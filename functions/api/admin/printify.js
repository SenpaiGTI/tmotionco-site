// Protected admin utility for provisioning the Printify catalog.
// Requires header x-admin-key matching env.ADMIN_SECRET. Not linked anywhere in the UI.
const PRINTIFY_BASE = "https://api.printify.com/v1";

function authed(request, env) {
  return request.headers.get("x-admin-key") === env.ADMIN_SECRET && !!env.ADMIN_SECRET;
}

async function pf(env, path, options = {}) {
  const res = await fetch(`${PRINTIFY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`Printify ${path} -> ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
    err.data = data;
    throw err;
  }
  return data;
}

async function getShopId(env) {
  if (env.PRINTIFY_SHOP_ID) return env.PRINTIFY_SHOP_ID;
  const shops = await pf(env, "/shops.json");
  return shops[0].id;
}

export async function onRequestGet({ request, env }) {
  if (!authed(request, env)) return new Response("unauthorized", { status: 401 });
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "blueprints") {
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const all = await pf(env, "/catalog/blueprints.json");
      const filtered = search
        ? all.filter((b) => b.title.toLowerCase().includes(search))
        : all;
      return json(filtered.slice(0, 40).map((b) => ({ id: b.id, title: b.title, brand: b.brand, model: b.model })));
    }
    if (action === "providers") {
      const bpId = url.searchParams.get("blueprint_id");
      const providers = await pf(env, `/catalog/blueprints/${bpId}/print_providers.json`);
      return json(providers);
    }
    if (action === "variants") {
      const bpId = url.searchParams.get("blueprint_id");
      const providerId = url.searchParams.get("provider_id");
      const data = await pf(env, `/catalog/blueprints/${bpId}/print_providers/${providerId}/variants.json`);
      return json(data);
    }
    if (action === "products") {
      const shopId = await getShopId(env);
      const data = await pf(env, `/shops/${shopId}/products.json`);
      const list = data.data || data;
      return json(list.map((p) => ({ id: p.id, title: p.title, visible: p.visible })));
    }
    if (action === "delete_product") {
      const shopId = await getShopId(env);
      const productId = url.searchParams.get("product_id");
      await pf(env, `/shops/${shopId}/products/${productId}.json`, { method: "DELETE" });
      return json({ deleted: productId });
    }
    return json({ error: "unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message, data: err.data }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return new Response("unauthorized", { status: 401 });
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const body = await request.json();

  try {
    if (action === "upload") {
      // body: { file_name, contents (base64, no data: prefix) }
      const result = await pf(env, "/uploads/images.json", {
        method: "POST",
        body: JSON.stringify({ file_name: body.file_name, contents: body.contents }),
      });
      return json(result);
    }

    if (action === "create") {
      // body: { title, description, blueprint_id, print_provider_id, image_id,
      //         variant_ids: [ints], price_cents, tags:[...] , placement: 'front'|'default' }
      const shopId = await getShopId(env);
      const placement = body.placement || "front";
      const variants = body.variant_ids.map((id) => ({
        id,
        price: body.price_cents,
        is_enabled: true,
      }));
      const print_areas = [
        {
          variant_ids: body.variant_ids,
          placeholders: [
            {
              position: placement,
              images: [
                {
                  id: body.image_id,
                  x: 0.5,
                  y: body.image_y ?? 0.4,
                  scale: body.image_scale ?? 0.85,
                  angle: 0,
                },
              ],
            },
          ],
        },
      ];
      const product = await pf(env, `/shops/${shopId}/products.json`, {
        method: "POST",
        body: JSON.stringify({
          title: body.title,
          description: body.description,
          blueprint_id: body.blueprint_id,
          print_provider_id: body.print_provider_id,
          variants,
          print_areas,
          tags: body.tags || [],
        }),
      });
      return json(product);
    }

    return json({ error: "unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message, data: err.data }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
