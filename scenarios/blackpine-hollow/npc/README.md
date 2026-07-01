# Blackpine Hollow NPCs

No Blackpine Hollow NPC source material is present in this repository snapshot.

## What was checked

- `scenarios/blackpine-hollow/` for converted NPC files
- repository-wide `Blackpine Hollow` / `blackpine-hollow` / `blackpine` text matches
- likely source-like filenames containing `blackpine`
- local git history for Blackpine-related paths
- visible pull request metadata for Blackpine-related work

## Current state

- `npc-index.json` is intentionally empty: `[]`
- no `.en.md` or `.ua.md` NPC entries exist yet
- no source PDF, PD, DOCX, TXT, or prior markdown draft for Blackpine Hollow NPCs was found

## Expected format when source is available

1. Add one Markdown file per locale in this directory:
   - `{slug}.en.md`
   - `{slug}.ua.md` only when Ukrainian source exists
2. Keep `npc-index.json` as a slug-only JSON array.
3. Each slug should match its filename stem exactly.
4. Follow the existing scenario pattern for NPC slugs, for example:
   - `01_first_last`
   - `02_name_title`
5. Preserve real source details only:
   - scene reference
   - quick roleplay
   - sample lines
   - DM notes
   - stat block only if the source actually includes one

## Next steps

1. Locate the actual Blackpine Hollow source adventure or draft.
2. Extract each named NPC into its own `{slug}.en.md` file.
3. Add each slug to `npc-index.json`.
4. Register supporting proper names in `../names/names-index.json` if Ukrainian localization is added.
5. Run `scripts/build-sources.cmd --validate-only`.
