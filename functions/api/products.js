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

// Picks one representative photo per variant: prefers that variant's own
// front-facing shot, falls back to any shot tagged with it, then the
// product's default image. Keeps the payload to exactly one image per
// sellable variant instead of shipping every camera angle to the browser.
function buildVariantImageMap(images) {
  const byVariant = {};
  const defaultImg = images.find((i) => i.is_default) || images[0];
  for (const img of images) {
    for (const vid of img.variant_ids || []) {
      const existing = byVariant[vid];
      if (!existing || (img.position === "front" && existing.position !== "front")) {
        byVariant[vid] = img;
      }
    }
  }
  return { byVariant, defaultImg };
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

    const products = list
      .filter((p) => p.visible !== false)
      .map((p) => {
        const images = p.images || [];
        const { byVariant, defaultImg } = buildVariantImageMap(images);

        const sellable = (p.variants || []).filter((v) => v.is_enabled && v.is_available);
        if (!sellable.length) return null;

        // Whichever variant the product's default (cover) photo represents
        // goes first, so the dropdown's initial selection always matches
        // the picture actually shown.
        const defaultVariantId = defaultImg?.variant_ids?.[0];
        sellable.sort((a, b) => {
          if (a.id === defaultVariantId) return -1;
          if (b.id === defaultVariantId) return 1;
          return 0;
        });

        const variantImages = {};
        for (const v of sellable) {
          const img = byVariant[v.id] || defaultImg;
          if (img) variantImages[v.id] = img.src;
        }

        return {
          id: p.id,
          title: p.title,
          description: (p.description || "").replace(/<[^>]*>/g, "").slice(0, 220),
          variants: sellable.map((v) => ({ id: v.id, title: v.title, price: v.price })),
          variantImages,
        };
      })
      .filter(Boolean);

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
