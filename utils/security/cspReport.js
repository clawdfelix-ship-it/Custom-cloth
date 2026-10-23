function safeUrl(u) {
  if (!u) return '';
  try {
    const x = new URL(String(u));
    return x.origin + x.pathname;
  } catch {
    return '';
  }
}

function normalizeCspReports(body) {
  const out = [];

  if (body && typeof body === 'object' && body['csp-report']) {
    const r = body['csp-report'];
    out.push({
      type: 'csp-report',
      blockedUri: safeUrl(r['blocked-uri']),
      violatedDirective: String(r['violated-directive'] || ''),
      effectiveDirective: String(r['effective-directive'] || ''),
      sourceFile: safeUrl(r['source-file']),
      disposition: String(r.disposition || 'report'),
    });
    return out;
  }

  if (Array.isArray(body)) {
    for (const item of body) {
      const r = item && (item.body || item['csp-report']);
      if (!r || typeof r !== 'object') continue;
      out.push({
        type: String(item.type || 'report'),
        blockedUri: safeUrl(r.blockedURL || r['blocked-uri']),
        violatedDirective: String(r.violatedDirective || r['violated-directive'] || ''),
        effectiveDirective: String(r.effectiveDirective || r['effective-directive'] || ''),
        sourceFile: safeUrl(r.sourceFile || r['source-file']),
        disposition: String(r.disposition || 'report'),
      });
    }
  }

  return out;
}

module.exports = { normalizeCspReports };

