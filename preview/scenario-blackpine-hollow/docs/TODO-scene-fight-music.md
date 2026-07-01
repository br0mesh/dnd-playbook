# TODO: Scene & fight music

Status: **not started**  
Priority: **medium** (DM UX enhancement; no blocker for current content)  
Related: `Shared/DmScript/dm-script-library.js`, `Shared/Monsters/monster-library.js`, `scenarios/<slug>/manifest.json`, [content-locales.md](./content-locales.md)

---

## Goal

Let the DM play **ambient or combat music** tied to:

1. **DM script scenes** (e.g. tavern hook → calm tavern loop)
2. **Fights / encounters** (e.g. mill yard wolves → combat track)

Music should start when the DM opens or navigates to the linked moment, with manual override (play/pause, volume, optional loop).

---

## Current state (investigation)

### What exists

- **DM Script** is paginated scene-by-scene (`dm-script-library.js`); best anchor for scene music.
- **Monsters** markdown includes `### Encounter Reference` (`Default quantity`, `Wave`, CR) but the library **does not parse** that section — only stat block, tactics, actions, DM notes.
- **NPCs** have `### Scene Reference` (`Appears in:`) as **free text**; not machine-linkable.
- **Cross-links are prose**: e.g. Scene 2 DM Notes say "Use monster sheets from Monsters section"; maps mention encounters in description text.
- **No audio files or player code** in the repo.
- **HTTP preview** already required (`preview.cmd`) — suitable for serving audio assets.

### Gaps

| Gap | Impact |
|-----|--------|
| No content field for `audio` / `music` | Nothing to author against |
| No encounter slug / index | Fight music cannot reliably follow scene → encounter |
| No shared `Audio` module | Duplication risk across libraries |
| Browser autoplay policy | Need explicit DM control, not auto-start on page load |
| No asset convention | Authors don't know where to put tracks |

---

## Design decisions (resolve before implementation)

- [ ] **Track reference format** — relative path (`audio/tavern_ambient.ogg`), slug in index (`tavern_ambient` → file), or external URL?
- [ ] **Audio formats** — standardize on OGG + MP3 fallback, or MP3-only for simplicity?
- [ ] **Scope of auto-play** — scene change only in DM Script, or also when opening a monster with a given `Wave` / encounter slug?
- [ ] **Player placement** — global bar in `book-header` (all DM sections) vs DM Script footer only for v1?
- [ ] **Encounter model** — extend monster `Encounter Reference`, new `encounters/encounters-index.json`, or scene-frontmatter in dm-script markdown?
- [ ] **Licensing** — repo-shipped vs DM-provided local files; document in scenario README.

**Recommendation for v1:** scene music via dm-script metadata + a small shared player in book chrome; fight music via optional `encounter` slug on scenes and a simple `audio-index.json` at scenario root.

---

## Proposed fix (phased)

### Phase 1 — Content model & assets (low risk)

**Goal:** Authors can declare tracks without player code yet.

- [ ] Add scenario folder convention: `scenarios/<slug>/audio/` (or `media/audio/`).
- [ ] Add `scenarios/<slug>/audio/audio-index.json`:

  ```json
  {
    "tavern_ambient": { "file": "tavern_ambient.ogg", "label": "Tavern — rain & fire", "loop": true },
    "mill_combat": { "file": "mill_combat.ogg", "label": "Mill yard fight", "loop": true }
  }
  ```

- [ ] Extend DM script markdown (EN file is source of truth) with optional block, e.g.:

  ```markdown
  ### Music

  **Ambient:** tavern_ambient
  **Combat:** mill_combat
  ```

  Or YAML-style frontmatter if preferred — pick one and document.

- [ ] Add `music` / `ambient` / `combat` keys to `content-schema.js` → `DM_SCRIPT`.
- [ ] Update `parseScene()` in `dm-script-library.js` to read music slugs (no playback yet).
- [ ] Document authoring in `docs/content-locales.md` (or new `docs/scene-music.md`).
- [ ] Add demo entries: `Shared/DmScript/demo/01_hook` → placeholder silent/short sample or stub index entry.

**Acceptance:** Parser returns `ambientTrack` / `combatTrack` slugs; validate script resolves slugs against `audio-index.json`.

---

### Phase 2 — Core audio player (medium effort)

**Goal:** Reusable player for any library page.

- [ ] Add `Shared/Core/audio-player.js`:
  - Load track by slug from scenario `audio-index.json` (resolve base URL from `library-shell` scenario path).
  - API sketch: `play(slug)`, `pause()`, `stop()`, `setVolume(0–1)`, `onEnded`, `currentSlug`.
  - Handle missing files gracefully (console + unobtrusive UI message).
  - Respect user gesture: first play requires button click.
- [ ] Add minimal UI component (play/pause, volume slider, track label) — CSS in `Shared/Styles/book.css` or `audio-player.css`.
- [ ] Persist volume in `sessionStorage` (optional).

**Acceptance:** Manual test on DM Script page — click play, hear track, pause works, refresh keeps volume.

---

### Phase 3 — DM Script integration (medium effort)

**Goal:** Music follows scene navigation.

- [ ] On `renderPage()` / scene change in `dm-script-library.js`:
  - If scene has `ambient` slug and DM enabled music → crossfade or switch track.
  - Optional: "Combat" button to swap ambient → combat track for same scene.
- [ ] Add footer or header controls to `Shared/DmScript/library.html`.
- [ ] Toggle: "Auto music on scene change" (default off until first user play).
- [ ] Stop previous scene's track when advancing prev/next.

**Acceptance:** Demo Scene 1 plays tavern ambient; Scene 2 plays different track or combat on button press.

---

### Phase 4 — Fight / encounter linking (higher effort)

**Goal:** Combat music not only per-scene but per encounter definition.

- [ ] **Option A (lighter):** Parse `### Encounter Reference` in monsters; add optional `**Music:** mill_combat` bold field; monster library shows "Play fight music" when DM mode.
- [ ] **Option B (richer):** New `encounters/encounters-index.json`:

  ```json
  {
    "mill_wolves": {
      "label": "Mill yard wolves",
      "music": "mill_combat",
      "monsters": ["01_goblin_monster"],
      "defaultQuantity": 2
    }
  }
  ```

  DM script scene links `**Combat:** mill_wolves` → resolves music + monster list.

- [ ] Align `Wave` / `Appears in` text with encounter slugs over time (migration note for existing scenarios).
- [ ] Optional: deep link from dm-script to Monsters section with `?index=<slug>`.

**Acceptance:** Opening encounter from scene (or monster sheet) plays the same combat track; one source of truth per fight.

---

### Phase 5 — Polish & edge cases

- [ ] Fade in/out on scene change (avoid hard cuts).
- [ ] Preload next scene's track (optional, bandwidth-aware).
- [ ] Keyboard shortcut (e.g. M = mute) in DM Script only.
- [ ] `build-sources.cmd --validate-only` — warn on unknown music slugs in dm-script / encounters.
- [ ] Player mode: no music UI (DM-only sections already gated where applicable).

---

## Out of scope (for this TODO)

- Spotify / YouTube embeds (licensing, offline play).
- Syncing music to initiative tracker or round boundaries.
- Player-facing audio (this is DM tooling).
- Generating music in-app.

---

## Suggested order of work

1. **Phase 1** — content model and demo stubs; no runtime player yet.
2. **Phase 2** — shared audio player; manual play from DM Script.
3. **Phase 3** — auto-switch on scene navigation.
4. **Phase 4** — encounter linking when fight-specific music is needed.
5. **Phase 5** — polish and validation.

---

## Files likely touched

| Phase | Files |
|-------|-------|
| 1 | `content-schema.js`, `dm-script-library.js`, scenario `audio/`, `audio-index.json`, docs |
| 2 | new `Shared/Core/audio-player.js`, `book.css`, `library-shell.js` (URL resolve) |
| 3 | `DmScript/library.html`, `dm-script-library.js` |
| 4 | `monster-library.js`, optional `encounters/`, `manifest.json`, build validation |
| 5 | `scripts/build-sources.cmd`, styles |

---

## Testing checklist

- [ ] `preview.cmd` → DM Script with `?scenario=test-adventure`
- [ ] Scene prev/next switches tracks when auto-music enabled
- [ ] Combat button / encounter link plays fight track
- [ ] Missing slug shows clear error, does not break page
- [ ] First play requires click (no autoplay violation in console)
- [ ] Volume persists for session
- [ ] Player view / non-DM pages unchanged
