# Agent instructions — dnd-playbook

Guidance for AI agents editing this repository.

## Spell references in play content

When you add or edit spells in scenario content (`scenarios/<slug>/`), **never leave a bare spell name** (for example *Thaumaturgy* in italics or prose) unless it is also wired into the scenario spell book.

### After adding or changing spell mentions

1. **Search** the change for spell-like text: cantrip/spell names in character `**Cantrips:**` / `**Prepared spells:**`, Attacks rows, racial traits, items, monsters, dm-script.
2. **Prefer an existing slug** from `Shared/Spells/demo/spells-index.json` when the spell already exists (same name, level, and school).
3. **If no demo spell exists**, add `{name}_{level}_{school}` under `Shared/Spells/demo/` (`.en.md` + `.ua.md`), update `Shared/Spells/demo/spells-index.json`, and add stub metadata to `scripts/spell-stub-meta.js` when sync needs it.
4. **Sync into the scenario** spell book:
   ```powershell
   scripts\build-sources.cmd --sync-spells
   ```
5. **Author character sheets** using comma-separated **slugs** in spell lists (not display names). Example: `thaumaturgy_cantrip_transmutation`, not `Thaumaturgy`.
6. **Validate before finishing**:
   ```powershell
   scripts\build-sources.cmd --validate-only
   ```

### Character sheet pattern

- Racial or innate spells belong in `### Spellcasting` under `**Cantrips:**` or `**Prepared spells:**` with slugs.
- Class features that grant a spell should reference the slug in `### Special Abilities` (the character library links slugs and spell names to the spell book).
- Spell attacks use the slug in the Attacks table `Attack` column when applicable.

### Do not treat as spell-book entries

Equipment "spellbook", "spell slots", class features that are not spells (Arcane Recovery), and AC notes like "mage armor" unless the spell is explicitly listed.

See [docs/spell-closure.md](docs/spell-closure.md) and [.cursor/rules/spell-closure.mdc](.cursor/rules/spell-closure.mdc).

## Proper names in Ukrainian content

When you add or edit `.ua.md` scenario content (`scenarios/<slug>/`), **do not leave English invented proper nouns** (places, taverns, organizations) when a registry entry exists.

### After adding or changing proper names

1. **Search** recent edits for English place/tavern/NPC names in `*.ua.md` files.
2. **Add or update** the entry in `scenarios/<slug>/names/names-index.json` (`en`, `ua`, optional `declension_ua`, `aliases_en`).
3. **Author** with the Ukrainian form and correct case in prose (no slugs in dm-script).
4. **Align PC names** with character `.ua.md` H1 / `**Ім'я персонажа:**`.
5. **Validate before finishing**:
   ```powershell
   scripts\build-sources.cmd --validate-only
   ```

See [docs/name-closure.md](docs/name-closure.md) and [.cursor/rules/name-closure.mdc](.cursor/rules/name-closure.mdc).
