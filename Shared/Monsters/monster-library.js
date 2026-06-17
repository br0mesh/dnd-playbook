(function () {
  "use strict";
  const shell = window.DnDCore.shell;
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const ui = window.DnDCore.entityUi;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader({
    indexGlobal: "MONSTERS_LIBRARY_INDEX", mdGlobal: "__MONSTERS_MD__",
    defaultSourcesJs: "demo/monsters-sources.js",
    clearGlobals: function () { delete window.MONSTERS_LIBRARY_INDEX; delete window.__MONSTERS_MD__; },
  });

  const state = { lang: "en", mode: "player", search: "", page: 1, slug: null };
  let raws = [];

  function parseLang(text, ua, showDm) {
    const body = showDm ? text : md.excludeDmNotes(text);
    const titles = md.titleParts(body);
    const stat = md.parseBoldFields(md.sectionAnyHeading(body, "Stat Block", "Статблок"));
    const traits = md.sectionAnyHeading(body, "Traits", "Риси");
    const actions = md.sectionAnyHeading(body, "Actions", "Дії");
    const dm = showDm ? md.sectionAnyHeading(body, "DM Notes", "Нотатки Майстра") : "";
    const tactics = showDm ? md.sectionAnyHeading(body, "Quick Tactics", "Тактика") : "";
    const statsTable = md.tableRows(md.sectionAnyHeading(body, "Main Stats", "Основні характеристики"));
    return {
      name: ua ? titles.ua : titles.en,
      type: stat.Type || stat["Тип"] || "",
      ac: stat["Armor Class AC"] || stat["Клас броні КБ"] || "",
      hp: stat["Hit Points HP"] || stat["Пункти здоров'я ПЗ"] || "",
      speed: mech.formatDistancesInText(stat.Speed || stat["Швидкість"] || "", ua),
      cr: stat["Challenge Rating CR"] || stat["Рейтинг складності РС"] || "",
      traits: traits, actions: actions, dm: dm, tactics: tactics, statsTable: statsTable,
    };
  }

  function parseEntry(slug, raw) {
    const split = md.splitBilingual(raw);
    const crMatch = raw.match(/CR[:\s]*([\d/]+)/i) || raw.match(/РС[:\s]*([\d/]+)/i);
    const typeMatch = (split.enText.match(/\*\*Type:\*\*\s*(.+)/i) || [])[1] || "unknown";
    const typeKey = typeMatch.split("(")[0].trim().toLowerCase().split(" ").pop() || "unknown";
    const dm = state.mode === "dm";
    return {
      slug: slug, cr_key: crMatch ? crMatch[1] : "?",
      type_key: typeKey,
      en: parseLang(split.enText, false, dm),
      ua: split.hasUa ? parseLang(split.uaText, true, dm) : {},
    };
  }

  function entries() { return raws.map(function (r) { return parseEntry(r.slug, r.raw); }); }

  function renderTable(rows) {
    if (!rows.length) return "";
    let h = "<table><tbody>";
    rows.forEach(function (row, i) {
      h += "<tr>" + row.map(function (c) { return (i === 0 ? "<th>" : "<td>") + esc(c) + (i === 0 ? "</th>" : "</td>"); }).join("") + "</tr>";
    });
    return h + "</tbody></table>";
  }

  function renderActions(block) {
    const rows = md.tableRows(block);
    if (rows.length < 2) return block ? "<p>" + mech.highlightDice(block) + "</p>" : "";
    return renderTable(rows);
  }

  function renderEntry(entry) {
    const b = entry[state.lang] || entry.en || {};
    let html = '<article class="entity-card"><h2>' + esc(b.name) + "</h2>";
    html += '<p class="stat-line"><strong>AC</strong> ' + esc(b.ac) + " · <strong>HP</strong> " + esc(b.hp) + " · <strong>CR</strong> " + esc(b.cr) + "</p>";
    html += '<p class="stat-line">' + esc(b.type) + " · " + esc(b.speed) + "</p>";
    if (b.statsTable && b.statsTable.length) html += renderTable(b.statsTable);
    if (b.traits) { html += "<h3>Traits</h3><div>" + mech.highlightDice(b.traits.replace(/\n- /g, "\n").replace(/^- /gm, "• ")) + "</div>"; }
    if (b.actions) { html += "<h3>Actions</h3>" + renderActions(b.actions); }
    if (b.tactics) html += '<div class="dm-notes-block"><h3>Tactics</h3><p>' + mech.highlightDice(b.tactics) + "</p></div>";
    if (b.dm) html += '<div class="dm-notes-block"><h3>DM Notes</h3><p>' + mech.highlightDice(b.dm) + "</p></div>";
    return html + "</article>";
  }

  function filtered() {
    const q = state.search.toLowerCase();
    return entries().filter(function (e) {
      const name = ((e[state.lang] || e.en || {}).name || "").toLowerCase();
      return !q || name.includes(q);
    });
  }

  function renderPage() {
    const list = filtered();
    const uiEl = ui.defaultUi("monster-library");
    if (!list.length) {
      uiEl.page.hidden = true;
      uiEl.empty.hidden = false;
      uiEl.empty.innerHTML = "<strong>No monsters found</strong>";
      return;
    }
    const idx = Math.min(state.page - 1, list.length - 1);
    state.slug = list[idx].slug;
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderEntry(list[idx]);
    uiEl.pageInfo.textContent = (idx + 1) + " of " + list.length;
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= list.length - 1;
    document.querySelectorAll("#list-nav .bookmark-btn").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-slug") === state.slug ? "true" : "false");
    });
  }

  function buildListNav() {
    const nav = document.getElementById("list-nav");
    nav.innerHTML = entries().map(function (e) {
      const name = (e[state.lang] || e.en || {}).name || e.slug;
      return '<button type="button" class="bookmark-btn" data-slug="' + esc(e.slug) + '">' + esc(name) + "</button>";
    }).join("");
    nav.addEventListener("click", function (ev) {
      const btn = ev.target.closest("[data-slug]");
      if (!btn) return;
      state.slug = btn.getAttribute("data-slug");
      const list = filtered();
      state.page = list.findIndex(function (e) { return e.slug === state.slug; }) + 1;
      renderPage();
    });
  }

  async function bootstrap() {
    const chrome = ui.initBookChrome("monsters", function (l) { state.lang = l; buildListNav(); renderPage(); },
      function (m) { state.mode = m; renderPage(); }, true);
    state.lang = chrome.lang;
    state.mode = chrome.mode;
    const uiEl = ui.defaultUi("monster-library");
    ui.setLoading(uiEl, "Loading monsters…");
    try {
      const config = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "monsters", indexFileName: "monsters-index.json",
        demoIndex: "demo/monsters-index.json", sourcesJs: "demo/monsters-sources.js",
      });
      raws = await loader.loadData(config, false, function (slug, text) { return { slug: slug, raw: text }; });
      ui.setReady(uiEl);
      buildListNav();
      renderPage();
      document.getElementById("search").addEventListener("input", function (e) {
        state.search = e.target.value;
        state.page = 1;
        renderPage();
      });
    } catch (err) {
      ui.setError(uiEl, "Failed to load monsters", esc(err.message));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
