# Blackpine Hollow DM script status

## Source check result

No Blackpine Hollow DM script source was found in the current repository snapshot.

Checked locations and signals:

- `scenarios/blackpine-hollow/` scaffold contents
- repository text matches for `Blackpine Hollow`, `blackpine-hollow`, and `blackpine hollow`
- filename matches for likely Blackpine-related assets
- migration notes in `docs/blackpine-hollow-migration-plan.md`
- scenario status notes in `scenarios/blackpine-hollow/README.md`

Current result:

- `dm-script/dm-script-index.json` exists and is empty
- no numbered scene markdown files exist under this folder
- no source PDF, DOCX, TXT, markdown draft, or prior converted scene content was found to convert safely

## Expected scene structure

When source documents arrive, convert the adventure flow into numbered scene files in this folder.

Expected files:

- `dm-script-index.json` as a slug-only array in play order
- one Markdown file per scene and locale, for example:
  - `00_session_framing.en.md`
  - `01_scene_slug.en.md`
  - `02_scene_slug.en.md`

Expected index shape:

```json
[
  "00_session_framing",
  "01_scene_slug",
  "02_scene_slug"
]
```

Each scene file should use the standard five-section DM script layout:

1. `### Summary`
2. `### Read-aloud`
3. `### Checks`
4. `### Contingencies`
5. `### DM Notes`

## Naming guidance

- Use a zero-padded numeric prefix for scene order: `00_`, `01_`, `02_`, and so on
- Follow the number with a short descriptive slug
- Keep `dm-script-index.json` entries identical to the filename stem
- Add `.ua.md` counterparts only when Ukrainian source text exists

## Next steps when source docs arrive

1. Identify the authoritative Blackpine Hollow source document.
2. Split the adventure into ordered scenes without inventing new content.
3. Create one `.en.md` scene file per scene using the five-section format.
4. Add each scene stem to `dm-script-index.json` in encounter order.
5. Add `.ua.md` scene files only if Ukrainian source text is provided.
6. Run `scripts/build-sources.cmd --validate-only`.
