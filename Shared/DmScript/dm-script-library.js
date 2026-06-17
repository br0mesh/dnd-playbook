(function () {
  "use strict";
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader({
    indexGlobal: "DMSCRIPT_LIBRARY_INDEX", mdGlobal: "__DMSCRIPT_MD__",
    defaultSourcesJs: "demo/dm-script-sources.js",
    clearGlobals: function () { delete window.DMSCRIPT_LIBRARY_INDEX; delete window.__DMSCRIPT_MD__; },
  });
  const state = { lang: "en", page: 1 };
  let raws = [];

  function parseScene(text, ua) {
    const body = ua ? (md.splitBilingual(text).uaText || text) : md.splitBilingual(text).enText;
    const title = md.titleParts(text);
    const summary = md.sectionAnyHeading(body, "Summary", "Короткий опис");
    const readAloud = md.sectionAnyHeading(body, "Read-aloud", "Зачитай");
    const checks = md.sectionAnyHeading(body, "Checks", "Перевірки");
    const contingencies = md.sectionAnyHeading(body, "Contingencies", "Запасні варіанти");
    const dmNotes = md.sectionAnyHeading(body, "DM Notes", "Нотатки Майстра");
    return {
      title: ua ? title.ua : title.en,
      summary: summary, readAloud: readAloud, checks: checks,
      contingencies: contingencies, dm: dmNotes,
    };
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

  function scenes() {
    return raws.map(function (r) {
      const split = md.splitBilingual(r.raw);
      const s = parseScene(r.raw, state.lang === "ua");
      return { slug: r.slug, scene: s };
    });
  }

  function renderPage() {
    const list = scenes();
    const uiEl = ui.defaultUi("dm-script-library");
    const idx = Math.max(0, state.page - 1);
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderScene(list[idx].scene);
    uiEl.pageInfo.textContent = "Scene " + (idx + 1) + " of " + list.length;
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= list.length - 1;
  }

  async function bootstrap() {
    ui.initBookChrome("dm-script", function (l) { state.lang = l; renderPage(); });
    state.lang = shell.parseUrlParams().lang;
    const uiEl = ui.defaultUi("dm-script-library");
    try {
      const config = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "dm-script", indexFileName: "dm-script-index.json",
        demoIndex: "demo/dm-script-index.json", sourcesJs: "demo/dm-script-sources.js",
      });
      raws = await loader.loadData(config, false, function (slug, text) { return { slug: slug, raw: text }; });
      document.getElementById("list-nav").innerHTML = scenes().map(function (s, i) {
        return '<button type="button" class="bookmark-btn">' + esc(s.scene.title.split("/")[0].trim()) + "</button>";
      }).join("");
      document.getElementById("list-nav").querySelectorAll(".bookmark-btn").forEach(function (btn, i) {
        btn.addEventListener("click", function () { state.page = i + 1; renderPage(); });
      });
      renderPage();
      ui.bindPagination(state, uiEl, renderPage, function () { return raws.length; });
    } catch (err) { ui.setError(uiEl, "Failed to load DM script", esc(err.message)); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
