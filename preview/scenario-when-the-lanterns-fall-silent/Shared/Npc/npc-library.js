(function () {
  "use strict";
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const locale = window.DnDCore.locale;
  const headings = window.DnDCore.contentSchema.NPC;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader();
  const state = { lang: "en", mode: "player", page: 1, slug: null };
  let raws = [];

  function section(text, key) {
    const args = [text].concat(headings[key] || []);
    return md.sectionAnyHeading.apply(md, args);
  }

  function parseLang(text, lang, dm) {
    let body = text;
    if (!dm) {
      body = md.excludeDmNotes(body);
      body = body.replace(/### Quick Roleplay[\s\S]*?(?=###|##|$)/i, "");
      body = body.replace(/### Scene Reference[\s\S]*?(?=###|##|$)/i, "");
    }
    const roleplay = md.parseBoldFields(section(body, "quickRoleplay"));
    const lines = section(body, "sampleLines");
    const dmNotes = dm ? section(body, "dmNotes") : "";
    return {
      name: md.titleForLocale(body, lang),
      voice: roleplay.Voice || roleplay["Голос"] || "",
      goal: roleplay.Goal || roleplay["Мета"] || "",
      lines: lines, dm: dmNotes,
    };
  }

  function assembleEntry(slug, texts) {
    const dm = state.mode === "dm";
    const en = parseLang(texts.en, "en", dm);
    const ua = texts.ua.trim()
      ? parseLang(texts.ua, "ua", dm)
      : locale.mergeWithFallback(en, {});
    return { slug: slug, en: en, ua: ua };
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

  function entries() { return raws.map(function (r) { return assembleEntry(r.slug, r); }); }

  function focusNpcFromUrl() {
    const slug = shell.parseUrlParams().npc;
    if (!slug) return;
    const list = entries();
    const idx = list.findIndex(function (e) { return e.slug === slug; });
    if (idx < 0) {
      console.warn("[npc-library] NPC not found:", slug);
      return;
    }
    state.page = idx + 1;
    state.slug = slug;
  }

  function renderPage() {
    const list = entries();
    const uiEl = ui.defaultUi("npc-library");
    const idx = Math.min(Math.max(state.page - 1, 0), Math.max(list.length - 1, 0));
    state.page = idx + 1;
    if (list[idx]) state.slug = list[idx].slug;
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderEntry(list[idx] || { en: {}, ua: {} });
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
      const name = (e[state.lang] || e.en).name;
      return '<button type="button" class="bookmark-btn" data-slug="' + esc(e.slug) + '">' + esc(name) + "</button>";
    }).join("");
    nav.querySelectorAll(".bookmark-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.slug = btn.getAttribute("data-slug");
        state.page = entries().findIndex(function (e) { return e.slug === state.slug; }) + 1;
        renderPage();
      });
    });
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
        demoIndex: "demo/npc-index.json",
      });
      raws = await loader.loadData(config, false, function (slug, texts) {
        return { slug: slug, en: texts.en, ua: texts.ua };
      });
      buildListNav();
      focusNpcFromUrl();
      renderPage();
      ui.bindPagination(state, uiEl, renderPage, function () { return raws.length; });
    } catch (err) { ui.setError(uiEl, "Failed to load NPCs", esc(err.message)); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
