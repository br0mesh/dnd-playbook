# Blackpine Hollow migration plan

## Goal

Convert Blackpine Hollow into the current repository format used by `scenarios/<slug>/`, with slug-only section indexes and one Markdown file per locale.

## Source inventory

Completed checks:

- searched the working tree for `Blackpine Hollow` / `blackpine-hollow`
- searched for likely source assets such as PDF, DOCX, TXT, and markdown drafts
- searched local git history for Blackpine-related files
- checked visible GitHub refs and pull requests for Blackpine work

Current result:

- source PDF now available at `docs/source/blackpine-hollow.pdf`
- all five pregenerated characters have been extracted from the PDF in `en` and `ua`
- the current monster and NPC/reference sets have been extracted from the PDF in `en` and `ua`
- supporting character spell references have been synced into `scenarios/blackpine-hollow/spells/`
- the remaining scenario sections still need to be converted

## Current scaffold

Created:

- `scenarios/blackpine-hollow/manifest.json`
- section indexes for characters, monsters, NPCs, DM script, spells, items, maps
- `scenarios/blackpine-hollow/names/names-index.json`
- scenario README with status and next steps

Current extracted content:

- `characters/01_rowan_ashford_human_fighter.en.md`
- `characters/01_rowan_ashford_human_fighter.ua.md`
- `characters/02_lira_moonbrook_wood_elf_ranger.en.md`
- `characters/02_lira_moonbrook_wood_elf_ranger.ua.md`
- `characters/03_milo_underbough_lightfoot_halfling_rogue.en.md`
- `characters/03_milo_underbough_lightfoot_halfling_rogue.ua.md`
- `characters/04_brunna_stonekeep_hill_dwarf_cleric.en.md`
- `characters/04_brunna_stonekeep_hill_dwarf_cleric.ua.md`
- `characters/05_nyx_embervale_tiefling_warlock.en.md`
- `characters/05_nyx_embervale_tiefling_warlock.ua.md`
- `monsters/01_twig_blight_monster.en.md`
- `monsters/01_twig_blight_monster.ua.md`
- `monsters/02_fey_wolf_monster.en.md`
- `monsters/02_fey_wolf_monster.ua.md`
- `monsters/03_animated_bedroll_monster.en.md`
- `monsters/03_animated_bedroll_monster.ua.md`
- `monsters/04_angry_cooking_pan_monster.en.md`
- `monsters/04_angry_cooking_pan_monster.ua.md`
- `monsters/05_mosswick_fey_trickster_monster.en.md`
- `monsters/05_mosswick_fey_trickster_monster.ua.md`
- `npc/01_mosswick_fey_trickster.en.md`
- `npc/01_mosswick_fey_trickster.ua.md`
- `npc/02_lantern_spirits.en.md`
- `npc/02_lantern_spirits.ua.md`
- synced spell book entries required by the character set
- names registry entries for Blackpine Hollow, Mosswick, and Vesper

`manifest.json` now lists `en` and `ua`.

## Conversion workflow once source files are available

### 1. Characters

- complete initial extraction of each player character into `scenarios/blackpine-hollow/characters/`
- review wording and formatting drift against the PDF
- keep tile conversions for character distances
- maintain spell and item closure as future edits change the sheets

### 2. Monsters

- complete initial extraction of each current stat block into `scenarios/blackpine-hollow/monsters/`
- review encounter references, tactics, traits, actions, and DM notes against the PDF
- register any future spell or item dependencies introduced by edits

### 3. NPCs

- complete initial extraction of named social/reference characters into `scenarios/blackpine-hollow/npc/`
- keep roleplay notes, sample lines, and scene references aligned with the PDF
- maintain invented proper nouns in `names/names-index.json`
- add more Ukrainian declension data as new localized names appear

### 4. DM script

- split the adventure flow into numbered scene files under `scenarios/blackpine-hollow/dm-script/`
- keep the five standard sections used by the current renderer
- add branch markers only where player-path forks exist

### 5. Supporting content

- add maps, items, and spells only when they are referenced by indexed play content
- sync shared spells/items where possible before creating custom entries
- add proper nouns to `names/names-index.json` as soon as scenario content introduces them
- extend name entries with Ukrainian forms and declensions when UA content is added

### 6. Validation

- run `scripts/build-sources.cmd --validate-only`
- review warnings for missing `.ua.md` files
- verify each index references only existing `.en.md` files

## Delegated work blocks

- Characters agent: confirm source availability, then populate `characters/`
- Monsters agent: confirm source availability, then populate `monsters/` and `npc/`
- Script agent: confirm source availability, then populate `dm-script/`
- Consistency agent: review indexes, locale declarations, and closure-sensitive references

## Blockers

- DM script scenes, maps, items, and any extra support content still need to be extracted from the source PDF
