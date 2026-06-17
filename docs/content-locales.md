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

## Character distances (tiles)

**Characters only** (for now): every distance in feet must include the grid equivalent.

- **Conversion:** 5 ft = 1 tile (`tiles = feet ÷ 5`)
- **Format (EN):** `30 ft/6 tiles`
- **Format (UA):** `30 фт./6 клітинок`
- Apply to speed, thrown/reach ranges, and any other foot distances in the character sheet
- Dual ranges: `Thrown 30 ft/6 tiles, 120 ft/24 tiles` (not `30/120 ft`)
- Do not add tiles to monsters, spells, items, or other entity types yet

## Character resources & spellcasting

Optional sections for limited-use class features and casters. Parsed from `### Class Resources` / `### Ресурси класу` and `### Spellcasting` / `### Заклинання` (see `Shared/Core/content-schema.js`).

### Class Resources table

Use for martial or limited-use features that benefit from at-a-glance tracking at the table:

```markdown
### Class Resources

| Resource | Uses | Recharge |
|---|---|---|
| Second Wind | ○ | Short or long rest |
| Action Surge | ○ | Short or long rest |
```

| Column | Purpose |
|--------|---------|
| **Resource** | Feature name (localized per file) |
| **Uses** | Spend markers — one `○` (U+25CB) per available use; players cross out or fill in when spent (print-friendly; no JS tracking) |
| **Recharge** | When uses return (see recharge labels below) |

UA table headers: `Ресурс`, `Використання`, `Відновлення`.

### Spellcasting block

Casters only. Standard spell slots (not DMG spell points unless noted in prose):

```markdown
### Spellcasting

**Spell save DC:** 15 · **Spell attack:** +7

| | 1st | 2nd | 3rd |
|---|---:|---:|---:|
| **Slots** | 4 | 3 | 2 |
| **Used** | ○○○○ | ○○○ | ○○ |

**Cantrips:** Fire Bolt, Light, Mage Hand
**Prepared spells:** Magic Missile, Shield, Misty Step
```

UA field labels: `СЛ заклинань`, `Атака заклинанням`, `Заговори`, `Підготовлені заклинання`.

### Recharge shorthand (inline tags)

In **Special Abilities** prose, append a compact tag after the feature name:

| EN | UA | Meaning |
|----|-----|---------|
| `· 1/SR` | `· 1/КВ` | Short or long rest (regain on short **or** long rest) |
| `· 1/LR` | `· 1/ДВ` | Long rest only |
| `· 3/day` | `· 3/день` | Fixed uses per day |

Example:

```markdown
- **Second Wind** · 1/SR — Bonus action; regain 1d10+3 HP.
```

Legacy parenthetical prose still renders with rest badges: `(short rest)`, `(короткий відпочинок)`, etc.

### Recharge labels (table & prose)

| Label (EN) | Label (UA) | When to use |
|------------|------------|-------------|
| Short or long rest | Короткий або довгий відпочинок | Fighter Second Wind, Action Surge |
| Short rest | Короткий відпочинок | Monk Ki, Warlock slots |
| Long rest | Довгий відпочинок | Spell slots, Channel Divinity |
| Per day / `N/day` | `N/день` | Lucky, fixed daily uses |

### Class Resources vs inline tags only

| Use **Class Resources** table | Use **inline tags** only |
|-------------------------------|--------------------------|
| Multiple limited-use features to track across a session | Single-use or passive features |
| Players need a spend grid at the table | Recharge is obvious from class rules |
| Martial characters with short-rest pools | Flavor abilities with no limited uses |

Characters without these sections render unchanged (backward compatible).
