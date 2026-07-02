# Blackpine Hollow NPCs

## Status

NPC extraction is now underway from the source PDF at `docs/source/blackpine-hollow.pdf`.

Current result:

- `npc-index.json` now includes the current social/reference NPC set
- all extracted NPCs have both `.en.md` and `.ua.md` files
- supporting proper names have been added to `../names/names-index.json`

## Extracted NPCs

- `01_mosswick_fey_trickster`
- `02_lantern_spirits`

## Next steps

1. Review the extracted social/reference entries against the PDF for any wording drift.
2. Add more NPC entries if later DM-script extraction reveals additional named social beats that deserve separate files.
3. Keep `../names/names-index.json` up to date as new proper nouns appear.
4. Run `scripts/build-sources.cmd --validate-only`.
