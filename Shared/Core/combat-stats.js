(function (global) {
  "use strict";

  const md = global.DnDCore && global.DnDCore.markdown;
  const locale = global.DnDCore && global.DnDCore.locale;
  const schema = global.DnDCore && global.DnDCore.contentSchema;

  const CHARACTER_HEADINGS = (schema && schema.CHARACTER) || {
    basicInfo: ["Basic Info", "Основна інформація"],
    combat: ["Combat", "Бойові характеристики"],
    mainStats: ["Main Stats", "Основні характеристики"],
  };

  const MONSTER_HEADINGS = (schema && schema.MONSTER) || {
    statBlock: ["Stat Block", "Статблок"],
    mainStats: ["Main Stats", "Основні характеристики"],
  };

  const ENCOUNTER_HEADINGS = ["Encounter Reference", "Довідник зустрічі"];

  function section(text, aliases) {
    return md.sectionAnyHeading(text, ...(aliases || []));
  }

  function parseLeadingInt(raw) {
    if (raw == null || raw === "") return null;
    const m = String(raw).trim().match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function parseHpMax(hpRaw) {
    return parseLeadingInt(hpRaw);
  }

  function parseAc(acRaw) {
    return parseLeadingInt(acRaw);
  }

  function pickLocaleBlock(entry, lang) {
    if (!entry) return {};
    if (entry[lang] && typeof entry[lang].name === "string") return entry[lang];
    return entry.en || {};
  }

  function hpRawFromCombat(combat) {
    return combat["Hit Points HP"] || combat["ХП"] || combat["Пункти здоров'я ХП"] || combat["Пункти здоров'я ПЗ"] || "";
  }

  function acRawFromCombat(combat) {
    return combat["Armor Class AC"] || combat["Клас броні КБ"] || "";
  }

  function parseCharacterCombat(text, lang) {
    if (text && typeof text === "object" && typeof text.name === "string") {
      const hpRaw = text.hpRaw || text.hp || "";
      const acRaw = text.acRaw || (text.ac != null && text.ac !== "" ? String(text.ac) : "");
      return {
        name: text.name,
        acRaw: acRaw,
        hpRaw: hpRaw,
        ac: text.ac != null && typeof text.ac === "number" ? text.ac : parseAc(acRaw),
        hpMax: text.hpMax != null ? text.hpMax : parseHpMax(hpRaw),
        statsTable: text.statsTable || text.stats || [],
      };
    }
    const body = md.excludeDmNotes(text);
    const info = md.parseBoldFields(section(body, CHARACTER_HEADINGS.basicInfo));
    const combat = md.parseBoldFields(section(body, CHARACTER_HEADINGS.combat));
    const acRaw = acRawFromCombat(combat);
    const hpRaw = hpRawFromCombat(combat);
    return {
      name: info["Character Name"] || info["Ім'я персонажа"] || md.titleForLocale(body, lang),
      acRaw: acRaw,
      hpRaw: hpRaw,
      ac: parseAc(acRaw),
      hpMax: parseHpMax(hpRaw),
      statsTable: md.tableRows(section(body, CHARACTER_HEADINGS.mainStats)),
    };
  }

  function parseMonsterCombat(text, lang, showDm) {
    if (text && typeof text === "object" && typeof text.name === "string") {
      const hpRaw = text.hpRaw || text.hp || "";
      const acRaw = text.acRaw || (text.ac != null && text.ac !== "" ? String(text.ac) : "");
      return {
        name: text.name,
        acRaw: acRaw,
        hpRaw: hpRaw,
        ac: text.ac != null && typeof text.ac === "number" ? text.ac : parseAc(acRaw),
        hpMax: text.hpMax != null ? text.hpMax : parseHpMax(hpRaw),
        statsTable: text.statsTable || [],
        defaultQuantity: text.defaultQuantity != null ? text.defaultQuantity : 1,
      };
    }
    const body = showDm ? text : md.excludeDmNotes(text);
    const stat = md.parseBoldFields(section(body, MONSTER_HEADINGS.statBlock));
    const encounter = md.parseBoldFields(section(body, ENCOUNTER_HEADINGS));
    const acRaw = acRawFromCombat(stat);
    const hpRaw = hpRawFromCombat(stat);
    const qtyRaw = encounter["Default quantity"] || encounter["Типова кількість"] || "";
    const defaultQuantity = parseLeadingInt(qtyRaw) || 1;
    return {
      name: md.titleForLocale(body, lang),
      acRaw: acRaw,
      hpRaw: hpRaw,
      ac: parseAc(acRaw),
      hpMax: parseHpMax(hpRaw),
      statsTable: md.tableRows(section(body, MONSTER_HEADINGS.mainStats)),
      defaultQuantity: defaultQuantity,
    };
  }

  function fromCharacterEntry(entry, lang) {
    const block = pickLocaleBlock(entry, lang);
    if (typeof block.name === "string") {
      const acRaw = block.acRaw || (block.ac != null && block.ac !== "" ? String(block.ac) : "");
      const hpRaw = block.hpRaw || block.hp || "";
      return {
        slug: entry.slug,
        sourceType: "character",
        name: block.name,
        acRaw: acRaw,
        hpRaw: hpRaw,
        ac: block.ac != null && typeof block.ac === "number" ? block.ac : parseAc(acRaw),
        hpMax: block.hpMax != null ? block.hpMax : parseHpMax(hpRaw),
        statsTable: block.statsTable || block.stats || [],
      };
    }
    const text = lang === "ua" && entry.ua ? entry.ua : entry.en;
    const parsed = parseCharacterCombat(text, lang);
    return Object.assign({ slug: entry.slug, sourceType: "character" }, parsed);
  }

  function fromMonsterEntry(entry, lang, mode) {
    const showDm = mode === "dm";
    const block = pickLocaleBlock(entry, lang);
    if (typeof block.name === "string") {
      const acRaw = block.acRaw || (block.ac != null && block.ac !== "" ? String(block.ac) : "");
      const hpRaw = block.hpRaw || block.hp || "";
      return {
        slug: entry.slug,
        sourceType: "monster",
        name: block.name,
        acRaw: acRaw,
        hpRaw: hpRaw,
        ac: block.ac != null && typeof block.ac === "number" ? block.ac : parseAc(acRaw),
        hpMax: block.hpMax != null ? block.hpMax : parseHpMax(hpRaw),
        statsTable: block.statsTable || [],
        defaultQuantity: block.defaultQuantity != null ? block.defaultQuantity : 1,
      };
    }
    const text = lang === "ua" && entry.ua ? entry.ua : entry.en;
    const parsed = parseMonsterCombat(text, lang, showDm);
    return Object.assign({ slug: entry.slug, sourceType: "monster" }, parsed);
  }

  function assembleCharacterEntry(slug, texts) {
    const en = parseCharacterCombat(texts.en, "en");
    const ua = texts.ua && texts.ua.trim()
      ? parseCharacterCombat(texts.ua, "ua")
      : locale.mergeWithFallback(en, {});
    return { slug: slug, en: en, ua: ua };
  }

  function assembleMonsterEntry(slug, texts, showDm) {
    const en = parseMonsterCombat(texts.en, "en", showDm);
    const ua = texts.ua && texts.ua.trim()
      ? parseMonsterCombat(texts.ua, "ua", showDm)
      : locale.mergeWithFallback(en, {});
    return { slug: slug, en: en, ua: ua };
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.combatStats = {
    parseLeadingInt: parseLeadingInt,
    parseHpMax: parseHpMax,
    parseAc: parseAc,
    pickLocaleBlock: pickLocaleBlock,
    parseCharacterCombat: parseCharacterCombat,
    parseMonsterCombat: parseMonsterCombat,
    fromCharacterEntry: fromCharacterEntry,
    fromMonsterEntry: fromMonsterEntry,
    assembleCharacterEntry: assembleCharacterEntry,
    assembleMonsterEntry: assembleMonsterEntry,
  };
})(typeof window !== "undefined" ? window : this);
