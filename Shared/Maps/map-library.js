(function () {
  "use strict";
  const md = window.DnDCore.markdown;
  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const locale = window.DnDCore.locale;
  const headings = window.DnDCore.contentSchema.MAP;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader({
    indexGlobal: "MAPS_LIBRARY_INDEX", mdGlobal: "__MAPS_MD__",
    defaultSourcesJs: "demo/maps-sources.js",
    clearGlobals: function () { delete window.MAPS_LIBRARY_INDEX; delete window.__MAPS_MD__; },
  });
  const state = { lang: "en", page: 1, grid: "" };
  let entries = [];

  function section(text, key) {
    const args = [text].concat(headings[key] || []);
    return md.sectionAnyHeading.apply(md, args);
  }

  function parseLang(text, lang) {
    const info = md.parseBoldFields(section(text, "mapInfo"));
    const desc = section(text, "description");
    const dm = section(text, "dmNotes");
    const image = info.Image || info["Зображення"] || "";
    const grid = info["Grid template"] || info["Шаблон сітки"] || "";
    const scale = info.Scale || info["Масштаб"] || "";
    return {
      title: md.titleForLocale(text, lang),
      image: image, gridTemplate: grid, scale: scale, description: desc, dm: dm,
    };
  }

  function assembleMap(slug, texts) {
    const en = parseLang(texts.en, "en");
    const ua = texts.ua.trim()
      ? parseLang(texts.ua, "ua")
      : locale.mergeWithFallback(en, {});
    return { slug: slug, en: en, ua: ua };
  }

  function renderMap(entry) {
    const b = entry[state.lang] || entry.en;
    const gridPath = state.grid || (b.gridTemplate ? "../../../_shared/battlefield-templates/" + b.gridTemplate : "");
    let html = '<article class="entity-card"><h2>' + esc(b.title) + "</h2>";
    if (b.scale) html += "<p><em>" + esc(b.scale) + "</em></p>";
    if (b.image) {
      html += '<div class="map-viewport"><img src="' + esc(b.image) + '" alt="' + esc(b.title) + '"/>';
      if (gridPath) html += '<object class="grid-overlay" type="image/svg+xml" data="' + esc(gridPath) + '"></object>';
      html += "</div>";
    }
    if (b.description) html += "<p>" + esc(b.description) + "</p>";
    if (b.dm) html += '<div class="dm-notes-block"><h3>DM Notes</h3><p>' + esc(b.dm) + "</p></div>";
    return html + "</article>";
  }

  function renderPage() {
    const uiEl = ui.defaultUi("map-library");
    const idx = Math.max(0, state.page - 1);
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderMap(entries[idx]);
    uiEl.pageInfo.textContent = (idx + 1) + " of " + entries.length;
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= entries.length - 1;
  }

  async function bootstrap() {
    ui.initBookChrome("maps", function (l) { state.lang = l; renderPage(); });
    state.lang = shell.parseUrlParams().lang;
    document.getElementById("grid-select").addEventListener("change", function (e) {
      state.grid = e.target.value;
      renderPage();
    });
    const uiEl = ui.defaultUi("map-library");
    try {
      const config = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "maps", indexFileName: "maps-index.json",
        demoIndex: "demo/maps-index.json", sourcesJs: "demo/maps-sources.js",
      });
      entries = await loader.loadData(config, false, assembleMap);
      document.getElementById("list-nav").innerHTML = entries.map(function (e, i) {
        return '<button type="button" class="bookmark-btn">' + esc((e[state.lang] || e.en).title) + "</button>";
      }).join("");
      document.getElementById("list-nav").querySelectorAll(".bookmark-btn").forEach(function (btn, i) {
        btn.addEventListener("click", function () { state.page = i + 1; renderPage(); });
      });
      renderPage();
      ui.bindPagination(state, uiEl, renderPage, function () { return entries.length; });
    } catch (err) { ui.setError(uiEl, "Failed to load maps", esc(err.message)); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
