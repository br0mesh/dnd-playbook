# Blackpine Hollow

Blackpine Hollow is registered in `scenarios/scenarios-index.json`, and this branch now contains the source PDF plus the first migrated scenario content.

## Current status

- Scenario scaffold created in the current HTML/Markdown format
- Source PDF added at `docs/source/blackpine-hollow.pdf`
- All five pregenerated player characters have been extracted from the PDF in both `en` and `ua`
- The current monster set and NPC/reference entries have been extracted from the PDF in both `en` and `ua`
- Character-linked spells have been synced into `scenarios/blackpine-hollow/spells/`
- Proper-name registry entries now include Blackpine Hollow, Mosswick, and Vesper
- `manifest.json` now advertises `en` and `ua`
- `dm-script`, `maps`, and `items` are still pending extraction

## Immediate next steps

1. Continue extracting the source PDF into:
   - DM script scenes
   - supporting maps and items as needed
2. Review the migrated character, monster, and NPC sets in the preview and adjust any formatting drift from the PDF.
3. Run `scripts/build-sources.cmd --validate-only`.

See `docs/blackpine-hollow-migration-plan.md` for the working migration plan.
