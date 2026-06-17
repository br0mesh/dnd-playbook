(function () {
  "use strict";
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader({
    indexGlobal: "ITEMS_LIBRARY_INDEX", mdGlobal: "__ITEMS_MD__",
    defaultSourcesJs: "demo/items-sources.js",
    clearGlobals: function () { delete window.ITEMS_LIBRARY_INDEX; delete window.__ITEMS_MD__; },
  });
  const RARITIES = [["all", "All"], ["common", "Common"], ["uncommon", "Uncommon"], ["rare", "Rare"]];
  const TYPES = [["all", "All"], ["consumable", "Consumable"], ["wondrous", "Wondrous"]];
  const state = { lang: "en", rarity: "all", type: "all", search: "", page: 1 };
  let entries = [];

  function keysFromSlug(slug) {
    const p = slug.split("_");
    return { rarity_key: p[p.length - 2] || "unknown", type_key: p[p.length - 1] || "unknown" };
  }

  function parseItem(slug, raw) {
    const split = md.splitBilingual(md.excludeDmNotes(raw));
    function langBlock(text, ua) {
      const h = md.parseBoldFields(md.sectionByHeading(text, "Header") || text);
      const props = md.parseBoldFields(md.sectionAnyHeading(text, "Properties", "Властивості"));
      const desc = md.sectionAnyHeading(text, "Description", "Опис");
      return {
        name: h.Name || h["Назва"] || md.titleParts(text).en,
        rarity: h.Rarity || h["Рідкість"] || "",
        type: h.Type || h["Тип"] || "",
        attunement: props.Attunement || props["Налаштування"] || "",
        description: mech.formatDistancesInText(desc, ua),
      };
    }
    const keys = keysFromSlug(slug);
    return {
      slug: slug, rarity_key: keys.rarity_key, type_key: keys.type_key,
      en: langBlock(split.enText, false),
      ua: split.hasUa ? langBlock(split.uaText, true) : {},
    };
  }

  function filtered() {
    const q = state.search.toLowerCase();
    return entries.filter(function (e) {
      if (state.rarity !== "all" && e.rarity_key !== state.rarity) return false;
      if (state.type !== "all" && e.type_key !== state.type) return false;
      const name = ((e[state.lang] || e.en).name || "").toLowerCase();
      return !q || name.includes(q);
    });
  }

  function renderCard(e) {
    const b = e[state.lang] || e.en;
    return '<article class="entity-card spell-card"><h2>' + esc(b.name) + '</h2><p class="spell-meta">' +
      esc(b.rarity + " · " + b.type) + "</p><p>" + mech.highlightDice(b.description) + "</p>" +
      (b.attunement ? "<p><small>Attunement:</small> " + esc(b.attunement) + "</p>" : "") + "</article>";
  }

  function renderPage() {
    const list = filtered();
    const uiEl = ui.defaultUi("item-library");
    if (!list.length) { uiEl.page.hidden = true; uiEl.empty.hidden = false; uiEl.empty.innerHTML = "<strong>No items match</strong>"; return; }
    const idx = Math.max(0, state.page - 1);
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderCard(list[idx]);
    uiEl.pageInfo.textContent = (idx + 1) + " of " + list.length;
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= list.length - 1;
  }

  async function bootstrap() {
    ui.initBookChrome("items", function (l) { state.lang = l; renderPage(); });
    state.lang = shell.parseUrlParams().lang;
    ui.bindListSidebar("rarity-nav", RARITIES, state, "rarity", renderPage);
    ui.bindListSidebar("type-nav", TYPES, state, "type", renderPage);
    const uiEl = ui.defaultUi("item-library");
    try {
      const config = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "items", indexFileName: "items-index.json",
        demoIndex: "demo/items-index.json", sourcesJs: "demo/items-sources.js",
      });
      entries = await loader.loadData(config, false, parseItem);
      document.getElementById("search").addEventListener("input", function (e) { state.search = e.target.value; state.page = 1; renderPage(); });
      renderPage();
      ui.bindPagination(state, uiEl, renderPage, function () { return filtered().length; });
    } catch (err) { ui.setError(uiEl, "Failed to load items", esc(err.message)); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
