function buildShellLocals(req) {
  return {
    user: req.session && req.session.userId ? { id: req.session.userId, isAdmin: !!req.session.isAdmin } : null,
    categories: [],
    categoryOptions: [],
    categoriesTree: [],
    categorySpecials: [],
    selectedCategorySlug: 'all',
    q: '',
    currentPath: req.path || '',
  };
}

module.exports = function registerCustomizerPages(app) {
  app.get('/customizer', (req, res) => {
    res.render('customizer/index', {
      title: '團體服訂製器 - OHYA2.0',
      ...buildShellLocals(req),
    });
  });

  app.get('/customizer/editor', (req, res) => {
    const bootstrap = {
      productTypeId: req.query.productTypeId || null,
      templateId: req.query.templateId || null,
      startMode: req.query.startMode || 'template',
    };

    res.render('customizer/editor', {
      title: '編輯團體服設計 - OHYA2.0',
      ...buildShellLocals(req),
      customizerBootstrap: bootstrap,
    });
  });

  app.get('/customizer/quote-success', (req, res) => {
    res.render('customizer/quote-success', {
      title: '報價提交完成 - OHYA2.0',
      ...buildShellLocals(req),
      quoteId: req.query.quoteId || null,
    });
  });

  app.get('/customizer/order-success', (req, res) => {
    res.render('customizer/order-success', {
      title: '訂單草稿已建立 - OHYA2.0',
      ...buildShellLocals(req),
      draftId: req.query.draftId || null,
    });
  });
};
