// Auth middleware shared across all API modules

function hasPermissionList(permissions, required) {
  if (!required) return true;
  const reqs = Array.isArray(required) ? required : [required];
  const perms = Array.isArray(permissions) ? permissions : [];
  if (perms.includes('*')) return true;

  return reqs.every((r) => {
    if (perms.includes(r)) return true;
    const idx = String(r).indexOf(':');
    if (idx > 0) {
      const prefix = String(r).slice(0, idx);
      if (perms.includes(prefix + ':*')) return true;
    }
    return false;
  });
}

function hasBackofficeAccess(session) {
  if (!session || !session.userId) return false;
  if (session.isAdmin) return true;
  return Boolean(session.isBackoffice && Array.isArray(session.adminPermissions) && session.adminPermissions.length > 0);
}

module.exports = {
  requireAuth: (req, res, next) => {
    if (req.session && req.session.userId) {
      // Attach user object to req for convenience
      if (req.session.userId) {
        // We can fetch user from DB if needed, but session already has basics
        req.user = {
          id: req.session.userId,
          isAdmin: req.session.isAdmin || false,
          permissions: req.session.adminPermissions || []
        };
      }
      return next();
    }
    res.status(401).json({ error: '需要登入' });
  },

  requireAdmin: (req, res, next) => {
    if (hasBackofficeAccess(req.session)) {
      req.user = {
        id: req.session.userId,
        isAdmin: !!req.session.isAdmin,
        permissions: req.session.adminPermissions || []
      };
      return next();
    }
    res.status(401).json({ error: '需要管理員權限' });
  },

  requirePermission: (required) => {
    return (req, res, next) => {
      if (!req.session || !req.session.userId || (!req.session.isAdmin && !req.session.isBackoffice)) {
        return res.status(401).json({ error: '需要管理員權限' });
      }
      req.user = {
        id: req.session.userId,
        isAdmin: !!req.session.isAdmin,
        permissions: req.session.adminPermissions || []
      };
      if (req.session.isAdmin) return next();
      if (!hasPermissionList(req.session.adminPermissions, required)) {
        return res.status(403).json({ error: '沒有權限' });
      }
      next();
    };
  },

  hasBackofficeAccess,
};
