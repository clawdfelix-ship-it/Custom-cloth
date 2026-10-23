function normalizeTemplateZone(zone = {}) {
  const zoneKey = String(zone.zoneKey || zone.zone_key || '').trim();
  const zoneName = String(zone.zoneName || zone.zone_name || zoneKey).trim();
  const rules = zone.rules && typeof zone.rules === 'object' ? { ...zone.rules } : {};

  return {
    zoneKey,
    zoneName,
    status: String(zone.status || 'active'),
    sortOrder: Number.isFinite(Number(zone.sortOrder ?? zone.sort_order))
      ? Number(zone.sortOrder ?? zone.sort_order)
      : 0,
    allowColor: zone.allowColor ?? zone.allow_color ?? rules.allowColor ?? true,
    allowPattern: zone.allowPattern ?? zone.allow_pattern ?? rules.allowPattern ?? false,
    allowLogo: zone.allowLogo ?? zone.allow_logo ?? rules.allowLogo ?? false,
    allowText: zone.allowText ?? zone.allow_text ?? rules.allowText ?? false,
    bounds: zone.bounds || zone.bounds_json || null,
    safeArea: zone.safeArea || zone.safe_area || null,
    defaultValues: zone.defaultValues || zone.default_values_json || {},
  };
}

function validateRosterItems(items = []) {
  const normalizedItems = [];
  const errors = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] || {};
    const normalized = {
      playerName: String(item.playerName || item.player_name || '').trim(),
      playerNumber: String(item.playerNumber || item.player_number || '').trim(),
      sizeCode: String(item.sizeCode || item.size_code || '').trim().toUpperCase(),
      quantity: Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
        ? Number(item.quantity)
        : 1,
      sortOrder: Number.isFinite(Number(item.sortOrder ?? item.sort_order))
        ? Number(item.sortOrder ?? item.sort_order)
        : index,
      meta: item.meta && typeof item.meta === 'object' ? { ...item.meta } : {},
    };

    if (!normalized.playerName) errors.push({ index, field: 'playerName', code: 'required' });
    if (!normalized.playerNumber) errors.push({ index, field: 'playerNumber', code: 'required' });
    if (!normalized.sizeCode) errors.push({ index, field: 'sizeCode', code: 'required' });

    normalizedItems.push(normalized);
  }

  const totalQuantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  return {
    valid: errors.length === 0,
    errors,
    normalizedItems,
    totalQuantity,
  };
}

module.exports = {
  normalizeTemplateZone,
  validateRosterItems,
};
