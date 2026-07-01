"use strict";

const LEVEL_LABEL = {
  cantrip: "Cantrip",
  "1st": "1st",
  "2nd": "2nd",
  "3rd": "3rd",
  "4th": "4th",
  "5th": "5th",
  "6th": "6th",
  "7th": "7th",
  "8th": "8th",
  "9th": "9th",
};

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderStubEn(name, meta) {
  const level = LEVEL_LABEL[meta.level] || meta.level;
  const school = capitalize(meta.school);
  return (
    "# " +
    name +
    "\n\n### Header\n\n**Name:** " +
    name +
    "\n**Level:** " +
    level +
    "\n**School:** " +
    school +
    "\n\n### Casting\n\n**Time:** TODO\n**Range:** TODO\n**Components:** TODO\n**Duration:** TODO\n\n### Description\n\nTODO — add spell description.\n\n---\n"
  );
}

function renderStubUa(nameUa, meta) {
  return (
    "# " +
    nameUa +
    "\n\n### Header\n\n**Назва:** " +
    nameUa +
    "\n**Рівень:** " +
    meta.levelUa +
    "\n**Школа:** " +
    meta.schoolUa +
    "\n\n### Накладання\n\n**Час:** TODO\n**Дальність:** TODO\n**Компоненти:** TODO\n**Тривалість:** TODO\n\n### Опис\n\nTODO — додайте опис заклинання.\n\n---\n"
  );
}

function slugFromMeta(name, meta) {
  const snake = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return snake + "_" + meta.level + "_" + meta.school;
}

module.exports = {
  renderStubEn: renderStubEn,
  renderStubUa: renderStubUa,
  slugFromMeta: slugFromMeta,
};
