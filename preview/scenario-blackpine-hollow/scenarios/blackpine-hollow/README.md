# Blackpine Hollow

Blackpine Hollow is registered in `scenarios/scenarios-index.json`, and this branch now contains the source PDF plus the first migrated scenario content.

## Current status

- Scenario scaffold created in the current HTML/Markdown format
- Source PDF added at `docs/source/blackpine-hollow.pdf`
- All five pregenerated player characters have been extracted from the PDF in both `en` and `ua`
- Character-linked spells have been synced into `scenarios/blackpine-hollow/spells/`
- `manifest.json` now advertises `en` and `ua`
- Other section indexes are still empty pending extraction

## Immediate next steps

1. Continue extracting the source PDF into:
   - monsters
   - NPCs
   - DM script scenes
   - supporting maps, items, and proper names as needed
2. Review the migrated character set in the preview and adjust any formatting drift from the PDF.
3. Run `scripts/build-sources.cmd --validate-only`.

See `docs/blackpine-hollow-migration-plan.md` for the working migration plan.
