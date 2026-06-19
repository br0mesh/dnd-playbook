"use strict";

const fs = require("fs");
const path = require("path");
const md = require("./markdown-utils");
const itemRegistry = require("./item-registry");

const ROOT = itemRegistry.ROOT;

const SCAN_FOLDERS = [
  { folder: "characters", index: "characters-index.json" },
  { folder: "monsters", index: "monsters-index.json" },
  { folder: "dm-script", index: "dm-script-index.json" },
  { folder: "npc", index: "npc-index.json" },
];

const EQUIPMENT_HEADINGS = ["Equipment & Inventory", "Спорядження та інвентар", "Спорядження"];
const MAGIC_ITEM_KEYS = ["Magic items", "Чарівні предмети"];
const TREASURE_HEADINGS = ["Treasure", "Loot", "Скарб", "Добуток"];

const DM_SCRIPT_HEADINGS = {
  summary: ["Summary", "Короткий опис"],
  readAloud: ["Read-aloud", "Зачитай"],
  checks: ["Checks", "Перевірки"],
  contingencies: ["Contingencies", "Запасні варіанти"],
  dmNotes: ["DM Notes", "Нотатки Майстра"],
};

function readIndexSlugs(dir, indexName) {
  const indexPath = path.join(dir, indexName);
  if (!fs.existsSync(indexPath)) return [];
  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  return raw.map(function (entry) {
    return String(entry)
      .replace(/^.*\//, "")
      .replace(/\.(en|ua)\.md$/i, "")
      .replace(/\.md$/i, "");
  });
}

function addItemSlugRef(refs, token, sourceFile, sourceSection, reg, scenarioItemsDir) {
  const slug = String(token || "").trim();
  if (!slug) return;
  const ref = {
    itemName: slug,
    sourceFile: sourceFile,
    sourceSection: sourceSection,
    slug: null,
  };
  if (!itemRegistry.isItemSlug(slug)) {
    ref.formatError = true;
    refs.push(ref);
    return;
  }
  ref.slug = slug;
  refs.push(ref);
}

function addItemNameRef(refs, name, sourceFile, sourceSection, reg, scenarioItemsDir) {
  const resolved = itemRegistry.resolveItemSlug(name, { registry: reg, scenarioItemsDir: scenarioItemsDir });
  const ref = {
    itemName: name,
    sourceFile: sourceFile,
    sourceSection: sourceSection,
    slug: null,
  };
  if (resolved && typeof resolved === "object" && resolved.error) {
    ref.resolveError = resolved;
    refs.push(ref);
    return;
  }
  if (!resolved) return;
  ref.slug = resolved;
  refs.push(ref);
}

function scanMagicItemsLine(block, relPath, refs, reg, scenarioItemsDir) {
  MAGIC_ITEM_KEYS.forEach(function (key) {
    const re = new RegExp("\\*\\*" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":\\*\\*\\s*(.+)", "i");
    const m = block.match(re);
    if (!m) return;
    m[1].split(",").forEach(function (part) {
      addItemSlugRef(refs, part.trim(), relPath, "Equipment", reg, scenarioItemsDir);
    });
  });
}

function scanGearProse(block, relPath, refs, reg, scenarioItemsDir) {
  const itemNames = itemRegistry.allItemNames(reg);
  block.split("\n").forEach(function (line, i) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) return;
    const body = trimmed.slice(2);
    md.findSpellPhrasesInText(body, itemNames).forEach(function (hit) {
      addItemNameRef(refs, hit.spellName, relPath, "Equipment", reg, scenarioItemsDir);
    });
  });
}

function scanEquipmentBlock(relPath, text, refs, reg, scenarioItemsDir) {
  const block = md.sectionAnyHeading.apply(md, [text].concat(EQUIPMENT_HEADINGS));
  if (!block) return;
  scanMagicItemsLine(block, relPath, refs, reg, scenarioItemsDir);
  scanGearProse(block, relPath, refs, reg, scenarioItemsDir);
}

function scanTreasureBlock(relPath, text, refs, reg, scenarioItemsDir) {
  const block = md.sectionAnyHeading.apply(md, [text].concat(TREASURE_HEADINGS));
  if (!block) return;
  const itemNames = itemRegistry.allItemNames(reg);
  md.findSpellPhrasesInText(block, itemNames).forEach(function (hit) {
    addItemNameRef(refs, hit.spellName, relPath, "Treasure", reg, scenarioItemsDir);
  });
}

function scanCharacterFile(relPath, text, refs, reg, scenarioItemsDir) {
  scanEquipmentBlock(relPath, text, refs, reg, scenarioItemsDir);
}

function scanMonsterOrNpc(relPath, text, refs, reg, scenarioItemsDir) {
  scanTreasureBlock(relPath, text, refs, reg, scenarioItemsDir);
}

function scanDmScript(relPath, text, refs, reg, scenarioItemsDir) {
  const itemNames = itemRegistry.allItemNames(reg);
  Object.keys(DM_SCRIPT_HEADINGS).forEach(function (key) {
    const block = md.sectionAnyHeading.apply(md, [text].concat(DM_SCRIPT_HEADINGS[key]));
    if (!block) return;
    md.findSpellPhrasesInText(block, itemNames).forEach(function (hit) {
      addItemNameRef(refs, hit.spellName, relPath, md.SECTION_LABELS[key] || key, reg, scenarioItemsDir);
    });
  });
}

function scanScenario(scenarioDir) {
  const reg = itemRegistry.buildRegistry();
  const scenarioItemsDir = path.join(scenarioDir, "items");
  const refs = [];

  SCAN_FOLDERS.forEach(function (cfg) {
    const folderDir = path.join(scenarioDir, cfg.folder);
    const slugs = readIndexSlugs(folderDir, cfg.index);
    slugs.forEach(function (slug) {
      const enPath = path.join(folderDir, slug + ".en.md");
      const uaPath = path.join(folderDir, slug + ".ua.md");
      const relBase = path.relative(scenarioDir, folderDir).replace(/\\/g, "/");

      if (fs.existsSync(enPath) && cfg.folder === "characters") {
        scanCharacterFile(relBase + "/" + slug + ".en.md", fs.readFileSync(enPath, "utf8"), refs, reg, scenarioItemsDir);
      }
      if (fs.existsSync(enPath) && (cfg.folder === "monsters" || cfg.folder === "npc")) {
        scanMonsterOrNpc(relBase + "/" + slug + ".en.md", fs.readFileSync(enPath, "utf8"), refs, reg, scenarioItemsDir);
      }
      if (fs.existsSync(uaPath) && (cfg.folder === "monsters" || cfg.folder === "npc")) {
        scanMonsterOrNpc(relBase + "/" + slug + ".ua.md", fs.readFileSync(uaPath, "utf8"), refs, reg, scenarioItemsDir);
      }
      if (fs.existsSync(enPath) && cfg.folder === "dm-script") {
        scanDmScript(relBase + "/" + slug + ".en.md", fs.readFileSync(enPath, "utf8"), refs, reg, scenarioItemsDir);
      }
      if (fs.existsSync(uaPath) && cfg.folder === "dm-script") {
        scanDmScript(relBase + "/" + slug + ".ua.md", fs.readFileSync(uaPath, "utf8"), refs, reg, scenarioItemsDir);
      }
    });
  });

  return { refs: refs };
}

function uniqueRefsBySlug(refs) {
  const bySlug = new Map();
  refs.forEach(function (r) {
    const key = (r.slug || r.itemName.toLowerCase()) + "|" + r.sourceFile + "|" + r.sourceSection;
    if (!bySlug.has(key)) bySlug.set(key, r);
  });
  return Array.from(bySlug.values());
}

function listScenarios() {
  const scenariosDir = path.join(ROOT, "scenarios");
  if (!fs.existsSync(scenariosDir)) return [];
  return fs.readdirSync(scenariosDir).filter(function (name) {
    return fs.statSync(path.join(scenariosDir, name)).isDirectory();
  });
}

if (require.main === module) {
  const slug = process.argv[2] || "test-adventure";
  const scenarioDir = path.join(ROOT, "scenarios", slug);
  if (!fs.existsSync(scenarioDir)) {
    console.error("Scenario not found: " + slug);
    process.exit(1);
  }
  const result = scanScenario(scenarioDir);
  const unique = uniqueRefsBySlug(result.refs);
  const indexSlugs = new Set(itemRegistry.readScenarioItemSlugs(path.join(scenarioDir, "items")));

  console.log("scenario: " + slug);
  console.log("item references: " + unique.length);
  unique.forEach(function (r) {
    const inIndex = r.slug && indexSlugs.has(r.slug) ? "OK" : "MISSING";
    const slugLabel = r.slug || "(unresolved)";
    console.log(
      "  [" + inIndex + "] " + r.itemName + " → " + slugLabel + " — " + r.sourceFile + " (" + r.sourceSection + ")"
    );
  });
  const missing = unique.filter(function (r) {
    return !r.slug || !indexSlugs.has(r.slug);
  });
  if (missing.length) {
    console.log("\n" + missing.length + " missing from items-index.json");
    process.exit(1);
  }
}

module.exports = {
  scanScenario: scanScenario,
  uniqueRefsBySlug: uniqueRefsBySlug,
  listScenarios: listScenarios,
};
