(function () {
  "use strict";

  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const locale = window.DnDCore.locale;
  const combatStats = window.DnDCore.combatStats;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader();
  const BATTLE_UI = window.DnDCore.contentSchema.BATTLE.ui;

  const state = {
    lang: "en",
    mode: "player",
    scenario: "",
    addType: "character",
    expandedIds: {},
  };

  let characterCatalog = [];
  let monsterCatalog = [];
  let battleStore = null;
  let encounter = null;
  let saveTimer = null;
  let uidCounter = 0;
  let catalogLoaded = false;
  let uiElRef = null;

  function uiLabel(key) {
    const labels = BATTLE_UI[key] || [key, key];
    return locale.pickLabel(labels, state.lang);
  }

  function storageKey() {
    const slug = state.scenario || "demo";
    return "dndbook:battle:" + slug;
  }

  function newId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    uidCounter += 1;
    return "battle-" + Date.now() + "-" + uidCounter;
  }

  function defaultSceneData(name) {
    return {
      id: newId(),
      name: name,
      updatedAt: new Date().toISOString(),
      round: 1,
      nextSortOrder: 1,
      instanceCounts: {},
      combatants: [],
    };
  }

  function defaultSceneName(index) {
    return uiLabel("defaultSceneName") + " " + index;
  }

  function encounterFromScene(scene) {
    return {
      round: scene.round || 1,
      nextSortOrder: scene.nextSortOrder || 1,
      instanceCounts: JSON.parse(JSON.stringify(scene.instanceCounts || {})),
      combatants: JSON.parse(JSON.stringify(scene.combatants || [])),
    };
  }

  function activeScene() {
    if (!battleStore || !Array.isArray(battleStore.scenes)) return null;
    return battleStore.scenes.find(function (s) { return s.id === battleStore.activeSceneId; }) || null;
  }

  function syncEncounterToStore() {
    const scene = activeScene();
    if (!scene || !encounter) return;
    scene.round = encounter.round;
    scene.nextSortOrder = encounter.nextSortOrder;
    scene.instanceCounts = encounter.instanceCounts;
    scene.combatants = encounter.combatants;
    scene.updatedAt = new Date().toISOString();
  }

  function loadStore() {
    const key = storageKey();
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.v === 2 && Array.isArray(parsed.scenes) && parsed.scenes.length) {
          return parsed;
        }
      }
    } catch (_e) { /* ignore */ }

    try {
      const sessionRaw = sessionStorage.getItem(key);
      if (sessionRaw) {
        const old = JSON.parse(sessionRaw);
        if (old && old.v === 1 && Array.isArray(old.combatants)) {
          const scene = defaultSceneData(defaultSceneName(1));
          scene.round = old.round || 1;
          scene.nextSortOrder = old.nextSortOrder || 1;
          scene.instanceCounts = old.instanceCounts || {};
          scene.combatants = old.combatants || [];
          sessionStorage.removeItem(key);
          return {
            v: 2,
            activeSceneId: scene.id,
            scenes: [scene],
          };
        }
      }
    } catch (_e) { /* ignore */ }

    const scene = defaultSceneData(defaultSceneName(1));
    return {
      v: 2,
      activeSceneId: scene.id,
      scenes: [scene],
    };
  }

  function persistStore() {
    syncEncounterToStore();
    try {
      localStorage.setItem(storageKey(), JSON.stringify(battleStore));
    } catch (_e) { /* quota / private mode */ }
  }

  function loadActiveEncounter() {
    battleStore = loadStore();
    const scene = activeScene() || battleStore.scenes[0];
    battleStore.activeSceneId = scene.id;
    encounter = encounterFromScene(scene);
  }

  function switchScene(sceneId) {
    if (!battleStore || sceneId === battleStore.activeSceneId) return;
    const target = battleStore.scenes.find(function (s) { return s.id === sceneId; });
    if (!target) return;
    syncEncounterToStore();
    battleStore.activeSceneId = sceneId;
    encounter = encounterFromScene(target);
    state.expandedIds = {};
    refreshCombatantNames();
    persistStore();
    renderAll();
  }

  function createScene(name) {
    syncEncounterToStore();
    const scene = defaultSceneData(name || defaultSceneName(battleStore.scenes.length + 1));
    battleStore.scenes.push(scene);
    battleStore.activeSceneId = scene.id;
    encounter = encounterFromScene(scene);
    state.expandedIds = {};
    persistStore();
    renderAll();
  }

  function renameActiveScene() {
    const scene = activeScene();
    if (!scene) return;
    const next = globalThis.prompt(uiLabel("sceneNamePrompt"), scene.name);
    if (next == null || !String(next).trim()) return;
    scene.name = String(next).trim();
    persistStore();
    renderSceneList();
  }

  function deleteActiveScene() {
    if (!battleStore || battleStore.scenes.length <= 1) return;
    if (!globalThis.confirm(uiLabel("deleteSceneConfirm"))) return;
    syncEncounterToStore();
    const activeId = battleStore.activeSceneId;
    battleStore.scenes = battleStore.scenes.filter(function (s) { return s.id !== activeId; });
    battleStore.activeSceneId = battleStore.scenes[0].id;
    encounter = encounterFromScene(battleStore.scenes[0]);
    state.expandedIds = {};
    persistStore();
    renderAll();
  }

  function clearActiveEncounter() {
    encounter.round = 1;
    encounter.nextSortOrder = 1;
    encounter.instanceCounts = {};
    encounter.combatants = [];
    state.expandedIds = {};
    persistStore();
    renderAll();
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persistStore, 150);
  }

  function renderSceneList() {
    const nav = document.getElementById("scene-list-nav");
    if (!nav || !battleStore) return;
    nav.innerHTML = battleStore.scenes.map(function (scene) {
      const active = scene.id === battleStore.activeSceneId;
      const count = (scene.combatants || []).length;
      const meta = count + " · " + uiLabel("round") + " " + (scene.round || 1);
      return '<button type="button" class="bookmark-btn battle-scene-btn" data-scene-id="' + esc(scene.id) +
        '" aria-pressed="' + (active ? "true" : "false") + '">' +
        esc(scene.name) + '<span class="scene-meta">' + esc(meta) + "</span></button>";
    }).join("");
  }

  function catalogForType(type) {
    return type === "monster" ? monsterCatalog : characterCatalog;
  }

  function catalogEntry(type, slug) {
    return catalogForType(type).find(function (e) { return e.slug === slug; }) || null;
  }

  function resolveCatalogStats(type, slug) {
    const entry = catalogEntry(type, slug);
    if (!entry) return null;
    return type === "monster"
      ? combatStats.fromMonsterEntry(entry, state.lang, state.mode)
      : combatStats.fromCharacterEntry(entry, state.lang);
  }

  function refreshCombatantNames() {
    encounter.combatants.forEach(function (c) {
      const stats = resolveCatalogStats(c.sourceType, c.slug);
      if (!stats) return;
      c.name = stats.name;
      if (c.instance > 1) {
        c.instanceLabel = stats.name + " #" + c.instance;
      } else {
        c.instanceLabel = stats.name;
      }
    });
  }

  function sortCombatants(list) {
    return list.slice().sort(function (a, b) {
      const ai = a.initiative;
      const bi = b.initiative;
      const aEmpty = ai == null || ai === "";
      const bEmpty = bi == null || bi === "";
      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;
      if (!aEmpty && !bEmpty && Number(bi) !== Number(ai)) {
        return Number(bi) - Number(ai);
      }
      return a.sortOrder - b.sortOrder;
    });
  }

  function clampHp(c) {
    const max = c.hpMax != null ? c.hpMax : null;
    if (c.hpCurrent == null || isNaN(c.hpCurrent)) c.hpCurrent = max != null ? max : 0;
    if (max != null && c.hpCurrent > max) c.hpCurrent = max;
    if (c.hpCurrent < 0) c.hpCurrent = 0;
  }

  function addCombatant(type, slug, skipSave) {
    const stats = resolveCatalogStats(type, slug);
    if (!stats) return;
    const counts = encounter.instanceCounts;
    counts[slug] = (counts[slug] || 0) + 1;
    const instance = counts[slug];
    const sortOrder = encounter.nextSortOrder;
    encounter.nextSortOrder += 1;
    const label = instance > 1 ? stats.name + " #" + instance : stats.name;
    const combatant = {
      id: newId(),
      sourceType: type,
      slug: slug,
      instance: instance,
      instanceLabel: label,
      name: stats.name,
      ac: stats.ac,
      acRaw: stats.acRaw || String(stats.ac != null ? stats.ac : ""),
      hpMax: stats.hpMax,
      hpMaxManual: false,
      hpCurrent: stats.hpMax != null ? stats.hpMax : 0,
      initiative: null,
      isDead: false,
      sortOrder: sortOrder,
      statsTable: stats.statsTable || [],
    };
    clampHp(combatant);
    encounter.combatants.push(combatant);
    if (!skipSave) scheduleSave();
    return combatant;
  }

  function addMultipleCombatants(type, slug, count) {
    for (let i = 0; i < count; i += 1) {
      addCombatant(type, slug, i < count - 1);
    }
    scheduleSave();
    renderAll();
  }

  function removeCombatant(id) {
    encounter.combatants = encounter.combatants.filter(function (c) { return c.id !== id; });
    delete state.expandedIds[id];
    scheduleSave();
    renderTable();
  }

  function libraryUrl(c) {
    const q = new URLSearchParams();
    if (state.scenario) q.set("scenario", state.scenario);
    if (state.lang !== "en") q.set("lang", state.lang);
    if (state.mode === "dm") q.set("mode", "dm");
    if (c.sourceType === "character") q.set("character", c.slug);
    else q.set("monster", c.slug);
    const qs = q.toString();
    const base = c.sourceType === "character" ? "../Characters/library.html" : "../Monsters/library.html";
    return base + (qs ? "?" + qs : "");
  }

  function renderStatsTable(rows) {
    if (!rows || !rows.length) return "<em>—</em>";
    let html = '<table class="stats-table"><tbody>';
    rows.forEach(function (row) {
      html += "<tr>";
      row.forEach(function (cell) {
        html += "<td>" + esc(cell) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    return html;
  }

  function renderTable() {
    const tbody = document.getElementById("encounter-body");
    const emptyEl = document.getElementById("encounter-empty");
    const table = document.getElementById("encounter-table");
    if (!tbody) return;

    const sorted = sortCombatants(encounter.combatants);
    if (!sorted.length) {
      tbody.innerHTML = "";
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = uiLabel("empty");
      }
      if (table) table.hidden = true;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (table) table.hidden = false;

    let html = "";
    sorted.forEach(function (c) {
      const deadClass = c.isDead ? " combatant-dead" : "";
      const expanded = !!state.expandedIds[c.id];
      const expandClass = expanded ? " combatant-expanded" : "";
      const badgeClass = c.sourceType === "character" ? "type-badge--pc" : "type-badge--mon";
      const badge = c.sourceType === "character" ? uiLabel("badgePc") : uiLabel("badgeMon");
      const status = c.isDead ? uiLabel("statusDead") : uiLabel("statusAlive");
      const statusClass = c.isDead ? " status-badge--dead" : "";
      const hpMaxVal = c.hpMax != null ? c.hpMax : "";
      const hpMaxPlaceholder = c.hpMax != null ? "" : "?";
      const initVal = c.initiative != null && c.initiative !== "" ? c.initiative : "";
      const deadBtnClass = c.isDead ? " is-dead" : "";
      const expandLabel = expanded ? uiLabel("collapseStats") : uiLabel("expandStats");

      html += '<tr class="combatant-row' + deadClass + expandClass + '" data-id="' + esc(c.id) + '">';
      html += "<td>";
      html += '<label class="visually-hidden" for="init-' + esc(c.id) + '">' + esc(uiLabel("colInit")) + " " + esc(c.instanceLabel) + "</label>";
      html += '<input type="text" class="init-input" id="init-' + esc(c.id) + '" data-field="initiative" inputmode="numeric" maxlength="2" autocomplete="off" value="' + esc(String(initVal)) + '"/>';
      html += "</td>";
      html += "<td>";
      html += '<a class="combatant-name-link" href="' + esc(libraryUrl(c)) + '" title="' + esc(uiLabel("viewInLibrary")) + '">' + esc(c.instanceLabel) + "</a>";
      if (c.statsTable && c.statsTable.length) {
        html += '<button type="button" class="stats-expand-btn btn-secondary" data-action="expand" aria-expanded="' + (expanded ? "true" : "false") + '" aria-label="' + esc(expandLabel) + ' for ' + esc(c.instanceLabel) + '">' + (expanded ? "▾" : "▸") + "</button>";
      }
      html += "</td>";
      html += '<td><span class="type-badge ' + badgeClass + '">' + esc(badge) + "</span></td>";
      html += "<td>" + esc(c.ac != null ? String(c.ac) : "?") + "</td>";
      html += "<td><div class=\"hp-cell\">";
      html += '<label class="visually-hidden" for="hp-max-' + esc(c.id) + '">' + esc(uiLabel("colHp")) + " " + esc(c.instanceLabel) + "</label>";
      html += '<input type="number" class="hp-max" id="hp-max-' + esc(c.id) + '" data-field="hpMax" min="0" placeholder="' + esc(hpMaxPlaceholder) + '" value="' + esc(String(hpMaxVal)) + '"/>';
      html += '<span class="hp-sep">/</span>';
      html += '<input type="number" class="hp-current" id="hp-current-' + esc(c.id) + '" data-field="hpCurrent" min="0" value="' + esc(String(c.hpCurrent)) + '"/>';
      html += "</div></td>";
      html += '<td><span class="status-badge' + statusClass + '">' + esc(status) + "</span></td>";
      html += "<td><div class=\"action-btns\">";
      html += '<button type="button" data-action="hp-down" aria-label="' + esc(uiLabel("hpDown") + ": " + c.instanceLabel) + '">−</button>';
      html += '<button type="button" data-action="hp-up" aria-label="' + esc(uiLabel("hpUp") + ": " + c.instanceLabel) + '">+</button>';
      html += '<button type="button" class="btn-dead' + deadBtnClass + '" data-action="toggle-dead" aria-label="' + esc((c.isDead ? uiLabel("markAlive") : uiLabel("markDead")) + ": " + c.instanceLabel) + '" title="' + esc(c.isDead ? uiLabel("markAlive") : uiLabel("markDead")) + '">☠</button>';
      html += '<button type="button" class="btn-remove" data-action="remove" aria-label="' + esc(uiLabel("remove") + ": " + c.instanceLabel) + '">✕</button>';
      html += "</div></td>";
      html += "</tr>";

      if (expanded && c.statsTable && c.statsTable.length) {
        html += '<tr class="combatant-stats" data-for="' + esc(c.id) + '"><td colspan="7">';
        html += renderStatsTable(c.statsTable);
        html += "</td></tr>";
      }
    });
    tbody.innerHTML = html;
    renderSceneList();
  }

  function findCombatant(id) {
    return encounter.combatants.find(function (c) { return c.id === id; });
  }

  function onTableInput(ev) {
    const input = ev.target;
    if (!input.dataset.field) return;
    const row = input.closest("[data-id]");
    if (!row) return;
    const c = findCombatant(row.getAttribute("data-id"));
    if (!c) return;

    if (input.dataset.field === "initiative") {
      const raw = input.value.trim();
      if (raw === "") {
        c.initiative = null;
      } else {
        const val = parseInt(raw, 10);
        c.initiative = isNaN(val) ? null : val;
      }
      scheduleSave();
      return;
    }

    if (input.dataset.field === "hpCurrent") {
      const val = parseInt(input.value, 10);
      c.hpCurrent = isNaN(val) ? 0 : val;
      clampHp(c);
      if (c.hpCurrent > 0 && c.isDead) c.isDead = false;
      scheduleSave();
      return;
    }

    if (input.dataset.field === "hpMax") {
      const raw = input.value.trim();
      if (raw === "") {
        c.hpMax = null;
        c.hpMaxManual = false;
      } else {
        const val = parseInt(raw, 10);
        c.hpMax = isNaN(val) ? null : val;
        c.hpMaxManual = true;
      }
      clampHp(c);
      scheduleSave();
    }
  }

  function onTableBlur(ev) {
    const input = ev.target;
    if (!input.dataset || !input.dataset.field) return;
    const field = input.dataset.field;
    if (field !== "initiative" && field !== "hpCurrent" && field !== "hpMax") return;
    const row = input.closest("[data-id]");
    if (!row) return;
    const c = findCombatant(row.getAttribute("data-id"));
    if (!c) return;

    if (field === "initiative") {
      const raw = input.value.trim();
      if (raw === "") {
        c.initiative = null;
      } else {
        const val = parseInt(raw, 10);
        c.initiative = isNaN(val) ? null : val;
      }
      scheduleSave();
      renderTable();
      return;
    }

    if (field === "hpCurrent") {
      const val = parseInt(input.value, 10);
      c.hpCurrent = isNaN(val) ? 0 : val;
      clampHp(c);
      scheduleSave();
      renderTable();
      return;
    }

    if (field === "hpMax") {
      const raw = input.value.trim();
      if (raw === "") {
        c.hpMax = null;
        c.hpMaxManual = false;
      } else {
        const val = parseInt(raw, 10);
        c.hpMax = isNaN(val) ? null : val;
        c.hpMaxManual = true;
      }
      clampHp(c);
      scheduleSave();
      renderTable();
    }
  }

  function onInitiativeInput(ev) {
    const input = ev.target;
    if (input.dataset.field !== "initiative") return;
    const digits = input.value.replace(/\D/g, "").slice(0, 2);
    if (input.value !== digits) input.value = digits;
    if (digits.length >= 2) {
      input.blur();
    }
  }

  function onTableClick(ev) {
    const btn = ev.target.closest("[data-action]");
    if (!btn) return;
    const row = btn.closest("[data-id]");
    if (!row) return;
    const id = row.getAttribute("data-id");
    const c = findCombatant(id);
    if (!c) return;
    const action = btn.getAttribute("data-action");

    if (action === "hp-down") {
      c.hpCurrent = (c.hpCurrent || 0) - 1;
      clampHp(c);
      scheduleSave();
      renderTable();
      return;
    }

    if (action === "hp-up") {
      c.hpCurrent = (c.hpCurrent || 0) + 1;
      clampHp(c);
      if (c.isDead && c.hpCurrent > 0) c.isDead = false;
      scheduleSave();
      renderTable();
      return;
    }

    if (action === "toggle-dead") {
      c.isDead = !c.isDead;
      if (c.isDead && c.hpCurrent > 0) c.hpCurrent = 0;
      scheduleSave();
      renderTable();
      return;
    }

    if (action === "remove") {
      removeCombatant(id);
      return;
    }

    if (action === "expand") {
      if (state.expandedIds[id]) delete state.expandedIds[id];
      else state.expandedIds[id] = true;
      renderTable();
    }
  }

  function updateAddMultipleButton() {
    const select = document.getElementById("catalog-select");
    const addMultiple = document.getElementById("add-multiple");
    if (!addMultiple || !select) return;
    if (state.addType === "monster") {
      const slug = select.value;
      const entry = catalogEntry("monster", slug);
      const stats = entry ? combatStats.fromMonsterEntry(entry, state.lang, state.mode) : null;
      const qty = stats && stats.defaultQuantity > 1 ? stats.defaultQuantity : 0;
      if (qty > 1) {
        addMultiple.hidden = false;
        addMultiple.textContent = uiLabel("addMultiple") + qty;
        addMultiple.dataset.qty = String(qty);
      } else {
        addMultiple.hidden = true;
      }
    } else {
      addMultiple.hidden = true;
    }
  }

  function readAddType() {
    const checked = document.querySelector('input[name="add-type"]:checked');
    return checked ? checked.value : state.addType;
  }

  function updateCatalogSelect() {
    const select = document.getElementById("catalog-select");
    if (!select) return;
    const previous = select.value;
    const list = catalogForType(state.addType);
    select.innerHTML = list.map(function (e) {
      const stats = state.addType === "monster"
        ? combatStats.fromMonsterEntry(e, state.lang, state.mode)
        : combatStats.fromCharacterEntry(e, state.lang);
      return '<option value="' + esc(e.slug) + '">' + esc(stats.name) + "</option>";
    }).join("");

    if (previous && list.some(function (e) { return e.slug === previous; })) {
      select.value = previous;
    }
    updateAddMultipleButton();
  }

  function applyLabels() {
    const title = document.getElementById("battle-title");
    if (title) title.textContent = uiLabel("title");
    const addLabel = document.getElementById("add-combatant-label");
    if (addLabel) addLabel.textContent = uiLabel("addCombatant");
    const typeChar = document.getElementById("type-character-label");
    if (typeChar) typeChar.textContent = uiLabel("typeCharacter");
    const typeMon = document.getElementById("type-monster-label");
    if (typeMon) typeMon.textContent = uiLabel("typeMonster");
    const addBtn = document.getElementById("add-combatant");
    if (addBtn) addBtn.textContent = "+ " + uiLabel("add");
    const clearBtn = document.getElementById("clear-encounter");
    if (clearBtn) clearBtn.textContent = uiLabel("clearEncounter");
    const scenesHeading = document.getElementById("scenes-heading");
    if (scenesHeading) scenesHeading.textContent = uiLabel("scenesHeading");
    const newSceneBtn = document.getElementById("new-scene");
    if (newSceneBtn) newSceneBtn.textContent = "+ " + uiLabel("newScene");
    const renameBtn = document.getElementById("rename-scene");
    if (renameBtn) renameBtn.textContent = uiLabel("renameScene");
    const deleteBtn = document.getElementById("delete-scene");
    if (deleteBtn) {
      deleteBtn.textContent = uiLabel("deleteScene");
      deleteBtn.disabled = !!(battleStore && battleStore.scenes.length <= 1);
    }
    const prevBtn = document.getElementById("prev-round");
    if (prevBtn) prevBtn.innerHTML = "&#9664; " + uiLabel("prevRound");
    const nextBtn = document.getElementById("next-round");
    if (nextBtn) nextBtn.innerHTML = uiLabel("nextRound") + " &#9654;";
    ["init", "name", "type", "ac", "hp", "status", "actions"].forEach(function (col) {
      const el = document.getElementById("th-" + col);
      if (el) el.textContent = uiLabel("col" + col.charAt(0).toUpperCase() + col.slice(1));
    });
    document.getElementById("round-value").textContent = String(encounter ? encounter.round : 1);
  }

  function renderRound() {
    const roundEl = document.getElementById("round-value");
    const roundLabel = document.getElementById("round-label");
    if (roundEl) roundEl.textContent = String(encounter.round);
    if (roundLabel) {
      roundLabel.setAttribute("aria-label", uiLabel("round") + " " + encounter.round);
    }
    renderSceneList();
  }

  function renderAll() {
    applyLabels();
    renderSceneList();
    updateCatalogSelect();
    renderRound();
    renderTable();
  }

  function showPlayerBlock() {
    ui.setReady(uiElRef);
    document.getElementById("battle-content").hidden = true;
    const sidebar = document.querySelector(".battle-sidebar");
    if (sidebar) sidebar.hidden = true;
    uiElRef.empty.hidden = false;
    uiElRef.empty.classList.remove("load-error");
    uiElRef.empty.innerHTML = '<div class="player-mode-block"><strong>' + esc(uiLabel("playerModeBlock")) + "</strong></div>";
  }

  async function loadCatalog() {
    const charConfig = shell.resolveModuleConfig({
      rootEl: uiElRef.root,
      scenarioFolder: "characters",
      indexFileName: "characters-index.json",
      demoIndex: "../Characters/demo/characters-index.json",
    });
    const monConfig = shell.resolveModuleConfig({
      rootEl: uiElRef.root,
      scenarioFolder: "monsters",
      indexFileName: "monsters-index.json",
      demoIndex: "../Monsters/demo/monsters-index.json",
    });

    const [charRaws, monRaws] = await Promise.all([
      loader.loadData(charConfig, false, function (slug, texts) {
        return combatStats.assembleCharacterEntry(slug, texts);
      }),
      loader.loadData(monConfig, false, function (slug, texts) {
        return combatStats.assembleMonsterEntry(slug, texts, true);
      }),
    ]);

    characterCatalog = charRaws;
    monsterCatalog = monRaws;
    catalogLoaded = true;
    refreshCombatantNames();
  }

  async function enterDmMode() {
    if (!(await window.DnDCore.accessGate.ensureUnlocked("battle", state.scenario, uiElRef))) return;
    if (!catalogLoaded) {
      ui.setLoading(uiElRef, uiLabel("loading"));
      try {
        await loadCatalog();
        ui.setReady(uiElRef);
      } catch (err) {
        ui.setError(uiElRef, uiLabel("loadError"), esc(err.message));
        return;
      }
    }
    uiElRef.empty.hidden = true;
    document.getElementById("battle-content").hidden = false;
    const sidebar = document.querySelector(".battle-sidebar");
    if (sidebar) sidebar.hidden = false;
    bindControlsOnce();
    renderAll();
  }

  let controlsBound = false;
  function bindControlsOnce() {
    if (controlsBound) return;
    controlsBound = true;
    bindControls();
  }

  function bindControls() {
    document.querySelectorAll('input[name="add-type"]').forEach(function (radio) {
      radio.addEventListener("change", function (ev) {
        state.addType = ev.target.value;
        updateCatalogSelect();
      });
    });

    const select = document.getElementById("catalog-select");
    if (select) {
      select.addEventListener("change", updateAddMultipleButton);
    }

    document.getElementById("add-combatant").addEventListener("click", function () {
      const addType = readAddType();
      state.addType = addType;
      const slug = document.getElementById("catalog-select").value;
      if (!slug) return;
      addCombatant(addType, slug);
      renderAll();
    });

    const addMultiple = document.getElementById("add-multiple");
    if (addMultiple) {
      addMultiple.addEventListener("click", function () {
        const addType = readAddType();
        state.addType = addType;
        const slug = document.getElementById("catalog-select").value;
        const qty = parseInt(addMultiple.dataset.qty, 10) || 1;
        if (!slug || qty < 2 || addType !== "monster") return;
        addMultipleCombatants("monster", slug, qty);
      });
    }

    document.getElementById("prev-round").addEventListener("click", function () {
      encounter.round = Math.max(1, encounter.round - 1);
      scheduleSave();
      renderRound();
    });

    document.getElementById("next-round").addEventListener("click", function () {
      encounter.round += 1;
      scheduleSave();
      renderRound();
      renderTable();
    });

    document.getElementById("clear-encounter").addEventListener("click", function () {
      if (!encounter.combatants.length) return;
      if (!globalThis.confirm(uiLabel("clearConfirm"))) return;
      clearActiveEncounter();
    });

    const sceneNav = document.getElementById("scene-list-nav");
    if (sceneNav) {
      sceneNav.addEventListener("click", function (ev) {
        const btn = ev.target.closest("[data-scene-id]");
        if (!btn) return;
        switchScene(btn.getAttribute("data-scene-id"));
      });
    }

    document.getElementById("new-scene").addEventListener("click", function () {
      const suggested = defaultSceneName(battleStore.scenes.length + 1);
      const name = globalThis.prompt(uiLabel("sceneNamePrompt"), suggested);
      if (name == null) return;
      createScene(String(name).trim() || suggested);
    });

    document.getElementById("rename-scene").addEventListener("click", renameActiveScene);

    document.getElementById("delete-scene").addEventListener("click", deleteActiveScene);

    const tbody = document.getElementById("encounter-body");
    tbody.addEventListener("input", onTableInput);
    tbody.addEventListener("input", onInitiativeInput);
    tbody.addEventListener("blur", onTableBlur, true);
    tbody.addEventListener("click", onTableClick);
  }

  async function bootstrap() {
    const chrome = ui.initBookChrome("battle", function (l) {
      state.lang = l;
      if (encounter) {
        refreshCombatantNames();
        scheduleSave();
      }
      renderAll();
    }, function (m) {
      state.mode = m;
      if (state.mode !== "dm") {
        showPlayerBlock();
        return;
      }
      enterDmMode();
    }, true);

    state.lang = chrome.lang;
    state.mode = chrome.mode;
    uiElRef = ui.defaultUi("battle-tracker");
    const params = shell.parseUrlParams();
    state.scenario = params.scenario || uiElRef.root.getAttribute("data-scenario") || "demo";
    if (uiElRef.root) uiElRef.root.setAttribute("data-scenario", state.scenario);

    loadActiveEncounter();
    applyLabels();

    if (state.mode !== "dm") {
      showPlayerBlock();
      return;
    }

    ui.setLoading(uiElRef, uiLabel("loading"));
    try {
      await enterDmMode();
    } catch (err) {
      ui.setError(uiElRef, uiLabel("loadError"), esc(err.message));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
