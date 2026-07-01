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
- character extraction has started from the PDF
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

`manifest.json` now lists `en` and `ua`.

## Conversion workflow once source files are available

### 1. Characters

- extract each player character into `scenarios/blackpine-hollow/characters/`
- name files with ordinal + descriptive slug, e.g. `01_name_species_class.en.md`
- include tile conversions for character distances
- add spell and item slugs where referenced
- add `.ua.md` counterparts only when Ukrainian text exists

### 2. Monsters

- extract each stat block into `scenarios/blackpine-hollow/monsters/`
- preserve encounter references, tactics, traits, actions, and DM notes
- register any spell or item dependencies

### 3. NPCs

- extract named social/supporting characters into `scenarios/blackpine-hollow/npc/`
- keep roleplay notes, sample lines, and scene references
- register invented proper nouns in `names/names-index.json`
- add Ukrainian declension data when Ukrainian localization is added

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

- remaining characters, monsters, NPCs, DM script scenes, and supporting content still need to be extracted from the source PDF
