/**
 * JAN code 抽取（mzakka）
 * ============================================================
 * mzakka 嘅出廠 JAN code 唔喺規格表，而係以純文字埋喺商品描述入面，
 * 格式多為「JANコード：4571355635590」。本模組由描述 / raw_payload /
 * HTML 抽取有效 JAN（日本 45/49 開頭、13 位）。
 */

// JAN label：JAN / ＪＡＮ（全形）+ 可選「コード/Code」+ 冒號（半形/全形）或空白
// 全形字元先正規化，故呢度主要食半形
const LABEL_RE = /[JＪ][AＡ][NＮ](?:[\s　]*(?:コード|code))?[\s　:：]*?(?=[0-9])/gi;

// 13 位數字，前後須為非數字邊界（避免喺更長數字入面誤抓）
const DIGIT_RE = /(?<![0-9])([0-9]{13})(?![0-9])/g;

function normalizeWidth(s) {
  if (s == null) return '';
  return String(s)
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // 全形英數符號 → 半形
    .replace(/　/g, ' '); // 全形空格
}

/** 有效日本 JAN：13 位、45 或 49 開頭 */
function isValidJan(code) {
  return typeof code === 'string' && /^(?:45|49)[0-9]{11}$/.test(code);
}

/**
 * 由文字 / HTML 抽取所有 JAN（去重、保留首次出現順序）。
 * 只接受 label 後緊貼嘅有效 JAN。
 */
function extractJanCodes(source) {
  if (source == null) return [];
  const text = normalizeWidth(source);

  const found = [];
  let lm;
  LABEL_RE.lastIndex = 0;
  while ((lm = LABEL_RE.exec(text)) !== null) {
    // 由 label 完結位置起，向後搵緊貼嘅 13 位數字
    const tail = text.slice(lm.index + lm[0].length);
    DIGIT_RE.lastIndex = 0;
    const dm = DIGIT_RE.exec(tail);
    if (!dm) continue;
    // label 同數字之間唔好隔太多（容許少量空白，已被 label regex 食），
    // dm.index 應為 0（label regex 已食晒分隔符）
    if (dm.index !== 0) continue;
    const code = dm[1];
    if (isValidJan(code) && !found.includes(code)) found.push(code);
  }
  return found;
}

/** 回第一個有效 JAN 或 null */
function extractPrimaryJan(source) {
  const codes = extractJanCodes(source);
  return codes.length ? codes[0] : null;
}

module.exports = {
  extractJanCodes,
  extractPrimaryJan,
  isValidJan,
};
