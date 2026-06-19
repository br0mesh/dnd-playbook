#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const previewRoot = process.argv[2] || "preview";
const outFile = process.argv[3] || "previews-index.json";
const previews = [];

if (fs.existsSync(previewRoot)) {
  for (const dir of fs.readdirSync(previewRoot)) {
    const fullDir = path.join(previewRoot, dir);
    if (!fs.statSync(fullDir).isDirectory()) continue;

    const metaPath = path.join(fullDir, ".preview-meta.json");
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      previews.push({
        branch: meta.branch,
        slug: meta.sanitized || dir,
        updatedAt: meta.updatedAt || null,
      });
    } else {
      previews.push({
        branch: dir.startsWith("scenario-")
          ? "scenario/" + dir.slice("scenario-".length).replace(/-/g, "/")
          : dir,
        slug: dir,
        updatedAt: null,
      });
    }
  }
}

previews.sort(function (a, b) {
  return a.slug.localeCompare(b.slug);
});

fs.writeFileSync(outFile, JSON.stringify({ previews: previews }, null, 2) + "\n");
