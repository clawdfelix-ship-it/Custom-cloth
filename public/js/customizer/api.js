(function attachCustomizerApi(global) {
  async function request(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload && payload.error ? payload.error : 'Customizer API error');
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  global.CustomizerApi = {
    fetchCatalog() {
      return request('/api/customizer/catalog');
    },
    fetchTemplates(productTypeId) {
      return request(`/api/customizer/product-types/${productTypeId}/templates`);
    },
    fetchTemplate(templateId) {
      return request(`/api/customizer/templates/${templateId}`);
    },
    fetchAssets(filters = {}) {
      const params = new URLSearchParams();
      if (filters.productTypeId) params.set('productTypeId', filters.productTypeId);
      if (filters.templateId) params.set('templateId', filters.templateId);
      if (filters.assetType) params.set('assetType', filters.assetType);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return request(`/api/customizer/assets${suffix}`);
    },
    createSession(payload) {
      return request('/api/customizer/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });
    },
    fetchSession(sessionId) {
      return request(`/api/customizer/sessions/${sessionId}`);
    },
    saveDesign(sessionId, payload, selection = {}) {
      return request(`/api/customizer/sessions/${sessionId}/design`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productTypeId: selection.productTypeId ?? null,
          templateId: selection.templateId ?? null,
          design: payload || {},
        }),
      });
    },
    saveRoster(sessionId, items) {
      return request(`/api/customizer/sessions/${sessionId}/roster`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items || [] }),
      });
    },
    savePreviews(sessionId, previews) {
      return request(`/api/customizer/sessions/${sessionId}/previews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previews: previews || {} }),
      });
    },
    submitSession(sessionId, payload) {
      return request(`/api/customizer/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });
    },
  };
})(window);
