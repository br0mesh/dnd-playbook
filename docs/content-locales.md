# Content locales

Adventure and demo content uses **one Markdown file per locale**, not a single bilingual file.

## File naming

| File | Purpose |
|------|---------|
| `{slug}.en.md` | English (required) |
| `{slug}.ua.md` | Ukrainian (optional; falls back to EN) |

Example: `01_sample_wolf_monster.en.md`, `01_sample_wolf_monster.ua.md`

The URL language toggle uses `?lang=en` or `?lang=ua` (locale code `ua`, not ISO `uk`).

## Index format

Section indexes (`*-index.json`) list **slugs only** (no `.md` suffix):

```json
["01_sample_wolf_monster"]
```

The loader resolves `{slug}.en.md` and `{slug}.ua.md` next to the index file.

## Markdown shape

Each locale file is a normal single-language document:

- H1 is the title in that language only (`# Wolf`, not `EN / UA`)
- No `## English Version` or `## Українська Версія` wrappers
- Shared preamble (Encounter Reference, Quick Tactics, etc.) lives **inside each locale file** (duplicate or translate)

## HTTP vs file://

| Preview | Build step |
|---------|------------|
| `python -m http.server` or GitHub Pages | None — `.md` files are fetched directly |
| Opening `library.html` via `file://` | Run `scripts\build-sources.cmd` after editing `.md` |

The build script regenerates `*-sources.js` and `*-index.js` for offline use.

## Build commands

```powershell
# Regenerate offline bundles (Node or Python)
scripts\build-sources.cmd

# Validate every index slug has .en.md; warn on missing .ua.md
scripts\build-sources.cmd --validate-only

# One-time split of legacy bilingual .md (already done on main)
scripts\build-sources.cmd --split-legacy --build
```

## Breaking changes for scenario authors

1. Replace bilingual `foo.md` with `foo.en.md` + optional `foo.ua.md`
2. Index entries are slugs: `"01_hook"` not `"01_hook.md"`
3. Run `build-sources` when testing via `file://`
4. UA file optional — EN is always required
