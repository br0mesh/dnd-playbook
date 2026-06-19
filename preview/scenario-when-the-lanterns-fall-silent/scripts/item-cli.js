#!/usr/bin/env node
"use strict";

const itemSync = require("./item-sync");
const cmd = process.argv[2];

if (cmd === "sync") {
  process.exit(itemSync.syncAllScenarios());
}
if (cmd === "validate") {
  process.exit(itemSync.validateAllItemClosure());
}

console.error("Usage: node item-cli.js sync|validate");
process.exit(1);
