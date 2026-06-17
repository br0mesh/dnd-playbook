"use strict";

const fs = require("fs");
const path = require("path");
const registry = require("./spell-registry");
const scanRefs = require("./scan-spell-refs");
const stubMeta = require("./spell-stub-meta");
const spellTemplate = require("./spell-template");

const ROOT = registry.ROOT;
const DEMO_SPELLS = registry.DEMO_SPELLS;

function copySpellFromDemo(slug, spellDir, needsUa) {
  const enSrc = path.join(DEMO_SPELLS, slug + ".en.md");
  const uaSrc = path.join(DEMO_SPELLS, slug + ".ua.md");
  const enDst = path.join(spellDir, slug + ".en.md");
  const uaDst = path.join(spellDir, slug + ".ua.md");
  let copied = false;
  if (!fs.existsSync(enDst) && fs.existsSync(enSrc)) {
    fs.copyFileSync(enSrc, enDst);
    copied = true;
  }
  if (needsUa && !fs.existsSync(uaDst) && fs.existsSync(uaSrc)) {
    fs.copyFileSync(uaSrc, uaDst);
    copied = true;
  }
  return copied || fs.existsSync(enDst);
}

function createStubFromSlug(slug, spellDir, needsUa) {
  const meta = stubMeta[slug];
  if (!meta) {
    return { error: 'No demo or stub metadata for slug "' + slug + '". Add spell manually or extend scripts/spell-stub-meta.js' };
  }

  const enPath = path.join(spellDir, slug + ".en.md");
  const uaPath = path.join(spellDir, slug + ".ua.md");
  let created = false;
  if (!fs.existsSync(enPath)) {
    fs.writeFileSync(enPath, spellTemplate.renderStubEn(meta.nameEn, meta), "utf8");
    created = true;
  }
  if (needsUa && !fs.existsSync(uaPath)) {
    fs.writeFileSync(uaPath, spellTemplate.renderStubUa(meta.nameUa, meta), "utf8");
    created = true;
  }
  return { slug: slug, created: created };
}

function syncScenarioSpells(scenarioDir) {
  const spellDir = path.join(scenarioDir, "spells");
  if (!fs.existsSync(spellDir)) fs.mkdirSync(spellDir, { recursive: true });

  const indexPath = path.join(spellDir, "spells-index.json");
  let slugs = fs.existsSync(indexPath) ? registry.readScenarioSpellSlugs(spellDir) : [];
  const usesUa = scanRefs.scanScenario(scenarioDir).usesUa;
  const result = scanRefs.scanScenario(scenarioDir);
  const errors = [];
  const added = [];

  const needed = new Set();
  result.refs.forEach(function (ref) {
    if (ref.slug) needed.add(ref.slug);
  });

  needed.forEach(function (slug) {
    if (slugs.includes(slug)) return;

    const demoPath = path.join(DEMO_SPELLS, slug + ".en.md");
    if (fs.existsSync(demoPath)) {
      copySpellFromDemo(slug, spellDir, usesUa);
    } else {
      const stub = createStubFromSlug(slug, spellDir, usesUa);
      if (stub.error) {
        errors.push(stub.error);
        return;
      }
    }

    if (!slugs.includes(slug)) {
      slugs.push(slug);
      added.push(slug);
    }
  });

  slugs = slugs.slice().sort();
  fs.writeFileSync(indexPath, JSON.stringify(slugs, null, 2) + "\n", "utf8");

  return { added: added, errors: errors, slugs: slugs };
}

function validateSpellClosure(scenarioDir) {
  const scenarioSlug = path.basename(scenarioDir);
  const spellDir = path.join(scenarioDir, "spells");
  const indexSlugs = new Set(registry.readScenarioSpellSlugs(spellDir));
  const result = scanRefs.scanScenario(scenarioDir);
  const errors = [];
  const warnings = result.warnings.slice();

  result.refs.forEach(function (ref) {
    if (ref.formatError) {
      errors.push(
        'INVALID SPELL SLUG: "' +
          ref.spellName +
          '" in ' +
          ref.sourceFile +
          " (" +
          ref.sourceSection +
          ")"
      );
      return;
    }
    if (ref.resolveError) {
      errors.push(
        'AMBIGUOUS SPELL: "' +
          ref.spellName +
          '" in ' +
          ref.sourceFile +
          " (" +
          ref.sourceSection +
          ") — candidates: " +
          ref.resolveError.candidates.join(", ")
      );
      return;
    }
    if (!ref.slug) {
      errors.push(
        'UNRESOLVED SPELL: "' +
          ref.spellName +
          '" in ' +
          ref.sourceFile +
          " (" +
          ref.sourceSection +
          ")"
      );
      return;
    }
    if (!indexSlugs.has(ref.slug)) {
      errors.push(
        "MISSING SPELL: " +
          ref.slug +
          " referenced in " +
          ref.sourceFile +
          " (" +
          ref.sourceSection +
          ")"
      );
    }
  });

  return {
    scenario: scenarioSlug,
    errors: errors,
    warnings: warnings,
  };
}

function validateAllSpellClosure() {
  const scenarios = scanRefs.listScenarios();
  const allErrors = [];
  const allWarnings = [];
  scenarios.forEach(function (name) {
    const scenarioDir = path.join(ROOT, "scenarios", name);
    const result = validateSpellClosure(scenarioDir);
    if (result.errors.length) {
      console.error("scenario: " + result.scenario);
      result.errors.forEach(function (e) { console.error(e); });
      allErrors.push.apply(allErrors, result.errors);
    }
    result.warnings.forEach(function (w) { console.warn(w); });
    allWarnings.push.apply(allWarnings, result.warnings);
  });
  if (allErrors.length) {
    console.error("Spell closure: " + allErrors.length + " error(s).");
    return 1;
  }
  console.log("Spell closure: OK (" + scenarios.length + " scenario(s)).");
  return 0;
}

function syncAllScenarios() {
  const scenarios = scanRefs.listScenarios();
  let totalAdded = 0;
  const allErrors = [];
  scenarios.forEach(function (name) {
    const scenarioDir = path.join(ROOT, "scenarios", name);
    const result = syncScenarioSpells(scenarioDir);
    if (result.errors.length) {
      console.error("scenario: " + name);
      result.errors.forEach(function (e) { console.error(e); });
      allErrors.push.apply(allErrors, result.errors);
    } else if (result.added.length) {
      console.log("scenario: " + name + " — added " + result.added.length + " spell(s): " + result.added.join(", "));
      totalAdded += result.added.length;
    } else {
      console.log("scenario: " + name + " — spell index up to date");
    }
  });
  if (allErrors.length) {
    console.error("Sync spells: " + allErrors.length + " error(s).");
    return 1;
  }
  console.log("Sync spells: " + totalAdded + " spell(s) added across " + scenarios.length + " scenario(s).");
  return 0;
}

module.exports = {
  syncScenarioSpells: syncScenarioSpells,
  validateSpellClosure: validateSpellClosure,
  validateAllSpellClosure: validateAllSpellClosure,
  syncAllScenarios: syncAllScenarios,
};
