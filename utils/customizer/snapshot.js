function createSnapshotRecord({ side, storageKey, mimeType = 'image/png', meta = {} }) {
  return {
    side: String(side || ''),
    storageKey: String(storageKey || ''),
    mimeType: String(mimeType || 'image/png'),
    meta: meta && typeof meta === 'object' ? { ...meta } : {},
  };
}

module.exports = {
  createSnapshotRecord,
};
