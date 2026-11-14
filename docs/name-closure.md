# Name closure

Every invented proper noun in Ukrainian scenario content must have a canonical entry in that scenario's names registry (`scenarios/<slug>/names/`).

## Rule

For each scenario under `scenarios/<scenario-slug>/` that ships `.ua.md` play content:

> **Name closure:** If an English proper noun appears in `names/names-index.json`, the corresponding `.ua.md` file MUST use the registered Ukrainian form (with correct declension). English forms are not allowed in `.ua.md` when a registry entry exists.

Unlike spell and item closure, names stay **human-readable in prose** — do not insert slugs into dm-script or character text.

## Registry format

`scenarios/<slug>/names/names-index.json` is a JSON **array of objects**:

```json
{
  "slug": "briarford",
  "type": "settlement",
  "en": "Briarford",
  "ua": "Терновбрід",
  "declension_ua": {
    "nominative": "Терновбрід",
    "genitive": "Терновброду",
    "dative": "Терновброду",
    "accusative": "Терновбрід",
    "instrumental": "Терновбродом",
    "locative": "Терновброді"
  },
  "aliases_en": ["Briarford's"]
}
```

| Field | Purpose |
|-------|---------|
| `slug` | Stable key for tooling (not used in prose) |
| `type` | `settlement`, `tavern`, `npc`, `organization`, etc. |
| `en` | Canonical English form |
| `ua` | Default Ukrainian nominative (or full title for NPCs) |
| `declension_ua` | Optional case forms for settlements and similar |
| `aliases_en` | Extra English strings to flag in `.ua.md` (longest match first) |

There are no `{slug}.en.md` files for names. Do **not** add `names-index.json` to the generic index validator's slug list.

## Scan scope

The validator scans indexed `.ua.md` files (slugs from each folder's `*-index.json`):

| Folder | What is checked |
|--------|-----------------|
| `dm-script/` | All prose — primary location for invented place and tavern names |
| `characters/` | `.ua.md` body when present |
| `monsters/`, `npc/` | `.ua.md` body when present |

Only scenarios with `names/names-index.json` are validated.

## Translation policy

| Category | Policy |
|----------|--------|
| Invented locations, taverns, regions | Translate or transliterate per registry; `.ua.md` never uses the English form when an entry exists |
| NPC personal names | Transliterate (Алден, Томас, Корвін) unless the registry specifies otherwise |
| PC names | Match the character `.ua.md` H1 and `**Ім'я персонажа:**` (e.g. Мордейн, Гаррі Поттер). Secret real names (e.g. **Векс** for the rogue's public **Гаррі Поттер** sheet) belong in the registry with declension |
| D&D mechanics, class features, spell slugs | Not name closure (use spell/item closure instead) |

Tavern and shop **sign names** use Ukrainian guillemets when cited as names: у «Останньому ліхтарі», покидає «Останній ліхтар».

## Out of scope

Do **not** require registry entries for:

- Generic D&D terms (Божественне чуття, Lay on Hands in DM meta-notes)
- Spell slugs (`fire_bolt_cantrip_evocation`) — spell closure
- Item slugs — item closure
- English proper nouns not yet added to the registry (add the entry before or with the UA mention)

## Validate

```powershell
# Full pipeline (index + spell + item + name closure)
scripts\build-sources.cmd --validate-only

# Debug one scenario
node scripts/scan-name-refs.js when-the-lanterns-fall-silent
```

**Validate** fails with a per-scenario report:

```
scenario: when-the-lanterns-fall-silent
EN NAME IN UA: "Briarford" in dm-script/01_intro_vex.ua.md:7 — use Терновбрід (see declension_ua: nominative Терновбрід)
```

v1 does **not** auto-replace — declension is context-sensitive; authors fix matches manually.

## Author workflow

1. Add or edit invented names in `names/names-index.json` first (or in the same change).
2. Write `.ua.md` using the Ukrainian form with correct case (до Терновброду, у Терновброді, …).
3. Run `scripts\build-sources.cmd --validate-only` before commit.

## Future (optional)

- `Shared/Names/demo/names-index.json` for cross-scenario reuse
- Names browser page (like spell library) for DM lookup
