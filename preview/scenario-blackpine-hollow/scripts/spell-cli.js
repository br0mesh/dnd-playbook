#!/usr/bin/env node
"use strict";

const spellSync = require("./spell-sync");
const cmd = process.argv[2];

if (cmd === "sync") {
  process.exit(spellSync.syncAllScenarios());
}
if (cmd === "validate") {
  process.exit(spellSync.validateAllSpellClosure());
}

console.error("Usage: node spell-cli.js sync|validate");
process.exit(1);
