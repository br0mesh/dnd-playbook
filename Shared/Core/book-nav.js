(function (global) {
  "use strict";

  const SECTIONS = [
    { id: "dm-script", label: "DM Script", path: "../DmScript/library.html", dmOnly: true },
    { id: "characters", label: "Characters", path: "../Characters/library.html" },
    { id: "monsters", label: "Monsters", path: "../Monsters/library.html" },
    { id: "npc", label: "NPC", path: "../Npc/library.html" },
    { id: "spells", label: "Spells", path: "../Spells/library.html" },
    { id: "items", label: "Items", path: "../Items/library.html" },
    { id: "maps", label: "Maps", path: "../Maps/library.html", dmOnly: true },
  ];

  const shell = global.DnDCore && global.DnDCore.shell;

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
    let html = "";
    if (showHome) {
      html += '<a class="book-home" href="../../index.html' + buildQuery(params) + '">DnD Book</a>';
    }
    html += '<nav class="book-section-nav" aria-label="Book sections">';
    SECTIONS.forEach(function (sec) {
      const active = sec.id === activeSection ? ' aria-current="page"' : "";
      html += '<a href="' + esc(sectionUrl(sec.id, params)) + '"' + active + ">" + esc(sec.label) + "</a>";
    });
    html += "</nav>";
    if (params.scenario) {
      html += '<span class="book-scenario-tag">' + esc(params.scenario) + "</span>";
    }
    el.innerHTML = html;
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
    });
    uaBtn.addEventListener("click", function () {
      if (onChange) onChange("ua");
      const q = buildQuery({ lang: "ua" });
      global.history.replaceState(null, "", global.location.pathname + q);
      uaBtn.setAttribute("aria-pressed", "true");
      enBtn.setAttribute("aria-pressed", "false");
    });
    return params.lang;
  }

  function bindModeToggle(onChange) {
    const params = parseParams();
    const btn = document.getElementById("mode-dm");
    if (!btn) return params.mode;
    btn.hidden = false;
    btn.setAttribute("aria-pressed", params.mode === "dm" ? "true" : "false");
    btn.textContent = params.mode === "dm" ? "DM mode" : "Player view";
    btn.addEventListener("click", function () {
      const next = params.mode === "dm" ? "player" : "dm";
      params.mode = next;
      if (onChange) onChange(next);
      const q = buildQuery({ mode: next });
      global.history.replaceState(null, "", global.location.pathname + q);
      btn.setAttribute("aria-pressed", next === "dm" ? "true" : "false");
      btn.textContent = next === "dm" ? "DM mode" : "Player view";
    });
    return params.mode;
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.bookNav = {
    SECTIONS: SECTIONS,
    parseParams: parseParams,
    buildQuery: buildQuery,
    sectionUrl: sectionUrl,
    renderTopNav: renderTopNav,
    bindLangToggle: bindLangToggle,
    bindModeToggle: bindModeToggle,
  };
})(typeof window !== "undefined" ? window : this);
