"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEMO_SPELLS = path.join(ROOT, "Shared", "Spells", "demo");

const SPELL_SLUG_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*_(cantrip|\d+(?:st|nd|rd|th))_[a-z]+$/;

function isSpellSlug(token) {
  const slug = String(token || "").trim();
  if (!slug) return false;
  if (SPELL_SLUG_RE.test(slug)) return true;
  const parts = slug.split("_");
  if (parts.length < 3) return false;
  const school = parts[parts.length - 1];
  const level = parts[parts.length - 2];
  return /^[a-z]+$/.test(school) && /^(cantrip|\d+(?:st|nd|rd|th))$/.test(level);
}

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яіїєґ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSpellNameFromFile(filePath, lang) {
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

function scanSpellDir(dir) {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  fs.readdirSync(dir).forEach(function (name) {
    if (!name.endsWith(".en.md")) return;
    const slug = name.replace(/\.en\.md$/, "");
    const enPath = path.join(dir, slug + ".en.md");
    const uaPath = path.join(dir, slug + ".ua.md");
    const enName = parseSpellNameFromFile(enPath, "en");
    if (!enName) return;
    let uaName = null;
    if (fs.existsSync(uaPath)) {
      uaName = parseSpellNameFromFile(uaPath, "ua");
    }
    entries.push({
      slug: slug,
      enName: enName,
      uaName: uaName,
      dir: dir,
      isDemo: dir.replace(/\\/g, "/").endsWith("Shared/Spells/demo"),
    });
  });
  return entries;
}

function buildRegistry() {
  const entries = scanSpellDir(DEMO_SPELLS);
  const scenariosDir = path.join(ROOT, "scenarios");
  if (fs.existsSync(scenariosDir)) {
    fs.readdirSync(scenariosDir).forEach(function (scenario) {
      const spellDir = path.join(scenariosDir, scenario, "spells");
      entries.push.apply(entries, scanSpellDir(spellDir));
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
      if (!byNormUa.has(normUa)) byNormUa.set(normUa, []);
      byNormUa.get(normUa).push(entry);
    }
  });

  return { entries: entries, byNormEn: byNormEn, byNormUa: byNormUa };
}

function readScenarioSpellSlugs(scenarioSpellsDir) {
  const indexPath = path.join(scenarioSpellsDir, "spells-index.json");
  if (!fs.existsSync(indexPath)) return [];
  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  return raw.map(function (entry) {
    return String(entry)
      .replace(/^.*\//, "")
      .replace(/\.(en|ua)\.md$/i, "")
      .replace(/\.md$/i, "");
  });
}

function pickSlug(candidates, scenarioSpellsDir) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0].slug;

  const scenarioSlugs = new Set(readScenarioSpellSlugs(scenarioSpellsDir));
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

function resolveSpellSlug(name, options) {
  const registry = options && options.registry ? options.registry : buildRegistry();
  const scenarioSpellsDir = options && options.scenarioSpellsDir ? options.scenarioSpellsDir : null;
  const norm = normalizeName(name);
  if (!norm) return null;

  let candidates = registry.byNormEn.get(norm) || [];
  if (!candidates.length) {
    candidates = registry.byNormUa.get(norm) || [];
  }
  if (!candidates.length) return null;

  const picked = pickSlug(candidates, scenarioSpellsDir);
  if (picked && typeof picked === "object" && picked.error) {
    return picked;
  }
  return picked;
}

function allSpellNames(registry) {
  const reg = registry || buildRegistry();
  const names = new Set();
  reg.entries.forEach(function (e) {
    names.add(e.enName);
    if (e.uaName) names.add(e.uaName);
  });
  return Array.from(names);
}

function findDemoSlugByEnName(enName) {
  const registry = buildRegistry();
  const norm = normalizeName(enName);
  const candidates = registry.byNormEn.get(norm) || [];
  const demo = candidates.filter(function (c) { return c.isDemo; });
  return demo.length === 1 ? demo[0].slug : null;
}

function getEntryBySlug(slug) {
  return buildRegistry().entries.find(function (e) { return e.slug === slug; });
}

module.exports = {
  ROOT: ROOT,
  DEMO_SPELLS: DEMO_SPELLS,
  SPELL_SLUG_RE: SPELL_SLUG_RE,
  isSpellSlug: isSpellSlug,
  normalizeName: normalizeName,
  buildRegistry: buildRegistry,
  resolveSpellSlug: resolveSpellSlug,
  allSpellNames: allSpellNames,
  findDemoSlugByEnName: findDemoSlugByEnName,
  getEntryBySlug: getEntryBySlug,
  readScenarioSpellSlugs: readScenarioSpellSlugs,
};
