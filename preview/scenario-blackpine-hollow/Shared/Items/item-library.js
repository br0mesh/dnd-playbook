(function () {
  "use strict";

  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const shell = window.DnDCore.shell;
  const ui = window.DnDCore.entityUi;
  const locale = window.DnDCore.locale;
  const spellLinks = window.DnDCore.spellLinks;
  const itemLinks = window.DnDCore.itemLinks;
  const headings = window.DnDCore.contentSchema.ITEM;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader();

  const RARITY_EN = {
    common: "Common", uncommon: "Uncommon", rare: "Rare",
    very_rare: "Very rare", legendary: "Legendary", artifact: "Artifact",
  };

  const RARITY_UA = {
    common: "Звичайна", uncommon: "Незвичайна", rare: "Рідкісна",
    very_rare: "Дуже рідкісна", legendary: "Легендарна", artifact: "Артефакт",
  };

  const TYPE_EN = {
    armor: "Armor", potion: "Potion", ring: "Ring", rod: "Rod", scroll: "Scroll",
    staff: "Staff", wand: "Wand", weapon: "Weapon", wondrous: "Wondrous",
  };

  const TYPE_UA = {
    armor: "Броня", potion: "Зілля", ring: "Перстень", rod: "Жезл", scroll: "Сувій",
    staff: "Посох", wand: "Паличка", weapon: "Зброя", wondrous: "Чудовий предмет",
  };

  const ENTITY_TYPE_LABELS = {
    character: ["character", "персонаж"],
    monster: ["monster", "монстр"],
    npc: ["NPC", "НПК"],
  };

  const state = { lang: "en", rarity: "all", type: "all", search: "", page: 1, focusSlug: null };
  let entries = [];
  let loadConfig = null;
  let referrerIndex = {};
  let focusHighlightSlug = null;
  let metaBound = false;

  function uiLabel(key) {
    const pair = headings.ui && headings.ui[key];
    if (!pair) return key;
    return state.lang === "ua" ? (pair[1] || pair[0]) : pair[0];
  }

  function rarityLabel(key) {
    return state.lang === "ua" ? (RARITY_UA[key] || key) : (RARITY_EN[key] || key);
  }

  function typeLabel(key) {
    return state.lang === "ua" ? (TYPE_UA[key] || key) : (TYPE_EN[key] || key);
  }

  function entityTypeLabel(type) {
    const pair = ENTITY_TYPE_LABELS[type] || [type, type];
    return state.lang === "ua" ? pair[1] : pair[0];
  }

  function rarityOptions() {
    return [["all", uiLabel("all")]].concat(
      (headings.rarities || []).map(function (key) {
        return [key, rarityLabel(key)];
      })
    );
  }

  function typeOptions() {
    return [["all", uiLabel("all")]].concat(
      (headings.types || []).map(function (key) {
        return [key, typeLabel(key)];
      })
    );
  }

  function bindFilters() {
    ui.bindListSidebar("rarity-nav", rarityOptions(), state, "rarity", function () {
      syncUrlParams();
      renderPage();
    });
    ui.bindListSidebar("type-nav", typeOptions(), state, "type", function () {
      syncUrlParams();
      renderPage();
    });
  }

  function keysFromSlug(slug) {
    return itemLinks.keysFromSlug(slug);
  }

  function section(text, key) {
    const args = [text].concat(headings[key] || []);
    return md.sectionAnyHeading.apply(md, args);
  }

  function parseLang(text, lang) {
    const h = md.parseBoldFields(section(text, "header") || text);
    const props = md.parseBoldFields(section(text, "properties"));
    const desc = section(text, "description");
    return {
      name: h.Name || h["Назва"] || md.titleForLocale(text, lang),
      rarity: h.Rarity || h["Рідкість"] || "",
      type: h.Type || h["Тип"] || "",
      attunement: props.Attunement || props["Узгодження"] || props["Налаштування"] || "",
      description: mech.formatDistancesInText(desc, lang === "ua"),
    };
  }

  function assembleItem(slug, texts) {
    const keys = keysFromSlug(slug);
    const en = parseLang(md.excludeDmNotes(texts.en), "en");
    const ua = texts.ua.trim()
      ? parseLang(md.excludeDmNotes(texts.ua), "ua")
      : locale.mergeWithFallback(en, {});
    return {
      slug: slug, rarity_key: keys.rarity_key, type_key: keys.type_key,
      en: en, ua: ua,
    };
  }

  function filtered() {
    const q = state.search.toLowerCase();
    return entries.filter(function (e) {
      if (state.rarity !== "all" && e.rarity_key !== state.rarity) return false;
      if (state.type !== "all" && e.type_key !== state.type) return false;
      const name = ((e[state.lang] || e.en).name || "").toLowerCase();
      return !q || name.includes(q);
    });
  }

  function applyUrlStateOnBootstrap() {
    const params = shell.parseUrlParams();
    if (params.rarity && (headings.rarities || []).indexOf(params.rarity) !== -1) {
      state.rarity = params.rarity;
    }
    if (params.type && (headings.types || []).indexOf(params.type) !== -1) {
      state.type = params.type;
    }
    if (params.item) {
      focusItemFromUrl(params.item);
    }
  }

  function focusItemFromUrl(slug) {
    if (!slug) return;
    state.focusSlug = slug;
    state.rarity = "all";
    state.type = "all";
    state.search = "";
    const search = document.getElementById("search");
    if (search) search.value = "";
    const idx = entries.findIndex(function (e) { return e.slug === slug; });
    if (idx < 0) {
      console.warn("[item-library] Item not found:", slug);
      return;
    }
    state.page = idx + 1;
  }

  function syncUrlParams() {
    const q = new URLSearchParams(window.location.search);
    if (loadConfig && loadConfig.scenario) q.set("scenario", loadConfig.scenario);
    else q.delete("scenario");

    if (state.lang === "ua") q.set("lang", "ua");
    else q.delete("lang");

    if (state.rarity !== "all") q.set("rarity", state.rarity);
    else q.delete("rarity");

    if (state.type !== "all") q.set("type", state.type);
    else q.delete("type");

    const list = filtered();
    const idx = Math.min(Math.max(state.page, 1), list.length) - 1;
    const current = list[idx];
    if (current) q.set("item", current.slug);
    else q.delete("item");

    const next = q.toString();
    const url = next ? "?" + next : window.location.pathname;
    if (window.location.search !== (next ? "?" + next : "")) {
      window.history.replaceState(null, "", url);
    }
  }

  function renderMeta(e) {
    return '<button type="button" class="item-meta-link" data-filter-key="rarity" data-filter-value="' +
      esc(e.rarity_key) + '">' + esc(rarityLabel(e.rarity_key)) + '</button> · ' +
      '<button type="button" class="item-meta-link" data-filter-key="type" data-filter-value="' +
      esc(e.type_key) + '">' + esc(typeLabel(e.type_key)) + "</button>";
  }

  function renderHeldBy(slug) {
    const refs = referrerIndex[slug];
    if (!refs || !refs.length) return "";
    const items = refs.map(function (ref) {
      const href = itemLinks.entityLibraryHref(ref.type, ref.slug, state.lang);
      return "<li><a class=\"item-link\" href=\"" + esc(href) + "\">" + esc(ref.name) +
        "</a> (" + esc(entityTypeLabel(ref.type)) + ")</li>";
    }).join("");
    return '<section class="item-held-by"><h3>' + esc(uiLabel("heldBy")) +
      "</h3><ul>" + items + "</ul></section>";
  }

  function renderAttunement(text) {
    if (!text) return "";
    const linked = spellLinks.renderSpellProse(text, state.lang);
    return "<p><small>" + esc(uiLabel("attunement")) + ":</small> " + linked + "</p>";
  }

  function renderCard(e, focused) {
    const b = e[state.lang] || e.en;
    const focusClass = focused ? " item-card-focused" : "";
    return '<article class="entity-card spell-card' + focusClass + '" data-slug="' + esc(e.slug) + '"><h2>' +
      esc(b.name) + '</h2><p class="spell-meta">' + renderMeta(e) + "</p><p>" +
      spellLinks.renderSpellProse(b.description, state.lang) + "</p>" +
      renderAttunement(b.attunement) +
      renderHeldBy(e.slug) + "</article>";
  }

  function bindMetaLinks(uiEl) {
    if (metaBound) return;
    metaBound = true;
    uiEl.page.addEventListener("click", function (ev) {
      const btn = ev.target.closest("[data-filter-key][data-filter-value]");
      if (!btn) return;
      const key = btn.getAttribute("data-filter-key");
      const val = btn.getAttribute("data-filter-value");
      if (!key || !val) return;
      state[key] = val;
      state.page = 1;
      state.focusSlug = null;
      bindFilters();
      syncUrlParams();
      renderPage();
    });
  }

  function renderPage() {
    const list = filtered();
    const uiEl = ui.defaultUi("item-library");

    if (state.page > list.length) state.page = Math.max(1, list.length);
    if (state.page < 1) state.page = 1;

    const slugToFocus = state.focusSlug;
    state.focusSlug = null;
    focusHighlightSlug = slugToFocus;
    if (slugToFocus) {
      const focusIdx = list.findIndex(function (e) { return e.slug === slugToFocus; });
      if (focusIdx >= 0) state.page = focusIdx + 1;
    }

    if (!list.length) {
      focusHighlightSlug = null;
      uiEl.page.hidden = true;
      uiEl.empty.hidden = false;
      uiEl.empty.innerHTML = "<strong>" + esc(uiLabel("empty")) + "</strong>";
      uiEl.pageInfo.textContent = "0 of 0";
      uiEl.prev.disabled = uiEl.next.disabled = true;
      syncUrlParams();
      return;
    }

    const idx = Math.min(Math.max(state.page - 1, 0), list.length - 1);
    state.page = idx + 1;
    const current = list[idx];
    const focused = focusHighlightSlug && current.slug === focusHighlightSlug;

    uiEl.empty.hidden = true;
    uiEl.page.hidden = false;
    uiEl.page.innerHTML = renderCard(current, focused);
    uiEl.pageInfo.textContent = (idx + 1) + " of " + list.length;
    uiEl.prev.disabled = idx <= 0;
    uiEl.next.disabled = idx >= list.length - 1;

    if (focused) {
      const card = uiEl.page.querySelector(".item-card-focused, [data-slug=\"" + current.slug + "\"]");
      if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    focusHighlightSlug = null;
    syncUrlParams();
  }

  function applyChromeLabels() {
    const h1 = document.querySelector("#item-library .top-bar h1");
    if (h1) h1.textContent = uiLabel("title");
    const search = document.getElementById("search");
    if (search) search.placeholder = uiLabel("searchPlaceholder");
  }

  async function bootstrap() {
    ui.initBookChrome("items", function (l) {
      state.lang = l;
      applyChromeLabels();
      bindFilters();
      renderPage();
    });

    const urlParams = shell.parseUrlParams();
    state.lang = urlParams.lang;
    applyChromeLabels();
    bindFilters();

    const uiEl = ui.defaultUi("item-library");
    bindMetaLinks(uiEl);

    try {
      loadConfig = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "items", indexFileName: "items-index.json",
        demoIndex: "demo/items-index.json",
      });

      applyUrlStateOnBootstrap();

      await Promise.all([
        spellLinks.loadSpellNameMap(loadConfig.scenario),
        itemLinks.loadItemNameMap(loadConfig.scenario),
      ]);

      entries = await loader.loadData(loadConfig, false, assembleItem);
      referrerIndex = await itemLinks.buildItemReferrerIndex(loadConfig.scenario);

      document.getElementById("search").addEventListener("input", function (e) {
        state.search = e.target.value;
        state.page = 1;
        state.focusSlug = null;
        syncUrlParams();
        renderPage();
      });

      renderPage();
      ui.bindPagination(state, uiEl, function () {
        state.focusSlug = null;
        syncUrlParams();
        renderPage();
      }, function () { return filtered().length; });
    } catch (err) {
      ui.setError(uiEl, uiLabel("loadError"), esc(err.message));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
