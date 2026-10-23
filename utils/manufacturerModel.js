/**
 * 廠方型號（メーカー型番 / MPN）抽取（mzakka）
 * ============================================================
 * mzakka 多數將廠方型號寫喺商品頁 <title> 結尾（| 前），例如
 * 「グリコケミカル ... GLCM-002 | M-ZAKKA」。亦有啲寫喺名中間。
 * 常見格式：GLCM-002、Ligre-0238（字母-數字）或 UHTP361（字母+數字）。
 */

// 候選型號：
//  1) 字母段 + 連字號 + 文數段：GLCM-002 / Ligre-0238 / TYPE-AB1
//  2) 純字母緊貼 2+ 位數字：UHTP361
// 兩邊須為非「文數/連字號」邊界
const MODEL_RE =
  /(?<![A-Za-z0-9-])(?:[A-Za-z]{2,}[-][A-Za-z0-9]{1,}|[A-Za-z]{2,}[0-9]{2,})(?![A-Za-z0-9-])/g;

function normalizeWidth(s) {
  if (s == null) return '';
  return String(s)
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
}

function stripMzakkaSuffix(title) {
  // 去掉「| ... M-ZAKKA ...」網站後綴
  return String(title).split('|')[0];
}

function looksLikeCapacity(token) {
  // 50ml / 100ml / 10,000mg 等唔算型號
  return /^[0-9][0-9,.]*(ml|mg|g|kg|mm|cm|m|l)\b/i.test(token);
}

/**
 * @param {string} titleOrName 商品標題（可含 | 後綴）
 * @param {{ownCode?:string}} [opts] ownCode = mzakka 自己商品編號，要排除
 * @returns {string|null}
 */
function extractManufacturerModel(titleOrName, opts = {}) {
  if (titleOrName == null) return null;
  const ownCode = opts.ownCode ? String(opts.ownCode) : null;

  const core = stripMzakkaSuffix(normalizeWidth(titleOrName));

  // 先由尾行最後一個 token 揾（最常見、最可信）
  const tokens = core.split(/[\s\t]+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (looksLikeCapacity(t)) continue;
    const m = t.match(MODEL_RE);
    if (m) {
      const code = m[m.length - 1];
      if (code !== ownCode) return code;
    }
  }

  // fallback：型號可能黏喺日文/符號中間，喺整段做一次全域比對
  const all = core.match(MODEL_RE);
  if (all) {
    for (const code of all) {
      if (code !== ownCode && !looksLikeCapacity(code)) return code;
    }
  }
  return null;
}

module.exports = { extractManufacturerModel };
