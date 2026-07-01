"use strict";

const fs = require("fs");
const path = require("path");
const itemRegistry = require("./item-registry");
const scanRefs = require("./scan-item-refs");

const ROOT = itemRegistry.ROOT;
const DEMO_ITEMS = itemRegistry.DEMO_ITEMS;

function copyItemFromDemo(slug, itemDir) {
  const enSrc = path.join(DEMO_ITEMS, slug + ".en.md");
  const uaSrc = path.join(DEMO_ITEMS, slug + ".ua.md");
  const enDst = path.join(itemDir, slug + ".en.md");
  const uaDst = path.join(itemDir, slug + ".ua.md");
  let copied = false;
  if (!fs.existsSync(enDst) && fs.existsSync(enSrc)) {
    fs.copyFileSync(enSrc, enDst);
    copied = true;
  }
  if (!fs.existsSync(uaDst) && fs.existsSync(uaSrc)) {
    fs.copyFileSync(uaSrc, uaDst);
    copied = true;
  }
  return copied || fs.existsSync(enDst);
}

function syncScenarioItems(scenarioDir) {
  const itemDir = path.join(scenarioDir, "items");
  if (!fs.existsSync(itemDir)) fs.mkdirSync(itemDir, { recursive: true });

  const indexPath = path.join(itemDir, "items-index.json");
  let slugs = fs.existsSync(indexPath) ? itemRegistry.readScenarioItemSlugs(itemDir) : [];
  const result = scanRefs.scanScenario(scenarioDir);
  const errors = [];
  const added = [];

  const needed = new Set();
  result.refs.forEach(function (ref) {
    if (ref.slug) needed.add(ref.slug);
  });

  needed.forEach(function (slug) {
    if (slugs.includes(slug)) return;
    const demoPath = path.join(DEMO_ITEMS, slug + ".en.md");
    if (!fs.existsSync(demoPath)) {
      errors.push('No demo item for slug "' + slug + '". Add manually or extend Shared/Items/demo/');
      return;
    }
    copyItemFromDemo(slug, itemDir);
    if (!slugs.includes(slug)) {
      slugs.push(slug);
      added.push(slug);
    }
  });

  slugs = slugs.slice().sort();
  fs.writeFileSync(indexPath, JSON.stringify(slugs, null, 2) + "\n", "utf8");

  return { added: added, errors: errors, slugs: slugs };
}

function validateItemClosure(scenarioDir) {
  const scenarioSlug = path.basename(scenarioDir);
  const itemDir = path.join(scenarioDir, "items");
  const indexSlugs = new Set(itemRegistry.readScenarioItemSlugs(itemDir));
  const result = scanRefs.scanScenario(scenarioDir);
  const errors = [];

  result.refs.forEach(function (ref) {
    if (ref.formatError) {
      errors.push(
        'INVALID ITEM SLUG: "' +
          ref.itemName +
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
        'AMBIGUOUS ITEM: "' +
          ref.itemName +
          '" in ' +
          ref.sourceFile +
          " (" +
          ref.sourceSection +
          ") — candidates: " +
          ref.resolveError.candidates.join(", ")
      );
      return;
    }
    if (!ref.slug) return;
    if (!indexSlugs.has(ref.slug)) {
      errors.push(
        "MISSING ITEM: " +
          ref.slug +
          " referenced in " +
          ref.sourceFile +
          " (" +
          ref.sourceSection +
          ")"
      );
    }
  });

  return { scenario: scenarioSlug, errors: errors };
}

function validateAllItemClosure() {
  const scenarios = scanRefs.listScenarios();
  const allErrors = [];
  scenarios.forEach(function (name) {
    const scenarioDir = path.join(ROOT, "scenarios", name);
    const result = validateItemClosure(scenarioDir);
    if (result.errors.length) {
      console.error("scenario: " + result.scenario);
      result.errors.forEach(function (e) { console.error(e); });
      allErrors.push.apply(allErrors, result.errors);
    }
  });
  if (allErrors.length) {
    console.error("Item closure: " + allErrors.length + " error(s).");
    return 1;
  }
  console.log("Item closure: OK (" + scenarios.length + " scenario(s)).");
  return 0;
}

function syncAllScenarios() {
  const scenarios = scanRefs.listScenarios();
  let totalAdded = 0;
  const allErrors = [];
  scenarios.forEach(function (name) {
    const scenarioDir = path.join(ROOT, "scenarios", name);
    const result = syncScenarioItems(scenarioDir);
    if (result.errors.length) {
      console.error("scenario: " + name);
      result.errors.forEach(function (e) { console.error(e); });
      allErrors.push.apply(allErrors, result.errors);
    } else if (result.added.length) {
      console.log("scenario: " + name + " — added " + result.added.length + " item(s): " + result.added.join(", "));
      totalAdded += result.added.length;
    } else {
      console.log("scenario: " + name + " — item index up to date");
    }
  });
  if (allErrors.length) {
    console.error("Sync items: " + allErrors.length + " error(s).");
    return 1;
  }
  console.log("Sync items: " + totalAdded + " item(s) added across " + scenarios.length + " scenario(s).");
  return 0;
}

module.exports = {
  syncScenarioItems: syncScenarioItems,
  validateItemClosure: validateItemClosure,
  validateAllItemClosure: validateAllItemClosure,
  syncAllScenarios: syncAllScenarios,
};
