(function (global) {
  "use strict";

  const INT_RE = /-?\d+/;
  const FT_IN_TEXT_RE = /(\d+)\s*(?:-\s*)?(?:ft\.?|feet|foot|фут(?:ів)?)(?!\s*\/\s*\d+\s*(?:tiles|клітинок))/gi;
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
    if (!text) return "";
    return text.replace(FT_IN_TEXT_RE, function (_match, ftStr) {
      const ft = parseInt(ftStr, 10);
      const tiles = Math.floor(ft / 5);
      if (ua) return ft + " футів/" + tiles + " клітинок";
      return ft + " ft/" + tiles + " tiles";
    });
  }

  function highlightDice(text) {
    const esc = global.DnDCore && global.DnDCore.shell ? global.DnDCore.shell.esc : function (s) { return String(s); };
    if (!text) return "";
    let out = "";
    let last = 0;
    let m;
    DICE_RE.lastIndex = 0;
    while ((m = DICE_RE.exec(text)) !== null) {
      if (m.index > last) out += esc(text.slice(last, m.index));
      out += '<span class="damage">' + esc(m[0]) + "</span>";
      last = m.index + m[0].length;
    }
    out += esc(text.slice(last));
    return out;
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.mechanical = {
    INT_RE: INT_RE,
    FT_IN_TEXT_RE: FT_IN_TEXT_RE,
    DICE_RE: DICE_RE,
    formatDistance: formatDistance,
    formatDistancesInText: formatDistancesInText,
    highlightDice: highlightDice,
  };
})(typeof window !== "undefined" ? window : this);
