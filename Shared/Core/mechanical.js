(function (global) {
  "use strict";

  const INT_RE = /-?\d+/;
  const FT_IN_TEXT_RE = /(\d+)\s*(?:-\s*)?(?:ft\.?|feet|foot|фт\.?|фут(?:ів)?)(?!\s*\.?\s*\/\s*\d+\s*(?:tiles|клітин(?:ок|ки)))/gi;
  const DICE_RE = /\d+d\d+(?:\s*[+\-−]\s*\d+)?/gi;

  function formatDistance(raw, ua) {
    if (!raw) return "";
    const m = INT_RE.exec(raw.trim());
    if (!m) return raw;
    const ft = parseInt(m[0], 10);
    const tiles = Math.floor(ft / 5);
    if (ua) return ft + " футів/" + tiles + " клітинок";
    return ft + " ft/" + tiles + " tiles";
  }

  function formatDistancesInText(text, ua) {
    if (text == null || text === "") return "";
    return String(text).replace(FT_IN_TEXT_RE, function (_match, ftStr) {
      const ft = parseInt(ftStr, 10);
      const tiles = Math.floor(ft / 5);
      if (ua) return ft + " футів/" + tiles + " клітинок";
      return ft + " ft/" + tiles + " tiles";
    });
  }

  const REST_PATTERNS = [
    { re: /\(short or long rest\)/gi, cls: "rest-sr-lr" },
    { re: /\(короткий або довгий відпочинок\)/gi, cls: "rest-sr-lr" },
    { re: /короткий або довгий відпочинок/gi, cls: "rest-sr-lr" },
    { re: /Short or long rest/gi, cls: "rest-sr-lr" },
    { re: /\(short rest\)/gi, cls: "rest-sr" },
    { re: /\(короткий відпочинок\)/gi, cls: "rest-sr" },
    { re: /короткий відпочинок/gi, cls: "rest-sr" },
    { re: /Short rest/gi, cls: "rest-sr" },
    { re: /\(long rest\)/gi, cls: "rest-lr" },
    { re: /\(довгий відпочинок\)/gi, cls: "rest-lr" },
    { re: /довгий відпочинок/gi, cls: "rest-lr" },
    { re: /Long rest/gi, cls: "rest-lr" },
    { re: /·\s*\d+\s*\/\s*day\b/gi, cls: "rest-day" },
    { re: /·\s*\d+\s*\/\s*день\b/gi, cls: "rest-day" },
    { re: /·\s*1\s*\/\s*SR\b/gi, cls: "rest-sr" },
    { re: /·\s*1\s*\/\s*КВ\b/gi, cls: "rest-sr" },
    { re: /·\s*1\s*\/\s*LR\b/gi, cls: "rest-lr" },
    { re: /·\s*1\s*\/\s*ДВ\b/gi, cls: "rest-lr" },
  ];

  function highlightPatterns(text, patterns, wrap) {
    const esc = global.DnDCore && global.DnDCore.shell ? global.DnDCore.shell.esc : function (s) { return String(s); };
    if (text == null || text === "") return "";
    text = String(text);
    const matches = [];
    patterns.forEach(function (p) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(text)) !== null) {
        matches.push({ index: m.index, length: m[0].length, html: wrap(m[0], p.cls) });
      }
    });
    matches.sort(function (a, b) { return a.index - b.index; });
    const kept = [];
    let end = 0;
    matches.forEach(function (m) {
      if (m.index >= end) {
        kept.push(m);
        end = m.index + m.length;
      }
    });
    let out = "";
    let last = 0;
    kept.forEach(function (m) {
      if (m.index > last) out += esc(text.slice(last, m.index));
      out += m.html;
      last = m.index + m.length;
    });
    out += esc(text.slice(last));
    return out;
  }

  function highlightDice(text) {
    return highlightPatterns(text, [{ re: DICE_RE, cls: "damage" }], function (match, cls) {
      const esc = global.DnDCore && global.DnDCore.shell ? global.DnDCore.shell.esc : function (s) { return String(s); };
      return '<span class="' + cls + '">' + esc(match) + "</span>";
    });
  }

  function highlightRestTags(text) {
    return highlightPatterns(text, REST_PATTERNS, function (match, cls) {
      const esc = global.DnDCore && global.DnDCore.shell ? global.DnDCore.shell.esc : function (s) { return String(s); };
      return '<span class="rest-badge ' + cls + '">' + esc(match) + "</span>";
    });
  }

  function highlightMechanical(text) {
    const patterns = [{ re: DICE_RE, cls: "damage" }].concat(REST_PATTERNS);
    return highlightPatterns(text, patterns, function (match, cls) {
      const esc = global.DnDCore && global.DnDCore.shell ? global.DnDCore.shell.esc : function (s) { return String(s); };
      if (cls === "damage") return '<span class="damage">' + esc(match) + "</span>";
      return '<span class="rest-badge ' + cls + '">' + esc(match) + "</span>";
    });
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.mechanical = {
    INT_RE: INT_RE,
    FT_IN_TEXT_RE: FT_IN_TEXT_RE,
    DICE_RE: DICE_RE,
    formatDistance: formatDistance,
    formatDistancesInText: formatDistancesInText,
    highlightDice: highlightDice,
    highlightRestTags: highlightRestTags,
    highlightMechanical: highlightMechanical,
  };
})(typeof window !== "undefined" ? window : this);
