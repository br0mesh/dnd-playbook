# DM Script branches and beats

Branching scenes stay inside the five standard `###` sections ([Summary, Read-aloud, Checks, Contingencies, DM Notes](content-locales.md)). Do **not** add custom top-level `### Branch A` headings.

The DM Script library detects branch markers inside section bodies (usually **Checks**) and renders a tab switcher at the table.

## Read-aloud beats

When **two or more** standalone `**Beat label**` lines appear in **Read-aloud**, the library shows a beat stepper (dots + Prev/Next). Optional future syntax: `#### Beat 1 — Arrival` (prefix `Beat`, not `Branch`).

```markdown
### Read-aloud

**Arrival**

> …quote…

**The name at the bar**

> …quote…

<!-- check: insight-12 -->
```

- Beat labels are **not** `**Option N —**` lines (those stay in Checks under branches).
- Short `**On fail:**` / `**On success:**` snippets and optional `**On fail (read-aloud):**` blockquotes may appear inside a beat body; the library hides them until **Rolled fail** / **Rolled success**. Full option trees, tables, and shared tails stay under `#### Branch A` / `#### Branch B` in Checks.
- Scenes with **one** beat or no beat labels render flat Read-aloud (demo scenes unchanged).
- Read-aloud with markdown **tables** uses the mixed renderer (same as Checks).

### Beat micro-loop (Ask + roll + inline results)

Inside a beat body, after read-aloud prose, optional markers guide the table through ask → roll → outcome without leaving the beat panel:

```markdown
**The name at the bar**

> …read-aloud quote…

**Ask:** What does Vex do when Tomas's eye flicks to your corner?
**Ask (example):** «I stay still and watch his hands.»
<!-- check: insight-12 -->
**On fail:** Short panic beat — chest says *run*; Tomas's hand goes to his belt.
**On success:** You read the pause: frightened, not hunting. You have a beat to act.
**On fail (read-aloud):**
> The name hangs in the air like a noose…
**On success (read-aloud):**
> You let the silence sit one heartbeat longer…
```

| Marker | EN | UA |
|--------|----|----|
| Ask | `**Ask:**` | `**Запитай:**` |
| Ask example | `**Ask (example):**` | `**Приклад відповіді:**` |
| On fail | `**On fail:**` | `**При провалі:**` |
| On success | `**On success:**` | `**При успіху:**` |
| On fail read-aloud | `**On fail (read-aloud):**` | `**При провалі (зачитай):**` |
| On success read-aloud | `**On success (read-aloud):**` | `**При успіху (зачитай):**` |

- Outcome snippets mirror Branch A/B content — keep them short (1–2 paragraphs or a quote). Checks branches remain the source of truth for options and tables.
- **Rolled fail** / **Rolled success** reveal only the matching inline outcome; they also activate Branch A/B in Checks when present.
- Revealed outcomes persist per beat in `localStorage` (`beatResults` on the scene progress object).

### Check callouts

Wire a beat to its roll with an HTML comment or bold line at the end of the beat:

```markdown
<!-- check: insight-12 -->
```

or

```markdown
**Check:** Insight (DC 12)
```

Slug form `skill-dc` (e.g. `insight-12`) matches the first check heading with that DC before any `#### Branch` line. The beat panel shows **Show check**, **Rolled fail**, and **Rolled success** buttons.

Deep-link beat index: `&beat=1` (0-based).

## Session groups

Optional `dmScriptSessions` in `scenarios/<slug>/manifest.json` groups sidebar scenes. The flat `dm-script-index.json` array is unchanged.

```json
"dmScriptSessions": [
  {
    "id": 1,
    "label": { "en": "Session 1 — Briarford", "ua": "Сесія 1 — Терновбрід" },
    "scenes": ["00_session_framing", "01_intro_vex"]
  }
]
```

- Sidebar: collapse groups, filter **All scenes** / **Current session**.
- Pagination stays global; footer shows session badge when defined.
- URL: `?session=2` sets the active session filter.

## Scene progress

Per-scenario progress in `localStorage` (`dm-script-progress:<scenario>`): scene status (unseen / in progress / done), beat index, branch mirror, per-beat roll outcomes (`beatResults`, e.g. `{ "1": "fail" }`). Branch tab selection remains in `sessionStorage`.

Use **Mark scene done** at the bottom of each scene. Done scenes show ✓ in the sidebar.

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

Accepted prefixes: `Option`, `Варіант`, `Опція`. The line must match the full-line pattern (avoids false positives in Read-aloud beat labels).

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

Optional deep-link: `&scene=01_intro_vex&branch=b&option=3&beat=1`

Branch selection persists in `sessionStorage` per scenario and scene slug. Beat index and scene progress use `localStorage`.

## UI spike

Static mock comparing beat stepper vs section tabs: `Shared/DmScript/spike/run-mode-mock.html`

## Simple scenes

Scenes without branch markers (for example `test-adventure` hook) render exactly as before.
