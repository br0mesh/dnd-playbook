# Blackpine Hollow

Blackpine Hollow is registered in `scenarios/scenarios-index.json`, but this branch starts from an empty content tree.

## Current status

- Scenario scaffold created in the current HTML/Markdown format
- Section indexes are present and currently empty
- No Blackpine Hollow source PDF, PD, or prior markdown content was found in the repository, local git history, or visible GitHub refs
- `manifest.json` currently advertises `en` only; add `ua` after Ukrainian source files exist

## Immediate next steps

1. Locate the source adventure materials for Blackpine Hollow.
2. Split the source into:
   - player characters
   - monsters
   - NPCs
   - DM script scenes
   - supporting maps, items, spells, and proper names as needed
3. Convert each block into locale-specific Markdown files plus slug-only indexes.
4. Run `scripts/build-sources.cmd --validate-only`.

See `docs/blackpine-hollow-migration-plan.md` for the working migration plan.
