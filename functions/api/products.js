// GET /api/products — server-side only Printify call (Printify has no CORS support)
const PRINTIFY_BASE = "https://api.printify.com/v1";

async function getShopId(env) {
  if (env.PRINTIFY_SHOP_ID) return env.PRINTIFY_SHOP_ID;
  const res = await fetch(`${PRINTIFY_BASE}/shops.json`, {
    headers: { Authorization: `Bearer ${env.PRINTIFY_API_TOKEN}` },
  });
  const shops = await res.json();
  if (!Array.isArray(shops) || !shops.length) throw new Error("No Printify shop connected");
  return shops[0].id;
}

export async function onRequestGet({ env }) {
  try {
    const shopId = await getShopId(env);
    const res = await fetch(`${PRINTIFY_BASE}/shops/${shopId}/products.json`, {
      headers: { Authorization: `Bearer ${env.PRINTIFY_API_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Printify products fetch failed (${res.status})`);
    const data = await res.json();
    const list = data.data || data;

    // Only publish what the storefront needs. Keep raw Printify payload server-side.
    const products = list
      .filter((p) => p.visible !== false)
      .map((p) => ({
        id: p.id,
        title: p.title,
        description: (p.description || "").replace(/<[^>]*>/g, "").slice(0, 220),
        images: (p.images || []).filter((i) => i.is_default || true).slice(0, 6).map((i) => i.src),
        variants: (p.variants || [])
          .filter((v) => v.is_enabled && v.is_available)
          .map((v) => ({ id: v.id, title: v.title, price: v.price })),
      }))
      .filter((p) => p.variants.length > 0);

    return new Response(JSON.stringify({ shop_id: shopId, products }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=120" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
