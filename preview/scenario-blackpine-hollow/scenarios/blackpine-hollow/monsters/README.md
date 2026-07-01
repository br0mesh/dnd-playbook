# Blackpine Hollow monsters

## Status

Monster extraction is now underway from the source PDF at `docs/source/blackpine-hollow.pdf`.

Current result:

- `monsters-index.json` now includes the full current combat set
- all extracted monsters have both `.en.md` and `.ua.md` files
- Mosswick has a dedicated monster entry for the combat branch of Scene 7

## Extracted monsters

- `01_twig_blight_monster`
- `02_fey_wolf_monster`
- `03_animated_bedroll_monster`
- `04_angry_cooking_pan_monster`
- `05_mosswick_fey_trickster_monster`

## Next steps

1. Review the extracted stat blocks against the PDF for any remaining wording or formatting drift.
2. Add spell or item support only if future monster edits introduce explicit references that need closure.
3. Run `scripts/build-sources.cmd --validate-only`.
