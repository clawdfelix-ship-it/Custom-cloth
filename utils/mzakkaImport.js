const crypto = require('node:crypto');
const { yenToHkd } = require('./currency');

function isPseudoCategory(name) {
  const s = String(name || '').trim();
  if (!s) return true;
  if (s.includes('新商品')) return true;
  if (s.includes('新規取扱')) return true;
  if (s.includes('注目商品')) return true;
  if (s.includes('ランキング')) return true;
  if (s.includes('上半期')) return true;
  if (s.includes('下半期')) return true;
  if (/\d{4}年/.test(s)) return true;
  return false;
}

function extractCategorySegments(category) {
  if (typeof category !== 'string') return ['未分類'];
  const parts = category
    .split(' > ')
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .filter((s) => !isPseudoCategory(s));
  return parts.length ? parts : ['未分類'];
}

function getRootCategoryName(category) {
  return extractCategorySegments(category)[0] || '未分類';
}

function getLeafCategoryName(category) {
  const segments = extractCategorySegments(category);
  return segments[segments.length - 1] || '未分類';
}

function makeCategorySlug(name) {
  const h = crypto.createHash('sha1').update(String(name || ''), 'utf8').digest('hex').slice(0, 16);
  return `mzakka-cat-${h}`;
}

function makeSourceKey(parts) {
  return (Array.isArray(parts) ? parts : [])
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' > ');
}

function makeProductSlug(mzakkaId) {
  return `mzakka-${String(mzakkaId || '').toLowerCase()}`;
}

function normalizeTextOrNull(value) {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t ? t : null;
}

function buildCategoryNodes(category) {
  const segments = extractCategorySegments(category);
  return segments.map((name, index) => ({
    name,
    source_key: makeSourceKey(segments.slice(0, index + 1)),
    source_parent_key: index > 0 ? makeSourceKey(segments.slice(0, index)) : null,
    depth: index,
  }));
}

function toProductUpsertInput(item, categoryId) {
  const name = String(item.name || '').trim();
  const description = normalizeTextOrNull(item.description);
  const images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
  const image_url = images[0] || null;
  const gallery_images = images;

  const name_zh_hk = name || '未命名商品';
  const description_zh_hk = description || name_zh_hk;

  return {
    name: name_zh_hk,
    name_zh_hk,
    slug: makeProductSlug(item.id),
    description,
    description_zh_hk,
    short_description_zh_hk: null,
    price: Number.isFinite(item.priceYen) ? yenToHkd(item.priceYen) : 0,
    original_price: Number.isFinite(item.originalPriceYen) ? yenToHkd(item.originalPriceYen) : null,
    category_id: categoryId,
    image_url,
    gallery_images,
    status: 'active',
    source: 'mzakka',
    source_key: String(item.id || '').trim() || null,
    source_url: normalizeTextOrNull(item.productUrl),
    sync_status: 'synced',
    raw_payload: item || null,
  };
}

function toSkuUpsertInput(item, productId) {
  return {
    product_id: productId,
    sku: String(item.id || ''),
    attributes: {},
    stock: 0,
    is_active: true,
  };
}

function toProductMediaRows(item, productId) {
  const images = Array.isArray(item && item.images) ? item.images.filter(Boolean) : [];
  return images.map((mediaUrl, index) => ({
    product_id: productId,
    media_url: String(mediaUrl),
    media_type: 'image',
    alt_text: normalizeTextOrNull(item && item.name),
    sort_order: index,
    source_key: `${String(item && item.id ? item.id : '').trim()}:image:${index}`,
  }));
}

function toProductSectionRows(item, productId) {
  const rows = [];
  const baseId = String(item && item.id ? item.id : '').trim();
  // 價格由本店 HKD 價位區顯示，唔收錄 mzakka 日元「販売価格」，避免產品頁重複/誤導
  const HIDDEN_INFO_LABELS = ['販売価格'];
  const infoRows = Array.isArray(item && item.productInfo)
    ? item.productInfo.filter((row) => row && !HIDDEN_INFO_LABELS.includes(String(row.label || '').trim()))
    : [];
  const sections = Array.isArray(item && item.sections) ? item.sections.filter(Boolean) : [];

  if (infoRows.length) {
    rows.push({
      product_id: productId,
      section_type: 'product_info',
      title: '商品情報',
      sort_order: 10,
      content_html: null,
      content_text: infoRows
        .map((row) => `${String(row.label || '').trim()}: ${String(row.value || '').trim()}`)
        .filter(Boolean)
        .join('\n'),
      content_json: { rows: infoRows },
      source_anchor: `${baseId}:product_info`,
    });
  }

  let nextSortOrder = 20;
  for (const section of sections) {
    rows.push({
      product_id: productId,
      section_type: normalizeTextOrNull(section.sectionType) || 'content',
      title: normalizeTextOrNull(section.title),
      sort_order: Number.isFinite(Number(section.sortOrder)) ? Number(section.sortOrder) : nextSortOrder,
      content_html: normalizeTextOrNull(section.contentHtml),
      content_text: normalizeTextOrNull(section.contentText),
      content_json: section.contentJson && typeof section.contentJson === 'object' ? section.contentJson : null,
      source_anchor: normalizeTextOrNull(section.sourceAnchor) || `${baseId}:section:${rows.length}`,
    });
    nextSortOrder += 10;
  }

  return rows;
}

module.exports = {
  buildCategoryNodes,
  extractCategorySegments,
  getLeafCategoryName,
  getRootCategoryName,
  makeCategorySlug,
  makeProductSlug,
  makeSourceKey,
  toProductUpsertInput,
  toProductMediaRows,
  toProductSectionRows,
  toSkuUpsertInput,
};
