# Blackpine Hollow monsters

No Blackpine Hollow monster source material is present in this repository snapshot.

## What was checked

- `scenarios/blackpine-hollow/` for converted monster files
- repository-wide `Blackpine Hollow` / `blackpine-hollow` / `blackpine` text matches
- likely source-like filenames containing `blackpine`
- local git history for Blackpine-related paths
- visible pull request metadata for Blackpine-related work

## Current state

- `monsters-index.json` is intentionally empty: `[]`
- no `.en.md` or `.ua.md` monster entries exist yet
- no source PDF, PD, DOCX, TXT, or prior markdown draft for Blackpine Hollow monsters was found

## Expected format when source is available

1. Add one Markdown file per locale in this directory:
   - `{slug}.en.md`
   - `{slug}.ua.md` only when Ukrainian source exists
2. Keep `monsters-index.json` as a slug-only JSON array.
3. Each slug should match its filename stem exactly.
4. Follow the existing scenario pattern for monster slugs, for example:
   - `01_name_descriptor_monster`
   - `02_creature_variant_monster`
5. Preserve real source details only:
   - encounter reference
   - quick tactics
   - stat block
   - traits
   - actions
   - DM notes

## Next steps

1. Locate the actual Blackpine Hollow source adventure or draft.
2. Extract each monster block into its own `{slug}.en.md` file.
3. Add each slug to `monsters-index.json`.
4. Add supporting spell or item entries only if the monster content references them.
5. Run `scripts/build-sources.cmd --validate-only`.
