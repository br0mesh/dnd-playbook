(function (global) {
  "use strict";

  const UA_SPLIT = /##\s+Українська\s+Версія/i;
  const DM_NOTES_HEADINGS = new Set(["dm notes", "нотатки майстра", "notes dm"]);

  function excludeDmNotes(text) {
    const lines = text.split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("### ")) {
        const heading = line.slice(4).trim();
        if (
          DM_NOTES_HEADINGS.has(heading.toLowerCase()) ||
          heading === "DM Notes" ||
          heading === "Нотатки Майстра"
        ) {
          i += 1;
          while (i < lines.length) {
            const nxt = lines[i];
            if (nxt.startsWith("### ") || nxt.startsWith("## ") || nxt.trim() === "---") break;
            i += 1;
          }
          continue;
        }
      }
      out.push(line);
      i += 1;
    }
    return out.join("\n");
  }

  /** @deprecated Use per-locale .en.md / .ua.md files instead of splitBilingual(). */
  function splitBilingual(text) {
    const parts = text.split(UA_SPLIT);
    const enText = parts[0];
    const uaText = parts.length > 1 ? parts[1] : "";
    return { enText: enText, uaText: uaText, hasUa: Boolean(uaText.trim()) };
  }

  const EN_VERSION_SPLIT = /##\s+English\s+Version\s*/i;

  function stripLegacyBilingualWrapper(text) {
    let body = String(text || "");
    const uaParts = body.split(UA_SPLIT);
    if (uaParts.length > 1) {
      return { enText: stripEnVersionHeader(uaParts[0]), uaText: uaParts[1].trim() };
    }
    return { enText: stripEnVersionHeader(body), uaText: "" };
  }

  function stripEnVersionHeader(text) {
    let body = String(text || "");
    const enMatch = body.match(EN_VERSION_SPLIT);
    if (enMatch) {
      body = body.slice(enMatch.index + enMatch[0].length);
    }
    return body.trim();
  }

  function parseBoldFields(block) {
    const out = {};
    if (!block) return out;
    block.split("\n").forEach(function (line) {
      const m = line.trim().match(/^\*\*(.+?):\*\*\s*(.+)$/);
      if (m) out[m[1].trim()] = m[2].trim();
    });
    return out;
  }

  function sectionByHeading(text, heading) {
    const pattern = new RegExp(
      "###\\s+" + heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\n\\n([\\s\\S]*?)(?=\\n### |\\n---|\\n## |\\Z)",
      "i"
    );
    const m = text.match(pattern);
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
    block.split("\n").forEach(function (line) {
      if (!line.startsWith("|")) return;
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) return;
      rows.push(line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.trim(); }));
    });
    return rows;
  }

  function listItems(block) {
    const items = [];
    if (!block) return items;
    block.split("\n").forEach(function (line) {
      if (line.startsWith("- ")) items.push(line.slice(2).trim());
    });
    return items;
  }

  function titleForLocale(text, locale) {
    const m = text.match(/^#\s+(.+)$/m);
    if (!m) return "";
    const title = m[1].trim();
    if (title.indexOf(" / ") >= 0 && !locale) {
      return title.split(" / ")[0].trim();
    }
    if (title.indexOf(" / ") >= 0 && locale) {
      const parts = title.split(" / ");
      return locale === "ua" ? parts.slice(1).join(" / ").trim() : parts[0].trim();
    }
    return title;
  }

  function titleParts(text, locale) {
    const m = text.match(/^#\s+(.+)$/m);
    if (!m) {
      if (locale === "ua") return { ua: "" };
      if (locale === "en") return { en: "" };
      return { en: "", ua: "" };
    }
    const title = m[1].trim();
    if (locale === "ua") return { ua: title.indexOf(" / ") >= 0 ? title.split(" / ").slice(1).join(" / ").trim() : title };
    if (locale === "en") return { en: title.indexOf(" / ") >= 0 ? title.split(" / ")[0].trim() : title };
    if (title.indexOf(" / ") >= 0) {
      const parts = title.split(" / ");
      return { en: parts[0].trim(), ua: parts.slice(1).join(" / ").trim() };
    }
    return { en: title, ua: title };
  }

  function inlineMarkdown(text, highlightFn) {
    const escFn = global.DnDCore && global.DnDCore.shell ? global.DnDCore.shell.esc : function (s) { return String(s); };
    let out = escFn(text || "");
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
    if (highlightFn) out = highlightFn(out);
    return out;
  }

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.markdown = {
    UA_SPLIT: UA_SPLIT,
    DM_NOTES_HEADINGS: DM_NOTES_HEADINGS,
    excludeDmNotes: excludeDmNotes,
    splitBilingual: splitBilingual,
    stripLegacyBilingualWrapper: stripLegacyBilingualWrapper,
    stripEnVersionHeader: stripEnVersionHeader,
    parseBoldFields: parseBoldFields,
    sectionByHeading: sectionByHeading,
    sectionAnyHeading: sectionAnyHeading,
    tableRows: tableRows,
    listItems: listItems,
    titleParts: titleParts,
    titleForLocale: titleForLocale,
    inlineMarkdown: inlineMarkdown,
  };
})(typeof window !== "undefined" ? window : this);
