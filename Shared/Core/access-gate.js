(function (global) {
  "use strict";

  const PROTECTED_SECTIONS = ["dm-script", "monsters", "npc", "maps", "battle"];
  const STORAGE_KEY = "dndbook:access:unlocked";
  const CONFIG_URL = "../Core/access-config.json";

  let configPromise = null;

  function isProtectedSection(sectionId) {
    return PROTECTED_SECTIONS.indexOf(sectionId) >= 0;
  }

  function needsGate(sectionId, scenarioSlug) {
    if (!isProtectedSection(sectionId)) return false;
    if (!scenarioSlug || scenarioSlug === "demo") return false;
    return true;
  }

  function isUnlocked() {
    try {
      return global.sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch (_e) {
      return false;
    }
  }

  function setUnlocked() {
    try {
      global.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (_e) { /* ignore quota / private mode */ }
  }

  async function loadAccessConfig() {
    if (!configPromise) {
      configPromise = (async function () {
        const shell = global.DnDCore && global.DnDCore.shell;
        if (!shell) return { enabled: false };
        const url = new URL(CONFIG_URL, global.location.href).href;
        try {
          const text = await shell.fetchText(url, false);
          return JSON.parse(text);
        } catch (_e) {
          return { enabled: false };
        }
      })();
    }
    return configPromise;
  }

  async function hashPassword(plain) {
    const data = new TextEncoder().encode(plain);
    const buf = await global.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  async function verifyPassword(plain, config) {
    const hash = await hashPassword(plain);
    const expected = String(config.passwordHash || "").toLowerCase();
    return hash === expected;
  }

  function labels(lang) {
    if (lang === "ua") {
      return {
        title: "Контент для Майстра",
        hint: "Введіть пароль, щоб переглянути матеріали сценарію.",
        placeholder: "Пароль",
        unlock: "Увійти",
        wrong: "Невірний пароль",
      };
    }
    return {
      title: "DM content",
      hint: "Enter the password to view scenario materials.",
      placeholder: "Password",
      unlock: "Unlock",
      wrong: "Incorrect password",
    };
  }

  function showGateOverlay(uiEl, lang, onSubmit) {
    const shell = global.DnDCore.shell;
    const esc = shell.esc;
    const L = labels(lang);
    if (uiEl.root) uiEl.root.setAttribute("data-access-gate", "true");
    if (uiEl.empty) {
      uiEl.empty.hidden = false;
      uiEl.empty.classList.remove("load-error");
      uiEl.empty.classList.add("access-gate");
      uiEl.empty.innerHTML =
        '<div class="access-gate-form">' +
        "<strong>" + esc(L.title) + "</strong>" +
        "<p>" + esc(L.hint) + "</p>" +
        '<form id="access-gate-form">' +
        '<input type="password" id="access-gate-password" autocomplete="current-password" placeholder="' +
        esc(L.placeholder) +
        '" />' +
        '<button type="submit">' + esc(L.unlock) + "</button>" +
        '<p class="access-gate-error" id="access-gate-error" hidden>' + esc(L.wrong) + "</p>" +
        "</form></div>";
    }
    if (uiEl.page) uiEl.page.hidden = true;

    const form = document.getElementById("access-gate-form");
    const input = document.getElementById("access-gate-password");
    const errEl = document.getElementById("access-gate-error");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      errEl.hidden = true;
      Promise.resolve(onSubmit(input.value)).then(function (ok) {
        if (!ok) {
          errEl.hidden = false;
          input.select();
        }
      });
    });
    input.focus();
  }

  async function ensureUnlocked(sectionId, scenarioSlug, uiEl) {
    if (!needsGate(sectionId, scenarioSlug)) return true;

    const config = await loadAccessConfig();
    if (!config.enabled) return true;
    if (isUnlocked()) return true;

    const lang = global.DnDCore.shell.parseUrlParams().lang || "en";

    return new Promise(function (resolve) {
      showGateOverlay(uiEl, lang, async function (password) {
        const ok = await verifyPassword(password, config);
        if (ok) {
          setUnlocked();
          if (uiEl.root) uiEl.root.removeAttribute("data-access-gate");
          if (uiEl.empty) {
            uiEl.empty.classList.remove("access-gate");
            uiEl.empty.innerHTML = "<strong>Loading…</strong>";
          }
          resolve(true);
          return true;
        }
        return false;
      });
    });
  }

  function isGateActive(rootEl) {
    return !!(rootEl && rootEl.getAttribute("data-access-gate") === "true");
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.accessGate = {
    PROTECTED_SECTIONS: PROTECTED_SECTIONS,
    isProtectedSection: isProtectedSection,
    needsGate: needsGate,
    isUnlocked: isUnlocked,
    isGateActive: isGateActive,
    ensureUnlocked: ensureUnlocked,
  };
})(typeof window !== "undefined" ? window : this);
