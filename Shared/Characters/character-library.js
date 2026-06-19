(function () {
  "use strict";
  const shell = window.DnDCore.shell;
  const md = window.DnDCore.markdown;
  const mech = window.DnDCore.mechanical;
  const ui = window.DnDCore.entityUi;
  const locale = window.DnDCore.locale;
  const esc = shell.esc;
  const loader = window.DnDCore.loader.createLoader();
  const POLL_MS = 3000;
  const spellLinks = window.DnDCore.spellLinks;
  const itemLinks = window.DnDCore.itemLinks;
  const state = { lang: "en", page: 1, slug: null };
  let raws = [];
  let loadConfig = null;
  let dataFingerprint = "";

  const DEFAULT_HEADINGS = {
    basicInfo: ["Basic Info", "Основна інформація"],
    combat: ["Combat", "Бойові характеристики"],
    resources: ["Class Resources", "Ресурси класу"],
    mainStats: ["Main Stats", "Основні характеристики"],
    spellcasting: ["Spellcasting", "Заклинання"],
    attacks: ["Attacks", "Атаки"],
    skills: ["Good Skills", "Сильні навички", "Навички"],
    abilities: ["Special Abilities", "Особливі здібності"],
    equipment: ["Equipment & Inventory", "Спорядження та інвентар", "Спорядження"],
  };

  const DEFAULT_UI = {
    ac: ["AC", "КБ"],
    hp: ["HP", "ХП"],
    level: ["lvl", "рів."],
    spellDc: ["Spell save DC", "СЛ заклинань"],
    spellAttack: ["Spell attack", "Атака заклинанням"],
    cantrips: ["Cantrips", "Заговори"],
    preparedSpells: ["Prepared spells", "Підготовлені заклинання"],
    magicItems: ["Magic items", "Чарівні предмети"],
  };

  function characterSchema() {
    return window.DnDCore.contentSchema && window.DnDCore.contentSchema.CHARACTER;
  }

  function headingAliases(key) {
    const schema = characterSchema();
    return (schema && schema[key]) || DEFAULT_HEADINGS[key] || [];
  }

  function uiAliases(key) {
    const schema = characterSchema();
    return (schema && schema.ui && schema.ui[key]) || DEFAULT_UI[key] || [];
  }

  function labelFor(aliases) {
    if (!aliases.length) return "";
    return state.lang === "ua" ? (aliases[1] || aliases[0]) : aliases[0];
  }

  function sectionLabel(key) {
    return labelFor(headingAliases(key));
  }

  function uiLabel(key) {
    return labelFor(uiAliases(key));
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

  function attackCellTransform(c, j, row) {
    if (j !== 0) return withTiles(c);
    const cell = stripCellBold(String(c || "").trim());
    if (!cell) return "";
    if (spellLinks.resolveSpellSlug(cell, state.lang)) return spellLinks.renderSpellToken(cell, state.lang);
    return esc(cell);
  }

  function parseEquipmentBlock(block) {
    if (!block) return { prose: "", magicItems: "" };
    let prose = block;
    let magicItems = "";
    ["Magic items", "Чарівні предмети"].forEach(function (key) {
      const re = new RegExp("\\*\\*" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":\\*\\*\\s*(.+)", "i");
      const m = block.match(re);
      if (m) {
        magicItems = m[1].trim();
        prose = block.replace(re, "").trim();
      }
    });
    return { prose: prose, magicItems: magicItems };
  }

  function section(text, key) {
    const args = [md.normalizeNewlines(text)].concat(headingAliases(key));
    return md.sectionAnyHeading.apply(md, args);
  }

  function parseBoldSegments(line) {
    const out = {};
    line.split("·").forEach(function (seg) {
      const m = seg.trim().match(/^\*\*(.+?):\*\*\s*(.+)$/);
      if (m) out[m[1].trim()] = m[2].trim();
    });
    return out;
  }

  function stripCellBold(cell) {
    const m = String(cell).trim().match(/^\*\*(.+)\*\*$/);
    return m ? m[1] : cell;
  }

  function isSlotUsedRow(row) {
    const label = stripCellBold(row[0] || "").toLowerCase();
    return label === "used" || label === "використано";
  }

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
    const slots = md.tableRows(tableBlock);
    if (!fields.dc && !fields.attack && !slots.length && !fields.cantrips && !fields.prepared) return null;
    return { dc: fields.dc, attack: fields.attack, slots: slots, cantrips: fields.cantrips, prepared: fields.prepared };
  }

  function parseLang(text, lang) {
    if (text && typeof text === "object" && typeof text.name === "string") return text;
    const body = md.excludeDmNotes(text);
    const info = md.parseBoldFields(section(body, "basicInfo"));
    const combat = md.parseBoldFields(section(body, "combat"));
    const equipParsed = parseEquipmentBlock(section(body, "equipment"));
    return {
      name: info["Character Name"] || info["Ім'я персонажа"] || md.titleForLocale(body, lang),
      className: info.Class || info["Клас"] || "",
      level: info.Level || info["Рівень"] || "?",
      ac: combat["Armor Class AC"] || combat["Клас броні КБ"] || "",
      hp: combat["Hit Points HP"] || combat["ХП"] || combat["Пункти здоров'я ХП"] || combat["Пункти здоров'я ПЗ"] || "",
      speed: combat.Speed || combat["Швидкість"] || "",
      resources: section(body, "resources"),
      stats: md.tableRows(section(body, "mainStats")),
      spellcasting: parseSpellcasting(section(body, "spellcasting")),
      attacks: section(body, "attacks"),
      skills: section(body, "skills"),
      abilities: section(body, "abilities"),
      equipment: equipParsed.prose,
      magicItems: equipParsed.magicItems,
    };
  }

  function assembleEntry(slug, texts) {
    const en = parseLang(texts.en, "en");
    const ua = texts.ua.trim()
      ? parseLang(texts.ua, "ua")
      : locale.mergeWithFallback(en, {});
    return { slug: slug, en: en, ua: ua };
  }

  function renderTable(rows, cellTransform, allowHtml) {
    if (!rows.length) return "";
    let h = "<table><tbody>";
    rows.forEach(function (row, i) {
      h += "<tr>" + row.map(function (c, j) {
        let inner;
        if (cellTransform && i > 0) {
          inner = cellTransform(c, j, row);
          if (!allowHtml) inner = esc(inner);
        } else {
          inner = esc(c);
        }
        return (i === 0 ? "<th>" : "<td>") + inner + (i === 0 ? "</th>" : "</td>");
      }).join("") + "</tr>";
    });
    return h + "</tbody></table>";
  }

  function withTiles(text) {
    if (!text) return "";
    if (/\d+\s*\.?\s*\/\s*\d+\s*(?:tiles|клітин(?:ок|ки))/i.test(text)) return text;
    return mech.formatDistancesInText(text, state.lang === "ua");
  }

  function mechanicalEnrich(text) {
    if (mech.highlightMechanical) return mech.highlightMechanical(text);
    if (mech.highlightDice) return mech.highlightDice(text);
    return esc(text);
  }

  function restEnrich(text) {
    if (mech.highlightRestTags) return mech.highlightRestTags(text);
    return esc(text);
  }

  function linkProsePlain(text) {
    const linkOpts = { highlightDice: false };
    return spellLinks.renderSpellProse(
      itemLinks.renderItemProse(text, state.lang, linkOpts),
      state.lang,
      linkOpts
    );
  }

  function enrichProseSegment(text) {
    if (!text) return "";
    let out = "";
    const slugRe = /\b([a-z0-9]+(?:_[a-z0-9]+)*_(?:cantrip|\d+(?:st|nd|rd|th))_[a-z]+)\b/g;
    let last = 0;
    let m;
    while ((m = slugRe.exec(text)) !== null) {
      if (m.index > last) {
        out += mech.highlightDicePreservingHtml(linkProsePlain(text.slice(last, m.index)));
      }
      out += spellLinks.isSpellSlug(m[1])
        ? spellLinks.renderSpellToken(m[1], state.lang)
        : esc(m[1]);
      last = m.index + m[0].length;
    }
    out += mech.highlightDicePreservingHtml(linkProsePlain(text.slice(last)));
    return out;
  }

  function formatProseLine(raw) {
    let out = "";
    let last = 0;
    const re = /\*\*(.+?)\*\*/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) out += enrichProseSegment(raw.slice(last, m.index));
      out += "<strong>" + esc(m[1]) + "</strong>";
      last = m.index + m[0].length;
    }
    out += enrichProseSegment(raw.slice(last));
    return out;
  }

  function renderProseBlock(text) {
    if (!text) return "";
    return md.normalizeNewlines(text).split("\n").map(function (line) {
      const trimmed = line.trim();
      if (!trimmed) return "";
      const isList = trimmed.startsWith("- ");
      const body = isList ? trimmed.slice(2) : trimmed;
      return '<div class="prose-line">' + (isList ? "• " : "") + formatProseLine(body) + "</div>";
    }).filter(Boolean).join("");
  }

  function enrichCell(text) {
    return mechanicalEnrich(withTiles(text));
  }

  function renderSpellcasting(sc) {
    if (!sc) return "";
    let html = "<h3>" + esc(sectionLabel("spellcasting")) + "</h3>";
    if (sc.dc || sc.attack) {
      html += "<p class=\"spellcasting-summary\">";
      if (sc.dc) html += "<strong>" + esc(uiLabel("spellDc")) + ":</strong> " + esc(sc.dc);
      if (sc.dc && sc.attack) html += " · ";
      if (sc.attack) html += "<strong>" + esc(uiLabel("spellAttack")) + ":</strong> " + esc(sc.attack);
      html += "</p>";
    }
    if (sc.slots && sc.slots.length) {
      html += renderTable(sc.slots, function (c, j, row) {
        if (j === 0) return "<strong>" + esc(stripCellBold(c)) + "</strong>";
        if (isSlotUsedRow(row) && j > 0) return '<span class="resource-uses">' + esc(c) + "</span>";
        return enrichCell(c);
      }, true);
    }
    if (sc.cantrips) html += "<p><strong>" + esc(uiLabel("cantrips")) + ":</strong> " + spellLinks.renderSpellSlugList(sc.cantrips, state.lang) + "</p>";
    if (sc.prepared) html += "<p><strong>" + esc(uiLabel("preparedSpells")) + ":</strong> " + spellLinks.renderSpellSlugList(sc.prepared, state.lang) + "</p>";
    return html;
  }

  function renderEntry(entry) {
    const b = entry[state.lang] || entry.en;
    const classLine = b.className
      ? [b.className, uiLabel("level") + " " + b.level].filter(Boolean).join(" · ")
      : (b.cls || "");
    let html = '<article class="entity-card"><h2>' + esc(b.name) + "</h2>";
    if (classLine) html += "<p><em>" + esc(classLine) + "</em></p>";
    html += "<p><strong>" + esc(uiLabel("ac")) + "</strong> " + esc(b.ac) +
      " · <strong>" + esc(uiLabel("hp")) + "</strong> " + esc(b.hp) +
      " · " + esc(withTiles(b.speed)) + "</p>";
    if ((b.stats || []).length) html += "<h3>" + esc(sectionLabel("mainStats")) + "</h3>" + renderTable(b.stats);
    if (b.resources) {
      html += "<h3>" + esc(sectionLabel("resources")) + "</h3>" + renderTable(md.tableRows(b.resources), function (c, j) {
        if (j === 2) return restEnrich(c);
        if (j === 1) return '<span class="resource-uses">' + esc(c) + "</span>";
        return esc(c);
      }, true);
    }
    if (b.spellcasting) html += renderSpellcasting(b.spellcasting);
    if (b.attacks) html += "<h3>" + esc(sectionLabel("attacks")) + "</h3>" + renderTable(md.tableRows(b.attacks), attackCellTransform, true);
    if (b.skills) html += "<h3>" + esc(sectionLabel("skills")) + "</h3><div class=\"prose-block\">" + renderProseBlock(b.skills) + "</div>";
    if (b.abilities) html += "<h3>" + esc(sectionLabel("abilities")) + "</h3><div class=\"prose-block\">" + renderProseBlock(b.abilities) + "</div>";
    if (b.magicItems || b.equipment) {
      html += "<h3>" + esc(sectionLabel("equipment")) + "</h3>";
      if (b.magicItems) {
        html += "<p><strong>" + esc(uiLabel("magicItems")) + ":</strong> " +
          itemLinks.renderItemSlugList(b.magicItems, state.lang) + "</p>";
      }
      if (b.equipment) html += "<div class=\"prose-block\">" + renderProseBlock(b.equipment) + "</div>";
    }
    return html + "</article>";
  }

  function entries() { return raws.map(function (r) { return assembleEntry(r.slug, r); }); }

  function focusCharacterFromUrl() {
    const slug = shell.parseUrlParams().character;
    if (!slug) return;
    const idx = raws.findIndex(function (r) { return r.slug === slug; });
    if (idx < 0) {
      console.warn("[character-library] Character not found:", slug);
      return;
    }
    state.page = idx + 1;
    state.slug = slug;
  }

  function renderPage() {
    const list = entries();
    const uiEl = ui.defaultUi("character-library");
    if (!list.length) { ui.setError(uiEl, "No characters", ""); return; }
    const idx = Math.min(Math.max(state.page - 1, 0), list.length - 1);
    state.page = idx + 1;
    state.slug = list[idx].slug;
    try {
      uiEl.empty.hidden = true;
      uiEl.page.hidden = false;
      uiEl.page.innerHTML = renderEntry(list[idx]);
      uiEl.pageInfo.textContent = (idx + 1) + " of " + list.length;
      uiEl.prev.disabled = idx <= 0;
      uiEl.next.disabled = idx >= list.length - 1;
      document.querySelectorAll("#list-nav .bookmark-btn").forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-slug") === state.slug ? "true" : "false");
      });
    } catch (err) {
      console.error("[character-library] render failed:", err);
      ui.setError(uiEl, "Failed to render character", esc(err.message));
    }
  }

  function buildListNav() {
    const nav = document.getElementById("list-nav");
    nav.innerHTML = entries().map(function (e) {
      const name = (e[state.lang] || e.en).name;
      return '<button type="button" class="bookmark-btn" data-slug="' + esc(e.slug) + '">' + esc(name) + "</button>";
    }).join("");
    nav.querySelectorAll(".bookmark-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.slug = btn.getAttribute("data-slug");
        const list = entries();
        state.page = list.findIndex(function (e) { return e.slug === state.slug; }) + 1;
        renderPage();
      });
    });
  }

  async function bootstrap() {
    ui.initBookChrome("characters", function (l) { state.lang = l; buildListNav(); renderPage(); });
    state.lang = shell.parseUrlParams().lang;
    const uiEl = ui.defaultUi("character-library");
    ui.setLoading(uiEl);
    try {
      loadConfig = shell.resolveModuleConfig({
        rootEl: uiEl.root, scenarioFolder: "characters", indexFileName: "characters-index.json",
        demoIndex: "demo/characters-index.json",
      });
      await Promise.all([
        spellLinks.loadSpellNameMap(loadConfig.scenario),
        itemLinks.loadItemNameMap(loadConfig.scenario),
      ]);
      raws = await loader.loadData(loadConfig, false, function (slug, texts) {
        return { slug: slug, en: texts.en, ua: texts.ua };
      });
      dataFingerprint = loader.fingerprint(raws);
      ui.setReady(uiEl);
      focusCharacterFromUrl();
      buildListNav();
      renderPage();
      ui.bindPagination(state, uiEl, renderPage, function () { return raws.length; });
      if (loadConfig.poll) {
        setInterval(async function () {
          try {
            const refreshed = await loader.loadData(loadConfig, true, function (slug, texts) {
              return { slug: slug, en: texts.en, ua: texts.ua };
            });
            if (loader.fingerprint(refreshed) !== dataFingerprint) {
              dataFingerprint = loader.fingerprint(refreshed);
              raws = refreshed;
              buildListNav();
              renderPage();
            }
          } catch (_e) { /* keep last good data */ }
        }, POLL_MS);
      }
    } catch (err) { ui.setError(uiEl, "Failed to load characters", esc(err.message)); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();
