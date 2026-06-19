"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const SCAN_FOLDERS = [
  { folder: "characters", index: "characters-index.json" },
  { folder: "monsters", index: "monsters-index.json" },
  { folder: "dm-script", index: "dm-script-index.json" },
  { folder: "npc", index: "npc-index.json" },
];

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

function readNamesIndex(scenarioDir) {
  const indexPath = path.join(scenarioDir, "names", "names-index.json");
  if (!fs.existsSync(indexPath)) return null;
  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("names-index.json must be an array: " + indexPath);
  return raw;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchTerms(entry) {
  const terms = [{ text: entry.en, slug: entry.slug, ua: entry.ua, declension: entry.declension_ua }];
  (entry.aliases_en || []).forEach(function (alias) {
    terms.push({ text: alias, slug: entry.slug, ua: entry.ua, declension: entry.declension_ua, alias: true });
  });
  terms.sort(function (a, b) {
    return b.text.length - a.text.length;
  });
  return terms;
}

function findEnMatches(line, term) {
  const pattern = "\\b" + escapeRegex(term.text) + "\\b";
  const re = new RegExp(pattern, "g");
  const matches = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    matches.push({ index: m.index, length: m[0].length });
  }
  return matches;
}

function formatHint(entry) {
  if (entry.declension_ua) {
    return entry.ua + " (see declension_ua: nominative " + entry.declension_ua.nominative + ")";
  }
  return entry.ua;
}

function scanUaFile(filePath, relPath, registry) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const hits = [];

  registry.forEach(function (entry) {
    const terms = buildSearchTerms(entry);
    lines.forEach(function (line, lineNum) {
      terms.forEach(function (term) {
        const matches = findEnMatches(line, term);
        matches.forEach(function () {
          hits.push({
            en: term.text,
            slug: term.slug,
            ua: term.ua,
            declension: term.declension,
            file: relPath,
            line: lineNum + 1,
          });
        });
      });
    });
  });

  return hits;
}

function scanScenario(scenarioDir) {
  const registry = readNamesIndex(scenarioDir);
  if (!registry) return { hits: [], registry: null };

  const hits = [];
  SCAN_FOLDERS.forEach(function (cfg) {
    const folderDir = path.join(scenarioDir, cfg.folder);
    if (!fs.existsSync(folderDir)) return;
    const slugs = readIndexSlugs(folderDir, cfg.index);
    slugs.forEach(function (slug) {
      const uaPath = path.join(folderDir, slug + ".ua.md");
      if (!fs.existsSync(uaPath)) return;
      const relPath = cfg.folder + "/" + slug + ".ua.md";
      const fileHits = scanUaFile(uaPath, relPath, registry);
      hits.push.apply(hits, fileHits);
    });
  });

  return { hits: hits, registry: registry };
}

function listScenariosWithNames() {
  const scenariosDir = path.join(ROOT, "scenarios");
  if (!fs.existsSync(scenariosDir)) return [];
  return fs.readdirSync(scenariosDir).filter(function (name) {
    const scenarioDir = path.join(scenariosDir, name);
    if (!fs.statSync(scenarioDir).isDirectory()) return false;
    return fs.existsSync(path.join(scenarioDir, "names", "names-index.json"));
  });
}

function validateNameClosure(scenarioDir) {
  const scenarioSlug = path.basename(scenarioDir);
  const result = scanScenario(scenarioDir);
  const errors = [];

  result.hits.forEach(function (hit) {
    const hint = hit.declension
      ? hit.ua + " (see declension_ua: nominative " + hit.declension.nominative + ")"
      : hit.ua;
    errors.push(
      'EN NAME IN UA: "' +
        hit.en +
        '" in ' +
        hit.file +
        ":" +
        hit.line +
        " — use " +
        hint
    );
  });

  return { scenario: scenarioSlug, errors: errors };
}

function validateAllNameClosure() {
  const scenarios = listScenariosWithNames();
  if (!scenarios.length) {
    console.log("Name closure: OK (no scenarios with names registry).");
    return 0;
  }

  const allErrors = [];
  scenarios.forEach(function (name) {
    const scenarioDir = path.join(ROOT, "scenarios", name);
    const result = validateNameClosure(scenarioDir);
    if (result.errors.length) {
      console.error("scenario: " + result.scenario);
      result.errors.forEach(function (e) {
        console.error(e);
      });
      allErrors.push.apply(allErrors, result.errors);
    }
  });

  if (allErrors.length) {
    console.error("Name closure: " + allErrors.length + " error(s).");
    return 1;
  }
  console.log("Name closure: OK (" + scenarios.length + " scenario(s)).");
  return 0;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--validate")) {
    process.exit(validateAllNameClosure());
  }
  const slug = args[0] || "when-the-lanterns-fall-silent";
  const scenarioDir = path.join(ROOT, "scenarios", slug);
  if (!fs.existsSync(scenarioDir)) {
    console.error("Scenario not found: " + slug);
    process.exit(1);
  }
  const result = scanScenario(scenarioDir);
  if (!result.registry) {
    console.error("No names/names-index.json in scenario: " + slug);
    process.exit(1);
  }
  console.log("scenario: " + slug);
  console.log("EN name hits in .ua.md: " + result.hits.length);
  result.hits.forEach(function (hit) {
    console.log(
      '  "' + hit.en + '" in ' + hit.file + ":" + hit.line + " — use " + formatHint(hit)
    );
  });
  if (result.hits.length) process.exit(1);
}

module.exports = {
  scanScenario: scanScenario,
  validateNameClosure: validateNameClosure,
  validateAllNameClosure: validateAllNameClosure,
  listScenariosWithNames: listScenariosWithNames,
};
