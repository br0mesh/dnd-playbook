(function (global) {
  "use strict";

  const DEFAULT_LOCALE = "en";
  const SUPPORTED_LOCALES = ["en", "ua"];

  function localeFileName(slug, lang) {
    return String(slug) + "." + lang + ".md";
  }

  function resolveLocale(param) {
    return param === "ua" ? "ua" : "en";
  }

  function mergeWithFallback(enObj, uaObj) {
    const out = {};
    const keys = Object.keys(enObj || {});
    keys.forEach(function (key) {
      const uaVal = uaObj && uaObj[key];
      const enVal = enObj[key];
      if (uaVal != null && String(uaVal).trim() !== "") {
        out[key] = uaVal;
      } else {
        out[key] = enVal;
      }
    });
    Object.keys(uaObj || {}).forEach(function (key) {
      if (!(key in out) && uaObj[key] != null && String(uaObj[key]).trim() !== "") {
        out[key] = uaObj[key];
      }
    });
    return out;
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.locale = {
    DEFAULT_LOCALE: DEFAULT_LOCALE,
    SUPPORTED_LOCALES: SUPPORTED_LOCALES,
    localeFileName: localeFileName,
    resolveLocale: resolveLocale,
    mergeWithFallback: mergeWithFallback,
  };
})(typeof window !== "undefined" ? window : this);
