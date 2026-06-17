"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEMO_ITEMS = path.join(ROOT, "Shared", "Items", "demo");

const ITEM_TYPES = ["armor", "potion", "ring", "rod", "scroll", "staff", "wand", "weapon", "wondrous"];
const ITEM_RARITIES = ["common", "uncommon", "rare", "very_rare", "legendary", "artifact"];

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

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яіїєґ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseItemNameFromFile(filePath, lang) {
  const text = fs.readFileSync(filePath, "utf8");
  const headerMatch = text.match(/###\s+Header\s*\n([\s\S]*?)(?=\n### |\n---|$)/i);
  const headerBlock = headerMatch ? headerMatch[1] : text.split("---")[0];
  const nameKey = lang === "ua" ? "Назва" : "Name";
  const fieldRe = new RegExp("\\*\\*" + nameKey + ":\\*\\*\\s*(.+)", "i");
  const fieldMatch = headerBlock.match(fieldRe);
  if (fieldMatch) return fieldMatch[1].trim();
  const h1 = text.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : null;
}

function scanItemDir(dir) {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  fs.readdirSync(dir).forEach(function (name) {
    if (!name.endsWith(".en.md")) return;
    const slug = name.replace(/\.en\.md$/, "");
    const enPath = path.join(dir, slug + ".en.md");
    const uaPath = path.join(dir, slug + ".ua.md");
    const enName = parseItemNameFromFile(enPath, "en");
    if (!enName) return;
    let uaName = null;
    if (fs.existsSync(uaPath)) {
      uaName = parseItemNameFromFile(uaPath, "ua");
    }
    entries.push({
      slug: slug,
      enName: enName,
      uaName: uaName,
      dir: dir,
      isDemo: dir.replace(/\\/g, "/").endsWith("Shared/Items/demo"),
    });
  });
  return entries;
}

function buildRegistry() {
  const entries = scanItemDir(DEMO_ITEMS);
  const scenariosDir = path.join(ROOT, "scenarios");
  if (fs.existsSync(scenariosDir)) {
    fs.readdirSync(scenariosDir).forEach(function (scenario) {
      const itemDir = path.join(scenariosDir, scenario, "items");
      entries.push.apply(entries, scanItemDir(itemDir));
    });
  }

  const byNormEn = new Map();
  const byNormUa = new Map();
  entries.forEach(function (entry) {
    const normEn = normalizeName(entry.enName);
    if (normEn) {
      if (!byNormEn.has(normEn)) byNormEn.set(normEn, []);
      byNormEn.get(normEn).push(entry);
    }
    if (entry.uaName) {
      const normUa = normalizeName(entry.uaName);
      if (!normUa) return;
      if (!byNormUa.has(normUa)) byNormUa.set(normUa, []);
      byNormUa.get(normUa).push(entry);
    }
  });

  return { entries: entries, byNormEn: byNormEn, byNormUa: byNormUa };
}

function readScenarioItemSlugs(scenarioItemsDir) {
  const indexPath = path.join(scenarioItemsDir, "items-index.json");
  if (!fs.existsSync(indexPath)) return [];
  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  return raw.map(function (entry) {
    return String(entry)
      .replace(/^.*\//, "")
      .replace(/\.(en|ua)\.md$/i, "")
      .replace(/\.md$/i, "");
  });
}

function pickSlug(candidates, scenarioItemsDir) {
  const seen = new Set();
  candidates = candidates.filter(function (c) {
    if (seen.has(c.slug)) return false;
    seen.add(c.slug);
    return true;
  });
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0].slug;

  const scenarioSlugs = new Set(readScenarioItemSlugs(scenarioItemsDir));
  const inScenario = candidates.filter(function (c) {
    return scenarioSlugs.has(c.slug);
  });
  if (inScenario.length === 1) return inScenario[0].slug;
  if (inScenario.length > 1) {
    return { error: "ambiguous", candidates: inScenario.map(function (c) { return c.slug; }) };
  }

  const demo = candidates.filter(function (c) { return c.isDemo; });
  if (demo.length === 1) return demo[0].slug;
  if (demo.length > 1) {
    return { error: "ambiguous", candidates: demo.map(function (c) { return c.slug; }) };
  }

  return { error: "ambiguous", candidates: candidates.map(function (c) { return c.slug; }) };
}

function resolveItemSlug(name, options) {
  const registry = options && options.registry ? options.registry : buildRegistry();
  const scenarioItemsDir = options && options.scenarioItemsDir ? options.scenarioItemsDir : null;
  const norm = normalizeName(name);
  if (!norm) return null;

  let candidates = registry.byNormEn.get(norm) || [];
  if (!candidates.length) {
    candidates = registry.byNormUa.get(norm) || [];
  }
  if (!candidates.length) return null;

  const picked = pickSlug(candidates, scenarioItemsDir);
  if (picked && typeof picked === "object" && picked.error) {
    return picked;
  }
  return picked;
}

function allItemNames(registry) {
  const reg = registry || buildRegistry();
  const names = new Set();
  reg.entries.forEach(function (e) {
    names.add(e.enName);
    if (e.uaName) names.add(e.uaName);
  });
  return Array.from(names);
}

module.exports = {
  ROOT: ROOT,
  DEMO_ITEMS: DEMO_ITEMS,
  ITEM_TYPES: ITEM_TYPES,
  ITEM_RARITIES: ITEM_RARITIES,
  keysFromSlug: keysFromSlug,
  isItemSlug: isItemSlug,
  normalizeName: normalizeName,
  buildRegistry: buildRegistry,
  resolveItemSlug: resolveItemSlug,
  allItemNames: allItemNames,
  readScenarioItemSlugs: readScenarioItemSlugs,
};
