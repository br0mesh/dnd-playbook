(function (global) {
  "use strict";

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function pageBaseUrl() {
    return new URL("./", global.location.href).href;
  }

  function indexBaseUrl(indexUrl) {
    return new URL("./", new URL(indexUrl, pageBaseUrl())).href;
  }

  function isLocalDevHost() {
    const h = global.location && global.location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
  }

  function effectiveCacheBust(bustCache) {
    return bustCache || isLocalDevHost();
  }

  function withCacheBust(url, bust) {
    if (!effectiveCacheBust(bust)) return url;
    const sep = url.indexOf("?") >= 0 ? "&" : "?";
    return url + sep + "t=" + Date.now();
  }

  const FETCH_RETRIES = 3;
  const FETCH_RETRY_MS = 150;

  function fetchRetryDelay(attempt) {
    return new Promise(function (resolve) {
      global.setTimeout(resolve, FETCH_RETRY_MS * attempt);
    });
  }

  async function fetchResponse(url, bustCache) {
    let lastErr = null;
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
      try {
        const resp = await fetch(withCacheBust(url, bustCache), {
          cache: bustCache ? "no-store" : "default",
        });
        if (resp.ok || resp.status === 404) return resp;
        lastErr = new Error("HTTP " + resp.status + " loading " + url);
      } catch (err) {
        lastErr = err;
      }
      if (attempt < FETCH_RETRIES) await fetchRetryDelay(attempt);
    }
    throw lastErr || new Error("Failed to load " + url);
  }

  async function fetchText(url, bustCache) {
    const bust = effectiveCacheBust(bustCache);
    const resp = await fetchResponse(url, bust);
    if (!resp.ok) {
      throw new Error("HTTP " + resp.status + " loading " + url);
    }
    return resp.text();
  }

  async function fetchTextOptional(url, bustCache) {
    const resp = await fetchResponse(url, bustCache);
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
      item: params.get("item") || "",
      rarity: params.get("rarity") || "",
      type: params.get("type") || "",
      character: params.get("character") || "",
      monster: params.get("monster") || "",
      npc: params.get("npc") || "",
      scene: params.get("scene") || "",
      branch: params.get("branch") || "",
      option: params.get("option") || "",
    };
  }

  function buildQuery(overrides) {
    const base = parseUrlParams();
    const merged = Object.assign({}, base, overrides || {});
    const q = new URLSearchParams();
    if (merged.scenario) q.set("scenario", merged.scenario);
    if (merged.lang && merged.lang !== "en") q.set("lang", merged.lang);
    if (merged.mode === "dm") q.set("mode", merged.mode);
    if (merged.index) q.set("index", merged.index);
    const s = q.toString();
    return s ? "?" + s : "";
  }

  /**
   * Shared index resolution for content modules.
   * opts: { rootEl, scenarioFolder, indexFileName, demoIndex }
   */
  function resolveModuleConfig(opts) {
    const root = opts.rootEl;
    const params = new URLSearchParams(global.location.search);
    const indexParam = params.get("index") || (root && root.getAttribute("data-index"));
    const scenarioParam = params.get("scenario") || (root && root.getAttribute("data-scenario"));
    const pollAttr = root && root.getAttribute("data-poll");

    let indexUrl = indexParam;

    if (!indexUrl && scenarioParam && scenarioParam !== "demo") {
      indexUrl = "../../scenarios/" + scenarioParam + "/" + opts.scenarioFolder + "/" + opts.indexFileName;
    }
    if (!indexUrl) {
      indexUrl = opts.demoIndex;
    }

    const poll = pollAttr !== "false";
    return {
      indexUrl: indexUrl,
      poll: poll,
      scenario: scenarioParam || "",
    };
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.shell = {
    esc: esc,
    pageBaseUrl: pageBaseUrl,
    indexBaseUrl: indexBaseUrl,
    withCacheBust: withCacheBust,
    fetchText: fetchText,
    fetchTextOptional: fetchTextOptional,
    slugFromIndexPath: slugFromIndexPath,
    parseUrlParams: parseUrlParams,
    buildQuery: buildQuery,
    resolveModuleConfig: resolveModuleConfig,
  };
})(typeof window !== "undefined" ? window : this);
