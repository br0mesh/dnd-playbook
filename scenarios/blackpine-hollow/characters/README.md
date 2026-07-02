# Blackpine Hollow characters

## Status

Character extraction is now underway from the source PDF at `docs/source/blackpine-hollow.pdf`.

Current result:

- `characters-index.json` now includes the full pregen party
- all five pregenerated characters have been added in both `.en.md` and `.ua.md`
- supporting spell references for the extracted characters have been synced into `../spells/`

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

1. Review the extracted sheets against the PDF for any remaining formatting or wording drift.
2. Keep character distances in the repository style, such as `30 ft/6 tiles`.
3. Add item slugs if future character revisions introduce indexed magic items.
4. Run `scripts/build-sources.cmd --validate-only`.
