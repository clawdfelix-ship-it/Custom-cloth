function normalizeHeader(s) {
  return String(s || '').trim().toUpperCase();
}

function detectDelimiter(text) {
  if (text.includes('\t')) return '\t';
  if (text.includes(',')) return ',';
  return '';
}

function splitLines(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x);
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (!inQ && ch === ',') {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function splitRow(line, delim) {
  if (delim === ',') return parseCsvLine(line);
  return line.split(delim).map((x) => String(x || '').trim());
}

function mapHeaderToKey(h) {
  const x = normalizeHeader(h);
  const map = {
    EU: 'eu',
    'EU SIZE': 'eu',
    SIZE: 'eu',
    '國際尺碼': 'eu',
    '國際尺碼(EU)': 'eu',
    '尺碼': 'eu',

    CHEST: 'chest',
    '胸圍': 'chest',
    '胸圍(CM)': 'chest',
    '胸圍CM': 'chest',

    WAIST: 'waist',
    '腰圍': 'waist',
    '腰圍(CM)': 'waist',
    '腰圍CM': 'waist',

    LENGTH: 'length',
    '衣長': 'length',
    '衣長(CM)': 'length',
    '衣長CM': 'length',

    CHINA: 'china',
    'CHINA SIZE': 'china',
    '中國尺碼': 'china',
    '中國尺碼(HEIGHT/CHEST)': 'china',

    HEIGHT: 'height',
    'SUGGESTED HEIGHT': 'height',
    '適用身高範圍': 'height'
  };
  return map[x] || '';
}

function parseSizeTableText(text, opts) {
  const header = !!(opts && opts.header);
  const lines = splitLines(text);
  if (!lines.length) return { ok: false, error: 'empty', rows: [], mapping: null };

  const delim = detectDelimiter(lines[0]);
  if (!delim) return { ok: false, error: 'delimiter', rows: [], mapping: null };

  const matrix = lines.map((ln) => splitRow(ln, delim));
  const mapping = { eu: -1, chest: -1, waist: -1, length: -1, china: -1, height: -1 };

  let start = 0;
  if (header) {
    const heads = matrix[0];
    heads.forEach((h, idx) => {
      const k = mapHeaderToKey(h);
      if (k && mapping[k] === -1) mapping[k] = idx;
    });
    start = 1;
  } else {
    mapping.eu = 0;
    mapping.chest = 1;
    mapping.waist = 2;
    mapping.length = 3;
    mapping.china = 4;
    mapping.height = 5;
  }

  const need = Object.entries(mapping)
    .filter(([, idx]) => idx < 0)
    .map(([k]) => k);
  if (need.length) return { ok: false, error: 'missing_columns', rows: [], mapping };

  const rows = [];
  for (let i = start; i < matrix.length; i++) {
    const r = matrix[i];
    const get = (k) => String(r[mapping[k]] || '').trim();
    const eu = get('eu');
    if (!eu) continue;
    rows.push({ eu, chest: get('chest'), waist: get('waist'), length: get('length'), china: get('china'), height: get('height') });
  }

  if (!rows.length) return { ok: false, error: 'no_rows', rows: [], mapping };
  return { ok: true, error: '', rows, mapping };
}

module.exports = { parseSizeTableText };

