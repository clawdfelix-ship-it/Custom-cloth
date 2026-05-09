function csvEscape(s) {
  const v = String(s ?? '');
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function toCsv(rows, columns) {
  const cols = columns.slice();
  const header = cols.map((c) => csvEscape(c.header)).join(',');
  const lines = rows.map((r) => cols.map((c) => csvEscape(r[c.key])).join(','));
  return [header, ...lines].join('\n');
}

module.exports = { csvEscape, toCsv };

