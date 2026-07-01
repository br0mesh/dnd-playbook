# Spell closure

Every spell referenced in scenario play content must have a full entry in that scenario's spell book (`scenarios/<slug>/spells/`).

## Rule

For each scenario under `scenarios/<scenario-slug>/`:

> **Spell closure:** If a spell slug appears in any indexed content file for that scenario, it MUST have a corresponding entry in `spells/spells-index.json` with valid `{slug}.en.md` (and `.ua.md` when other entities in the scenario use UA).

Opening `Shared/Spells/library.html?scenario=<slug>` must list every spell players and DMs need during play — not only a manually curated subset.

## Slug convention

Spell files and index entries use semantic slugs (no numeric ordinal prefix):

```
{name_snake}_{level}_{school}
```

Examples: `fire_bolt_cantrip_evocation`, `magic_missile_1st_evocation`, `fireball_3rd_evocation`.

Levels: `cantrip`, `1st`, `2nd`, `3rd`, …  
Schools: `abjuration`, `conjuration`, `divination`, `enchantment`, `evocation`, `illusion`, `necromancy`, `transmutation`.

Display names live only inside spell markdown (`**Name:**` / H1), not in character references.

## Scan scope

The validator scans indexed `.en.md` and `.ua.md` files (slugs from each folder's `*-index.json`):

| Folder | What counts as a spell reference |
|--------|----------------------------------|
| `characters/` | Comma-separated **slugs** in `**Cantrips:**` / `**Prepared spells:**` (`.en.md` only); Attacks table when the Attack cell is a slug or Notes contain Cantrip/Заговір |
| `monsters/` | Spell names in Traits, Actions, bonus actions, reactions, spellcasting blocks (display names; registry lookup) |
| `dm-script/` | Explicit spell names in Summary, Read-aloud, Checks, Contingencies, DM Notes |
| `npc/` | Same as monsters/characters when spell lists appear |
| `items/` | Only when an item **casts** or **stores** a named spell |

## Out of scope

Do **not** treat these as spell-book requirements:

- Passive mentions: "spellbook" (equipment), "spell slots", "spell save DC", "mage armor" in AC parenthetical unless also listed under Cantrips/Prepared
- Class feature names that are not spells (e.g. Arcane Recovery)
- Demo-only content under `Shared/` when not part of a scenario

## Name → slug resolution (monsters, items, dm-script)

The spell registry is built from `Shared/Spells/demo/*.en.md` plus all `scenarios/*/spells/*.en.md` (and `.ua.md` for `**Назва:**`).

| Step | Behavior |
|------|----------|
| Parse | `**Name:**` / `**Назва:**` in `### Header`, fallback to H1 title |
| Normalize | Case-insensitive, trim, collapse whitespace, ignore punctuation |
| Disambiguate | Prefer slug already in scenario index → prefer `Shared/Spells/demo/` slug → fail with candidate list |

Character spell lists use slugs directly — no name lookup.

## Validate vs sync

```powershell
# Validate index files + spell closure (default)
scripts\build-sources.cmd

# Same as default
scripts\build-sources.cmd --validate-only
```

**Validate** fails with a per-scenario report:

```
scenario: test-adventure
MISSING SPELL: fireball_3rd_evocation referenced in characters/02_elara_moonweaver_elf_wizard.en.md (Prepared spells)
```

**Sync** (requires Node.js):

```powershell
scripts\build-sources.cmd --sync-spells
```

- Copies matching `.en.md` / `.ua.md` from `Shared/Spells/demo/` into the scenario `spells/` folder
- Creates stub files for spells not in demo (from `scripts/spell-stub-meta.js` keyed by slug)
- Updates `spells-index.json` (sorted by slug)
- **Never overwrites** existing scenario spell markdown

If a referenced slug is not in demo and has no stub metadata, sync fails with instructions to add the spell manually.

## UA locale

When any indexed entity in the scenario has a `.ua.md` file, new spell files must include `.ua.md` (copied from demo or generated stub with `**Назва:**`).

Character spell lists use **EN slugs** in both `.en.md` and `.ua.md`; the character library resolves localized display names at render time.

## Author workflow

1. Add comma-separated spell **slugs** to character `.en.md` spell lists and spell attack rows.
2. Run `scripts\build-sources.cmd --sync-spells` to pull demo spells and create stubs for the rest.
3. Fill in stub descriptions (replace `TODO` in `### Description`).
4. Run `scripts\build-sources.cmd --validate-only` before commit.
5. Preview over HTTP: `preview.cmd` or `python -m http.server 8080` → `Shared/Spells/library.html?scenario=<slug>`.

## Debugging

```powershell
node scripts/scan-spell-refs.js test-adventure
```

Prints unique spell references with source file and section.

## Related

- [Content locales](content-locales.md) — file naming, index format, preview
- Character spellcasting format — `docs/content-locales.md` § Character resources & spellcasting
