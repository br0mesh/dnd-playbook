#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const UA_SPLIT = /##\s+Українська\s+Версія/i;
const EN_VERSION = /##\s+English\s+Version\s*/i;

const MODULE_MAP = {
  "characters-index.json": { indexGlobal: "CHARACTERS_LIBRARY_INDEX", mdGlobal: "__CHARACTERS_MD__" },
  "spells-index.json": { indexGlobal: "SPELL_LIBRARY_INDEX", mdGlobal: "__SPELL_MD__" },
  "monsters-index.json": { indexGlobal: "MONSTERS_LIBRARY_INDEX", mdGlobal: "__MONSTERS_MD__" },
  "npc-index.json": { indexGlobal: "NPC_LIBRARY_INDEX", mdGlobal: "__NPC_MD__" },
  "items-index.json": { indexGlobal: "ITEMS_LIBRARY_INDEX", mdGlobal: "__ITEMS_MD__" },
  "maps-index.json": { indexGlobal: "MAPS_LIBRARY_INDEX", mdGlobal: "__MAPS_MD__" },
  "dm-script-index.json": { indexGlobal: "DMSCRIPT_LIBRARY_INDEX", mdGlobal: "__DMSCRIPT_MD__" },
};

function walkDir(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkDir(full, out);
    else out.push(full);
  }
}

function findIndexFiles() {
  const files = [];
  walkDir(path.join(ROOT, "Shared"), files);
  walkDir(path.join(ROOT, "scenarios"), files);
  return files.filter(function (f) {
    const base = path.basename(f);
    return base.endsWith("-index.json") && MODULE_MAP[base];
  });
}

function slugFromIndexEntry(entry) {
  return String(entry)
    .replace(/^.*\//, "")
    .replace(/\.(en|ua)\.md$/i, "")
    .replace(/\.md$/i, "");
}

function readIndex(indexPath) {
  const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("Index must be array: " + indexPath);
  return raw.map(slugFromIndexEntry);
}

function writeIndex(indexPath, slugs) {
  fs.writeFileSync(indexPath, JSON.stringify(slugs, null, 2) + "\n", "utf8");
}

function escapeJsString(s) {
  return JSON.stringify(s);
}

function splitLegacyFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  if (!UA_SPLIT.test(content) && !EN_VERSION.test(content)) {
    return null;
  }
  const titleMatch = content.match(/^#\s+(.+)$/m);
  let enTitle = path.basename(filePath, ".md");
  let uaTitle = enTitle;
  if (titleMatch) {
    const parts = titleMatch[1].split(" / ");
    enTitle = parts[0].trim();
    uaTitle = parts.length > 1 ? parts.slice(1).join(" / ").trim() : enTitle;
  }

  const uaParts = content.split(UA_SPLIT);
  const beforeUa = uaParts[0];
  const uaBody = uaParts.length > 1 ? uaParts[1].trim() : "";

  const afterTitle = beforeUa.replace(/^#\s+.+\n?/, "").trim();
  const enMatch = afterTitle.match(EN_VERSION);
  let preamble = "";
  let enBody = "";
  if (enMatch) {
    const idx = afterTitle.search(EN_VERSION);
    preamble = afterTitle.slice(0, idx).trim();
    enBody = afterTitle.slice(idx + enMatch[0].length).trim();
  } else {
    enBody = afterTitle;
  }

  const preambleBlock = preamble ? preamble + "\n\n---\n\n" : "";
  const enFile = "# " + enTitle + "\n\n" + preambleBlock + enBody + "\n";
  const uaFile = uaBody
    ? "# " + uaTitle + "\n\n" + preambleBlock + uaBody + "\n"
    : null;

  return { enFile: enFile, uaFile: uaFile };
}

function splitLegacy() {
  const dirs = [];
  walkDir(path.join(ROOT, "Shared"), dirs);
  walkDir(path.join(ROOT, "scenarios"), dirs);
  const legacy = dirs.filter(function (f) {
    if (!f.endsWith(".md")) return false;
    if (f.endsWith(".en.md") || f.endsWith(".ua.md")) return false;
    if (path.basename(f) === "README.md") return false;
    const content = fs.readFileSync(f, "utf8");
    return UA_SPLIT.test(content) || EN_VERSION.test(content);
  });

  let split = 0;
  legacy.forEach(function (filePath) {
    const dir = path.dirname(filePath);
    const slug = path.basename(filePath, ".md");
    const enPath = path.join(dir, slug + ".en.md");
    const uaPath = path.join(dir, slug + ".ua.md");
    if (fs.existsSync(enPath)) {
      console.log("skip (en exists): " + path.relative(ROOT, filePath));
      return;
    }
    const result = splitLegacyFile(filePath);
    if (!result) return;
    fs.writeFileSync(enPath, result.enFile, "utf8");
    if (result.uaFile) fs.writeFileSync(uaPath, result.uaFile, "utf8");
    fs.unlinkSync(filePath);
    console.log("split: " + path.relative(ROOT, filePath));
    split += 1;
  });
  console.log("Split " + split + " legacy file(s).");
}

function validate() {
  let errors = 0;
  let warnings = 0;
  findIndexFiles().forEach(function (indexPath) {
    const dir = path.dirname(indexPath);
    const slugs = readIndex(indexPath);
    normalized.forEach(function (slug) {
      const enPath = path.join(dir, slug + ".en.md");
      const uaPath = path.join(dir, slug + ".ua.md");
      if (!fs.existsSync(enPath)) {
        console.error("MISSING EN: " + path.relative(ROOT, enPath));
        errors += 1;
      }
      if (!fs.existsSync(uaPath)) {
        console.warn("WARN missing UA: " + path.relative(ROOT, uaPath));
        warnings += 1;
      }
    });
  });
  console.log("Validate: " + errors + " error(s), " + warnings + " warning(s).");
  if (errors) process.exit(1);
}

function buildSources() {
  findIndexFiles().forEach(function (indexPath) {
    const base = path.basename(indexPath);
    const mod = MODULE_MAP[base];
    const dir = path.dirname(indexPath);
    const slugs = readIndex(indexPath);
    writeIndex(indexPath, slugs);

    const sourcesName = base.replace("-index.json", "-sources.js");
    const indexJsName = base.replace(".json", ".js");
    const sourcesPath = path.join(dir, sourcesName);
    const indexJsPath = path.join(dir, indexJsName);

    let sources = "window." + mod.mdGlobal + " = window." + mod.mdGlobal + " || {};\n";
    slugs.forEach(function (slug) {
      const enPath = path.join(dir, slug + ".en.md");
      const uaPath = path.join(dir, slug + ".ua.md");
      if (!fs.existsSync(enPath)) {
        console.error("Skip sources for missing EN: " + enPath);
        return;
      }
      const en = fs.readFileSync(enPath, "utf8");
      const ua = fs.existsSync(uaPath) ? fs.readFileSync(uaPath, "utf8") : "";
      sources += "window." + mod.mdGlobal + '["' + slug + '"] = { en: ' + escapeJsString(en);
      if (ua) sources += ", ua: " + escapeJsString(ua);
      sources += " };\n";
    });

    const indexJs = "window." + mod.indexGlobal + " = " + JSON.stringify(slugs) + ";\n";

    fs.writeFileSync(sourcesPath, sources, "utf8");
    fs.writeFileSync(indexJsPath, indexJs, "utf8");
    console.log("built: " + path.relative(ROOT, sourcesPath) + ", " + path.relative(ROOT, indexJsPath));
  });
}

const args = process.argv.slice(2);
if (args.includes("--split-legacy")) {
  splitLegacy();
}
if (!args.includes("--validate-only")) {
  buildSources();
}
if (args.includes("--validate") || args.includes("--validate-only")) {
  validate();
}
