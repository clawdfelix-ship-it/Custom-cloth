function mapDbProductToStorefrontProduct(row, { toProxyUrl }) {
  const id = row && row.id != null ? Number(row.id) : null;
  const name = row && row.name != null ? String(row.name) : '';
  const description = row && row.description != null ? String(row.description) : '';
  const category = row && row.category_name ? String(row.category_name) : '未分類';
  const categorySlug = row && row.category_slug ? String(row.category_slug) : null;

  const price = row && row.price_cents != null ? Number(row.price_cents) : 0;
  const originalPrice = row && row.original_price_cents != null ? Number(row.original_price_cents) : null;

  const stock = row && row.stock != null ? Number(row.stock) : 0;

  const imageUrl = row && row.image_url ? String(row.image_url) : null;
  let gallery = [];
  const galleryRaw = row && row.gallery_images != null ? row.gallery_images : null;
  if (Array.isArray(galleryRaw)) {
    gallery = galleryRaw;
  } else if (typeof galleryRaw === 'string' && galleryRaw.trim()) {
    try {
      const parsed = JSON.parse(galleryRaw);
      if (Array.isArray(parsed)) gallery = parsed;
    } catch (_) {}
  }

  const basePrefix = imageUrl
    ? (String(imageUrl).match(/^(https?:\/\/i\.mzakka\.com\/item\/[^/]+\/)/i) || [])[1] || null
    : null;

  const candidates = [];
  if (imageUrl) candidates.push(imageUrl);
  for (const v of gallery) candidates.push(v);

  const filtered = [];
  const seen = new Set();
  for (const v of candidates) {
    const u = v != null ? String(v).trim() : '';
    if (!u) continue;

    const ok = basePrefix
      ? u.startsWith(basePrefix)
      : /https?:\/\/i\.mzakka\.com\/imgs\/[a-f0-9]{32}\.(jpg|jpeg|png|webp|gif)/i.test(u);

    if (!ok) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    filtered.push(u);
    if (filtered.length >= 12) break;
  }

  const images = filtered.map(u => toProxyUrl(u));

  const image = images[0] || (imageUrl ? toProxyUrl(imageUrl) : null);

  return {
    id,
    name,
    description,
    category,
    categorySlug,
    price,
    originalPrice,
    stock,
    image,
    images,
  };
}

module.exports = { mapDbProductToStorefrontProduct };
