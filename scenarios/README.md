# Scenarios (branch-per-adventure)

Adventure content lives on long-lived branches. The `main` branch holds platform assets plus merged scenarios and [scenarios-index.json](./scenarios-index.json) for the HTML book picker.

| Slug | Branch | HTML book | Description |
|------|--------|-----------|-------------|
| test-adventure | (on `main`) | Yes | Minimal acceptance scenario — one file per section |
| wild-sheep-chase | `scenario/wild-sheep-chase` | PDF only | Comedy one-shot, levels 4–5 (Winghorn Press) |
| blackpine-hollow | `scenario/blackpine-hollow` | PDF only | Camping one-shot, level 3 (homebrew) |

## Preview (HTML)

```powershell
python -m http.server 8080
```

Open http://localhost:8080/index.html?scenario=test-adventure

### Content files (locales)

Each entity uses `{slug}.en.md` and optional `{slug}.ua.md`; indexes list slugs only. See [docs/content-locales.md](../docs/content-locales.md).

- **HTTP preview** (above): no build step.
- **`file://` preview**: run `scripts\build-sources.cmd` after editing `.md` files.

Legacy scenarios require migration to the new folder layout before HTML preview works — see [docs/pdf-html-migration.md](../docs/pdf-html-migration.md).

## Checkout a scenario branch

```powershell
git fetch origin
git checkout scenario/wild-sheep-chase
```

## New scenario

Branch from `main`, create `scenarios/<slug>/` with HTML layout (see [AGENTS.md](../AGENTS.md)), push `scenario/<slug>`. Add a row to this table and `scenarios-index.json` on `main` after merge.
