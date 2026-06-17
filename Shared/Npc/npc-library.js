(function () {
  "use strict";
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader({
    indexGlobal: "NPC_LIBRARY_INDEX", mdGlobal: "__NPC_MD__",
    defaultSourcesJs: "demo/npc-sources.js",
    clearGlobals: function () { delete window.NPC_LIBRARY_INDEX; delete window.__NPC_MD__; },
  });
  const state = { lang: "en", mode: "player", page: 1 };
  let raws = [];

  function parseLang(text, ua, dm) {
    let body = text;
    if (!dm) {
      body = md.excludeDmNotes(body);
      body = body.replace(/### Quick Roleplay[\s\S]*?(?=###|##|$)/i, "");
      body = body.replace(/### Scene Reference[\s\S]*?(?=###|##|$)/i, "");
    }
    const titles = md.titleParts(body);
    const roleplay = md.parseBoldFields(md.sectionAnyHeading(body, "Quick Roleplay", "Швидка гра"));
    const lines = md.sectionAnyHeading(body, "Sample Lines", "Приклади реплік");
    const dmNotes = dm ? md.sectionAnyHeading(body, "DM Notes", "Нотатки Майстра") : "";
    return {
      name: ua ? titles.ua : titles.en,
      voice: roleplay.Voice || roleplay["Голос"] || "",
      goal: roleplay.Goal || roleplay["Мета"] || "",
      lines: lines, dm: dmNotes,
    };
  }

  function parseEntry(slug, raw, dm) {
    const split = md.splitBilingual(raw);
    return { slug: slug, en: parseLang(split.enText, false, dm), ua: split.hasUa ? parseLang(split.uaText, true, dm) : {} };
  }

  function renderEntry(entry) {
    const b = entry[state.lang] || entry.en;
    let html = '<article class="entity-card"><h2>' + esc(b.name) + "</h2>";
    if (b.voice) html += "<p><strong>Voice:</strong> " + esc(b.voice) + "</p>";
    if (b.goal) html += "<p><strong>Goal:</strong> " + esc(b.goal) + "</p>";
    if (b.lines) {
      const rows = md.tableRows(b.lines);
      if (rows.length > 1) {
        html += "<h3>Sample Lines</h3><table><tbody>";
        rows.slice(1).forEach(function (row) {
          html += "<tr><td>" + esc(row[0]) + "</td><td>" + esc(row[1] || "") + "</td></tr>";
        });
        html += "</tbody></table>";
      }
    }
    if (b.dm) html += '<div class="dm-notes-block"><h3>DM Notes</h3><p>' + mech.highlightDice(b.dm) + "</p></div>";
    return html + "</article>";
  }

  function entries() { return raws.map(function (r) { return parseEntry(r.slug, r.raw, state.mode === "dm"); }); }

  function renderPage() {
    const list = entries();
    const uiEl = ui.defaultUi("npc-library");
    const idx = Math.max(0, state.page - 1);
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderEntry(list[idx] || { en: {}, ua: {} });
    uiEl.pageInfo.textContent = (idx + 1) + " of " + list.length;
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= list.length - 1;
  }

  async function bootstrap() {
    ui.initBookChrome("npc", function (l) { state.lang = l; renderPage(); },
      function (m) { state.mode = m; renderPage(); }, true);
    state.lang = shell.parseUrlParams().lang;
    state.mode = shell.parseUrlParams().mode;
    const uiEl = ui.defaultUi("npc-library");
    try {
      const config = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "npc", indexFileName: "npc-index.json",
        demoIndex: "demo/npc-index.json", sourcesJs: "demo/npc-sources.js",
      });
      raws = await loader.loadData(config, false, function (slug, text) { return { slug: slug, raw: text }; });
      document.getElementById("list-nav").innerHTML = entries().map(function (e, i) {
        return '<button type="button" class="bookmark-btn">' + esc((e[state.lang] || e.en).name) + "</button>";
      }).join("");
      document.getElementById("list-nav").querySelectorAll(".bookmark-btn").forEach(function (btn, i) {
        btn.addEventListener("click", function () { state.page = i + 1; renderPage(); });
      });
      renderPage();
      ui.bindPagination(state, uiEl, renderPage, function () { return raws.length; });
    } catch (err) { ui.setError(uiEl, "Failed to load NPCs", esc(err.message)); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
