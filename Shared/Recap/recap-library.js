(function () {
  "use strict";

  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const locale = window.DnDCore.locale;
  const esc = shell.esc;
  const state = { lang: "en", page: 1, empty: null };
  const DEFAULT_TITLE = ["Act 1 Recap", "Акт 1 — нагадування"];
  const EMPTY = {
    noScenario: [
      "Choose a scenario to open the Act 1 recap.",
      "Оберіть сценарій, щоб відкрити нагадування акту 1.",
    ],
    missing: [
      "This scenario has no Act 1 recap yet.",
      "У цьому сценарії ще немає нагадування акту 1.",
    ],
  };
  let deck = null;

  function label(pair) {
    return locale.pickLabel(pair, state.lang);
  }

  function slideLabel(slide) {
    return slide.nav ? label(slide.nav) : slide.slug;
  }

  function setTitle(pair) {
    const text = label(pair || DEFAULT_TITLE);
    const titleEl = document.getElementById("recap-title");
    if (titleEl) titleEl.textContent = text;
    document.title = text + " — DnD Book";
  }

  function showEmpty(messagePair) {
    const uiEl = ui.defaultUi("recap-library");
    state.empty = messagePair;
    ui.setReady(uiEl);
    uiEl.empty.hidden = false;
    uiEl.empty.innerHTML = "<strong>" + esc(label(messagePair)) + "</strong>";
    uiEl.page.hidden = true;
    uiEl.pageInfo.textContent = "0 of 0";
    uiEl.prev.disabled = true;
    uiEl.next.disabled = true;
    document.getElementById("list-nav").innerHTML = "";
    setTitle(DEFAULT_TITLE);
  }

  function renderSidebar() {
    const nav = document.getElementById("list-nav");
    if (!deck) {
      nav.innerHTML = "";
      return;
    }
    const listed = {};
    let html = "";
    function addSlides(slides) {
      slides.forEach(function (slide) {
        const idx = deck.slides.indexOf(slide);
        if (idx < 0 || listed[idx]) return;
        listed[idx] = true;
        const pressed = state.page === idx + 1 ? "true" : "false";
        html += '<button type="button" class="bookmark-btn" data-page="' + (idx + 1) +
          '" aria-pressed="' + pressed + '">' + esc(slideLabel(slide)) + "</button>";
      });
    }
    (deck.chapters || []).forEach(function (ch) {
      const slides = deck.slides.filter(function (s) { return s.chapter === ch.id; });
      if (!slides.length) return;
      html += '<p class="recap-chapter">' + esc(label(ch.label)) + "</p>";
      addSlides(slides);
    });
    const rest = deck.slides.filter(function (slide, idx) { return !listed[idx]; });
    addSlides(rest);
    nav.innerHTML = html;
    nav.querySelectorAll(".bookmark-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.page = Number(btn.getAttribute("data-page")) || 1;
        renderPage();
      });
    });
  }

  function renderPage() {
    const uiEl = ui.defaultUi("recap-library");
    if (!deck || !deck.slides.length) {
      showEmpty(state.empty || EMPTY.missing);
      return;
    }
    state.empty = null;
    const idx = Math.max(0, Math.min(deck.slides.length - 1, state.page - 1));
    state.page = idx + 1;
    const slide = deck.slides[idx];
    const src = "../../scenarios/" + deck.scenario + "/" + String(slide.image || "").replace(/^\/+/, "");
    const alt = slideLabel(slide);
    ui.setReady(uiEl);
    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = '<div class="recap-stage"><img src="' + esc(src) + '" alt="' + esc(alt) + '"/></div>';
    uiEl.pageInfo.textContent = state.page + " of " + deck.slides.length;
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= deck.slides.length - 1;
    setTitle(deck.title);
    renderSidebar();
  }

  function bindKeys() {
    document.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target && e.target.isContentEditable)) return;
      if (!deck || !deck.slides.length) return;
      const before = state.page;
      if (e.key === "ArrowLeft" && state.page > 1) state.page -= 1;
      if (e.key === "ArrowRight" && state.page < deck.slides.length) state.page += 1;
      if (state.page === before) return;
      e.preventDefault();
      renderPage();
    });
  }

  async function bootstrap() {
    ui.initBookChrome("recap", function (lang) {
      state.lang = lang;
      if (deck) renderPage();
      else if (state.empty) showEmpty(state.empty);
    });
    state.lang = shell.parseUrlParams().lang;
    const uiEl = ui.defaultUi("recap-library");
    ui.bindPagination(state, uiEl, renderPage, function () {
      return deck && deck.slides ? deck.slides.length : 0;
    });
    bindKeys();

    const scenario = shell.parseUrlParams().scenario;
    if (!scenario) {
      showEmpty(EMPTY.noScenario);
      return;
    }
    try {
      const text = await shell.fetchTextOptional(
        "../../scenarios/" + scenario + "/art/act1-recap-index.json",
        false
      );
      if (!text) {
        showEmpty(EMPTY.missing);
        return;
      }
      const data = JSON.parse(text);
      const slides = Array.isArray(data.slides) ? data.slides : [];
      if (!slides.length) {
        showEmpty(EMPTY.missing);
        return;
      }
      deck = {
        scenario: scenario,
        title: data.title || DEFAULT_TITLE,
        chapters: Array.isArray(data.chapters) ? data.chapters : [],
        slides: slides,
      };
      const scene = shell.parseUrlParams().scene;
      if (scene) {
        const found = slides.findIndex(function (s) { return s.slug === scene; });
        if (found >= 0) state.page = found + 1;
      }
      renderPage();
    } catch (err) {
      ui.setError(uiEl, "Failed to load recap", esc(err.message));
      uiEl.prev.disabled = true;
      uiEl.next.disabled = true;
      uiEl.pageInfo.textContent = "0 of 0";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
