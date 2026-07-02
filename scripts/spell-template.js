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

function metaField(meta, key, fallback) {
  return meta && meta[key] ? meta[key] : fallback;
}

function renderStubEn(name, meta) {
  const level = LEVEL_LABEL[meta.level] || meta.level;
  const school = capitalize(meta.school);
  const time = metaField(meta, "timeEn", "TODO");
  const range = metaField(meta, "rangeEn", "TODO");
  const components = metaField(meta, "componentsEn", "TODO");
  const duration = metaField(meta, "durationEn", "TODO");
  const description = metaField(meta, "descriptionEn", "TODO — add spell description.");
  const atHigher = metaField(meta, "atHigherEn", "");
  return (
    "# " +
    name +
    "\n\n### Header\n\n**Name:** " +
    name +
    "\n**Level:** " +
    level +
    "\n**School:** " +
    school +
    "\n\n### Casting\n\n**Time:** " +
    time +
    "\n**Range:** " +
    range +
    "\n**Components:** " +
    components +
    "\n**Duration:** " +
    duration +
    "\n\n### Description\n\n" +
    description +
    (atHigher ? "\n\n### At Higher Levels\n\n" + atHigher : "") +
    "\n\n---\n"
  );
}

function renderStubUa(nameUa, meta) {
  const time = metaField(meta, "timeUa", "TODO");
  const range = metaField(meta, "rangeUa", "TODO");
  const components = metaField(meta, "componentsUa", "TODO");
  const duration = metaField(meta, "durationUa", "TODO");
  const description = metaField(meta, "descriptionUa", "TODO — додайте опис заклинання.");
  const atHigher = metaField(meta, "atHigherUa", "");
  return (
    "# " +
    nameUa +
    "\n\n### Header\n\n**Назва:** " +
    nameUa +
    "\n**Рівень:** " +
    meta.levelUa +
    "\n**Школа:** " +
    meta.schoolUa +
    "\n\n### Накладання\n\n**Час:** " +
    time +
    "\n**Дальність:** " +
    range +
    "\n**Компоненти:** " +
    components +
    "\n**Тривалість:** " +
    duration +
    "\n\n### Опис\n\n" +
    description +
    (atHigher ? "\n\n### На вищих рівнях\n\n" + atHigher : "") +
    "\n\n---\n"
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
