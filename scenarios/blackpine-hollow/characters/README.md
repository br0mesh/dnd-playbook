# Blackpine Hollow characters

## Status

Character extraction is now in progress from the source PDF at `docs/source/blackpine-hollow.pdf`.

Current result:

- `characters-index.json` now includes `01_rowan_ashford_human_fighter`
- Rowan Ashford has been added in both `.en.md` and `.ua.md`
- the remaining pregenerated characters still need to be extracted from the PDF

## Expected file naming and index format

When source documents become available, add converted character files in this directory using one Markdown file per locale.

- English sheet filename: `NN_descriptive_slug.en.md`
- Ukrainian sheet filename: `NN_descriptive_slug.ua.md` only if Ukrainian source text exists
- `NN` should be a zero-padded ordinal such as `01`, `02`, `03`
- `descriptive_slug` should use lowercase snake_case and identify the character
- `characters-index.json` must contain a JSON array of slugs only, in display order

Example:

```json
[
  "01_example_human_fighter",
  "02_example_elf_wizard"
]
```

Those index entries must map to:

- `01_example_human_fighter.en.md`
- `02_example_elf_wizard.en.md`

## Next steps

1. Extract each remaining player character into `scenarios/blackpine-hollow/characters/NN_descriptive_slug.en.md`.
2. Add `.ua.md` counterparts from the bilingual PDF where available.
3. Preserve source mechanics exactly and convert character distances to the repository style, such as `30 ft/6 tiles`.
4. Replace any spell references in character spell lists or abilities with spell slugs, and register required spells in the scenario spell book if needed.
5. Replace any indexed magic item references with item slugs, and register required items in the scenario item index if needed.
6. Update `characters-index.json` so it lists every converted character slug in order.
7. Run `scripts/build-sources.cmd --validate-only`.
