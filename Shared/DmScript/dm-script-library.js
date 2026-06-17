(function () {
  "use strict";
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const locale = window.DnDCore.locale;
  const headings = window.DnDCore.contentSchema.DM_SCRIPT;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader({
    indexGlobal: "DMSCRIPT_LIBRARY_INDEX", mdGlobal: "__DMSCRIPT_MD__",
    defaultSourcesJs: "demo/dm-script-sources.js",
    clearGlobals: function () { delete window.DMSCRIPT_LIBRARY_INDEX; delete window.__DMSCRIPT_MD__; },
  });
  const state = { lang: "en", page: 1 };
  let raws = [];

  function section(text, key) {
    const args = [text].concat(headings[key] || []);
    return md.sectionAnyHeading.apply(md, args);
  }

  function parseScene(text, lang) {
    return {
      title: md.titleForLocale(text, lang),
      summary: section(text, "summary"),
      readAloud: section(text, "readAloud"),
      checks: section(text, "checks"),
      contingencies: section(text, "contingencies"),
      dm: section(text, "dmNotes"),
    };
  }

  function assembleEntry(slug, texts) {
    const en = parseScene(texts.en, "en");
    const ua = texts.ua.trim()
      ? parseScene(texts.ua, "ua")
      : locale.mergeWithFallback(en, {});
    return { slug: slug, en: en, ua: ua };
  }

  function block(label, content, cls) {
    if (!content || !content.trim()) return "";
    const formatted = content.replace(/^>\s?/gm, "").trim();
    if (cls === "read-aloud") return '<div class="read-aloud"><strong>' + esc(label) + "</strong><p>" + mech.highlightDice(formatted) + "</p></div>";
    return '<div class="scene-block"><h3>' + esc(label) + "</h3><div>" + mech.highlightDice(formatted.replace(/\n- /g, "\n").replace(/^- /gm, "• ")) + "</div></div>";
  }

  function renderScene(scene) {
    let html = '<article class="entity-card"><h2>' + esc(scene.title) + "</h2>";
    html += block("Summary", scene.summary);
    html += block("Read-aloud", scene.readAloud, "read-aloud");
    html += block("Checks", scene.checks);
    html += block("Contingencies", scene.contingencies);
    html += block("DM Notes", scene.dm);
    return html + "</article>";
  }

  function entries() {
    return raws.map(function (r) { return assembleEntry(r.slug, r); });
  }

  function renderPage() {
    const list = entries();
    const uiEl = ui.defaultUi("dm-script-library");
    const idx = Math.max(0, state.page - 1);
    const entry = list[idx] || { en: {}, ua: {} };
    const scene = entry[state.lang] || entry.en || {};
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderScene(scene);
    uiEl.pageInfo.textContent = "Scene " + (idx + 1) + " of " + list.length;
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= list.length - 1;
  }

  function buildListNav() {
    document.getElementById("list-nav").innerHTML = entries().map(function (e) {
      const scene = e[state.lang] || e.en || {};
      return '<button type="button" class="bookmark-btn">' + esc(scene.title) + "</button>";
    }).join("");
    document.getElementById("list-nav").querySelectorAll(".bookmark-btn").forEach(function (btn, i) {
      btn.addEventListener("click", function () { state.page = i + 1; renderPage(); });
    });
  }

  async function bootstrap() {
    ui.initBookChrome("dm-script", function (l) { state.lang = l; buildListNav(); renderPage(); });
    state.lang = shell.parseUrlParams().lang;
    const uiEl = ui.defaultUi("dm-script-library");
    try {
      const config = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "dm-script", indexFileName: "dm-script-index.json",
        demoIndex: "demo/dm-script-index.json", sourcesJs: "demo/dm-script-sources.js",
      });
      raws = await loader.loadData(config, false, function (slug, texts) {
        return { slug: slug, en: texts.en, ua: texts.ua };
      });
      buildListNav();
      renderPage();
      ui.bindPagination(state, uiEl, renderPage, function () { return raws.length; });
    } catch (err) { ui.setError(uiEl, "Failed to load DM script", esc(err.message)); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
