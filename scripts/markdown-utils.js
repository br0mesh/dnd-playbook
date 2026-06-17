"use strict";

function normalizeNewlines(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseBoldFields(block) {
  const out = {};
  if (!block) return out;
  normalizeNewlines(block).split("\n").forEach(function (line) {
    const m = line.trim().match(/^\*\*(.+?):\*\*\s*(.+)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  });
  return out;
}

function sectionByHeading(text, heading) {
  const body = normalizeNewlines(text);
  const pattern = new RegExp(
    "###\\s+" + heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*(?:\\r?\\n){2,}([\\s\\S]*?)(?=(?:\\r?\\n)### |(?:\\r?\\n)---|(?:\\r?\\n)## |$)",
    "i"
  );
  const m = body.match(pattern);
  return m ? m[1].trim() : "";
}

function sectionAnyHeading(text) {
  for (let i = 1; i < arguments.length; i += 1) {
    const block = sectionByHeading(text, arguments[i]);
    if (block) return block;
  }
  return "";
}

function tableRows(block) {
  const rows = [];
  if (!block) return rows;
  normalizeNewlines(block).split("\n").forEach(function (line) {
    if (!line.startsWith("|")) return;
    if (/^\|[\s\-:|]+\|$/.test(line.trim())) return;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map(function (c) { return c.trim(); });
    if (cells.length) rows.push(cells);
  });
  return rows;
}

function splitSpellList(value) {
  if (!value || !value.trim()) return [];
  return value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
}

function stripCellBold(cell) {
  return String(cell || "").replace(/\*\*/g, "").trim();
}

function parseBoldSegments(line) {
  const out = {};
  line.split("·").forEach(function (seg) {
    const m = seg.trim().match(/^\*\*(.+?):\*\*\s*(.+)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  });
  return out;
}

const SPELL_FIELD_KEYS = {
  "Spell save DC": "dc",
  "СЛ заклинань": "dc",
  "Spell attack": "attack",
  "Атака заклинанням": "attack",
  "Cantrips": "cantrips",
  "Заговори": "cantrips",
  "Prepared spells": "prepared",
  "Підготовлені заклинання": "prepared",
};

const SECTION_LABELS = {
  cantrips: "Cantrips",
  prepared: "Prepared spells",
  attacks: "Attacks",
  traits: "Traits",
  actions: "Actions",
  bonusActions: "Bonus Actions",
  reactions: "Reactions",
  spellcasting: "Spellcasting",
  summary: "Summary",
  readAloud: "Read-aloud",
  checks: "Checks",
  contingencies: "Contingencies",
  dmNotes: "DM Notes",
  properties: "Properties",
  description: "Description",
};

function parseSpellcasting(block) {
  if (!block || !block.trim()) return null;
  const fields = { dc: "", attack: "", cantrips: "", prepared: "" };
  let tableBlock = "";
  block.split("\n").forEach(function (line) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      tableBlock += line + "\n";
      return;
    }
    if (trimmed.includes("·")) {
      const segments = parseBoldSegments(line);
      Object.keys(segments).forEach(function (label) {
        const key = SPELL_FIELD_KEYS[label];
        if (key) fields[key] = segments[label];
      });
      return;
    }
    const solo = trimmed.match(/^\*\*(.+?):\*\*\s*(.+)$/);
    if (solo) {
      const key = SPELL_FIELD_KEYS[solo[1].trim()];
      if (key) fields[key] = solo[2].trim();
    }
  });
  const slots = tableRows(tableBlock);
  if (!fields.dc && !fields.attack && !slots.length && !fields.cantrips && !fields.prepared) return null;
  return fields;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSpellPhrasesInText(text, spellNames) {
  const hits = [];
  if (!text || !spellNames.length) return hits;
  const sorted = spellNames.slice().sort(function (a, b) { return b.length - a.length; });
  const lower = text.toLowerCase();
  const used = [];

  sorted.forEach(function (name) {
    const norm = name.toLowerCase().trim();
    if (!norm) return;
    const re = new RegExp("(?:^|[^a-zа-яіїєґ0-9])" + escapeRegex(norm) + "(?:[^a-zа-яіїєґ0-9]|$)", "gi");
    let m;
    while ((m = re.exec(lower)) !== null) {
      const start = m.index + (m[0].charAt(0).match(/[a-zа-яіїєґ0-9]/i) ? 0 : 1);
      const lineHint = text.slice(0, start).split("\n").length;
      const overlap = used.some(function (u) {
        return (start >= u.start && start < u.end) || (start + norm.length > u.start && start + norm.length <= u.end);
      });
      if (!overlap) {
        used.push({ start: start, end: start + norm.length });
        hits.push({ spellName: name, lineHint: lineHint });
      }
    }
  });
  return hits;
}

module.exports = {
  normalizeNewlines: normalizeNewlines,
  parseBoldFields: parseBoldFields,
  sectionByHeading: sectionByHeading,
  sectionAnyHeading: sectionAnyHeading,
  tableRows: tableRows,
  splitSpellList: splitSpellList,
  stripCellBold: stripCellBold,
  parseSpellcasting: parseSpellcasting,
  findSpellPhrasesInText: findSpellPhrasesInText,
  SPELL_FIELD_KEYS: SPELL_FIELD_KEYS,
  SECTION_LABELS: SECTION_LABELS,
};
