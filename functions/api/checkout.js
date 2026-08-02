// POST /api/checkout — creates a Stripe Checkout Session for one Printify variant.
// Secret keys never leave this server-side function.
const PRINTIFY_BASE = "https://api.printify.com/v1";
const STRIPE_BASE = "https://api.stripe.com/v1";

async function getShopId(env) {
  if (env.PRINTIFY_SHOP_ID) return env.PRINTIFY_SHOP_ID;
  const res = await fetch(`${PRINTIFY_BASE}/shops.json`, {
    headers: { Authorization: `Bearer ${env.PRINTIFY_API_TOKEN}` },
  });
  const shops = await res.json();
  return shops[0].id;
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const product_id = String(body.product_id || "");
    const variant_id = parseInt(body.variant_id, 10);
    const quantity = Math.min(Math.max(parseInt(body.quantity, 10) || 1, 1), 10); // basic input validation, cap at 10

    if (!product_id || !variant_id) {
      return new Response(JSON.stringify({ error: "product_id and variant_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const shopId = await getShopId(env);
    const pRes = await fetch(`${PRINTIFY_BASE}/shops/${shopId}/products.json`, {
      headers: { Authorization: `Bearer ${env.PRINTIFY_API_TOKEN}` },
    });
    const pData = await pRes.json();
    const product = (pData.data || pData).find((p) => String(p.id) === product_id);
    if (!product) {
      return new Response(JSON.stringify({ error: "Product not found" }), { status: 404 });
    }
    const variant = (product.variants || []).find((v) => v.id === variant_id && v.is_enabled && v.is_available);
    if (!variant) {
      return new Response(JSON.stringify({ error: "Selected size/variant is unavailable" }), { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", `${origin}/?session_id={CHECKOUT_SESSION_ID}#merch`);
    params.append("cancel_url", `${origin}/#merch`);
    params.append("shipping_address_collection[allowed_countries][]", "US");
    params.append("line_items[0][quantity]", String(quantity));
    params.append("line_items[0][price_data][currency]", "usd");
    params.append("line_items[0][price_data][unit_amount]", String(variant.price));
    params.append("line_items[0][price_data][product_data][name]", `${product.title} — ${variant.title}`);
    const img = product.images?.[0]?.src;
    if (img) params.append("line_items[0][price_data][product_data][images][0]", img);
    params.append("metadata[printify_product_id]", product_id);
    params.append("metadata[printify_variant_id]", String(variant_id));
    params.append("metadata[printify_shop_id]", String(shopId));
    params.append("metadata[quantity]", String(quantity));

    const sRes = await fetch(`${STRIPE_BASE}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = await sRes.json();
    if (!sRes.ok) {
      return new Response(JSON.stringify({ error: session.error?.message || "Stripe error" }), { status: 400 });
    }
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
