(function () {
  "use strict";
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const locale = window.DnDCore.locale;
  const headings = window.DnDCore.contentSchema.ITEM;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader();
  const RARITIES = [["all", "All"], ["common", "Common"], ["uncommon", "Uncommon"], ["rare", "Rare"]];
  const TYPES = [["all", "All"], ["consumable", "Consumable"], ["wondrous", "Wondrous"]];
  const state = { lang: "en", rarity: "all", type: "all", search: "", page: 1 };
  let entries = [];

  function keysFromSlug(slug) {
    const p = slug.split("_");
    return { rarity_key: p[p.length - 2] || "unknown", type_key: p[p.length - 1] || "unknown" };
  }

  function section(text, key) {
    const args = [text].concat(headings[key] || []);
    return md.sectionAnyHeading.apply(md, args);
  }

  function parseLang(text, lang) {
    const h = md.parseBoldFields(section(text, "header") || text);
    const props = md.parseBoldFields(section(text, "properties"));
    const desc = section(text, "description");
    return {
      name: h.Name || h["Назва"] || md.titleForLocale(text, lang),
      rarity: h.Rarity || h["Рідкість"] || "",
      type: h.Type || h["Тип"] || "",
      attunement: props.Attunement || props["Налаштування"] || "",
      description: mech.formatDistancesInText(desc, lang === "ua"),
    };
  }

  function assembleItem(slug, texts) {
    const keys = keysFromSlug(slug);
    const en = parseLang(md.excludeDmNotes(texts.en), "en");
    const ua = texts.ua.trim()
      ? parseLang(md.excludeDmNotes(texts.ua), "ua")
      : locale.mergeWithFallback(en, {});
    return {
      slug: slug, rarity_key: keys.rarity_key, type_key: keys.type_key,
      en: en, ua: ua,
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
        demoIndex: "demo/items-index.json",
      });
      entries = await loader.loadData(config, false, assembleItem);
      document.getElementById("search").addEventListener("input", function (e) { state.search = e.target.value; state.page = 1; renderPage(); });
      renderPage();
      ui.bindPagination(state, uiEl, renderPage, function () { return filtered().length; });
    } catch (err) { ui.setError(uiEl, "Failed to load items", esc(err.message)); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
