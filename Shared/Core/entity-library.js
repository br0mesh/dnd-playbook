(function (global) {
  "use strict";

  const shell = global.DnDCore.shell;
  const esc = shell.esc;

  function defaultUi(rootId) {
    return {
      root: document.getElementById(rootId),
      empty: document.getElementById("empty-state"),
      page: document.getElementById("content-page"),
      pageInfo: document.getElementById("page-info"),
      prev: document.getElementById("prev-page"),
      next: document.getElementById("next-page"),
      search: document.getElementById("search"),
    };
  }

  function setLoading(ui, msg) {
    if (ui.root) ui.root.setAttribute("data-loading", "true");
    if (ui.empty) {
      ui.empty.hidden = false;
      ui.empty.classList.remove("load-error");
      ui.empty.innerHTML = "<strong>" + esc(msg || "Loading…") + "</strong>";
    }
    if (ui.page) ui.page.hidden = true;
  }

  function setError(ui, title, detail) {
    if (ui.root) ui.root.removeAttribute("data-loading");
    if (ui.empty) {
      ui.empty.hidden = false;
      ui.empty.classList.add("load-error");
      ui.empty.innerHTML = "<strong>" + esc(title) + "</strong>" + (detail ? "<p>" + detail + "</p>" : "");
    }
    if (ui.page) ui.page.hidden = true;
  }

  function setReady(ui) {
    if (ui.root) ui.root.removeAttribute("data-loading");
    if (ui.empty) ui.empty.classList.remove("load-error");
  }

  function bindPagination(state, ui, renderPage, totalPagesFn) {
    if (!ui.prev || !ui.next) return;
    ui.prev.addEventListener("click", function () {
      if (state.page > 1) { state.page--; renderPage(); }
    });
    ui.next.addEventListener("click", function () {
      if (state.page < totalPagesFn()) { state.page++; renderPage(); }
    });
  }

  function bindListSidebar(containerId, items, state, key, renderPage) {
    const nav = document.getElementById(containerId);
    if (!nav) return;
    nav.innerHTML = "";
    items.forEach(function (pair) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bookmark-btn";
      btn.textContent = pair[1];
      btn.setAttribute("aria-pressed", state[key] === pair[0] ? "true" : "false");
      btn.addEventListener("click", function () {
        state[key] = pair[0];
        state.page = 1;
        nav.querySelectorAll(".bookmark-btn").forEach(function (b, i) {
          b.setAttribute("aria-pressed", items[i][0] === state[key] ? "true" : "false");
        });
        renderPage();
      });
      nav.appendChild(btn);
    });
  }

  function initBookChrome(sectionId, langCallback, modeCallback, showMode) {
    global.DnDCore.bookNav.renderTopNav("book-nav", sectionId, { showHome: true });
    const lang = global.DnDCore.bookNav.bindLangToggle(langCallback);
    if (showMode && document.getElementById("mode-dm")) {
      global.DnDCore.bookNav.bindModeToggle(modeCallback);
    }
    return { lang: lang, mode: shell.parseUrlParams().mode };
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.entityUi = {
    defaultUi: defaultUi,
    setLoading: setLoading,
    setError: setError,
    setReady: setReady,
    bindPagination: bindPagination,
    bindListSidebar: bindListSidebar,
    initBookChrome: initBookChrome,
  };
})(typeof window !== "undefined" ? window : this);
