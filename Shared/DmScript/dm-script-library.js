(function () {
  "use strict";
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const locale = window.DnDCore.locale;
  const headings = window.DnDCore.contentSchema.DM_SCRIPT;
  const spellLinks = window.DnDCore.spellLinks;
  const itemLinks = window.DnDCore.itemLinks;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader();
  const state = { lang: "en", page: 1 };
  let raws = [];

  function section(text, key) {
    const args = [text].concat(headings[key] || []);
    return md.sectionAnyHeading.apply(md, args);
  }

  function sectionLabel(key) {
    const labels = headings[key] || [];
    return locale.pickLabel(labels, state.lang) || labels[0] || key;
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

  function withTiles(text) {
    if (!text) return "";
    if (/\d+\s*\.?\s*\/\s*\d+\s*(?:tiles|клітин(?:ок|ки))/i.test(text)) return text;
    return mech.formatDistancesInText(text, state.lang === "ua");
  }

  function enrichText(text) {
    if (!text) return "";
    return spellLinks.renderSpellProse(
      itemLinks.renderItemProse(withTiles(text), state.lang, { highlightDice: false }),
      state.lang
    );
  }

  function formatProseLine(raw) {
    let out = "";
    let last = 0;
    const re = /\*\*(.+?)\*\*/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) out += enrichText(raw.slice(last, m.index));
      out += "<strong>" + esc(m[1]) + "</strong>";
      last = m.index + m[0].length;
    }
    out += enrichText(raw.slice(last));
    return out;
  }

  function renderProseBlock(text) {
    if (!text) return "";
    return md.normalizeNewlines(text).split("\n").map(function (line) {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const isList = trimmed.startsWith("- ");
      const body = isList ? trimmed.slice(2) : trimmed;
      return '<div class="prose-line">' + (isList ? "• " : "") + formatProseLine(body) + "</div>";
    }).filter(Boolean).join("");
  }

  function renderTable(rows) {
    if (!rows.length) return "";
    let h = "<table><tbody>";
    rows.forEach(function (row, i) {
      h += "<tr>" + row.map(function (c) {
        return (i === 0 ? "<th>" : "<td>") + formatProseLine(c) + (i === 0 ? "</th>" : "</td>");
      }).join("") + "</tr>";
    });
    return h + "</tbody></table>";
  }

  function renderMixedContent(text) {
    if (!text || !text.trim()) return "";
    const lines = md.normalizeNewlines(text).split("\n");
    let html = "";
    let i = 0;
    while (i < lines.length) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        i += 1;
        continue;
      }
      if (trimmed.startsWith("|")) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i]);
          i += 1;
        }
        const rows = md.tableRows(tableLines.join("\n"));
        if (rows.length) html += renderTable(rows);
        continue;
      }
      const proseLines = [];
      while (i < lines.length) {
        const lineTrim = lines[i].trim();
        if (!lineTrim || lineTrim.startsWith("|")) break;
        proseLines.push(lines[i]);
        i += 1;
      }
      if (proseLines.length) {
        html += '<div class="prose-block">' + renderProseBlock(proseLines.join("\n")) + "</div>";
      }
    }
    return html;
  }

  function renderReadAloud(content) {
    if (!content || !content.trim()) return "";
    const paragraphs = content.replace(/^>\s?/gm, "").trim().split(/\n\s*\n/);
    const body = paragraphs.map(function (para) {
      return "<p>" + enrichText(para.replace(/\n/g, " ").trim()) + "</p>";
    }).join("");
    return body;
  }

  function block(label, content, cls) {
    if (!content || !content.trim()) return "";
    if (cls === "read-aloud") {
      return '<div class="read-aloud"><strong>' + esc(label) + "</strong>" + renderReadAloud(content) + "</div>";
    }
    const inner = renderMixedContent(content);
    const blockCls = cls === "dm-notes" ? " scene-block dm-notes-block" : " scene-block";
    return '<div class="' + blockCls.trim() + '"><h3>' + esc(label) + "</h3><div>" + inner + "</div></div>";
  }

  function renderScene(scene) {
    let html = '<article class="entity-card"><h2>' + esc(scene.title) + "</h2>";
    html += block(sectionLabel("summary"), scene.summary);
    html += block(sectionLabel("readAloud"), scene.readAloud, "read-aloud");
    html += block(sectionLabel("checks"), scene.checks);
    html += block(sectionLabel("contingencies"), scene.contingencies);
    html += block(sectionLabel("dmNotes"), scene.dm, "dm-notes");
    return html + "</article>";
  }

  function entries() {
    return raws.map(function (r) { return assembleEntry(r.slug, r); });
  }

  function renderPage() {
    const list = entries();
    const uiEl = ui.defaultUi("dm-script-library");
    const idx = Math.max(0, state.page - 1);
    const entry = list[idx] || { slug: "", en: {}, ua: {} };
    const scene = entry[state.lang] || entry.en || {};
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderScene(scene);
    uiEl.pageInfo.textContent = "Scene " + (idx + 1) + " of " + list.length;
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= list.length - 1;
    document.querySelectorAll("#list-nav .bookmark-btn").forEach(function (btn, i) {
      btn.setAttribute("aria-pressed", i === idx ? "true" : "false");
    });
  }

  function buildListNav() {
    const nav = document.getElementById("list-nav");
    nav.innerHTML = entries().map(function (e, i) {
      const scene = e[state.lang] || e.en || {};
      return '<button type="button" class="bookmark-btn" data-page="' + (i + 1) + '">' + esc(scene.title) + "</button>";
    }).join("");
    nav.querySelectorAll(".bookmark-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.page = parseInt(btn.getAttribute("data-page"), 10) || 1;
        renderPage();
      });
    });
  }

  function focusSceneFromUrl() {
    const slug = shell.parseUrlParams().scene;
    if (!slug) return;
    const idx = entries().findIndex(function (e) { return e.slug === slug; });
    if (idx < 0) {
      console.warn("[dm-script-library] Scene not found:", slug);
      return;
    }
    state.page = idx + 1;
  }

  async function bootstrap() {
    ui.initBookChrome("dm-script", function (l) { state.lang = l; buildListNav(); renderPage(); });
    state.lang = shell.parseUrlParams().lang;
    const uiEl = ui.defaultUi("dm-script-library");
    try {
      const config = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "dm-script", indexFileName: "dm-script-index.json",
        demoIndex: "demo/dm-script-index.json",
      });
      await Promise.all([
        spellLinks.loadSpellNameMap(config.scenario),
        itemLinks.loadItemNameMap(config.scenario),
      ]);
      raws = await loader.loadData(config, false, function (slug, texts) {
        return { slug: slug, en: texts.en, ua: texts.ua };
      });
      buildListNav();
      focusSceneFromUrl();
      renderPage();
      ui.bindPagination(state, uiEl, renderPage, function () { return raws.length; });
    } catch (err) { ui.setError(uiEl, "Failed to load DM script", esc(err.message)); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
