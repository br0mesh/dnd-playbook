# DM Script branches

Branching scenes stay inside the five standard `###` sections ([Summary, Read-aloud, Checks, Contingencies, DM Notes](content-locales.md)). Do **not** add custom top-level `### Branch A` headings.

The DM Script library detects branch markers inside section bodies (usually **Checks**) and renders a tab switcher at the table.

## Branch headings

Use an `h4`-style marker on its own line:

```markdown
#### Branch A — Failed Insight (panic)
…content…

#### Branch B — Success (choose your exit)
…content…
```

Accepted prefixes: `Branch`, `Variant`, `Гілка`, `Варіант`. Letter may be Latin `A`/`B` or Cyrillic `А`/`Б`. Title after an em dash is optional but recommended.

Branch mode activates only when **two or more** branch headings appear in the same section. A single branch heading renders as flat prose (unchanged legacy behavior).

## Option headings (nested under a branch)

For sub-paths within a branch (for example four exits on a success branch), use a standalone bold line:

```markdown
**Option 1 — Bluff**
…
**Option 2 — Slip away**
…
```

Accepted prefixes: `Option`, `Варіант`, `Опція`. The line must match the full-line pattern (avoids false positives like `**Talk outside (success branch, Option 3)**` in Read-aloud).

## Shared tail prose

Content after the last option in a branch that applies to all options (clues, arrival beats, etc.) can follow the final option block. The renderer splits the last option at the first standalone `**Heading**` line that follows prior content.

Example (from the Vex intro):

```markdown
**Option 4 — Rob**
- **Sleight of Hand (DC 13)** — …

**Clues to carry into Briarford (leave with at least two):**
- …

**Arriving in Briarford (all branches):**
…
```

The Insight table and any prose **before** the first `#### Branch` heading always stay visible above the branch switcher (DM-only table columns are never hidden behind tabs).

## Preview

```powershell
preview.cmd
```

Open: `http://localhost:8080/Shared/DmScript/library.html?scenario=when-the-lanterns-fall-silent`

Optional deep-link: `&scene=01_intro_vex&branch=b&option=3`

Branch selection persists in `sessionStorage` per scenario and scene slug.

## Simple scenes

Scenes without branch markers (for example `test-adventure` hook) render exactly as before.
