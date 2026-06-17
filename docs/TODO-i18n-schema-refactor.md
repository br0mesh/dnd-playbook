# TODO: Refactor bilingual schema & localization

Status: **not started**  
Priority: **low** (current en/ua setup works; refactor before adding a 3rd locale)  
Related: [content-locales.md](./content-locales.md), `Shared/Core/content-schema.js`, `Shared/Core/locale.js`

---

## Problem summary

The app treats localization as **positional bilingual arrays** (`[enLabel, uaLabel, …extraAliases]`) shared between **markdown parsing** and **UI rendering**. That pattern is duplicated in places and does not scale beyond two locales.

---

## Current behavior

### Dual-purpose alias arrays

Section headings and UI labels are stored as arrays, e.g. in `Shared/Core/content-schema.js`:

```js
basicInfo: ["Basic Info", "Основна інформація"],
skills: ["Good Skills", "Сильні навички", "Навички"],
```

Each array serves two roles:

| Role | Mechanism | Example |
|------|-----------|---------|
| **Parse** | `sectionAnyHeading(text, …aliases)` tries every string until a `###` heading matches | UA file uses `### Основна інформація` |
| **Render** | `labelFor(aliases)` picks `aliases[0]` for en, `aliases[1]` for ua | UI shows "Basic Info" or "Основна інформація" |

Relevant code:

- `Shared/Characters/character-library.js` — `labelFor`, `headingAliases`, `uiAliases`, `section`
- `Shared/Core/markdown.js` — `sectionAnyHeading`
- All entity libraries (`monster-library.js`, `spell-library.js`, etc.) use the same schema pattern

### Positional en/ua convention

`labelFor` hard-codes index `0` = English, `1` = Ukrainian:

```js
return state.lang === "ua" ? (aliases[1] || aliases[0]) : aliases[0];
```

The rest of the stack assumes exactly two content locales:

- `Shared/Core/locale.js` — `SUPPORTED_LOCALES = ["en", "ua"]`
- `Shared/Core/library-loader.js` — loads only `{slug}.en.md` and `{slug}.ua.md`
- Entity assemblies — `{ slug, en: parsedEn, ua: parsedUa }`
- URL toggle — `?lang=en` or `?lang=ua`

### Parse-only aliases mixed with locale labels

Some schema entries have a **third** string (e.g. `skills`, `equipment`). Index `2+` is only used for parsing alternate or legacy headings; `labelFor` never reads them. Display labels and parse synonyms are conflated in one array.

### Duplication in character-library

`character-library.js` defines local `DEFAULT_HEADINGS` and `DEFAULT_UI` that mirror `contentSchema.CHARACTER` almost exactly. Other libraries (monsters, spells, items, NPCs, maps, dm-script) reference the schema directly:

```js
const headings = window.DnDCore.contentSchema.SPELL;
```

In normal runs `content-schema.js` is always loaded before `library.html` scripts, so the character `DEFAULT_*` fallbacks are effectively dead code.

### Scattered bilingual field maps (characters only)

Beyond section headings, character parsing hardcodes EN/UA **bold field labels** in multiple places:

| Location | Purpose |
|----------|---------|
| `parseLang()` | `"Character Name"` / `"Ім'я персонажа"`, `"Armor Class AC"` / `"Клас броні КБ"`, etc. |
| `SPELL_FIELD_KEYS` | `"Spell save DC"` / `"СЛ заклинань"`, `"Cantrips"` / `"Заговори"`, etc. |

These follow the same bilingual idea as the schema but are not centralized or documented alongside `content-schema.js`.

---

## Why this is a problem

1. **Duplication** — character schema exists in two files; changes can drift.
2. **Ambiguous arrays** — index 0/1 = locale, index 2+ = legacy parse alias; easy to misuse when editing.
3. **No path to N locales** — adding German means appending `aliases[2]` and rewriting every `labelFor`-style branch, loader paths, assembly objects, and merge logic.
4. **Inconsistent patterns** — entity libraries use schema-only; characters add local defaults and extra field maps.

For the **current** en + ua product, nothing is broken. The issue is **maintainability and future locale growth**.

---

## Proposed fix (phased)

### Phase 1 — Quick cleanup (low risk, do anytime)

**Goal:** One source of truth for character headings/UI; align with other libraries.

- [ ] Remove `DEFAULT_HEADINGS` and `DEFAULT_UI` from `character-library.js`.
- [ ] Use `contentSchema.CHARACTER` directly (same as `spell-library.js` uses `contentSchema.SPELL`).
- [ ] Keep `headingAliases` / `uiAliases` as thin wrappers only if they simplify `schema.ui` access.
- [ ] Verify `library.html` still loads `content-schema.js` before `character-library.js` (already true).

**Acceptance:** Character library renders and parses demo + scenario sheets identically; no duplicate heading definitions.

---

### Phase 2 — Separate labels from parse aliases (medium effort)

**Goal:** Make schema entries explicit about display vs parsing.

Replace flat arrays with a structured shape, e.g.:

```js
basicInfo: {
  labels: { en: "Basic Info", ua: "Основна інформація" },
  aliases: ["Навички"], // optional legacy/extra headings only
},
```

Or keep backward-compatible arrays during migration and add a small helper module:

```js
// Shared/Core/schema-i18n.js (sketch)
function labelsFor(entry, lang) { … }
function parseAliases(entry) { … } // all label values + aliases.flat()
```

- [ ] Add `schema-i18n.js` with `labelFor(entry, lang)` and `parseAliases(entry)`.
- [ ] Migrate `content-schema.js` entries to the new shape (or wrap legacy arrays in the helper).
- [ ] Update `character-library.js` and all entity libraries to use the helper.
- [ ] Document the shape in `content-locales.md`.

**Acceptance:** `skills` / `equipment` legacy UA headings still parse; UI labels unchanged; no positional index logic in libraries.

---

### Phase 3 — Centralize character field labels (medium effort)

**Goal:** Move `parseLang` and `SPELL_FIELD_KEYS` bilingual strings into schema or a dedicated `CHARACTER_FIELDS` map.

- [ ] Define internal keys (`characterName`, `armorClass`, `spellDc`, …) with per-locale display strings.
- [ ] Refactor `parseBoldFields` usage to try all locale variants for each internal key (or normalize markdown to internal keys in a future author guide — out of scope for code-only refactor).
- [ ] Extend `docs/content-locales.md` character section to reference the centralized map.

**Acceptance:** No raw `"Ім'я персонажа"` strings in `character-library.js` except via the map.

---

### Phase 4 — N-locale infrastructure (only when adding locale #3)

**Goal:** Generalize loader, storage, and fallback beyond en/ua.

Do **not** start until a third locale is actually required.

- [ ] `locale.js` — `SUPPORTED_LOCALES` drives file extension, URL param validation, and fallback order.
- [ ] `library-loader.js` — fetch `{slug}.{lang}.md` for each supported locale (parallel), not hardcoded en/ua.
- [ ] Assembly shape — `{ slug, locales: { en: {...}, ua: {...}, de: {...} } }` instead of top-level `en`/`ua`.
- [ ] `mergeWithFallback` — chain from `DEFAULT_LOCALE` through preferred fallbacks.
- [ ] UI chrome — language toggle lists all `SUPPORTED_LOCALES`.
- [ ] Build script / validation — ensure required locale files exist per slug.
- [ ] Author docs — file naming, optional vs required locales.

**Acceptance:** Adding locale `de` is adding strings to schema maps + author content files, not rewriting index arithmetic across the codebase.

---

## Out of scope (for this TODO)

- Translating spell-school bookmarks, pagination chrome, and other **UI chrome** that is still English-only in several libraries.
- Changing markdown author format to language-neutral internal keys (e.g. `**character_name:**`) — possible long-term, breaking for existing scenarios.
- ISO locale codes (`uk` vs `ua`) — project intentionally uses `ua`; changing would break URLs and filenames.

---

## Suggested order of work

1. **Phase 1** — small PR, immediate dedup win.
2. **Phase 2** — before any schema churn or new heading aliases.
3. **Phase 3** — when touching character parser anyway.
4. **Phase 4** — only when product commits to a third locale.

---

## Files likely touched

| Phase | Files |
|-------|-------|
| 1 | `Shared/Characters/character-library.js` |
| 2 | `Shared/Core/content-schema.js`, new `Shared/Core/schema-i18n.js`, all `*-library.js` |
| 3 | `Shared/Characters/character-library.js`, `content-schema.js` or new field map, `docs/content-locales.md` |
| 4 | `Shared/Core/locale.js`, `library-loader.js`, `library-shell.js`, entity libraries, build scripts, docs |

---

## Testing checklist (any phase)

- [ ] Open character library via HTTP (`preview.cmd`) with `?lang=en` and `?lang=ua`.
- [ ] Verify scenario `test-adventure` characters load and render all sections.
- [ ] Verify demo character `01_aria_storm_human_fighter` EN + UA files parse (including spellcasting, resources, skills).
- [ ] Offline `file://` after `scripts\build-sources.cmd` if loader or paths change.
- [ ] Spot-check one other entity library (monster or spell) if `content-schema.js` or shared helpers change.
