# Blackpine Hollow

Blackpine Hollow is registered in `scenarios/scenarios-index.json`, but this branch starts from an empty content tree.

## Current status

- Scenario scaffold created in the current HTML/Markdown format
- Source PDF added at `docs/source/blackpine-hollow.pdf`
- Character extraction has started from the PDF
- `manifest.json` now advertises `en` and `ua`
- Other section indexes are still empty pending extraction

## Immediate next steps

1. Continue extracting the source PDF into:
   - player characters
   - monsters
   - NPCs
   - DM script scenes
   - supporting maps, items, spells, and proper names as needed
2. Convert each block into locale-specific Markdown files plus slug-only indexes.
3. Run `scripts/build-sources.cmd --validate-only`.

See `docs/blackpine-hollow-migration-plan.md` for the working migration plan.
