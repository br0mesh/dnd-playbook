(function (global) {
  "use strict";

  const shell = global.DnDCore.shell;

  function sortBySlug(list) {
    return list.slice().sort(function (a, b) {
      return a.slug.localeCompare(b.slug);
    });
  }

  function fingerprint(list) {
    return list.map(function (e) { return e.slug; }).sort().join("|");
  }

  function createLoader(opts) {
    const isObject = opts.isParsedObject || function (e) {
      return e && typeof e === "object" && typeof e.slug === "string";
    };

    async function loadFromMarkdownIndex(indexUrl, bustCache, parseFn) {
      const indexText = await shell.fetchText(new URL(indexUrl, shell.pageBaseUrl()).href, bustCache);
      const index = JSON.parse(indexText);
      if (!Array.isArray(index)) throw new Error("Index must be a JSON array");
      if (index.length && isObject(index[0])) return sortBySlug(index);

      const base = shell.indexBaseUrl(indexUrl);
      const parsed = await Promise.all(
        index.map(async function (relPath) {
          const mdUrl = new URL(relPath, base).href;
          const text = await shell.fetchText(mdUrl, bustCache);
          return parseFn(shell.slugFromIndexPath(relPath), text);
        })
      );
      return sortBySlug(parsed);
    }

    async function loadFromLocalScripts(config, bustCache, parseFn) {
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
        const text = mdCache[slug];
        if (!text) throw new Error("Missing markdown for " + slug);
        return parseFn(slug, text);
      });
      return sortBySlug(parsed);
    }

    async function loadData(config, bustCache, parseFn) {
      if (shell.isFileProtocol()) {
        return loadFromLocalScripts(config, bustCache, parseFn);
      }
      return loadFromMarkdownIndex(config.indexUrl, bustCache, parseFn);
    }

    return {
      sortBySlug: sortBySlug,
      fingerprint: fingerprint,
      loadData: loadData,
    };
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.loader = { createLoader: createLoader, fingerprint: fingerprint };
})(typeof window !== "undefined" ? window : this);
