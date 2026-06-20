# Access gate (DM content password)

Client-side password gate for **spoiler deterrence** on static GitHub Pages. It hides DM-facing sections in the UI until the correct password is entered; it does **not** make files private.

## Protected sections

When `?scenario=<slug>` is set (and the slug is not `demo`), these sections require unlock:

- DM Script
- Monsters
- NPC
- Maps

**Not gated:** demo content (no scenario param), Characters, Spells, Items.

Unlock persists for the browser tab session (`sessionStorage`). Closing the tab clears it.

## Threat model

| What the gate does | What it does **not** do |
|--------------------|-------------------------|
| Blocks the library UI from loading scenario content | Block direct URLs to `.md`, `.json`, or map images |
| Keeps casual players from browsing DM sections via the app | Resist offline brute force on the password hash in git |
| Uses SHA-256 hash comparison in the browser | Replace server-side authentication |

Anyone who knows a file path can still `fetch()` or open raw assets. For real secrecy, use private hosting or build-time encryption (future work).

## Configuration

Edit [`Shared/Core/access-config.json`](../Shared/Core/access-config.json):

```json
{
  "enabled": true,
  "passwordHash": "<sha256-hex-lowercase>"
}
```

- Set `"enabled": false` to disable the gate (useful for local development).
- Store **only the hash** in git, never the plain password.

### Set or change the password

From the repo root:

```powershell
node scripts/hash-access-password.js "your-new-password"
```

Copy the printed hex into `passwordHash` in `access-config.json`.

Default password shipped for initial setup: **`dndbook`** — change this before sharing the site with players.

## Implementation

| File | Role |
|------|------|
| [`Shared/Core/access-gate.js`](../Shared/Core/access-gate.js) | Gate logic, password form, session flag |
| [`Shared/Core/access-config.json`](../Shared/Core/access-config.json) | Global enable flag + password hash |
| [`scripts/hash-access-password.js`](../scripts/hash-access-password.js) | CLI helper to generate hash |

Protected libraries call `await DnDCore.accessGate.ensureUnlocked(sectionId, scenarioSlug, uiEl)` before `loader.loadData()`.

Unlock is **global for the browser tab** — entering the password on one protected section (e.g. Maps) also unlocks DM Script, Monsters, and NPC until the tab is closed.

The gate only applies when the URL includes `?scenario=<slug>`. Opening `Shared/DmScript/library.html` without a scenario loads demo content with no password.

The hub ([`index.html`](../index.html)) shows a lock icon on protected section links when a scenario is selected (hint only; enforcement is on the library page).

## Manual test checklist

1. Open `Shared/DmScript/library.html?scenario=when-the-lanterns-fall-silent` — password form appears.
2. Wrong password shows an error; correct password loads content.
3. Repeat for Monsters, NPC, Maps.
4. Open the same sections without `?scenario=` — demo loads, no gate.
5. Open Characters with the same scenario — no gate.
6. Close tab, reopen a protected section — gate appears again.
7. Confirm a direct URL to a scenario `.md` file still returns content (expected limitation).
