# Blackpine Hollow DM script status

## Status

DM-script extraction is now underway from the source PDF at `docs/source/blackpine-hollow.pdf`.

Current result:

- `dm-script-index.json` now includes the full current script flow plus a quick-reference appendix
- all extracted entries have both `.en.md` and `.ua.md` files
- the script now covers framing, scenes 1-8, and a DM quick-reference appendix

## Extracted entries

- `00_session_framing`
- `01_camping_clearing`
- `02_following_the_lanterns`
- `03_whispering_pines`
- `04_abandoned_campsite`
- `05_moonlit_creek`
- `06_small_combat`
- `07_ruined_shrine`
- `08_endings`
- `09_quick_dm_reference`

## Format

Each scene file uses the standard five-section DM-script layout:

1. `### Summary`
2. `### Read-aloud`
3. `### Checks`
4. `### Contingencies`
5. `### DM Notes`

## Next steps

1. Review the extracted script against the PDF for any wording or structure drift.
2. Adjust scene flow only if later preview review shows readability issues in the DM-script library.
3. Keep maps, items, and any optional supporting references aligned as the rest of the scenario is extracted.
4. Run `scripts/build-sources.cmd --validate-only`.
