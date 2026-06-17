(function (global) {
  "use strict";

  const shell = global.DnDCore.shell;
  const esc = shell.esc;
  const mech = global.DnDCore.mechanical;

  const SPELL_SLUG_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*_(cantrip|\d+(?:st|nd|rd|th))_[a-z]+$/;

  const SPELL_LINK_DENY_RE = /\b(spell\s+attack(?:\s+rolls?)?|spellcaster|spell\s+slots?|spell\s+save(?:\s+DC)?|spellbook)\b/gi;

  let spellNameMap = {};
  let nameToSlugEn = {};
  let nameToSlugUa = {};
  let scenarioRef = "";

  function isSpellSlug(token) {
    return SPELL_SLUG_RE.test(String(token || "").trim());
  }

  function normalizeSpellName(name) {
    return String(name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9а-яіїєґ\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseSpellNameFromMd(text, lang) {
    const headerMatch = text.match(/###\s+Header\s*\n([\s\S]*?)(?=\n### |\n---|$)/i);
    const headerBlock = headerMatch ? headerMatch[1] : text.split("---")[0];
    const nameKey = lang === "ua" ? "Назва" : "Name";
    const fieldRe = new RegExp("\\*\\*" + nameKey + ":\\*\\*\\s*(.+)", "i");
    const fieldMatch = headerBlock.match(fieldRe);
    if (fieldMatch) return fieldMatch[1].trim();
    const h1 = text.match(/^#\s+(.+)$/m);
    return h1 ? h1[1].trim() : null;
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
        const overlap = used.some(function (u) {
          return (start >= u.start && start < u.end) || (start + norm.length > u.start && start + norm.length <= u.end);
        });
        if (!overlap) {
          used.push({ start: start, end: start + norm.length });
          hits.push({ spellName: name, start: start, end: start + norm.length });
        }
      }
    });
    return hits.sort(function (a, b) { return a.start - b.start; });
  }

  function isDeniedSpellContext(text, start, end) {
    const pad = 24;
    const slice = text.slice(Math.max(0, start - pad), Math.min(text.length, end + pad));
    SPELL_LINK_DENY_RE.lastIndex = 0;
    let m;
    while ((m = SPELL_LINK_DENY_RE.exec(slice)) !== null) {
      const denyStart = Math.max(0, start - pad) + m.index;
      const denyEnd = denyStart + m[0].length;
      if (start < denyEnd && end > denyStart) return true;
    }
    return false;
  }

  async function loadSpellNameMap(scenario) {
    spellNameMap = {};
    nameToSlugEn = {};
    nameToSlugUa = {};
    scenarioRef = scenario || "";
    const indexUrl = scenario
      ? "../../scenarios/" + scenario + "/spells/spells-index.json"
      : "../Spells/demo/spells-index.json";
    try {
      const indexText = await shell.fetchText(new URL(indexUrl, shell.pageBaseUrl()).href, false);
      const slugs = JSON.parse(indexText);
      if (!Array.isArray(slugs)) return;
      const base = shell.indexBaseUrl(indexUrl);
      await Promise.all(slugs.map(async function (entry) {
        const slug = shell.slugFromIndexPath(entry);
        try {
          const enText = await shell.fetchText(new URL(slug + ".en.md", base).href, false);
          let uaText = null;
          try {
            uaText = await shell.fetchTextOptional(new URL(slug + ".ua.md", base).href, false);
          } catch (_uaErr) { /* optional */ }
          const enName = parseSpellNameFromMd(enText, "en") || slug;
          const uaName = uaText ? (parseSpellNameFromMd(uaText, "ua") || enName) : "";
          spellNameMap[slug] = { en: enName, ua: uaName };
          const normEn = normalizeSpellName(enName);
          if (normEn) nameToSlugEn[normEn] = slug;
          if (uaName) {
            const normUa = normalizeSpellName(uaName);
            if (normUa) nameToSlugUa[normUa] = slug;
          }
        } catch (err) {
          console.warn("[spell-links] Failed to load spell:", slug, err);
        }
      }));
    } catch (err) {
      console.warn("[spell-links] Failed to load spell name map:", err);
    }
  }

  function allSpellDisplayNames() {
    const names = [];
    Object.keys(spellNameMap).forEach(function (slug) {
      const n = spellNameMap[slug];
      if (n.en) names.push(n.en);
      if (n.ua && n.ua !== n.en) names.push(n.ua);
    });
    return names;
  }

  function spellLibraryHref(slug, lang) {
    const q = new URLSearchParams();
    if (scenarioRef) q.set("scenario", scenarioRef);
    q.set("spell", slug);
    if (lang === "ua") q.set("lang", "ua");
    return "../Spells/library.html?" + q.toString();
  }

  function resolveSpellSlug(token, lang) {
    const t = String(token || "").trim();
    if (isSpellSlug(t)) return t;
    const norm = normalizeSpellName(t);
    if (lang === "ua" && nameToSlugUa[norm]) return nameToSlugUa[norm];
    if (nameToSlugEn[norm]) return nameToSlugEn[norm];
    if (nameToSlugUa[norm]) return nameToSlugUa[norm];
    return null;
  }

  function renderSpellToken(token, lang) {
    const t = String(token || "").trim();
    const slug = resolveSpellSlug(t, lang);
    if (!slug) return esc(t);
    const names = spellNameMap[slug];
    const label = names
      ? (lang === "ua" && names.ua ? names.ua : names.en)
      : t;
    return '<a class="spell-link" href="' + esc(spellLibraryHref(slug, lang)) + '">' + esc(label) + "</a>";
  }

  function renderSpellSlugList(text, lang) {
    if (!text) return "";
    return text.split(",").map(function (part) {
      return renderSpellToken(part.trim(), lang);
    }).filter(Boolean).join(", ");
  }

  function renderSpellProse(text, lang) {
    if (!text) return "";
    const names = allSpellDisplayNames();
    const hits = findSpellPhrasesInText(text, names).filter(function (hit) {
      return !isDeniedSpellContext(text, hit.start, hit.end);
    });
    if (!hits.length) return mech.highlightDice(text);

    let out = "";
    let last = 0;
    hits.forEach(function (hit) {
      if (hit.start > last) {
        out += mech.highlightDice(text.slice(last, hit.start));
      }
      const fragment = text.slice(hit.start, hit.end);
      const slug = resolveSpellSlug(hit.spellName, lang);
      if (slug) {
        const namesMap = spellNameMap[slug];
        const label = namesMap
          ? (lang === "ua" && namesMap.ua ? namesMap.ua : namesMap.en)
          : fragment;
        out += '<a class="spell-link" href="' + esc(spellLibraryHref(slug, lang)) + '">' + esc(label) + "</a>";
      } else {
        out += mech.highlightDice(fragment);
      }
      last = hit.end;
    });
    if (last < text.length) out += mech.highlightDice(text.slice(last));
    return out;
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.spellLinks = {
    isSpellSlug: isSpellSlug,
    normalizeSpellName: normalizeSpellName,
    parseSpellNameFromMd: parseSpellNameFromMd,
    loadSpellNameMap: loadSpellNameMap,
    spellLibraryHref: spellLibraryHref,
    resolveSpellSlug: resolveSpellSlug,
    renderSpellToken: renderSpellToken,
    renderSpellSlugList: renderSpellSlugList,
    renderSpellProse: renderSpellProse,
    findSpellPhrasesInText: findSpellPhrasesInText,
  };
})(typeof window !== "undefined" ? window : this);
