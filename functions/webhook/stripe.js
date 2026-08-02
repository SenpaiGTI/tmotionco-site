// POST /webhook/stripe — Stripe fires this after successful payment.
// Verifies the signature, then creates + submits the order in Printify.
const PRINTIFY_BASE = "https://api.printify.com/v1";

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map((p) => p.split("=")));
  if (!parts.t || !parts.v1) return false;
  const signedPayload = `${parts.t}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Basic timing-safe-ish compare
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

async function printifyPost(env, shopId, path, body) {
  const res = await fetch(`${PRINTIFY_BASE}/shops/${shopId}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`Printify ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  return data;
}

export async function onRequestPost({ request, env }) {
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");

  const valid = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  let event;
  try { event = JSON.parse(payload); } catch { return new Response("Bad payload", { status: 400 }); }

  if (event.type !== "checkout.session.completed") {
    return new Response("ignored", { status: 200 });
  }

  const session = event.data.object;
  const meta = session.metadata || {};
  const shipping = session.shipping_details || session.customer_details || {};
  const addr = shipping.address || {};
  const nameParts = (shipping.name || "Customer").split(" ");

  try {
    const shopId = meta.printify_shop_id || env.PRINTIFY_SHOP_ID;

    const created = await printifyPost(env, shopId, "/orders.json", {
      external_id: session.id,
      label: `TMC-${session.id.slice(-8)}`,
      line_items: [
        {
          product_id: meta.printify_product_id,
          variant_id: parseInt(meta.printify_variant_id, 10),
          quantity: parseInt(meta.quantity || "1", 10),
        },
      ],
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: {
        first_name: nameParts[0] || "Customer",
        last_name: nameParts.slice(1).join(" ") || "",
        email: session.customer_details?.email || "",
        phone: session.customer_details?.phone || "",
        country: addr.country || "US",
        region: addr.state || "",
        address1: addr.line1 || "",
        address2: addr.line2 || "",
        city: addr.city || "",
        zip: addr.postal_code || "",
      },
    });

    // Draft orders don't fulfill on their own — explicitly submit to production.
    await printifyPost(env, shopId, `/orders/${created.id}/send_to_production.json`, null);

    return new Response("ok", { status: 200 });
  } catch (err) {
    // Return 500 so Stripe retries the webhook automatically (it retries on non-2xx).
    return new Response(`order creation failed: ${err.message}`, { status: 500 });
  }
}
