(function (global) {
  "use strict";

  const shell = global.DnDCore.shell;
  const locale = global.DnDCore.locale;

  function sortBySlug(list) {
    return list.slice().sort(function (a, b) {
      return a.slug.localeCompare(b.slug);
    });
  }

  function fingerprint(list) {
    return list.map(function (e) { return e.slug; }).sort().join("|");
  }

  function normalizeLocaleTexts(slug, cached) {
    if (cached && typeof cached === "object" && typeof cached.en === "string") {
      return { slug: slug, en: cached.en, ua: cached.ua || "" };
    }
    if (typeof cached === "string") {
      return { slug: slug, en: cached, ua: "" };
    }
    throw new Error("Missing markdown for " + slug);
  }

  function createLoader(opts) {
    const isObject = opts.isParsedObject || function (e) {
      return e && typeof e === "object" && typeof e.slug === "string";
    };

    async function loadLocaleTexts(slug, baseUrl, bustCache) {
      const enUrl = new URL(locale.localeFileName(slug, "en"), baseUrl).href;
      const uaUrl = new URL(locale.localeFileName(slug, "ua"), baseUrl).href;
      const en = await shell.fetchText(enUrl, bustCache);
      let ua = await shell.fetchTextOptional(uaUrl, bustCache);
      if (ua == null) {
        console.warn("[DnDCore] Missing UA locale for " + slug + ", falling back to EN");
        ua = "";
      }
      return { slug: slug, en: en, ua: ua };
    }

    async function loadFromMarkdownIndex(indexUrl, bustCache, assembleFn) {
      const indexText = await shell.fetchText(new URL(indexUrl, shell.pageBaseUrl()).href, bustCache);
      const index = JSON.parse(indexText);
      if (!Array.isArray(index)) throw new Error("Index must be a JSON array");
      if (index.length && isObject(index[0])) return sortBySlug(index);

      const base = shell.indexBaseUrl(indexUrl);
      const parsed = await Promise.all(
        index.map(async function (relPath) {
          const slug = shell.slugFromIndexPath(relPath);
          const texts = await loadLocaleTexts(slug, base, bustCache);
          return assembleFn(slug, texts);
        })
      );
      return sortBySlug(parsed);
    }

    async function loadFromLocalScripts(config, bustCache, assembleFn) {
      if (opts.clearGlobals) opts.clearGlobals();

      if (config.jsonUrl && opts.jsonOfflineGlobal) {
        const offlineJs = shell.jsonToOfflineJs(config.jsonUrl);
        await shell.loadScript(/\.js$/i.test(offlineJs) ? offlineJs : opts.defaultOfflineJs, bustCache);
        const data = global[opts.jsonOfflineGlobal];
        if (data && Array.isArray(data)) return sortBySlug(data);
        throw new Error("Expected " + opts.jsonOfflineGlobal);
      }

      const indexJs = shell.jsonToJsCompanion(config.indexUrl);
      await shell.loadScript(indexJs, bustCache);
      const index = global[opts.indexGlobal];
      if (!Array.isArray(index)) throw new Error("Expected " + opts.indexGlobal);

      if (index.length && isObject(index[0])) return sortBySlug(index);

      const sourcesJs = config.sourcesJs || opts.defaultSourcesJs;
      await shell.loadScript(sourcesJs, bustCache);
      const mdCache = global[opts.mdGlobal] || {};
      const parsed = index.map(function (relPath) {
        const slug = shell.slugFromIndexPath(relPath);
        const texts = normalizeLocaleTexts(slug, mdCache[slug]);
        return assembleFn(slug, texts);
      });
      return sortBySlug(parsed);
    }

    async function loadData(config, bustCache, assembleFn) {
      if (shell.isFileProtocol()) {
        return loadFromLocalScripts(config, bustCache, assembleFn);
      }
      return loadFromMarkdownIndex(config.indexUrl, bustCache, assembleFn);
    }

    return {
      sortBySlug: sortBySlug,
      fingerprint: fingerprint,
      loadData: loadData,
      loadLocaleTexts: loadLocaleTexts,
      normalizeLocaleTexts: normalizeLocaleTexts,
    };
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.loader = { createLoader: createLoader, fingerprint: fingerprint };
})(typeof window !== "undefined" ? window : this);
