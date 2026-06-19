(function () {
  "use strict";
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const locale = window.DnDCore.locale;
  const headings = window.DnDCore.contentSchema.DM_SCRIPT;
  const uiLabels = window.DnDCore.contentSchema.DM_SCRIPT_UI || {};
  const spellLinks = window.DnDCore.spellLinks;
  const itemLinks = window.DnDCore.itemLinks;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader();
  const POLL_MS = 3000;
  const state = { lang: "en", page: 1 };
  let raws = [];
  let loadConfig = null;
  let dataFingerprint = "";
  let scenarioSlug = "";

  // Note: \b after [ABАБ] fails for Cyrillic А/Б in JS (ASCII-only word chars). Use lookahead instead.
  const BRANCH_HEADING_RE = /^####\s+(?:Branch|Variant|Гілка|Варіант)\s+([ABАБ])(?=\s*(?:—|-|:)|$)(?:\s*(?:—|-|:)\s*(.*))?$/i;
  const OPTION_HEADING_RE = /^\*\*(?:Option|Варіант|Опція)\s+(\d+)\s*(?:—|-|:)\s*(.+?)\*\*\s*$/i;
  const STANDALONE_BOLD_RE = /^\*\*[^*]+\*\*\s*$/;

  function section(text, key) {
    const args = [text].concat(headings[key] || []);
    return md.sectionAnyHeading.apply(md, args);
  }

  function sectionLabel(key) {
    const labels = headings[key] || [];
    return locale.pickLabel(labels, state.lang) || labels[0] || key;
  }

  function uiLabel(key) {
    const labels = uiLabels[key] || [];
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

  function normalizeBranchId(raw) {
    const ch = String(raw || "").trim().charAt(0).toUpperCase();
    if (ch === "A" || ch === "\u0410") return "a";
    if (ch === "B" || ch === "\u0411") return "b";
    return ch.toLowerCase();
  }

  function parseBranchHeading(line) {
    const m = line.trim().match(BRANCH_HEADING_RE);
    if (!m) return null;
    return {
      id: normalizeBranchId(m[1]),
      label: line.trim().replace(/^####\s+/, ""),
    };
  }

  function parseOptionHeading(line) {
    const m = line.trim().match(OPTION_HEADING_RE);
    if (!m) return null;
    return { id: m[1], label: line.trim().replace(/^\*\*|\*\*$/g, "") };
  }

  function splitSharedTailFromLastOption(optionBody) {
    const lines = md.normalizeNewlines(optionBody).split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const t = lines[i].trim();
      if (!t || parseOptionHeading(t)) continue;
      if (STANDALONE_BOLD_RE.test(t) && i > 0 && lines.slice(0, i).some(function (l) { return l.trim(); })) {
        return {
          body: lines.slice(0, i).join("\n").trim(),
          sharedTail: lines.slice(i).join("\n").trim(),
        };
      }
    }
    return { body: optionBody, sharedTail: "" };
  }

  function parseOptions(body) {
    const lines = md.normalizeNewlines(body).split("\n");
    const starts = [];
    lines.forEach(function (line, index) {
      const opt = parseOptionHeading(line);
      if (opt) starts.push({ index: index, id: opt.id, label: opt.label });
    });
    if (!starts.length) {
      return { intro: body.trim(), options: [], sharedTail: "" };
    }
    const intro = lines.slice(0, starts[0].index).join("\n").trim();
    const options = starts.map(function (start, j) {
      const end = j + 1 < starts.length ? starts[j + 1].index : lines.length;
      return {
        id: start.id,
        label: start.label,
        body: lines.slice(start.index + 1, end).join("\n").trim(),
      };
    });
    let sharedTail = "";
    if (options.length) {
      const split = splitSharedTailFromLastOption(options[options.length - 1].body);
      options[options.length - 1].body = split.body;
      sharedTail = split.sharedTail;
    }
    return { intro: intro, options: options, sharedTail: sharedTail };
  }

  function parseBranchBlocks(text) {
    if (!text || !text.trim()) return null;
    const lines = md.normalizeNewlines(text).split("\n");
    const markers = [];
    lines.forEach(function (line, index) {
      const branch = parseBranchHeading(line);
      if (branch) markers.push({ index: index, id: branch.id, label: branch.label });
    });
    if (markers.length < 2) return null;
    const prefix = lines.slice(0, markers[0].index).join("\n").trim();
    const branches = markers.map(function (marker, j) {
      const end = j + 1 < markers.length ? markers[j + 1].index : lines.length;
      const body = lines.slice(marker.index + 1, end).join("\n").trim();
      const parsed = parseOptions(body);
      return {
        id: marker.id,
        label: marker.label,
        intro: parsed.intro,
        options: parsed.options,
        sharedTail: parsed.sharedTail,
        body: parsed.options.length ? "" : body,
      };
    });
    return { prefix: prefix, branches: branches };
  }

  function renderMixedContentFlat(text) {
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
        const allQuotes = proseLines.every(function (line) {
          const t = line.trim();
          return !t || t.startsWith(">");
        }) && proseLines.some(function (line) { return line.trim().startsWith(">"); });
        if (allQuotes) {
          const quoteBody = proseLines.map(function (line) {
            return line.replace(/^\s*>\s?/, "");
          }).join("\n");
          html += '<blockquote class="scene-quote">' + renderProseBlock(quoteBody) + "</blockquote>";
        } else {
          html += '<div class="prose-block">' + renderProseBlock(proseLines.join("\n")) + "</div>";
        }
      }
    }
    return html;
  }

  function branchStorageKey(sceneSlug) {
    return "dm-script-branch:" + (scenarioSlug || "demo") + ":" + sceneSlug;
  }

  function readBranchState(sceneSlug, branches) {
    const params = shell.parseUrlParams();
    const branchParam = (params.branch || "").toLowerCase();
    const optionParam = params.option || "";
    if (branchParam && branches.some(function (b) { return b.id === branchParam; })) {
      const branch = branches.find(function (b) { return b.id === branchParam; });
      let optionId = optionParam || null;
      if (optionId && branch.options.length && !branch.options.some(function (o) { return o.id === optionId; })) {
        optionId = branch.options[0].id;
      }
      return { branchId: branchParam, optionId: optionId };
    }
    try {
      const raw = sessionStorage.getItem(branchStorageKey(sceneSlug));
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.branchId && branches.some(function (b) { return b.id === saved.branchId; })) {
          return { branchId: saved.branchId, optionId: saved.optionId || null };
        }
      }
    } catch (e) { /* ignore */ }
    const first = branches[0];
    const defaultOption = first.options.length ? first.options[0].id : null;
    return { branchId: first.id, optionId: defaultOption };
  }

  function saveBranchState(sceneSlug, branchId, optionId) {
    try {
      sessionStorage.setItem(branchStorageKey(sceneSlug), JSON.stringify({
        branchId: branchId,
        optionId: optionId || null,
      }));
    } catch (e) { /* ignore */ }
  }

  function renderOptionSwitcher(branch, sceneSlug, branchId, activeOptionId) {
    if (!branch.options.length) return "";
    const switcherId = esc(sceneSlug) + "-branch-" + branchId + "-options";
    let tabs = '<div class="option-switcher"><div class="option-tabs" role="tablist" aria-label="' + esc(uiLabel("optionSwitcher")) + '">';
    branch.options.forEach(function (opt) {
      const tabId = switcherId + "-tab-" + opt.id;
      const panelId = switcherId + "-panel-" + opt.id;
      const selected = opt.id === activeOptionId;
      tabs += '<button type="button" class="option-tab" role="tab" id="' + tabId + '" data-branch-id="' + esc(branchId) + '" data-option-id="' + esc(opt.id) + '" aria-selected="' + (selected ? "true" : "false") + '" aria-controls="' + panelId + '" tabindex="' + (selected ? "0" : "-1") + '">' + esc(opt.label) + "</button>";
    });
    tabs += "</div>";
    branch.options.forEach(function (opt) {
      const tabId = switcherId + "-tab-" + opt.id;
      const panelId = switcherId + "-panel-" + opt.id;
      const selected = opt.id === activeOptionId;
      tabs += '<div class="option-panel" role="tabpanel" id="' + panelId + '" aria-labelledby="' + tabId + '"' + (selected ? "" : " hidden") + ">" + renderMixedContentFlat(opt.body) + "</div>";
    });
    tabs += "</div>";
    return tabs;
  }

  function renderBranchPanel(branch, sceneSlug, isActive, activeOptionId) {
    const panelId = esc(sceneSlug) + "-branch-panel-" + branch.id;
    const tabId = esc(sceneSlug) + "-branch-tab-" + branch.id;
    let inner = "";
    if (branch.options.length) {
      if (branch.intro) inner += renderMixedContentFlat(branch.intro);
      inner += renderOptionSwitcher(branch, sceneSlug, branch.id, activeOptionId);
      if (branch.sharedTail) {
        inner += '<div class="branch-shared-tail">' + renderMixedContentFlat(branch.sharedTail) + "</div>";
      }
    } else if (branch.body) {
      inner = renderMixedContentFlat(branch.body);
    } else {
      inner = renderMixedContentFlat(branch.intro);
    }
    return '<div class="branch-panel" role="tabpanel" id="' + panelId + '" aria-labelledby="' + tabId + '" data-branch-id="' + esc(branch.id) + '"' + (isActive ? "" : " hidden") + ">" + inner + "</div>";
  }

  function renderBranchSwitcher(parsed, sceneSlug) {
    const branchState = readBranchState(sceneSlug, parsed.branches);
    const activeBranchId = branchState.branchId;
    const activeBranch = parsed.branches.find(function (b) { return b.id === activeBranchId; }) || parsed.branches[0];
    let activeOptionId = branchState.optionId;
    if (activeBranch.options.length) {
      if (!activeBranch.options.some(function (o) { return o.id === activeOptionId; })) {
        activeOptionId = activeBranch.options[0].id;
      }
    } else {
      activeOptionId = null;
    }

    let html = "";
    if (parsed.prefix) html += renderMixedContentFlat(parsed.prefix);
    html += '<div class="branch-switcher" data-scene-slug="' + esc(sceneSlug) + '">';
    html += '<div class="branch-tabs" role="tablist" aria-label="' + esc(uiLabel("branchSwitcher")) + '">';
    parsed.branches.forEach(function (branch) {
      const tabId = esc(sceneSlug) + "-branch-tab-" + branch.id;
      const panelId = esc(sceneSlug) + "-branch-panel-" + branch.id;
      const selected = branch.id === activeBranchId;
      html += '<button type="button" class="branch-tab" role="tab" id="' + tabId + '" data-branch-id="' + esc(branch.id) + '" aria-selected="' + (selected ? "true" : "false") + '" aria-controls="' + panelId + '" tabindex="' + (selected ? "0" : "-1") + '">' + esc(branch.label) + "</button>";
    });
    html += "</div>";
    parsed.branches.forEach(function (branch) {
      const optionId = branch.id === activeBranchId ? activeOptionId : (branch.options[0] ? branch.options[0].id : null);
      html += renderBranchPanel(branch, sceneSlug, branch.id === activeBranchId, optionId);
    });
    html += "</div>";
    return html;
  }

  function renderMixedContent(text) {
    if (!text || !text.trim()) return "";
    const parsed = parseBranchBlocks(text);
    if (parsed) return renderBranchSwitcher(parsed, currentSceneSlug());
    return renderMixedContentFlat(text);
  }

  function currentSceneSlug() {
    const list = entries();
    const idx = Math.max(0, state.page - 1);
    return (list[idx] && list[idx].slug) || "";
  }

  function setTabSelection(tabs, activeTab) {
    tabs.forEach(function (tab) {
      const on = tab === activeTab;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.setAttribute("tabindex", on ? "0" : "-1");
    });
  }

  function showPanel(panels, panelId) {
    panels.forEach(function (panel) {
      panel.hidden = panel.id !== panelId;
    });
  }

  function focusTabListKeyboard(event, tabs) {
    const current = tabs.findIndex(function (t) { return t === document.activeElement; });
    if (current < 0) return;
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  }

  function activateBranchTab(switcher, tab) {
    const branchId = tab.getAttribute("data-branch-id");
    const branchTabs = Array.from(switcher.querySelectorAll(".branch-tab"));
    const branchPanels = Array.from(switcher.querySelectorAll(".branch-panel"));
    setTabSelection(branchTabs, tab);
    showPanel(branchPanels, tab.getAttribute("aria-controls"));
    const branchPanel = switcher.querySelector('.branch-panel[data-branch-id="' + branchId + '"]');
    const optionTabs = branchPanel ? Array.from(branchPanel.querySelectorAll(".option-tab")) : [];
    if (optionTabs.length) {
      const selected = optionTabs.find(function (t) { return t.getAttribute("aria-selected") === "true"; }) || optionTabs[0];
      selected.click();
    }
    const sceneSlug = switcher.getAttribute("data-scene-slug") || "";
    const activeOption = branchPanel ? branchPanel.querySelector('.option-tab[aria-selected="true"]') : null;
    saveBranchState(sceneSlug, branchId, activeOption ? activeOption.getAttribute("data-option-id") : null);
  }

  function activateOptionTab(branchPanel, tab) {
    const optionTabs = Array.from(branchPanel.querySelectorAll(".option-tab"));
    const optionPanels = Array.from(branchPanel.querySelectorAll(".option-panel"));
    setTabSelection(optionTabs, tab);
    showPanel(optionPanels, tab.getAttribute("aria-controls"));
    const switcher = branchPanel.closest(".branch-switcher");
    const sceneSlug = switcher ? switcher.getAttribute("data-scene-slug") || "" : "";
    const branchId = tab.getAttribute("data-branch-id") || branchPanel.getAttribute("data-branch-id") || "";
    saveBranchState(sceneSlug, branchId, tab.getAttribute("data-option-id"));
  }

  function bindBranchControls(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll(".branch-switcher").forEach(function (switcher) {
      switcher.querySelectorAll(".branch-tab").forEach(function (tab) {
        tab.addEventListener("click", function () { activateBranchTab(switcher, tab); });
        tab.addEventListener("keydown", function (event) {
          focusTabListKeyboard(event, Array.from(switcher.querySelectorAll(".branch-tab")));
        });
      });
      switcher.querySelectorAll(".branch-panel").forEach(function (branchPanel) {
        branchPanel.querySelectorAll(".option-tab").forEach(function (tab) {
          tab.addEventListener("click", function () { activateOptionTab(branchPanel, tab); });
          tab.addEventListener("keydown", function (event) {
            focusTabListKeyboard(event, Array.from(branchPanel.querySelectorAll(".option-tab")));
          });
        });
      });
    });
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
    if (!uiEl.page || !uiEl.empty) return;
    const idx = Math.max(0, state.page - 1);
    const entry = list[idx] || { slug: "", en: {}, ua: {} };
    const scene = entry[state.lang] || entry.en || {};
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderScene(scene);
    bindBranchControls(uiEl.page);
    uiEl.pageInfo.textContent = "Scene " + (idx + 1) + " of " + list.length;
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= list.length - 1;
    document.querySelectorAll("#list-nav .bookmark-btn").forEach(function (btn, i) {
      btn.setAttribute("aria-pressed", i === idx ? "true" : "false");
    });
  }

  function buildListNav() {
    const nav = document.getElementById("list-nav");
    if (!nav) return;
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
      loadConfig = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "dm-script", indexFileName: "dm-script-index.json",
        demoIndex: "demo/dm-script-index.json",
      });
      scenarioSlug = loadConfig.scenario || "";
      raws = await loader.loadData(loadConfig, false, function (slug, texts) {
        return { slug: slug, en: texts.en, ua: texts.ua };
      });
      dataFingerprint = loader.fingerprint(raws);
      buildListNav();
      focusSceneFromUrl();
      try {
        renderPage();
      } catch (renderErr) {
        ui.setError(uiEl, "Failed to render DM script", esc(renderErr && renderErr.message ? renderErr.message : "Unknown render error"));
        return;
      }
      ui.bindPagination(state, uiEl, renderPage, function () { return raws.length; });
      if (loadConfig.poll) {
        setInterval(async function () {
          try {
            const refreshed = await loader.loadData(loadConfig, true, function (slug, texts) {
              return { slug: slug, en: texts.en, ua: texts.ua };
            });
            if (loader.fingerprint(refreshed) !== dataFingerprint) {
              dataFingerprint = loader.fingerprint(refreshed);
              raws = refreshed;
              buildListNav();
              renderPage();
            }
          } catch (_e) { /* keep last good data */ }
        }, POLL_MS);
      }
      Promise.all([
        spellLinks.loadSpellNameMap(loadConfig.scenario),
        itemLinks.loadItemNameMap(loadConfig.scenario),
      ]).then(function () { renderPage(); }).catch(function (err) {
        console.warn("[dm-script-library] Spell/item link maps failed:", err);
      });
    } catch (err) {
      let detail = err && err.message ? String(err.message) : "Unknown error";
      if (window.location.protocol === "file:") {
        detail = "DM Script must be opened over HTTP, not as a local file. From the repo root run preview.cmd or: python -m http.server 8080 — then open http://localhost:8080/index.html?scenario=when-the-lanterns-fall-silent and choose DM Script.";
      } else if (!shell.parseUrlParams().scenario) {
        detail += " Tip: add ?scenario=when-the-lanterns-fall-silent (or pick the scenario from the hub first).";
      }
      ui.setError(uiEl, "Failed to load DM script", esc(detail));
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
