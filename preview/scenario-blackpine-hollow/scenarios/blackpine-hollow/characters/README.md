# Blackpine Hollow characters

## Status

No source character material was found for Blackpine Hollow in the current repository state.

Re-check completed on 2026-07-01:

- searched repo text for `Blackpine Hollow`, `blackpine-hollow`, and `blackpine`
- searched the Blackpine Hollow scaffold for any character, NPC, pregen, or sheet content
- checked filename matches for `*blackpine*` / `*Blackpine*`
- inspected `scenarios/blackpine-hollow/characters/`
- checked local git history for Blackpine-related files

Result:

- `scenarios/blackpine-hollow/characters/characters-index.json` exists and is empty (`[]`)
- no player character sheets, pregenerated character files, markdown drafts, or other character source content were found in this repository snapshot

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

## Next steps once source docs are available

1. Locate and add the real Blackpine Hollow player character source documents.
2. Extract each player character into `scenarios/blackpine-hollow/characters/NN_descriptive_slug.en.md`.
3. Preserve source mechanics exactly; do not invent missing character details.
4. Convert distance notation to the repository style, such as `30 ft/6 tiles`.
5. Replace any spell references in character spell lists or abilities with spell slugs, and register required spells in the scenario spell book if needed.
6. Replace any indexed magic item references with item slugs, and register required items in the scenario item index if needed.
7. Update `characters-index.json` so it lists every converted character slug in order.
8. Add `.ua.md` counterparts only if real Ukrainian character text is available.
9. Run `scripts/build-sources.cmd --validate-only`.
