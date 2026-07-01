# Item closure

Every magic item referenced in scenario play content must have a full entry in that scenario's item stash (`scenarios/<slug>/items/`).

## Rule

For each scenario under `scenarios/<scenario-slug>/`:

> **Item closure:** If an item slug appears in any indexed content file for that scenario, it MUST have a corresponding entry in `items/items-index.json` with valid `{slug}.en.md` (and `.ua.md` when other entities in the scenario use UA).

Opening `Shared/Items/library.html?scenario=<slug>` must list every item players and DMs need during play.

## Slug convention

Item files and index entries use semantic slugs with an optional numeric prefix:

```
{ordinal}_{name_snake}_{rarity}_{type}
```

Examples: `02_wand_war_mage_uncommon_wand`, `07_ring_spell_turning_very_rare_ring`.

Rarities: `common`, `uncommon`, `rare`, `very_rare` (two segments), `legendary`, `artifact`.  
Types: `armor`, `potion`, `ring`, `rod`, `scroll`, `staff`, `wand`, `weapon`, `wondrous`.

Display names live only inside item markdown (`**Name:**` / H1), not in character references.

## Scan scope

The validator scans indexed `.en.md` files (slugs from each folder's `*-index.json`):

| Folder | What counts as an item reference |
|--------|----------------------------------|
| `characters/` | Comma-separated **slugs** in `**Magic items:**` / `**Чарівні предмети:**`; display names in Gear bullets under `### Equipment & Inventory` |
| `monsters/`, `npc/` | Item names in Treasure/Loot sections when present |
| `dm-script/` | Explicit item names in Summary, Read-aloud, Checks, Contingencies, DM Notes |
| `items/` | Out of scope here (spell refs on items use spell closure) |

## Authoring

**Preferred:** structured slug list in character equipment:

```markdown
**Magic items:** 02_wand_war_mage_uncommon_wand, 01_healing_potion_common_potion
```

**Fallback:** prose name in a gear bullet (registry lookup, same rules as monster spell names).

## Name → slug resolution (prose fallback)

The item registry is built from `Shared/Items/demo/*.en.md` plus all `scenarios/*/items/*.en.md` (and `.ua.md` for `**Назва:**`).

| Step | Behavior |
|------|----------|
| Parse | `**Name:**` / `**Назва:**` in `### Header`, fallback to H1 title |
| Normalize | Case-insensitive, trim, collapse whitespace, ignore punctuation |
| Disambiguate | Prefer slug already in scenario index → prefer `Shared/Items/demo/` slug → fail with candidate list |

Structured `**Magic items:**` lines use slugs directly — no name lookup.

## URL parameters (items library)

| Param | Purpose |
|-------|---------|
| `scenario` | Load scenario `items/` instead of demo |
| `item` | Focus a specific item card |
| `rarity` | Filter by rarity key (e.g. `uncommon`) |
| `type` | Filter by type key (e.g. `wand`) |
| `lang` | `ua` for Ukrainian UI and link targets |

Cross-links from characters use `?character=<slug>` on the character library; items show reverse refs under **Held by** / **У володінні**.

## Validate vs sync

```bat
scripts\build-sources.cmd --validate-only
```

Runs index integrity, spell closure, and item closure.

```bat
scripts\build-sources.cmd --sync-items
```

Copies missing items from `Shared/Items/demo/` into each scenario's `items/` folder and updates `items-index.json`. Does not overwrite existing scenario markdown.

## Error format

```
MISSING ITEM: 02_wand_war_mage_uncommon_wand referenced in characters/02_elara_moonweaver_elf_wizard.en.md (Equipment).
```
