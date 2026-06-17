(function () {
  "use strict";
  const shell = window.DnDCore.shell;
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const ui = window.DnDCore.entityUi;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader({
    indexGlobal: "CHARACTERS_LIBRARY_INDEX", mdGlobal: "__CHARACTERS_MD__",
    defaultSourcesJs: "demo/characters-sources.js",
    clearGlobals: function () { delete window.CHARACTERS_LIBRARY_INDEX; delete window.__CHARACTERS_MD__; },
  });
  const state = { lang: "en", page: 1, slug: null };
  let raws = [];

  function parseLang(text, ua) {
    const body = md.excludeDmNotes(text);
    const info = md.parseBoldFields(md.sectionAnyHeading(body, "Basic Info", "Основна інформація"));
    const combat = md.parseBoldFields(md.sectionAnyHeading(body, "Combat", "Бойові характеристики"));
    return {
      name: info["Character Name"] || info["Ім'я персонажа"] || md.titleParts(body).en,
      cls: (info.Class || info["Клас"] || "") + " · Lv " + (info.Level || info["Рівень"] || "?"),
      ac: combat["Armor Class AC"] || combat["Клас броні КБ"] || "",
      hp: combat["Hit Points HP"] || combat["Пункти здоров'я ПЗ"] || "",
      speed: mech.formatDistancesInText(combat.Speed || combat["Швидкість"] || "", ua),
      stats: md.tableRows(md.sectionAnyHeading(body, "Main Stats", "Основні характеристики")),
      attacks: md.sectionAnyHeading(body, "Attacks", "Атаки"),
      skills: md.sectionAnyHeading(body, "Good Skills", "Навички"),
      abilities: md.sectionAnyHeading(body, "Special Abilities", "Особливі здібності"),
      equipment: md.sectionAnyHeading(body, "Equipment & Inventory", "Спорядження"),
    };
  }

  function parseEntry(slug, raw) {
    const split = md.splitBilingual(md.excludeDmNotes(raw));
    return { slug: slug, en: parseLang(split.enText, false), ua: split.hasUa ? parseLang(split.uaText, true) : {} };
  }

  function renderTable(rows) {
    if (!rows.length) return "";
    let h = "<table><tbody>";
    rows.forEach(function (row, i) {
      h += "<tr>" + row.map(function (c) { return (i === 0 ? "<th>" : "<td>") + esc(c) + (i === 0 ? "</th>" : "</td>"); }).join("") + "</tr>";
    });
    return h + "</tbody></table>";
  }

  function renderEntry(entry) {
    const b = entry[state.lang] || entry.en;
    let html = '<article class="entity-card"><h2>' + esc(b.name) + "</h2><p><em>" + esc(b.cls) + "</em></p>";
    html += "<p><strong>AC</strong> " + esc(b.ac) + " · <strong>HP</strong> " + esc(b.hp) + " · " + esc(b.speed) + "</p>";
    if (b.stats.length) html += "<h3>Stats</h3>" + renderTable(b.stats);
    if (b.attacks) html += "<h3>Attacks</h3>" + renderTable(md.tableRows(b.attacks));
    if (b.skills) html += "<h3>Skills</h3><div>" + mech.highlightDice(b.skills) + "</div>";
    if (b.abilities) html += "<h3>Features</h3><div>" + mech.highlightDice(b.abilities) + "</div>";
    if (b.equipment) html += "<h3>Equipment</h3><div>" + mech.highlightDice(b.equipment) + "</div>";
    return html + "</article>";
  }

  function entries() { return raws.map(function (r) { return parseEntry(r.slug, r.raw); }); }

  function renderPage() {
    const list = entries();
    const uiEl = ui.defaultUi("character-library");
    if (!list.length) { ui.setError(uiEl, "No characters", ""); return; }
    const idx = Math.max(0, state.page - 1);
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderEntry(list[idx]);
    uiEl.pageInfo.textContent = (idx + 1) + " of " + list.length;
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= list.length - 1;
  }

  function buildListNav() {
    const nav = document.getElementById("list-nav");
    nav.innerHTML = entries().map(function (e) {
      const name = (e[state.lang] || e.en).name;
      return '<button type="button" class="bookmark-btn">' + esc(name) + "</button>";
    }).join("");
    nav.querySelectorAll(".bookmark-btn").forEach(function (btn, i) {
      btn.addEventListener("click", function () { state.page = i + 1; renderPage(); });
    });
  }

  async function bootstrap() {
    ui.initBookChrome("characters", function (l) { state.lang = l; buildListNav(); renderPage(); });
    state.lang = shell.parseUrlParams().lang;
    const uiEl = ui.defaultUi("character-library");
    ui.setLoading(uiEl);
    try {
      const config = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "characters", indexFileName: "characters-index.json",
        demoIndex: "demo/characters-index.json", sourcesJs: "demo/characters-sources.js",
      });
      const loaded = await loader.loadData(config, false, function (slug, text) { return { slug: slug, raw: text }; });
      raws = loaded;
      ui.setReady(uiEl);
      buildListNav();
      renderPage();
      ui.bindPagination(state, uiEl, renderPage, function () { return raws.length; });
    } catch (err) { ui.setError(uiEl, "Failed to load characters", esc(err.message)); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
