#!/usr/bin/env node
"use strict";

const scanNameRefs = require("./scan-name-refs");
const cmd = process.argv[2];

if (cmd === "validate") {
  process.exit(scanNameRefs.validateAllNameClosure());
}

console.error("Usage: node name-cli.js validate");
process.exit(1);
