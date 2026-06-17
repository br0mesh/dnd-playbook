# Scenarios (branch-per-adventure)

Adventure content lives on long-lived branches. The `main` branch holds platform assets plus merged scenarios and [scenarios-index.json](./scenarios-index.json) for the HTML book picker.

| Slug | Branch | HTML book | Description |
|------|--------|-----------|-------------|
| test-adventure | (on `main`) | Yes | Minimal acceptance scenario — one file per section |
| wild-sheep-chase | `scenario/wild-sheep-chase` | PDF only | Comedy one-shot, levels 4–5 (Winghorn Press) |
| blackpine-hollow | `scenario/blackpine-hollow` | PDF only | Camping one-shot, level 3 (homebrew) |

## Preview (HTML)

Preview requires HTTP — `file://` is not supported.

```powershell
# Windows one-click (repo root)
preview.cmd

# Or manual
python -m http.server 8080
```

Open http://localhost:8080/index.html?scenario=test-adventure

## Branch previews (GitHub Pages)

Every push to a `scenario/*` branch deploys a public preview on GitHub Pages. Production at the repo root is unchanged.

| Item | Value |
|------|-------|
| URL pattern | `https://<owner>.github.io/dnd-playbook/preview/<sanitized-branch>/` |
| Sanitization | `scenario/wild-sheep-chase` → `scenario-wild-sheep-chase` (lowercase, `/` → `-`, strip unsafe chars) |
| Open a scenario | `…/preview/scenario-wild-sheep-chase/index.html?scenario=wild-sheep-chase` |

**Lifecycle**

- **Deploy:** automatic on push to `scenario/*` (or manual *Deploy scenario preview* workflow).
- **Discover:** preview link appears in the Actions job summary and on open PRs targeting `main`.
- **Index:** active previews are listed in `previews-index.json` at the site root.
- **Cleanup:** deleting a `scenario/*` branch removes its preview folder from the live site.

A scenario can appear in `scenarios-index.json` before its content folder exists on `main` — the branch preview serves the scenario branch’s full tree, so `?scenario=<slug>` works there once `scenarios/<slug>/` exists on that branch.

### Content files (locales)

Each entity uses `{slug}.en.md` and optional `{slug}.ua.md`; indexes list slugs only. See [docs/content-locales.md](../docs/content-locales.md).

Spell references in character sheets use semantic slugs — see [docs/spell-closure.md](../docs/spell-closure.md).

Validate before commit: `scripts\build-sources.cmd --validate-only`

## Checkout a scenario branch

```powershell
git fetch origin
git checkout scenario/wild-sheep-chase
```

## New scenario

Branch from `main`, create `scenarios/<slug>/` with HTML layout (see [AGENTS.md](../AGENTS.md)), push `scenario/<slug>`. Add a row to this table and `scenarios-index.json` on `main` after merge.
