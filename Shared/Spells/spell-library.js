(function () {
  "use strict";

  const shell = window.DnDCore.shell;
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader({
    indexGlobal: "SPELL_LIBRARY_INDEX",
    mdGlobal: "__SPELL_MD__",
    jsonOfflineGlobal: "SPELL_LIBRARY_SPELLS",
    defaultSourcesJs: "demo/spells-sources.js",
    defaultOfflineJs: "demo/spells-offline.js",
    clearGlobals: function () {
      delete window.SPELL_LIBRARY_SPELLS;
      delete window.__SPELL_MD__;
      delete window.SPELL_LIBRARY_INDEX;
    },
  });

  const SCHOOL_BOOKMARKS = [
    ["all", "All schools"], ["abjuration", "Abjuration"], ["conjuration", "Conjuration"],
    ["divination", "Divination"], ["enchantment", "Enchantment"], ["evocation", "Evocation"],
    ["illusion", "Illusion"], ["necromancy", "Necromancy"], ["transmutation", "Transmutation"],
  ];
  const LEVEL_BOOKMARKS = [
    ["all", "All levels"], ["cantrip", "Cantrip"], ["1", "1st"], ["2", "2nd"],
    ["3", "3rd"], ["4", "4th"], ["5", "5th"], ["6", "6th"], ["7", "7th"], ["8", "8th"], ["9", "9th"],
  ];
  const SCHOOL_CLASS = {
    abjuration: "school-abjuration", conjuration: "school-conjuration", divination: "school-divination",
    enchantment: "school-enchantment", evocation: "school-evocation", illusion: "school-illusion",
    necromancy: "school-necromancy", transmutation: "school-transmutation", unknown: "school-unknown",
  };
  const SCHOOL_SVG = {
    abjuration: '<path d="M12 2L4 6v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V6l-8-4z"/>',
    conjuration: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    divination: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
    enchantment: '<path d="M12 21s-6-4.5-6-10a4 4 0 0 1 7-2.5A4 4 0 0 1 18 11c0 5.5-6 10-6 10z"/>',
    evocation: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
    illusion: '<path d="M12 4c-4 0-7 2.5-7 6s3 6 7 6 7-2.5 7-6-3-6-7-6z"/>',
    necromancy: '<path d="M12 2a5 5 0 0 0-5 5c0 2.5 2 4.5 5 9 3-4.5 5-6.5 5-9a5 5 0 0 0-5-5z"/>',
    transmutation: '<path d="M7 17l5-14 5 14H7z"/>',
    unknown: '<circle cx="12" cy="12" r="9"/>',
  };
  const RULE_LABELS = {
    en: { time: "Time", range: "Range", components: "Components", duration: "Duration", higher: "At Higher Levels" },
    ua: { time: "Час", range: "Дальність", components: "Компоненти", duration: "Тривалість", higher: "На вищих рівнях" },
  };
  const SEARCH_PLACEHOLDER = { en: "Search spell by name…", ua: "Пошук за назвою…" };
  const LEVEL_SUFFIX = { cantrip: "cantrip", "1st": "1", "2nd": "2", "3rd": "3", "4th": "4", "5th": "5", "6th": "6", "7th": "7", "8th": "8", "9th": "9" };
  const POLL_MS = 3000;
  const PER_PAGE = { single: 1, grid: 16 };

  const state = { lang: "en", school: "all", level: "all", search: "", page: 1, perPage: PER_PAGE.single, focusSlug: null };
  let spells = [];
  let filtered = [];
  let searchTimer = null;
  let uiReady = false;
  let dataFingerprint = "";
  let loadConfig = null;

  function keysFromSlug(slug) {
    const parts = slug.split("_");
    return { school_key: parts[parts.length - 1] || "unknown", level_key: LEVEL_SUFFIX[parts[parts.length - 2]] || parts[parts.length - 2] || "unknown" };
  }

  function parseSpellLang(text, ua) {
    const headerBlock = md.parseBoldFields(md.sectionByHeading(text, "Header") || text.split("---")[0]);
    const castingBlock = md.parseBoldFields(ua ? md.sectionAnyHeading(text, "Casting", "Накладання") : md.sectionByHeading(text, "Casting"));
    const desc = ua ? md.sectionAnyHeading(text, "Description", "Опис") : md.sectionByHeading(text, "Description");
    const higher = ua ? md.sectionAnyHeading(text, "At Higher Levels", "На вищих рівнях") : md.sectionByHeading(text, "At Higher Levels");
    const titleM = text.match(/^#\s+(.+)$/m);
    const name = headerBlock.Name || headerBlock["Назва"] || (titleM ? titleM[1].trim() : "");
    const rangeRaw = castingBlock.Range || castingBlock["Дальність"] || "";
    return {
      name: name,
      level: headerBlock.Level || headerBlock["Рівень"] || "",
      school: headerBlock.School || headerBlock["Школа"] || "",
      casting_time: castingBlock.Time || castingBlock["Час"] || "",
      range: mech.formatDistance(rangeRaw, ua),
      components: castingBlock.Components || castingBlock["Компоненти"] || "",
      duration: castingBlock.Duration || castingBlock["Тривалість"] || "",
      description: mech.formatDistancesInText(desc.trim(), ua),
      at_higher_levels: mech.formatDistancesInText(higher.trim(), ua),
    };
  }

  function parseSpellMarkdown(slug, raw) {
    const cleaned = md.excludeDmNotes(raw);
    const split = md.splitBilingual(cleaned);
    const keys = keysFromSlug(slug);
    return {
      slug: slug, school_key: keys.school_key, level_key: keys.level_key,
      en: parseSpellLang(split.enText, false),
      ua: split.hasUa ? parseSpellLang(split.uaText, true) : {},
    };
  }

  function resolveConfig() {
    const root = document.getElementById("spell-library");
    const params = shell.parseUrlParams();
    const spellsParam = new URLSearchParams(window.location.search).get("spells");
    const cfg = shell.resolveModuleConfig({
      rootEl: root,
      scenarioFolder: "spells",
      indexFileName: "spells-index.json",
      demoIndex: "demo/spells-index.json",
      sourcesJs: "demo/spells-sources.js",
      dataJsonParam: "spells",
    });
    if (spellsParam) cfg.jsonUrl = spellsParam;
    return cfg;
  }

  function schoolIconHtml(schoolKey) {
    const key = SCHOOL_SVG[schoolKey] ? schoolKey : "unknown";
    const cls = SCHOOL_CLASS[key] || "school-unknown";
    return '<span class="school-icon ' + cls + '"><svg viewBox="0 0 24 24" fill="currentColor">' + SCHOOL_SVG[key] + "</svg></span>";
  }

  function renderSpellCard(spell, lang, compact) {
    const block = spell[lang] || spell.en || {};
    const labels = RULE_LABELS[lang] || RULE_LABELS.en;
    const cls = SCHOOL_CLASS[spell.school_key] || "school-unknown";
    const meta = [block.level, block.school].filter(Boolean).join(" · ");
    let higher = "";
    if (block.at_higher_levels && block.at_higher_levels.trim()) {
      higher = '<section class="higher-levels"><h3>' + esc(labels.higher) + "</h3><p>" + mech.highlightDice(block.at_higher_levels) + "</p></section>";
    }
    const rules = '<footer class="spell-rules">' +
      '<div class="rule"><small>' + esc(labels.time) + "</small><span>" + esc(block.casting_time) + "</span></div>" +
      '<div class="rule"><small>' + esc(labels.range) + "</small><span>" + esc(block.range) + "</span></div>" +
      '<div class="rule"><small>' + esc(labels.components) + "</small><span>" + esc(block.components) + "</span></div>" +
      '<div class="rule"><small>' + esc(labels.duration) + "</small><span>" + esc(block.duration) + "</span></div></footer>";
    const interact = compact ? ' data-slug="' + esc(spell.slug) + '" tabindex="0" role="button"' : "";
    return '<article class="spell-card ' + cls + (compact ? " compact" : "") + '"' + interact + ">" +
      '<header class="spell-card-header">' + schoolIconHtml(spell.school_key) +
      '<div><h2 class="spell-name">' + esc(block.name) + '</h2><p class="spell-meta">' + esc(meta) + "</p></div></header>" +
      '<div class="spell-description"><p>' + mech.highlightDice(block.description) + "</p></div>" + rules + higher + "</article>";
  }

  function totalPages() { return filtered.length ? Math.ceil(filtered.length / state.perPage) : 0; }
  function spellsOnPage() { const s = (state.page - 1) * state.perPage; return filtered.slice(s, s + state.perPage); }
  function spellName(spell, lang) { return ((spell[lang] || spell.en || {}).name || "").toLowerCase(); }

  function applyFilters() {
    const q = state.search.trim().toLowerCase();
    filtered = spells.filter(function (s) {
      if (state.school !== "all" && s.school_key !== state.school) return false;
      if (state.level !== "all" && s.level_key !== state.level) return false;
      if (q && !spellName(s, state.lang).includes(q)) return false;
      return true;
    });
    const maxPage = Math.max(1, totalPages());
    if (state.page > maxPage) state.page = maxPage;
    if (state.page < 1) state.page = 1;
  }

  function renderPage() {
    applyFilters();
    const pageEl = document.getElementById("spell-page");
    const emptyEl = document.getElementById("empty-state");
    const pageInfo = document.getElementById("page-info");
    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");
    if (!filtered.length) {
      pageEl.hidden = true;
      emptyEl.hidden = false;
      emptyEl.innerHTML = "<strong>No spells match</strong>";
      pageInfo.textContent = "Page 0 of 0";
      prevBtn.disabled = nextBtn.disabled = true;
      return;
    }
    emptyEl.hidden = true;
    pageEl.hidden = false;
    const compact = state.perPage > 1;
    pageEl.classList.toggle("grid-mode", compact);
    pageEl.innerHTML = spellsOnPage().map(function (s) { return renderSpellCard(s, state.lang, compact); }).join("");
    const pages = totalPages();
    pageInfo.textContent = "Page " + state.page + " of " + pages;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= pages;
  }

  function buildBookmarks(containerId, bookmarks, filterKey, cssPrefix) {
    const nav = document.getElementById(containerId);
    nav.innerHTML = "";
    bookmarks.forEach(function (pair) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bookmark-btn" + (pair[0] !== "all" && cssPrefix === "school" ? " school-" + pair[0] : "");
      btn.textContent = pair[1];
      btn.setAttribute("aria-pressed", state[filterKey] === pair[0] ? "true" : "false");
      btn.addEventListener("click", function () {
        state[filterKey] = pair[0];
        state.page = 1;
        renderPage();
        nav.querySelectorAll(".bookmark-btn").forEach(function (b, i) {
          b.setAttribute("aria-pressed", bookmarks[i][0] === state[filterKey] ? "true" : "false");
        });
      });
      nav.appendChild(btn);
    });
  }

  function setControlsEnabled(enabled) {
    ["search", "lang-en", "lang-ua", "view-1", "view-16", "prev-page", "next-page"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
  }

  function bindUiOnce() {
    if (uiReady) return;
    uiReady = true;
    buildBookmarks("school-nav", SCHOOL_BOOKMARKS, "school", "school");
    buildBookmarks("level-nav", LEVEL_BOOKMARKS, "level", "level");
    const search = document.getElementById("search");
    search.placeholder = SEARCH_PLACEHOLDER[state.lang];
    search.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { state.search = search.value; state.page = 1; renderPage(); }, 200);
    });
    document.getElementById("lang-en").addEventListener("click", function () { state.lang = "en"; search.placeholder = SEARCH_PLACEHOLDER.en; renderPage(); });
    document.getElementById("lang-ua").addEventListener("click", function () { state.lang = "ua"; search.placeholder = SEARCH_PLACEHOLDER.ua; renderPage(); });
    document.getElementById("view-1").addEventListener("click", function () { state.perPage = PER_PAGE.single; state.page = 1; renderPage(); });
    document.getElementById("view-16").addEventListener("click", function () { state.perPage = PER_PAGE.grid; state.page = 1; renderPage(); });
    document.getElementById("prev-page").addEventListener("click", function () { if (state.page > 1) { state.page--; renderPage(); } });
    document.getElementById("next-page").addEventListener("click", function () { if (state.page < totalPages()) { state.page++; renderPage(); } });
    document.getElementById("spell-page").addEventListener("click", function (e) {
      const card = e.target.closest(".spell-card.compact");
      if (!card) return;
      state.perPage = PER_PAGE.single;
      const idx = filtered.findIndex(function (s) { return s.slug === card.getAttribute("data-slug"); });
      if (idx >= 0) { state.page = Math.floor(idx / state.perPage) + 1; renderPage(); }
    });
  }

  async function bootstrap() {
    window.DnDCore.bookNav.renderTopNav("book-nav", "spells", { showHome: true });
    state.lang = window.DnDCore.bookNav.bindLangToggle(function (lang) { state.lang = lang; renderPage(); });
    loadConfig = resolveConfig();
    bindUiOnce();
    setControlsEnabled(false);
    try {
      spells = await loader.loadData(loadConfig, false, parseSpellMarkdown);
      if (!spells.length) throw new Error("No spells in index");
      setControlsEnabled(true);
      renderPage();
      if (loadConfig.poll) {
        setInterval(async function () {
          try {
            const refreshed = await loader.loadData(loadConfig, true, parseSpellMarkdown);
            if (loader.fingerprint(refreshed) !== dataFingerprint) {
              dataFingerprint = loader.fingerprint(refreshed);
              spells = refreshed;
              renderPage();
            }
          } catch (_e) { /* keep last good data */ }
        }, POLL_MS);
      }
      dataFingerprint = loader.fingerprint(spells);
    } catch (err) {
      document.getElementById("empty-state").classList.add("load-error");
      document.getElementById("empty-state").innerHTML = "<strong>Failed to load spells</strong><p>" + esc(err.message) + "</p>";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
