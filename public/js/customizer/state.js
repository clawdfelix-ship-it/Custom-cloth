(function attachCustomizerState(global) {
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createCustomizerStore(initialState = {}) {
    let state = {
      catalog: {
        productTypes: [],
        templateFamilies: [],
        templates: [],
        templateFamiliesByProductType: {},
        assets: [],
      },
      selectedProductType: null,
      selectedTemplateFamily: null,
      familyDetail: {
        partVariants: {},
        colorZones: [],
        defaultPartSelection: {},
        palette: [],
      },
      design: {
        parts: {
          body: null,
          sleeve: null,
          collar: null,
        },
        colorZones: {
          primary: '#f4f4f5',
          secondary: '#7f1d45',
          trim: '#fbbf24',
        },
        currentView: 'front',
        texts: {},
        logos: [],
        notes: '',
      },
      roster: {
        items: [],
        totalQuantity: 0,
      },
      uploadedAssets: [],
      previews: {
        activeSide: 'front',
        front: null,
        back: null,
      },
      pricing: {},
      deliverable: {},
      submission: {
        phase: 'idle',
        error: null,
      },
      session: null,
      ...initialState,
    };

    const listeners = new Set();

    function notify() {
      const snapshot = clone(state);
      listeners.forEach((listener) => listener(snapshot));
    }

    return {
      getState() {
        return clone(state);
      },
      setState(patch) {
        state = {
          ...state,
          ...patch,
        };
        notify();
      },
      update(updater) {
        state = updater(clone(state));
        notify();
      },
      subscribe(listener) {
        listeners.add(listener);
        return function unsubscribe() {
          listeners.delete(listener);
        };
      },
    };
  }

  global.CustomizerState = {
    createCustomizerStore,
  };
})(window);
