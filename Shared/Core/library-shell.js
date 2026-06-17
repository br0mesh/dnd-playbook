(function (global) {
  "use strict";

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function isFileProtocol() {
    return global.location.protocol === "file:";
  }

  function pageBaseUrl() {
    return new URL("./", global.location.href).href;
  }

  function indexBaseUrl(indexUrl) {
    return new URL("./", new URL(indexUrl, pageBaseUrl())).href;
  }

  function withCacheBust(url, bust) {
    if (!bust) return url;
    const sep = url.indexOf("?") >= 0 ? "&" : "?";
    return url + sep + "t=" + Date.now();
  }

  function jsonToJsCompanion(path) {
    return /\.json$/i.test(path) ? path.replace(/\.json$/i, ".js") : path;
  }

  function jsonToOfflineJs(path, suffix) {
    suffix = suffix || "-offline.js";
    if (/\.json$/i.test(path)) return path.replace(/\.json$/i, suffix);
    return path;
  }

  function loadScript(relativePath, bustCache) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = withCacheBust(new URL(relativePath, pageBaseUrl()).href, bustCache);
      s.onload = function () { resolve(); };
      s.onerror = function () {
        reject(new Error("Failed to load script " + relativePath));
      };
      document.head.appendChild(s);
    });
  }

  async function fetchText(url, bustCache) {
    const resp = await fetch(withCacheBust(url, bustCache), { cache: bustCache ? "no-store" : "default" });
    if (!resp.ok) {
      throw new Error("HTTP " + resp.status + " loading " + url);
    }
    return resp.text();
  }

  async function fetchTextOptional(url, bustCache) {
    const resp = await fetch(withCacheBust(url, bustCache), { cache: bustCache ? "no-store" : "default" });
    if (resp.status === 404) return null;
    if (!resp.ok) {
      throw new Error("HTTP " + resp.status + " loading " + url);
    }
    return resp.text();
  }

  function slugFromIndexPath(relPath) {
    return String(relPath)
      .replace(/^.*\//, "")
      .replace(/\.(en|ua)\.md$/i, "")
      .replace(/\.md$/i, "");
  }

  function parseUrlParams() {
    const params = new URLSearchParams(global.location.search);
    return {
      scenario: params.get("scenario") || "",
      section: params.get("section") || "",
      lang: params.get("lang") === "ua" ? "ua" : "en",
      mode: params.get("mode") === "dm" ? "dm" : "player",
      index: params.get("index") || "",
    };
  }

  function buildQuery(overrides) {
    const base = parseUrlParams();
    const merged = Object.assign({}, base, overrides || {});
    const q = new URLSearchParams();
    if (merged.scenario) q.set("scenario", merged.scenario);
    if (merged.lang && merged.lang !== "en") q.set("lang", merged.lang);
    if (merged.mode === "dm") q.set("mode", "dm");
    if (merged.index) q.set("index", merged.index);
    const s = q.toString();
    return s ? "?" + s : "";
  }

  /**
   * Shared index resolution for content modules.
   * opts: { rootEl, scenarioFolder, indexFileName, demoIndex, sourcesJs, dataJsonParam }
   */
  function resolveModuleConfig(opts) {
    const root = opts.rootEl;
    const params = new URLSearchParams(global.location.search);
    const indexParam = params.get("index") || (root && root.getAttribute("data-index"));
    const scenarioParam = params.get("scenario") || (root && root.getAttribute("data-scenario"));
    const pollAttr = root && root.getAttribute("data-poll");
    const jsonParam = opts.dataJsonParam && params.get(opts.dataJsonParam);

    let indexUrl = indexParam;
    let sourcesJs = null;

    if (!indexUrl && !jsonParam && scenarioParam && scenarioParam !== "demo") {
      indexUrl = "../../scenarios/" + scenarioParam + "/" + opts.scenarioFolder + "/" + opts.indexFileName;
      sourcesJs = indexUrl.replace(/\.json$/i, "-sources.js");
    }
    if (!indexUrl && !jsonParam) {
      indexUrl = opts.demoIndex;
      sourcesJs = opts.sourcesJs || opts.demoIndex.replace(/\.json$/i, "-sources.js").replace("-index", "-sources");
    }

    const poll = pollAttr !== "false" && !isFileProtocol();
    return {
      jsonUrl: jsonParam,
      indexUrl: indexUrl,
      sourcesJs: sourcesJs,
      poll: poll,
      scenario: scenarioParam || "",
    };
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.shell = {
    esc: esc,
    isFileProtocol: isFileProtocol,
    pageBaseUrl: pageBaseUrl,
    indexBaseUrl: indexBaseUrl,
    withCacheBust: withCacheBust,
    jsonToJsCompanion: jsonToJsCompanion,
    jsonToOfflineJs: jsonToOfflineJs,
    loadScript: loadScript,
    fetchText: fetchText,
    fetchTextOptional: fetchTextOptional,
    slugFromIndexPath: slugFromIndexPath,
    parseUrlParams: parseUrlParams,
    buildQuery: buildQuery,
    resolveModuleConfig: resolveModuleConfig,
  };
})(typeof window !== "undefined" ? window : this);
