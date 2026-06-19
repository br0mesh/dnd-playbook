(function (global) {
  "use strict";

  const SECTIONS = [
    { id: "dm-script", label: ["DM Script", "Сценарій DM"], path: "../DmScript/library.html", dmOnly: true },
    { id: "characters", label: ["Characters", "Персонажі"], path: "../Characters/library.html" },
    { id: "monsters", label: ["Monsters", "Монстри"], path: "../Monsters/library.html" },
    { id: "npc", label: ["NPC", "НПК"], path: "../Npc/library.html" },
    { id: "spells", label: ["Spells", "Заклинання"], path: "../Spells/library.html" },
    { id: "items", label: ["Items", "Предмети"], path: "../Items/library.html" },
    { id: "maps", label: ["Maps", "Карти"], path: "../Maps/library.html", dmOnly: true },
  ];

  const MODE_LABELS = {
    dm: ["DM mode", "Режим Майстра"],
    player: ["Player view", "Вигляд гравця"],
  };

  const shell = global.DnDCore && global.DnDCore.shell;
  const locale = global.DnDCore && global.DnDCore.locale;

  function sectionLabel(sec, lang) {
    if (locale) return locale.pickLabel(sec.label, lang);
    const lbl = sec.label;
    if (Array.isArray(lbl)) return lang === "ua" ? (lbl[1] || lbl[0]) : lbl[0];
    return lbl;
  }

  function parseParams() {
    return shell ? shell.parseUrlParams() : { scenario: "", lang: "en", mode: "player" };
  }

  function buildQuery(overrides) {
    return shell ? shell.buildQuery(overrides) : "";
  }

  function sectionUrl(sectionId, params) {
    const sec = SECTIONS.find(function (s) { return s.id === sectionId; });
    if (!sec) return "#";
    const q = buildQuery(Object.assign({}, params || parseParams(), { section: undefined }));
    return sec.path + q;
  }

  function renderTopNav(containerId, activeSection, options) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const params = parseParams();
    const esc = shell.esc;
    const showHome = options && options.showHome;
    const lang = params.lang;
    el.dataset.activeSection = activeSection;
    let html = "";
    if (showHome) {
      html += '<a class="book-home" href="../../index.html' + buildQuery(params) + '">DnD Book</a>';
    }
    html += '<nav class="book-section-nav" aria-label="Book sections">';
    SECTIONS.forEach(function (sec) {
      const active = sec.id === activeSection ? ' aria-current="page"' : "";
      html += '<a href="' + esc(sectionUrl(sec.id, params)) + '"' + active + ">" + esc(sectionLabel(sec, lang)) + "</a>";
    });
    html += "</nav>";
    if (params.scenario) {
      html += '<span class="book-scenario-tag">' + esc(params.scenario) + "</span>";
    }
    el.innerHTML = html;
  }

  function refreshTopNavLabels(lang) {
    const el = document.getElementById("book-nav");
    if (!el || !el.dataset.activeSection) return;
    renderTopNav("book-nav", el.dataset.activeSection, { showHome: true });
    const enBtn = document.getElementById("lang-en");
    const uaBtn = document.getElementById("lang-ua");
    if (enBtn) enBtn.setAttribute("aria-pressed", lang === "en" ? "true" : "false");
    if (uaBtn) uaBtn.setAttribute("aria-pressed", lang === "ua" ? "true" : "false");
    const modeBtn = document.getElementById("mode-dm");
    if (modeBtn && !modeBtn.hidden && locale) {
      const mode = parseParams().mode;
      modeBtn.textContent = locale.pickLabel(MODE_LABELS[mode === "dm" ? "dm" : "player"], lang);
    }
  }

  function bindLangToggle(onChange) {
    const params = parseParams();
    const enBtn = document.getElementById("lang-en");
    const uaBtn = document.getElementById("lang-ua");
    if (!enBtn || !uaBtn) return params.lang;
    enBtn.setAttribute("aria-pressed", params.lang === "en" ? "true" : "false");
    uaBtn.setAttribute("aria-pressed", params.lang === "ua" ? "true" : "false");
    enBtn.addEventListener("click", function () {
      if (onChange) onChange("en");
      const q = buildQuery({ lang: "en" });
      global.history.replaceState(null, "", global.location.pathname + q);
      enBtn.setAttribute("aria-pressed", "true");
      uaBtn.setAttribute("aria-pressed", "false");
      refreshTopNavLabels("en");
    });
    uaBtn.addEventListener("click", function () {
      if (onChange) onChange("ua");
      const q = buildQuery({ lang: "ua" });
      global.history.replaceState(null, "", global.location.pathname + q);
      uaBtn.setAttribute("aria-pressed", "true");
      enBtn.setAttribute("aria-pressed", "false");
      refreshTopNavLabels("ua");
    });
    return params.lang;
  }

  function bindModeToggle(onChange) {
    const params = parseParams();
    const btn = document.getElementById("mode-dm");
    if (!btn) return params.mode;
    btn.hidden = false;
    btn.setAttribute("aria-pressed", params.mode === "dm" ? "true" : "false");
    const modeLang = parseParams().lang;
    if (locale) {
      btn.textContent = locale.pickLabel(MODE_LABELS[params.mode === "dm" ? "dm" : "player"], modeLang);
    }
    btn.addEventListener("click", function () {
      const next = params.mode === "dm" ? "player" : "dm";
      params.mode = next;
      if (onChange) onChange(next);
      const q = buildQuery({ mode: next });
      global.history.replaceState(null, "", global.location.pathname + q);
      btn.setAttribute("aria-pressed", next === "dm" ? "true" : "false");
      if (locale) {
        btn.textContent = locale.pickLabel(MODE_LABELS[next === "dm" ? "dm" : "player"], parseParams().lang);
      }
    });
    return params.mode;
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.bookNav = {
    SECTIONS: SECTIONS,
    parseParams: parseParams,
    buildQuery: buildQuery,
    sectionUrl: sectionUrl,
    sectionLabel: sectionLabel,
    renderTopNav: renderTopNav,
    bindLangToggle: bindLangToggle,
    bindModeToggle: bindModeToggle,
  };
})(typeof window !== "undefined" ? window : this);
