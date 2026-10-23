function createTranslator({ dict }) {
  return function t(key, params) {
    const template = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (m, name) => {
      if (!Object.prototype.hasOwnProperty.call(params, name)) return m;
      return String(params[name]);
    });
  };
}

module.exports = { createTranslator };
