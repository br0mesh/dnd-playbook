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
  const state = { lang: "en", page: 1, navFilter: "all", activeSessionId: null };
  let raws = [];
  let loadConfig = null;
  let scenarioSlug = "";
  let dmScriptSessions = [];
  let manifestData = null;

  // Note: \b after [ABАБ] fails for Cyrillic А/Б in JS (ASCII-only word chars). Use lookahead instead.
  const BRANCH_HEADING_RE = /^####\s+(?:Branch|Variant|Гілка|Варіант)\s+([ABАБВ])(?=\s*(?:—|-|:)|$)(?:\s*(?:—|-|:)\s*(.*))?$/i;
  const OPTION_HEADING_RE = /^\*\*(?:Option|Варіант|Опція)\s+(\d+)\s*(?:—|-|:)\s*(.+?)\*\*\s*$/i;
  const STANDALONE_BOLD_RE = /^\*\*[^*]+\*\*\s*$/;
  const BEAT_H4_RE = /^####\s+Beat\s+(\d+)\s*(?:—|-|:)\s*(.*)$/i;
  const CHECK_COMMENT_RE = /<!--\s*check:\s*([^>]+?)\s*-->/i;
  const CHECK_LINE_RE = /^\*\*(?:Check|Перевірка):\s*(.+?)\*\*\s*$/i;
  const ASK_LINE_RE = /^\*\*(?:Ask|Запитай):\*\*\s*(.*)$/i;
  const ASK_EXAMPLE_RE = /^\*\*(?:Ask \(example\)|Приклад відповіді):\*\*\s*(.*)$/i;
  const ON_FAIL_RE = /^\*\*(?:On fail|При провалі):\*\*\s*(.*)$/i;
  const ON_SUCCESS_RE = /^\*\*(?:On success|При успіху):\*\*\s*(.*)$/i;
  const ON_FAIL_RA_RE = /^\*\*(?:On fail \(read-aloud\)|При провалі \(зачитай\)):\*\*\s*$/i;
  const ON_SUCCESS_RA_RE = /^\*\*(?:On success \(read-aloud\)|При успіху \(зачитай\)):\*\*\s*$/i;
  const MICRO_LOOP_MARKER_PREFIX_RE = /^\*\*(?:Ask|Запитай|On fail|On success|При провалі|При успіху|Ask \(example\)|Приклад відповіді)/i;
  const PROGRESS_KEY_PREFIX = "dm-script-progress:";
  const NAV_KEY_PREFIX = "dm-script-nav:";

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

  function progressStorageKey() {
    return PROGRESS_KEY_PREFIX + (scenarioSlug || "demo");
  }

  function navStorageKey() {
    return NAV_KEY_PREFIX + (scenarioSlug || "demo");
  }

  function readProgress() {
    try {
      const raw = localStorage.getItem(progressStorageKey());
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.v === 1) return data;
      }
    } catch (e) { /* ignore */ }
    return { v: 1, activeSessionId: null, navFilter: "all", collapsedSessions: [], scenes: {} };
  }

  function writeProgress(data) {
    try {
      localStorage.setItem(progressStorageKey(), JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function sceneProgress(slug) {
    const p = readProgress();
    return (p.scenes && p.scenes[slug]) || { status: "unseen", beatIndex: 0 };
  }

  function updateSceneProgress(slug, patch) {
    const p = readProgress();
    if (!p.scenes) p.scenes = {};
    p.scenes[slug] = Object.assign({}, sceneProgress(slug), patch);
    writeProgress(p);
  }

  function markSceneInProgress(slug) {
    const cur = sceneProgress(slug);
    if (cur.status === "done") return;
    updateSceneProgress(slug, { status: "in_progress" });
  }

  function readNavState() {
    try {
      const raw = localStorage.getItem(navStorageKey());
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { collapsedSessions: [] };
  }

  function writeNavState(data) {
    try {
      localStorage.setItem(navStorageKey(), JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function isSessionCollapsed(sessionId) {
    const nav = readNavState();
    const collapsed = nav.collapsedSessions || [];
    return collapsed.indexOf(sessionId) >= 0;
  }

  function toggleSessionCollapsed(sessionId) {
    const nav = readNavState();
    const collapsed = nav.collapsedSessions || [];
    const idx = collapsed.indexOf(sessionId);
    if (idx >= 0) collapsed.splice(idx, 1);
    else collapsed.push(sessionId);
    nav.collapsedSessions = collapsed;
    writeNavState(nav);
  }

  async function loadManifest(scenario) {
    if (!scenario || scenario === "demo") return null;
    try {
      const url = new URL("../../scenarios/" + scenario + "/manifest.json", shell.pageBaseUrl()).href;
      const text = await shell.fetchText(url, false);
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  function sessionLabelText(session) {
    if (!session || !session.label) return uiLabel("sessionLabel") + " " + (session && session.id);
    if (typeof session.label === "string") return session.label;
    return locale.pickLabel([session.label.en, session.label.ua], state.lang) || session.label.en || "";
  }

  function slugToSessionId(slug) {
    for (let i = 0; i < dmScriptSessions.length; i += 1) {
      const s = dmScriptSessions[i];
      if (s.scenes && s.scenes.indexOf(slug) >= 0) return s.id;
    }
    return null;
  }

  function resolveActiveSessionId() {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get("session");
    if (sessionParam) {
      const id = parseInt(sessionParam, 10);
      if (dmScriptSessions.some(function (s) { return s.id === id; })) return id;
    }
    const p = readProgress();
    if (p.activeSessionId && dmScriptSessions.some(function (s) { return s.id === p.activeSessionId; })) {
      return p.activeSessionId;
    }
    if (dmScriptSessions.length) return dmScriptSessions[dmScriptSessions.length - 1].id;
    return null;
  }

  function sceneVisibleInNav(slug) {
    if (state.navFilter !== "current" || !dmScriptSessions.length) return true;
    const sid = state.activeSessionId || resolveActiveSessionId();
    if (!sid) return true;
    const session = dmScriptSessions.find(function (s) { return s.id === sid; });
    if (!session || !session.scenes || !session.scenes.length) return true;
    return session.scenes.indexOf(slug) >= 0;
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
    if (ch === "\u0412") return "v";
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

  function parseBeatHeading(line) {
    const m = line.trim().match(BEAT_H4_RE);
    if (!m) return null;
    const title = (m[2] || "").trim() || ("Beat " + m[1]);
    return { id: m[1], label: title };
  }

  function isBeatMarkerLine(line) {
    const trimmed = line.trim();
    if (MICRO_LOOP_MARKER_PREFIX_RE.test(trimmed)) return false;
    if (parseBeatHeading(trimmed)) return true;
    if (!STANDALONE_BOLD_RE.test(trimmed)) return false;
    if (parseOptionHeading(trimmed)) return false;
    return true;
  }

  function consumeQuoteLines(lines, startIdx) {
    const quoteLines = [];
    let i = startIdx;
    while (i < lines.length && lines[i].trim().startsWith(">")) {
      quoteLines.push(lines[i]);
      i += 1;
    }
    const text = quoteLines.map(function (l) { return l.replace(/^\s*>\s?/, ""); }).join("\n").trim();
    return { text: text, nextIdx: i };
  }

  function parseBeatMicroLoop(body) {
    const empty = {
      body: "",
      ask: "",
      askExample: "",
      checkRef: null,
      onFail: "",
      onSuccess: "",
      onFailReadAloud: "",
      onSuccessReadAloud: "",
    };
    if (!body || !body.trim()) return empty;
    const lines = md.normalizeNewlines(body).split("\n");
    const kept = [];
    let ask = "";
    let askExample = "";
    let onFail = "";
    let onSuccess = "";
    let onFailReadAloud = "";
    let onSuccessReadAloud = "";
    for (let i = 0; i < lines.length; i += 1) {
      const t = lines[i].trim();
      let m;
      if (CHECK_COMMENT_RE.test(t)) continue;
      if (CHECK_LINE_RE.test(t)) continue;
      if ((m = t.match(ASK_LINE_RE))) {
        ask = m[1].trim();
        continue;
      }
      if ((m = t.match(ASK_EXAMPLE_RE))) {
        askExample = m[1].trim();
        continue;
      }
      if ((m = t.match(ON_FAIL_RE))) {
        onFail = m[1].trim();
        continue;
      }
      if ((m = t.match(ON_SUCCESS_RE))) {
        onSuccess = m[1].trim();
        continue;
      }
      if (ON_FAIL_RA_RE.test(t)) {
        const q = consumeQuoteLines(lines, i + 1);
        onFailReadAloud = q.text;
        i = q.nextIdx - 1;
        continue;
      }
      if (ON_SUCCESS_RA_RE.test(t)) {
        const q = consumeQuoteLines(lines, i + 1);
        onSuccessReadAloud = q.text;
        i = q.nextIdx - 1;
        continue;
      }
      kept.push(lines[i]);
    }
    return {
      body: kept.join("\n").trim(),
      ask: ask,
      askExample: askExample,
      checkRef: extractCheckRef(body),
      onFail: onFail,
      onSuccess: onSuccess,
      onFailReadAloud: onFailReadAloud,
      onSuccessReadAloud: onSuccessReadAloud,
    };
  }

  function beatMarkerLabel(line) {
    const h4 = parseBeatHeading(line.trim());
    if (h4) return h4.label;
    return line.trim().replace(/^\*\*|\*\*$/g, "");
  }

  function extractCheckRef(body) {
    if (!body) return null;
    const comment = body.match(CHECK_COMMENT_RE);
    if (comment) return comment[1].trim();
    const lines = md.normalizeNewlines(body).split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].trim().match(CHECK_LINE_RE);
      if (m) return m[1].trim();
    }
    return null;
  }

  function normalizeCheckRef(ref) {
    const dcMatch = ref.match(/DC\s*(\d+)/i);
    const slugMatch = ref.trim().match(/^([a-z_]+)-(\d+)$/i);
    if (slugMatch) {
      return {
        skill: slugMatch[1].toLowerCase(),
        dc: parseInt(slugMatch[2], 10),
        raw: ref,
      };
    }
    const skillPart = ref.split("(")[0].trim();
    return {
      skill: skillPart.toLowerCase(),
      dc: dcMatch ? parseInt(dcMatch[1], 10) : null,
      raw: ref,
    };
  }

  function findCheckAnchorId(checksText, ref) {
    if (!checksText || !ref) return "section-checks";
    const norm = normalizeCheckRef(ref);
    const slugForm = /^[a-z_]+-\d+$/i.test(ref.trim());
    const lines = md.normalizeNewlines(checksText).split("\n");
    let checkIdx = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();
      if (/^####\s+/.test(line)) break;
      if (!line.startsWith("**")) continue;
      const lower = line.toLowerCase();
      const dcOk = norm.dc == null || lower.indexOf("dc " + norm.dc) >= 0 || lower.indexOf("dc" + norm.dc) >= 0;
      if (!dcOk) continue;
      if (slugForm) return "check-line-" + checkIdx;
      const skillMatch = norm.skill && lower.indexOf(norm.skill) >= 0;
      if (skillMatch) return "check-line-" + checkIdx;
      checkIdx += 1;
    }
    return "section-checks";
  }

  function readAloudNeedsMixedRender(text) {
    if (!text) return false;
    return md.normalizeNewlines(text).split("\n").some(function (line) {
      return line.trim().startsWith("|");
    });
  }

  function parseBeatBlocks(text) {
    if (!text || !text.trim()) return null;
    const lines = md.normalizeNewlines(text).split("\n");
    const markers = [];
    lines.forEach(function (line, index) {
      if (isBeatMarkerLine(line)) {
        markers.push({ index: index, label: beatMarkerLabel(line) });
      }
    });
    if (markers.length < 2) return null;
    const prefix = lines.slice(0, markers[0].index).join("\n").trim();
    const beats = markers.map(function (marker, j) {
      const end = j + 1 < markers.length ? markers[j + 1].index : lines.length;
      const rawBody = lines.slice(marker.index + 1, end).join("\n").trim();
      const micro = parseBeatMicroLoop(rawBody);
      return {
        index: j,
        label: marker.label,
        body: micro.body,
        checkRef: micro.checkRef,
        ask: micro.ask,
        askExample: micro.askExample,
        onFail: micro.onFail,
        onSuccess: micro.onSuccess,
        onFailReadAloud: micro.onFailReadAloud,
        onSuccessReadAloud: micro.onSuccessReadAloud,
      };
    });
    return { prefix: prefix, beats: beats };
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
    updateSceneProgress(sceneSlug, { branchId: branchId, optionId: optionId || null });
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

  function readBeatIndexFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const beat = params.get("beat");
    if (beat == null || beat === "") return null;
    const idx = parseInt(beat, 10);
    return isNaN(idx) ? null : Math.max(0, idx);
  }

  function readBeatIndex(sceneSlug, beatCount) {
    const urlBeat = readBeatIndexFromUrl();
    if (urlBeat != null && urlBeat < beatCount) return urlBeat;
    const sp = sceneProgress(sceneSlug);
    if (sp.beatIndex != null && sp.beatIndex < beatCount) return sp.beatIndex;
    return 0;
  }

  function readBeatResult(sceneSlug, beatIndex) {
    const sp = sceneProgress(sceneSlug);
    const results = sp.beatResults || {};
    const key = String(beatIndex);
    const val = results[key];
    return val === "fail" || val === "success" ? val : null;
  }

  function renderAskCallout(beat) {
    if (!beat.ask) return "";
    let html = '<div class="ask-callout">';
    html += '<span class="ask-callout-label">' + esc(uiLabel("askPlayer")) + "</span>";
    html += '<p class="ask-callout-question">' + formatProseLine(beat.ask) + "</p>";
    if (beat.askExample) {
      html += '<div class="ask-callout-example">';
      html += '<span class="ask-callout-example-label">' + esc(uiLabel("askExample")) + "</span>";
      html += '<blockquote class="scene-quote ask-example-quote">' + formatProseLine(beat.askExample) + "</blockquote>";
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function renderBeatResultPanel(kind, prose, readAloud, revealed) {
    if (!prose && !readAloud) return "";
    const labelKey = kind === "fail" ? "onFail" : "onSuccess";
    const hidden = revealed ? "" : " hidden";
    const ariaHidden = revealed ? "false" : "true";
    let html = '<div class="beat-result-panel beat-result-' + kind + '" data-result="' + kind + '"' + hidden + ' aria-hidden="' + ariaHidden + '">';
    html += '<span class="beat-result-label">' + esc(uiLabel(labelKey)) + "</span>";
    if (prose) html += '<div class="beat-result-prose">' + renderProseBlock(prose) + "</div>";
    if (readAloud) {
      html += '<blockquote class="scene-quote beat-result-quote">' + renderProseBlock(readAloud) + "</blockquote>";
    }
    html += "</div>";
    return html;
  }

  function renderBeatResults(beat, sceneSlug, beatIndex) {
    const hasFail = beat.onFail || beat.onFailReadAloud;
    const hasSuccess = beat.onSuccess || beat.onSuccessReadAloud;
    if (!hasFail && !hasSuccess) return "";
    const saved = readBeatResult(sceneSlug, beatIndex);
    let html = '<div class="beat-results" data-beat-index="' + beatIndex + '">';
    if (hasFail) html += renderBeatResultPanel("fail", beat.onFail, beat.onFailReadAloud, saved === "fail");
    if (hasSuccess) html += renderBeatResultPanel("success", beat.onSuccess, beat.onSuccessReadAloud, saved === "success");
    html += "</div>";
    return html;
  }

  function renderCheckCallout(checkRef, checksContent, sceneSlug, beatIndex) {
    if (!checkRef) return "";
    const anchorId = findCheckAnchorId(checksContent, checkRef);
    const norm = normalizeCheckRef(checkRef);
    const slugForm = /^[a-z_]+-\d+$/i.test(checkRef.trim());
    let title = norm.raw || checkRef;
    if (slugForm && norm.dc != null) {
      title = norm.skill.charAt(0).toUpperCase() + norm.skill.slice(1) + " DC " + norm.dc;
    }
    const saved = readBeatResult(sceneSlug, beatIndex);
    let html = '<div class="check-callout" data-check-anchor="' + esc(anchorId) + '" data-beat-index="' + beatIndex + '">';
    html += '<span class="check-callout-title">' + esc(title) + "</span>";
    html += '<div class="check-callout-actions">';
    html += '<button type="button" class="check-show-btn" data-anchor="' + esc(anchorId) + '">' + esc(uiLabel("rollCheck")) + "</button>";
    html += '<button type="button" class="branch-quick-btn" data-branch-id="a" data-result="fail" data-scene-slug="' + esc(sceneSlug) + '" data-beat-index="' + beatIndex + '" aria-expanded="' + (saved === "fail" ? "true" : "false") + '" aria-label="' + esc(uiLabel("revealFail")) + '">' + esc(uiLabel("rolledFail")) + "</button>";
    html += '<button type="button" class="branch-quick-btn" data-branch-id="b" data-result="success" data-scene-slug="' + esc(sceneSlug) + '" data-beat-index="' + beatIndex + '" aria-expanded="' + (saved === "success" ? "true" : "false") + '" aria-label="' + esc(uiLabel("revealSuccess")) + '">' + esc(uiLabel("rolledSuccess")) + "</button>";
    html += "</div></div>";
    return html;
  }

  function renderBeatStepper(parsed, checksContent, sceneSlug) {
    const beatCount = parsed.beats.length;
    const activeIndex = readBeatIndex(sceneSlug, beatCount);
    const stepperId = esc(sceneSlug) + "-beat-stepper";
    let html = '<div class="beat-stepper" id="' + stepperId + '" data-scene-slug="' + esc(sceneSlug) + '" data-beat-count="' + beatCount + '">';
    if (parsed.prefix) html += renderMixedContentFlat(parsed.prefix);
    html += '<div class="beat-dots" role="tablist" aria-label="' + esc(uiLabel("beatOf")) + '">';
    parsed.beats.forEach(function (beat, i) {
      html += '<button type="button" class="beat-dot" role="tab" data-beat-index="' + i + '" aria-label="' + esc(beat.label) + '" aria-current="' + (i === activeIndex ? "true" : "false") + '"></button>';
    });
    html += "</div>";
    parsed.beats.forEach(function (beat, i) {
      const hidden = i !== activeIndex ? " hidden" : "";
      html += '<div class="beat-panel" role="tabpanel" data-beat-index="' + i + '"' + hidden + ">";
      html += '<p class="beat-panel-title">' + esc(beat.label) + "</p>";
      html += renderMixedContentFlat(beat.body);
      html += renderAskCallout(beat);
      html += renderCheckCallout(beat.checkRef, checksContent, sceneSlug, i);
      html += renderBeatResults(beat, sceneSlug, i);
      html += "</div>";
    });
    html += '<div class="beat-nav">';
    html += '<button type="button" class="beat-prev-btn"' + (activeIndex <= 0 ? " disabled" : "") + ">" + esc(uiLabel("beatPrev")) + "</button>";
    html += '<span class="beat-of-label">' + esc(uiLabel("beatOf")) + " " + (activeIndex + 1) + " " + esc(uiLabel("beatOfTotal")) + " " + beatCount + "</span>";
    html += '<button type="button" class="beat-next-btn"' + (activeIndex >= beatCount - 1 ? " disabled" : "") + ">" + esc(uiLabel("beatNext")) + "</button>";
    html += "</div></div>";
    return html;
  }

  function renderReadAloud(content, checksContent, sceneSlug) {
    if (!content || !content.trim()) return "";
    const beats = parseBeatBlocks(content);
    if (beats) {
      return renderBeatStepper(beats, checksContent || "", sceneSlug || "");
    }
    if (readAloudNeedsMixedRender(content)) {
      return renderMixedContentFlat(content);
    }
    const paragraphs = content.replace(/^>\s?/gm, "").trim().split(/\n\s*\n/);
    return paragraphs.map(function (para) {
      return "<p>" + enrichText(para.replace(/\n/g, " ").trim()) + "</p>";
    }).join("");
  }

  function renderSceneChrome(sceneSlug) {
    const prog = sceneProgress(sceneSlug);
    const isDone = prog.status === "done";
    const sid = slugToSessionId(sceneSlug);
    let badge = "";
    if (sid && dmScriptSessions.length) {
      badge = '<span class="session-badge">' + esc(sessionLabelText(dmScriptSessions.find(function (s) { return s.id === sid; }))) + "</span>";
    }
    let html = '<div class="scene-chrome" data-scene-slug="' + esc(sceneSlug) + '">';
    html += '<button type="button" class="mark-scene-btn" data-done="' + (isDone ? "true" : "false") + '">';
    html += esc(isDone ? uiLabel("reopenScene") : uiLabel("markSceneDone"));
    html += "</button>" + badge + "</div>";
    return html;
  }

  function block(label, content, cls, opts) {
    opts = opts || {};
    if (!content || !content.trim()) return "";
    if (cls === "read-aloud") {
      const body = renderReadAloud(content, opts.checksContent || "", opts.sceneSlug || "");
      return '<div class="read-aloud beat-stepper-wrap"><strong>' + esc(label) + "</strong>" + body + "</div>";
    }
    const sectionKey = opts.sectionKey || "";
    const sectionId = sectionKey ? ' id="section-' + esc(sectionKey) + '"' : "";
    const inner = renderMixedContent(content);
    const blockCls = cls === "dm-notes" ? " scene-block dm-notes-block" : " scene-block";
    if (opts.collapsible) {
      const collapsed = opts.collapsed !== false;
      return '<div class="scene-section collapsible' + (collapsed ? " collapsed" : "") + blockCls + '"' + sectionId + ">" +
        '<button type="button" class="section-toggle">' + esc(label) + ' <span class="section-chevron">▸</span></button>' +
        '<div class="section-body"><div>' + inner + "</div></div></div>";
    }
    return '<div class="' + blockCls.trim() + '"' + sectionId + "><h3>" + esc(label) + "</h3><div>" + inner + "</div></div>";
  }

  function annotateCheckAnchors(rootEl) {
    if (!rootEl) return;
    const checks = rootEl.querySelector("#section-checks");
    if (!checks) return;
    let idx = 0;
    checks.querySelectorAll(".prose-line").forEach(function (line) {
      const text = line.textContent || "";
      if (/DC\s*\d+/i.test(text)) {
        line.id = "check-line-" + idx;
        idx += 1;
      }
    });
  }

  function showBeatPanel(stepper, index) {
    const beatCount = parseInt(stepper.getAttribute("data-beat-count"), 10) || 0;
    const i = Math.max(0, Math.min(index, beatCount - 1));
    stepper.querySelectorAll(".beat-panel").forEach(function (panel) {
      panel.hidden = parseInt(panel.getAttribute("data-beat-index"), 10) !== i;
    });
    stepper.querySelectorAll(".beat-dot").forEach(function (dot) {
      dot.setAttribute("aria-current", parseInt(dot.getAttribute("data-beat-index"), 10) === i ? "true" : "false");
    });
    const prevBtn = stepper.querySelector(".beat-prev-btn");
    const nextBtn = stepper.querySelector(".beat-next-btn");
    const label = stepper.querySelector(".beat-of-label");
    if (prevBtn) prevBtn.disabled = i <= 0;
    if (nextBtn) nextBtn.disabled = i >= beatCount - 1;
    if (label) {
      label.textContent = uiLabel("beatOf") + " " + (i + 1) + " " + uiLabel("beatOfTotal") + " " + beatCount;
    }
    const sceneSlug = stepper.getAttribute("data-scene-slug") || "";
    if (sceneSlug) updateSceneProgress(sceneSlug, { beatIndex: i, status: sceneProgress(sceneSlug).status === "done" ? "done" : "in_progress" });
  }

  function scrollToCheckAnchor(rootEl, anchorId) {
    const el = rootEl.querySelector("#" + CSS.escape(anchorId)) || rootEl.querySelector("#section-checks");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("check-anchor-highlight");
    window.setTimeout(function () { el.classList.remove("check-anchor-highlight"); }, 2500);
  }

  function quickActivateBranch(rootEl, sceneSlug, branchId) {
    const switcher = rootEl.querySelector('.branch-switcher[data-scene-slug="' + sceneSlug + '"]');
    if (!switcher) {
      scrollToCheckAnchor(rootEl, "section-checks");
      return;
    }
    const tab = switcher.querySelector('.branch-tab[data-branch-id="' + branchId + '"]');
    if (tab) {
      activateBranchTab(switcher, tab);
      switcher.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function saveBeatResult(sceneSlug, beatIndex, result) {
    const sp = sceneProgress(sceneSlug);
    const beatResults = Object.assign({}, sp.beatResults || {});
    beatResults[String(beatIndex)] = result;
    updateSceneProgress(sceneSlug, { beatResults: beatResults });
  }

  function revealBeatResult(beatPanel, result) {
    if (!beatPanel) return;
    const resultsEl = beatPanel.querySelector(".beat-results");
    if (!resultsEl) return;
    resultsEl.querySelectorAll(".beat-result-panel").forEach(function (panel) {
      const match = panel.getAttribute("data-result") === result;
      panel.hidden = !match;
      panel.setAttribute("aria-hidden", match ? "false" : "true");
    });
    const callout = beatPanel.querySelector(".check-callout");
    if (callout) {
      callout.querySelectorAll(".branch-quick-btn").forEach(function (btn) {
        const isMatch = btn.getAttribute("data-result") === result;
        btn.setAttribute("aria-expanded", isMatch ? "true" : "false");
      });
    }
  }

  function restoreBeatResultForPanel(beatPanel, sceneSlug) {
    if (!beatPanel) return;
    const beatIndex = parseInt(beatPanel.getAttribute("data-beat-index"), 10);
    const saved = readBeatResult(sceneSlug, beatIndex);
    if (saved) revealBeatResult(beatPanel, saved);
  }

  function bindBeatControls(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll(".beat-stepper").forEach(function (stepper) {
      const beatCount = parseInt(stepper.getAttribute("data-beat-count"), 10) || 0;
      let current = readBeatIndex(stepper.getAttribute("data-scene-slug") || "", beatCount);
      showBeatPanel(stepper, current);
      const sceneSlug = stepper.getAttribute("data-scene-slug") || "";
      stepper.querySelectorAll(".beat-panel").forEach(function (panel) {
        restoreBeatResultForPanel(panel, sceneSlug);
      });
      stepper.querySelectorAll(".beat-dot").forEach(function (dot) {
        dot.addEventListener("click", function () {
          showBeatPanel(stepper, parseInt(dot.getAttribute("data-beat-index"), 10));
        });
      });
      const prevBtn = stepper.querySelector(".beat-prev-btn");
      const nextBtn = stepper.querySelector(".beat-next-btn");
      if (prevBtn) {
        prevBtn.addEventListener("click", function () {
          const active = stepper.querySelector('.beat-dot[aria-current="true"]');
          const idx = active ? parseInt(active.getAttribute("data-beat-index"), 10) : 0;
          if (idx > 0) showBeatPanel(stepper, idx - 1);
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener("click", function () {
          const active = stepper.querySelector('.beat-dot[aria-current="true"]');
          const idx = active ? parseInt(active.getAttribute("data-beat-index"), 10) : 0;
          if (idx < beatCount - 1) showBeatPanel(stepper, idx + 1);
        });
      }
    });
    rootEl.querySelectorAll(".check-show-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        scrollToCheckAnchor(rootEl, btn.getAttribute("data-anchor") || "section-checks");
      });
    });
    rootEl.querySelectorAll(".branch-quick-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const sceneSlug = btn.getAttribute("data-scene-slug") || "";
        const branchId = btn.getAttribute("data-branch-id") || "a";
        const result = btn.getAttribute("data-result");
        const beatIndex = btn.getAttribute("data-beat-index");
        if (beatIndex != null && result) {
          const beatPanel = btn.closest(".beat-panel");
          revealBeatResult(beatPanel, result);
          saveBeatResult(sceneSlug, parseInt(beatIndex, 10), result);
        }
        quickActivateBranch(rootEl, sceneSlug, branchId);
      });
    });
  }

  function bindSectionToggles(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll(".section-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        btn.closest(".scene-section").classList.toggle("collapsed");
      });
    });
  }

  function bindSceneChrome(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll(".mark-scene-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const chrome = btn.closest(".scene-chrome");
        const slug = chrome ? chrome.getAttribute("data-scene-slug") : "";
        if (!slug) return;
        const isDone = btn.getAttribute("data-done") === "true";
        updateSceneProgress(slug, { status: isDone ? "in_progress" : "done" });
        buildListNav();
        renderPage();
      });
    });
  }

  function renderScene(scene, sceneSlug) {
    let html = '<article class="entity-card"><h2>' + esc(scene.title) + "</h2>";
    html += block(sectionLabel("summary"), scene.summary, "scene-block", { collapsible: true, sectionKey: "summary", collapsed: true });
    html += block(sectionLabel("readAloud"), scene.readAloud, "read-aloud", { sceneSlug: sceneSlug, checksContent: scene.checks });
    html += block(sectionLabel("checks"), scene.checks, "scene-block", { sectionKey: "checks" });
    html += block(sectionLabel("contingencies"), scene.contingencies, "scene-block", { collapsible: true, sectionKey: "contingencies", collapsed: true });
    html += block(sectionLabel("dmNotes"), scene.dm, "dm-notes", { collapsible: true, sectionKey: "dm-notes", collapsed: true });
    html += renderSceneChrome(sceneSlug);
    return html + "</article>";
  }

  function scenePageLabel(idx, slug) {
    const base = "Scene " + (idx + 1) + " of " + entries().length;
    const sid = slugToSessionId(slug);
    if (!sid || !dmScriptSessions.length) return base;
    const session = dmScriptSessions.find(function (s) { return s.id === sid; });
    if (!session) return base;
    return sessionLabelText(session) + " · " + base;
  }

  function renderPage() {
    const uiEl = ui.defaultUi("dm-script-library");
    if (window.DnDCore.accessGate.isGateActive(uiEl.root)) return;
    const list = entries();
    if (!uiEl.page || !uiEl.empty) return;
    const idx = Math.max(0, state.page - 1);
    const entry = list[idx] || { slug: "", en: {}, ua: {} };
    const scene = entry[state.lang] || entry.en || {};
    if (entry.slug) markSceneInProgress(entry.slug);
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderScene(scene, entry.slug);
    annotateCheckAnchors(uiEl.page);
    bindBranchControls(uiEl.page);
    bindBeatControls(uiEl.page);
    bindSectionToggles(uiEl.page);
    bindSceneChrome(uiEl.page);
    uiEl.pageInfo.textContent = scenePageLabel(idx, entry.slug);
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= list.length - 1;
    document.querySelectorAll("#list-nav .bookmark-btn").forEach(function (btn) {
      const page = parseInt(btn.getAttribute("data-page"), 10) || 0;
      btn.setAttribute("aria-pressed", page === state.page ? "true" : "false");
    });
  }

  function buildSceneButton(e, i) {
    const scene = e[state.lang] || e.en || {};
    const prog = sceneProgress(e.slug);
    let cls = "bookmark-btn";
    if (prog.status === "done") cls += " scene-done";
    else if (prog.status === "in_progress") cls += " scene-in-progress";
    return '<button type="button" class="' + cls + '" data-page="' + (i + 1) + '" data-slug="' + esc(e.slug) + '">' + esc(scene.title) + "</button>";
  }

  function bindListNavButtons(nav) {
    nav.querySelectorAll(".bookmark-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.page = parseInt(btn.getAttribute("data-page"), 10) || 1;
        renderPage();
      });
    });
    nav.querySelectorAll(".session-group-header").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const group = btn.closest(".session-group");
        const sid = parseInt(group.getAttribute("data-session-id"), 10);
        group.classList.toggle("collapsed");
        toggleSessionCollapsed(sid);
      });
    });
    nav.querySelectorAll(".dm-script-nav-toolbar button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const filter = btn.getAttribute("data-nav-filter");
        state.navFilter = filter;
        const p = readProgress();
        p.navFilter = filter;
        writeProgress(p);
        nav.querySelectorAll(".dm-script-nav-toolbar button").forEach(function (b) {
          b.setAttribute("aria-pressed", b.getAttribute("data-nav-filter") === filter ? "true" : "false");
        });
        buildListNav();
      });
    });
  }

  function buildListNav() {
    const nav = document.getElementById("list-nav");
    if (!nav) return;
    const list = entries();
    const slugToPage = {};
    list.forEach(function (e, i) { slugToPage[e.slug] = i + 1; });

    if (!dmScriptSessions.length) {
      nav.innerHTML = list.map(function (e, i) { return buildSceneButton(e, i); }).join("");
      bindListNavButtons(nav);
      return;
    }

    const assigned = {};
    dmScriptSessions.forEach(function (session) {
      (session.scenes || []).forEach(function (slug) { assigned[slug] = true; });
    });
    const unassigned = list.filter(function (e) { return !assigned[e.slug]; });

    const p = readProgress();
    state.navFilter = p.navFilter || state.navFilter || "all";
    state.activeSessionId = resolveActiveSessionId();

    let html = '<div class="dm-script-nav-toolbar" role="group">';
    html += '<button type="button" data-nav-filter="all" aria-pressed="' + (state.navFilter === "all" ? "true" : "false") + '">' + esc(uiLabel("allScenes")) + "</button>";
    html += '<button type="button" data-nav-filter="current" aria-pressed="' + (state.navFilter === "current" ? "true" : "false") + '">' + esc(uiLabel("currentSessionOnly")) + "</button>";
    html += "</div>";

    dmScriptSessions.forEach(function (session) {
      const slugs = (session.scenes || []).filter(function (slug) {
        return slugToPage[slug] && sceneVisibleInNav(slug);
      });
      if (!slugs.length && state.navFilter === "current" && session.id !== state.activeSessionId) return;
      const collapsed = isSessionCollapsed(session.id);
      html += '<div class="session-group' + (collapsed ? " collapsed" : "") + '" data-session-id="' + session.id + '">';
      html += '<button type="button" class="session-group-header"><span class="chevron">▼</span> ' + esc(sessionLabelText(session)) + "</button>";
      html += '<div class="session-scenes">';
      slugs.forEach(function (slug) {
        const e = list.find(function (x) { return x.slug === slug; });
        if (e) html += buildSceneButton(e, slugToPage[slug] - 1);
      });
      html += "</div></div>";
    });

    if (unassigned.length && state.navFilter !== "current") {
      const collapsed = isSessionCollapsed(0);
      html += '<div class="session-group' + (collapsed ? " collapsed" : "") + '" data-session-id="0">';
      html += '<button type="button" class="session-group-header"><span class="chevron">▼</span> ' + esc(uiLabel("unassignedScenes")) + "</button>";
      html += '<div class="session-scenes">';
      unassigned.forEach(function (e) {
        html += buildSceneButton(e, slugToPage[e.slug] - 1);
      });
      html += "</div></div>";
    }

    nav.innerHTML = html;
    bindListNavButtons(nav);
  }

  function entries() {
    return raws.map(function (r) { return assembleEntry(r.slug, r); });
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
    ui.initBookChrome("dm-script", function (l) {
      state.lang = l;
      const uiEl = ui.defaultUi("dm-script-library");
      if (window.DnDCore.accessGate.isGateActive(uiEl.root)) return;
      buildListNav();
      renderPage();
    });
    state.lang = shell.parseUrlParams().lang;
    const uiEl = ui.defaultUi("dm-script-library");
    try {
      loadConfig = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "dm-script", indexFileName: "dm-script-index.json",
        demoIndex: "demo/dm-script-index.json",
      });
      scenarioSlug = loadConfig.scenario || "";
      manifestData = await loadManifest(scenarioSlug);
      dmScriptSessions = (manifestData && manifestData.dmScriptSessions) || [];
      const prog = readProgress();
      state.navFilter = prog.navFilter || "all";
      state.activeSessionId = resolveActiveSessionId();
      if (!(await window.DnDCore.accessGate.ensureUnlocked("dm-script", loadConfig.scenario, uiEl))) return;
      raws = await loader.loadData(loadConfig, false, function (slug, texts) {
        return { slug: slug, en: texts.en, ua: texts.ua };
      });
      buildListNav();
      focusSceneFromUrl();
      try {
        renderPage();
      } catch (renderErr) {
        ui.setError(uiEl, "Failed to render DM script", esc(renderErr && renderErr.message ? renderErr.message : "Unknown render error"));
        return;
      }
      ui.bindPagination(state, uiEl, renderPage, function () { return raws.length; });
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
