(function (global) {
  "use strict";

  const shell = global.DnDCore.shell;
  const md = global.DnDCore.markdown;
  const mech = global.DnDCore.mechanical;
  const esc = shell.esc;
  const schema = global.DnDCore.contentSchema.ITEM;

  const ITEM_TYPES = schema.types || [];
  const ITEM_RARITIES = schema.rarities || [];

  const EQUIPMENT_HEADINGS = ["Equipment & Inventory", "Спорядження та інвентар", "Спорядження"];
  const MAGIC_ITEM_KEYS = ["Magic items", "Чарівні предмети"];
  const TREASURE_HEADINGS = ["Treasure", "Loot", "Скарб", "Добуток"];

  let itemNameMap = {};
  let nameToSlugEn = {};
  let nameToSlugUa = {};
  let scenarioRef = "";

  function keysFromSlug(slug) {
    const p = String(slug || "").split("_");
    const type_key = p[p.length - 1] || "unknown";
    let rarity_key = p.length >= 2 ? p[p.length - 2] : "unknown";
    if (p.length >= 3) {
      const two = p[p.length - 3] + "_" + p[p.length - 2];
      if (ITEM_RARITIES.indexOf(two) !== -1) rarity_key = two;
    }
    return { rarity_key: rarity_key, type_key: type_key };
  }

  function isItemSlug(token) {
    const slug = String(token || "").trim();
    if (!slug) return false;
    const keys = keysFromSlug(slug);
    return ITEM_TYPES.indexOf(keys.type_key) !== -1 && ITEM_RARITIES.indexOf(keys.rarity_key) !== -1;
  }

  function normalizeItemName(name) {
    return String(name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9а-яіїєґ\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseItemNameFromMd(text, lang) {
    const headerMatch = text.match(/###\s+Header\s*\n([\s\S]*?)(?=\n### |\n---|$)/i);
    const headerBlock = headerMatch ? headerMatch[1] : text.split("---")[0];
    const nameKey = lang === "ua" ? "Назва" : "Name";
    const fieldRe = new RegExp("\\*\\*" + nameKey + ":\\*\\*\\s*(.+)", "i");
    const fieldMatch = headerBlock.match(fieldRe);
    if (fieldMatch) return fieldMatch[1].trim();
    const h1 = text.match(/^#\s+(.+)$/m);
    return h1 ? h1[1].trim() : null;
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function findItemPhrasesInText(text, itemNames) {
    const spellLinks = global.DnDCore.spellLinks;
    if (spellLinks && spellLinks.findSpellPhrasesInText) {
      return spellLinks.findSpellPhrasesInText(text, itemNames);
    }
    return [];
  }

  async function loadItemNameMap(scenario) {
    itemNameMap = {};
    nameToSlugEn = {};
    nameToSlugUa = {};
    scenarioRef = scenario || "";
    const indexUrl = scenario
      ? "../../scenarios/" + scenario + "/items/items-index.json"
      : "../Items/demo/items-index.json";
    try {
      const indexText = await shell.fetchText(new URL(indexUrl, shell.pageBaseUrl()).href, false);
      const slugs = JSON.parse(indexText);
      if (!Array.isArray(slugs)) return;
      const base = shell.indexBaseUrl(indexUrl);
      await Promise.all(slugs.map(async function (entry) {
        const slug = shell.slugFromIndexPath(entry);
        try {
          const enText = await shell.fetchText(new URL(slug + ".en.md", base).href, false);
          let uaText = null;
          try {
            uaText = await shell.fetchTextOptional(new URL(slug + ".ua.md", base).href, false);
          } catch (_uaErr) { /* optional */ }
          const enName = parseItemNameFromMd(enText, "en") || slug;
          const uaName = uaText ? (parseItemNameFromMd(uaText, "ua") || enName) : "";
          itemNameMap[slug] = { en: enName, ua: uaName };
          const normEn = normalizeItemName(enName);
          if (normEn) nameToSlugEn[normEn] = slug;
          if (uaName) {
            const normUa = normalizeItemName(uaName);
            if (normUa) nameToSlugUa[normUa] = slug;
          }
        } catch (err) {
          console.warn("[item-links] Failed to load item:", slug, err);
        }
      }));
    } catch (err) {
      console.warn("[item-links] Failed to load item name map:", err);
    }
  }

  function allItemDisplayNames() {
    const names = [];
    Object.keys(itemNameMap).forEach(function (slug) {
      const n = itemNameMap[slug];
      if (n.en) names.push(n.en);
      if (n.ua && n.ua !== n.en) names.push(n.ua);
    });
    return names;
  }

  function itemLibraryHref(slug, lang) {
    const q = new URLSearchParams();
    if (scenarioRef) q.set("scenario", scenarioRef);
    q.set("item", slug);
    if (lang === "ua") q.set("lang", "ua");
    return "../Items/library.html?" + q.toString();
  }

  function entityLibraryHref(entityType, entitySlug, lang) {
    const paths = {
      character: "../Characters/library.html",
      monster: "../Monsters/library.html",
      npc: "../Npc/library.html",
    };
    const paramKeys = { character: "character", monster: "monster", npc: "npc" };
    const q = new URLSearchParams();
    if (scenarioRef) q.set("scenario", scenarioRef);
    q.set(paramKeys[entityType] || "character", entitySlug);
    if (lang === "ua") q.set("lang", "ua");
    return (paths[entityType] || paths.character) + "?" + q.toString();
  }

  function resolveItemSlug(token, lang) {
    const t = String(token || "").trim();
    if (isItemSlug(t)) return t;
    const norm = normalizeItemName(t);
    if (lang === "ua" && nameToSlugUa[norm]) return nameToSlugUa[norm];
    if (nameToSlugEn[norm]) return nameToSlugEn[norm];
    if (nameToSlugUa[norm]) return nameToSlugUa[norm];
    return null;
  }

  function renderItemToken(token, lang) {
    const t = String(token || "").trim();
    const slug = resolveItemSlug(t, lang);
    if (!slug) return esc(t);
    const names = itemNameMap[slug];
    const label = names
      ? (lang === "ua" && names.ua ? names.ua : names.en)
      : t;
    return '<a class="item-link" href="' + esc(itemLibraryHref(slug, lang)) + '">' + esc(label) + "</a>";
  }

  function renderItemSlugList(text, lang) {
    if (!text) return "";
    return text.split(",").map(function (part) {
      return renderItemToken(part.trim(), lang);
    }).filter(Boolean).join(", ");
  }

  function renderItemProse(text, lang, opts) {
    if (!text) return "";
    const highlightDice = !opts || opts.highlightDice !== false;
    const names = allItemDisplayNames();
    const hits = findItemPhrasesInText(text, names);
    if (!hits.length) return highlightDice ? mech.highlightDice(text) : esc(text);

    let out = "";
    let last = 0;
    hits.forEach(function (hit) {
      const start = hit.start != null ? hit.start : 0;
      const end = hit.end != null ? hit.end : start + hit.spellName.length;
      if (start > last) {
        out += highlightDice ? mech.highlightDice(text.slice(last, start)) : esc(text.slice(last, start));
      }
      const fragment = text.slice(start, end);
      const slug = resolveItemSlug(hit.spellName, lang);
      if (slug) {
        const namesMap = itemNameMap[slug];
        const label = namesMap
          ? (lang === "ua" && namesMap.ua ? namesMap.ua : namesMap.en)
          : fragment;
        out += '<a class="item-link" href="' + esc(itemLibraryHref(slug, lang)) + '">' + esc(label) + "</a>";
      } else {
        out += highlightDice ? mech.highlightDice(fragment) : esc(fragment);
      }
      last = end;
    });
    if (last < text.length) out += highlightDice ? mech.highlightDice(text.slice(last)) : esc(text.slice(last));
    return out;
  }

  function parseEntityName(text, lang, entityType) {
    if (entityType === "character") {
      const info = md.parseBoldFields(md.sectionAnyHeading(text, "Basic Info", "Основна інформація") || text);
      return info["Character Name"] || info["Ім'я персонажа"] || md.titleForLocale(text, lang);
    }
    return md.titleForLocale(text, lang);
  }

  function extractMagicItemSlugs(equipmentBlock) {
    const slugs = [];
    if (!equipmentBlock) return slugs;
    MAGIC_ITEM_KEYS.forEach(function (key) {
      const re = new RegExp("\\*\\*" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":\\*\\*\\s*(.+)", "i");
      const m = equipmentBlock.match(re);
      if (!m) return;
      m[1].split(",").forEach(function (part) {
        const slug = part.trim();
        if (slug && isItemSlug(slug)) slugs.push(slug);
      });
    });
    return slugs;
  }

  function extractProseItemSlugs(equipmentBlock, lang) {
    const slugs = [];
    if (!equipmentBlock) return slugs;
    const names = allItemDisplayNames();
    equipmentBlock.split("\n").forEach(function (line) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("- ")) return;
      findItemPhrasesInText(trimmed.slice(2), names).forEach(function (hit) {
        const slug = resolveItemSlug(hit.spellName, lang);
        if (slug) slugs.push(slug);
      });
    });
    return slugs;
  }

  async function buildItemReferrerIndex(scenario) {
    const index = {};
    const folders = [
      { type: "character", folder: "characters", indexFile: "characters-index.json", demo: "../Characters/demo/characters-index.json" },
      { type: "monster", folder: "monsters", indexFile: "monsters-index.json", demo: "../Monsters/demo/monsters-index.json" },
      { type: "npc", folder: "npc", indexFile: "npc-index.json", demo: "../Npc/demo/npc-index.json" },
    ];

    function addRef(itemSlug, entityType, entitySlug, entityName) {
      if (!index[itemSlug]) index[itemSlug] = [];
      const exists = index[itemSlug].some(function (r) {
        return r.type === entityType && r.slug === entitySlug;
      });
      if (!exists) index[itemSlug].push({ type: entityType, slug: entitySlug, name: entityName });
    }

    await loadItemNameMap(scenario);

    for (let f = 0; f < folders.length; f += 1) {
      const cfg = folders[f];
      const indexUrl = scenario
        ? "../../scenarios/" + scenario + "/" + cfg.folder + "/" + cfg.indexFile
        : cfg.demo;
      let slugs = [];
      try {
        const indexText = await shell.fetchText(new URL(indexUrl, shell.pageBaseUrl()).href, false);
        slugs = JSON.parse(indexText);
        if (!Array.isArray(slugs)) slugs = [];
      } catch (err) {
        console.warn("[item-links] Failed referrer index:", cfg.folder, err);
        continue;
      }
      const base = shell.indexBaseUrl(indexUrl);
      await Promise.all(slugs.map(async function (entry) {
        const entitySlug = shell.slugFromIndexPath(entry);
        try {
          const enText = await shell.fetchText(new URL(entitySlug + ".en.md", base).href, false);
          const entityName = parseEntityName(enText, "en", cfg.type) || entitySlug;
          if (cfg.type === "character") {
            const equip = md.sectionAnyHeading.apply(md, [enText].concat(EQUIPMENT_HEADINGS));
            extractMagicItemSlugs(equip).forEach(function (itemSlug) {
              addRef(itemSlug, "character", entitySlug, entityName);
            });
            extractProseItemSlugs(equip, "en").forEach(function (itemSlug) {
              addRef(itemSlug, "character", entitySlug, entityName);
            });
          } else {
            const treasure = md.sectionAnyHeading.apply(md, [enText].concat(TREASURE_HEADINGS));
            if (treasure) {
              findItemPhrasesInText(treasure, allItemDisplayNames()).forEach(function (hit) {
                const itemSlug = resolveItemSlug(hit.spellName, "en");
                if (itemSlug) addRef(itemSlug, cfg.type, entitySlug, entityName);
              });
            }
          }
        } catch (err) {
          console.warn("[item-links] Failed referrer entity:", entitySlug, err);
        }
      }));
    }

    return index;
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.itemLinks = {
    isItemSlug: isItemSlug,
    keysFromSlug: keysFromSlug,
    loadItemNameMap: loadItemNameMap,
    itemLibraryHref: itemLibraryHref,
    entityLibraryHref: entityLibraryHref,
    resolveItemSlug: resolveItemSlug,
    renderItemToken: renderItemToken,
    renderItemSlugList: renderItemSlugList,
    renderItemProse: renderItemProse,
    buildItemReferrerIndex: buildItemReferrerIndex,
  };
})(typeof window !== "undefined" ? window : this);
