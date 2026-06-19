"use strict";

const fs = require("fs");
const path = require("path");
const md = require("./markdown-utils");
const registry = require("./spell-registry");
const isSpellSlug = registry.isSpellSlug;

const ROOT = registry.ROOT;

const SCAN_FOLDERS = [
  { folder: "characters", index: "characters-index.json" },
  { folder: "monsters", index: "monsters-index.json" },
  { folder: "dm-script", index: "dm-script-index.json" },
  { folder: "npc", index: "npc-index.json" },
  { folder: "items", index: "items-index.json" },
];

const CHARACTER_HEADINGS = {
  spellcasting: ["Spellcasting", "Заклинання"],
  attacks: ["Attacks", "Атаки"],
};

const MONSTER_HEADINGS = {
  traits: ["Traits", "Риси"],
  actions: ["Actions", "Дії"],
  bonusActions: ["Bonus Actions", "Бонусні дії"],
  reactions: ["Reactions", "Реакції"],
  spellcasting: ["Spellcasting", "Заклинання"],
};

const DM_SCRIPT_HEADINGS = {
  summary: ["Summary", "Короткий опис"],
  readAloud: ["Read-aloud", "Зачитай"],
  checks: ["Checks", "Перевірки"],
  contingencies: ["Contingencies", "Запасні варіанти"],
  dmNotes: ["DM Notes", "Нотатки Майстра"],
};

const ITEM_HEADINGS = {
  properties: ["Properties", "Властивості"],
  description: ["Description", "Опис"],
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

function addSlugRef(refs, token, sourceFile, sourceSection) {
  const slug = String(token || "").trim();
  refs.push({
    spellName: slug,
    slug: isSpellSlug(slug) ? slug : null,
    formatError: !isSpellSlug(slug),
    resolveError: null,
    sourceFile: sourceFile,
    sourceSection: sourceSection,
    lineHint: null,
  });
}

function addRef(refs, spellName, sourceFile, sourceSection, lineHint, reg, scenarioSpellsDir) {
  const resolved = registry.resolveSpellSlug(spellName, {
    registry: reg,
    scenarioSpellsDir: scenarioSpellsDir,
  });
  let slug = null;
  let resolveError = null;
  if (resolved && typeof resolved === "object" && resolved.error) {
    resolveError = resolved;
  } else {
    slug = resolved;
  }
  refs.push({
    spellName: spellName,
    slug: slug,
    resolveError: resolveError,
    sourceFile: sourceFile,
    sourceSection: sourceSection,
    lineHint: lineHint || null,
  });
}

function scanCharacterFile(relPath, text, locale, refs, reg, scenarioSpellsDir) {
  const spellBlock = md.sectionAnyHeading.apply(
    md,
    [text].concat(CHARACTER_HEADINGS.spellcasting)
  );
  const sc = md.parseSpellcasting(spellBlock);
  if (sc) {
    if (sc.cantrips) {
      md.splitSpellList(sc.cantrips).forEach(function (token) {
        if (isSpellSlug(token)) {
          addSlugRef(refs, token, relPath, md.SECTION_LABELS.cantrips);
        } else {
          addRef(refs, token, relPath, md.SECTION_LABELS.cantrips, null, reg, scenarioSpellsDir);
        }
      });
    }
    if (sc.prepared) {
      md.splitSpellList(sc.prepared).forEach(function (token) {
        if (isSpellSlug(token)) {
          addSlugRef(refs, token, relPath, md.SECTION_LABELS.prepared);
        } else {
          addRef(refs, token, relPath, md.SECTION_LABELS.prepared, null, reg, scenarioSpellsDir);
        }
      });
    }
  }

  const attacksBlock = md.sectionAnyHeading.apply(
    md,
    [text].concat(CHARACTER_HEADINGS.attacks)
  );
  const rows = md.tableRows(attacksBlock);
  rows.slice(1).forEach(function (row) {
    const attack = md.stripCellBold(row[0]);
    const notes = (row[3] || "").toLowerCase();
    const isCantrip = /cantrip|заговір/i.test(notes);
    if (isSpellSlug(attack) || isCantrip) {
      addSlugRef(refs, attack, relPath, md.SECTION_LABELS.attacks);
    }
  });
}

function scanMonsterOrNpc(relPath, text, refs, reg, scenarioSpellsDir) {
  const spellNames = registry.allSpellNames(reg);
  Object.keys(MONSTER_HEADINGS).forEach(function (key) {
    const block = md.sectionAnyHeading.apply(md, [text].concat(MONSTER_HEADINGS[key]));
    if (!block) return;
    md.findSpellPhrasesInText(block, spellNames).forEach(function (hit) {
      addRef(refs, hit.spellName, relPath, md.SECTION_LABELS[key] || key, hit.lineHint, reg, scenarioSpellsDir);
    });
  });
}

function scanDmScript(relPath, text, refs, reg, scenarioSpellsDir) {
  const spellNames = registry.allSpellNames(reg);
  Object.keys(DM_SCRIPT_HEADINGS).forEach(function (key) {
    const block = md.sectionAnyHeading.apply(md, [text].concat(DM_SCRIPT_HEADINGS[key]));
    if (!block) return;
    md.findSpellPhrasesInText(block, spellNames).forEach(function (hit) {
      addRef(refs, hit.spellName, relPath, md.SECTION_LABELS[key] || key, hit.lineHint, reg, scenarioSpellsDir);
    });
  });
}

const ITEM_CAST_RE = /\b(?:casts?|stores?|contains?)\s+(?:the\s+)?(?:spell\s+)?[«"']?([A-Za-z][A-Za-z' -]+)/gi;

function scanItem(relPath, text, refs, reg, scenarioSpellsDir) {
  const spellNames = registry.allSpellNames(reg);
  const blocks = [];
  Object.keys(ITEM_HEADINGS).forEach(function (key) {
    const block = md.sectionAnyHeading.apply(md, [text].concat(ITEM_HEADINGS[key]));
    if (block) blocks.push(block);
  });
  const combined = blocks.join("\n");
  if (!combined) return;

  let m;
  const castRe = new RegExp(ITEM_CAST_RE.source, ITEM_CAST_RE.flags);
  while ((m = castRe.exec(combined)) !== null) {
    const candidate = m[1].trim();
    const resolved = registry.resolveSpellSlug(candidate, { registry: reg, scenarioSpellsDir: scenarioSpellsDir });
    if (resolved && typeof resolved !== "object") {
      addRef(refs, candidate, relPath, md.SECTION_LABELS.properties, null, reg, scenarioSpellsDir);
    }
  }

  md.findSpellPhrasesInText(combined, spellNames).forEach(function (hit) {
    const line = combined.split("\n")[hit.lineHint - 1] || "";
    if (/\b(?:casts?|stores?|contains?)\b/i.test(line)) {
      addRef(refs, hit.spellName, relPath, md.SECTION_LABELS.properties, hit.lineHint, reg, scenarioSpellsDir);
    }
  });
}

function scenarioUsesUa(scenarioDir) {
  for (let i = 0; i < SCAN_FOLDERS.length; i += 1) {
    const folderDir = path.join(scenarioDir, SCAN_FOLDERS[i].folder);
    const slugs = readIndexSlugs(folderDir, SCAN_FOLDERS[i].index);
    for (let j = 0; j < slugs.length; j += 1) {
      const uaPath = path.join(folderDir, slugs[j] + ".ua.md");
      if (fs.existsSync(uaPath)) return true;
    }
  }
  return false;
}

function scanScenario(scenarioDir) {
  const reg = registry.buildRegistry();
  const scenarioSpellsDir = path.join(scenarioDir, "spells");
  const refs = [];
  const warnings = [];

  SCAN_FOLDERS.forEach(function (cfg) {
    const folderDir = path.join(scenarioDir, cfg.folder);
    const slugs = readIndexSlugs(folderDir, cfg.index);
    slugs.forEach(function (slug) {
      const enPath = path.join(folderDir, slug + ".en.md");
      const uaPath = path.join(folderDir, slug + ".ua.md");
      const relBase = path.relative(scenarioDir, folderDir).replace(/\\/g, "/");

      if (fs.existsSync(enPath) && cfg.folder === "characters") {
        scanCharacterFile(
          relBase + "/" + slug + ".en.md",
          fs.readFileSync(enPath, "utf8"),
          "en",
          refs,
          reg,
          scenarioSpellsDir
        );
      }
      if (fs.existsSync(enPath) && (cfg.folder === "monsters" || cfg.folder === "npc")) {
        scanMonsterOrNpc(relBase + "/" + slug + ".en.md", fs.readFileSync(enPath, "utf8"), refs, reg, scenarioSpellsDir);
      }
      if (fs.existsSync(uaPath) && (cfg.folder === "monsters" || cfg.folder === "npc")) {
        scanMonsterOrNpc(relBase + "/" + slug + ".ua.md", fs.readFileSync(uaPath, "utf8"), refs, reg, scenarioSpellsDir);
      }
      if (fs.existsSync(enPath) && cfg.folder === "dm-script") {
        scanDmScript(relBase + "/" + slug + ".en.md", fs.readFileSync(enPath, "utf8"), refs, reg, scenarioSpellsDir);
      }
      if (fs.existsSync(uaPath) && cfg.folder === "dm-script") {
        scanDmScript(relBase + "/" + slug + ".ua.md", fs.readFileSync(uaPath, "utf8"), refs, reg, scenarioSpellsDir);
      }
      if (fs.existsSync(enPath) && cfg.folder === "items") {
        scanItem(relBase + "/" + slug + ".en.md", fs.readFileSync(enPath, "utf8"), refs, reg, scenarioSpellsDir);
      }
      if (fs.existsSync(uaPath) && cfg.folder === "items") {
        scanItem(relBase + "/" + slug + ".ua.md", fs.readFileSync(uaPath, "utf8"), refs, reg, scenarioSpellsDir);
      }
    });
  });

  const enSlugsByName = new Map();
  refs.forEach(function (r) {
    if (r.sourceFile.endsWith(".en.md") && r.slug) {
      const key = r.spellName.toLowerCase();
      if (!enSlugsByName.has(key)) enSlugsByName.set(key, r.slug);
    }
  });
  refs.forEach(function (r) {
    if (!r.sourceFile.endsWith(".ua.md") || r.slug || !r.spellName) return;
    const enSlug = enSlugsByName.get(r.spellName.toLowerCase());
    if (enSlug) return;
    warnings.push(
      'WARN: UA spell name "' +
        r.spellName +
        '" in ' +
        r.sourceFile +
        " (" +
        r.sourceSection +
        ") does not resolve — check registry Назва or align with EN file"
    );
  });

  return {
    refs: refs,
    warnings: warnings,
    usesUa: scenarioUsesUa(scenarioDir),
  };
}

function uniqueRefsBySlug(refs) {
  const bySlug = new Map();
  refs.forEach(function (r) {
    const key = (r.slug || r.spellName.toLowerCase()) + "|" + r.sourceFile + "|" + r.sourceSection;
    if (!bySlug.has(key)) bySlug.set(key, r);
  });
  return Array.from(bySlug.values());
}

function requiredSlugs(refs) {
  const slugs = new Set();
  refs.forEach(function (r) {
    if (r.slug && typeof r.slug === "string") slugs.add(r.slug);
  });
  return slugs;
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
  const indexSlugs = new Set(registry.readScenarioSpellSlugs(path.join(scenarioDir, "spells")));
  const reg = registry.buildRegistry();

  console.log("scenario: " + slug);
  console.log("references: " + unique.length);
  unique.forEach(function (r) {
    const inIndex = r.slug && indexSlugs.has(r.slug) ? "OK" : "MISSING";
    const slugLabel = r.slug || "(unresolved)";
    console.log(
      "  [" + inIndex + "] " + r.spellName + " → " + slugLabel + " — " + r.sourceFile + " (" + r.sourceSection + ")"
    );
  });
  result.warnings.forEach(function (w) { console.log(w); });
  const missing = unique.filter(function (r) {
    return !r.slug || !indexSlugs.has(r.slug);
  });
  if (missing.length) {
    console.log("\n" + missing.length + " missing from spells-index.json");
    process.exit(1);
  }
}

module.exports = {
  scanScenario: scanScenario,
  uniqueRefsBySlug: uniqueRefsBySlug,
  requiredSlugs: requiredSlugs,
  listScenarios: listScenarios,
};
