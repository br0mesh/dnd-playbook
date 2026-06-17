(function () {
  "use strict";
  const md = window.DnDCore.markdown;
  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader({
    indexGlobal: "MAPS_LIBRARY_INDEX", mdGlobal: "__MAPS_MD__",
    defaultSourcesJs: "demo/maps-sources.js",
    clearGlobals: function () { delete window.MAPS_LIBRARY_INDEX; delete window.__MAPS_MD__; },
  });
  const state = { lang: "en", page: 1, grid: "" };
  let entries = [];

  function parseMap(slug, raw) {
    const split = md.splitBilingual(raw);
    function block(text, ua) {
      const info = md.parseBoldFields(md.sectionAnyHeading(text, "Map Info", "Інформація про карту"));
      const desc = md.sectionAnyHeading(text, "Description", "Опис");
      const dm = md.sectionAnyHeading(text, "DM Notes", "Нотатки Майстра");
      const image = info.Image || info["Зображення"] || "";
      const grid = info["Grid template"] || info["Шаблон сітки"] || "";
      const scale = info.Scale || info["Масштаб"] || "";
      return {
        title: md.titleParts(text)[ua ? "ua" : "en"],
        image: image, gridTemplate: grid, scale: scale, description: desc, dm: dm,
      };
    }
    return { slug: slug, en: block(split.enText, false), ua: split.hasUa ? block(split.uaText, true) : {} };
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
      entries = await loader.loadData(config, false, parseMap);
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
