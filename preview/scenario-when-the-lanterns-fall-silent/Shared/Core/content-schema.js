(function (global) {
  "use strict";

  global.DnDCore = global.DnDCore || {};
  global.DnDCore.contentSchema = {
    MONSTER: {
      statBlock: ["Stat Block", "Статблок"],
      traits: ["Traits", "Риси"],
      actions: ["Actions", "Дії"],
      dmNotes: ["DM Notes", "Нотатки Майстра"],
      tactics: ["Quick Tactics", "Тактика"],
      mainStats: ["Main Stats", "Основні характеристики"],
    },
    SPELL: {
      header: ["Header"],
      casting: ["Casting", "Накладання"],
      description: ["Description", "Опис"],
      atHigherLevels: ["At Higher Levels", "На вищих рівнях"],
    },
    ITEM: {
      header: ["Header"],
      properties: ["Properties", "Властивості"],
      description: ["Description", "Опис"],
      /** DMG Ch.7 — slug tail: {name}_{rarity}_{type}; rarity may be two segments (very_rare) */
      rarities: ["common", "uncommon", "rare", "very_rare", "legendary", "artifact"],
      types: ["armor", "potion", "ring", "rod", "scroll", "staff", "wand", "weapon", "wondrous"],
      ui: {
        attunement: ["Attunement", "Узгодження"],
        all: ["All", "Усі"],
        heldBy: ["Held by", "У володінні"],
        filterRarity: ["Filter by rarity", "За рідкістю"],
        filterType: ["Filter by type", "За типом"],
        title: ["Items Stash", "Сховище предметів"],
        searchPlaceholder: ["Search items…", "Пошук предметів…"],
        empty: ["No items match", "Немає відповідних предметів"],
        loadError: ["Failed to load items", "Не вдалося завантажити предмети"],
      },
    },
    NPC: {
      quickRoleplay: ["Quick Roleplay", "Швидка гра"],
      sampleLines: ["Sample Lines", "Приклади реплік"],
      dmNotes: ["DM Notes", "Нотатки Майстра"],
    },
    CHARACTER: {
      basicInfo: ["Basic Info", "Основна інформація"],
      combat: ["Combat", "Бойові характеристики"],
      resources: ["Class Resources", "Ресурси класу"],
      mainStats: ["Main Stats", "Основні характеристики"],
      spellcasting: ["Spellcasting", "Заклинання"],
      attacks: ["Attacks", "Атаки"],
      skills: ["Good Skills", "Сильні навички", "Навички"],
      abilities: ["Special Abilities", "Особливі здібності"],
      equipment: ["Equipment & Inventory", "Спорядження та інвентар", "Спорядження"],
      ui: {
        ac: ["AC", "КБ"],
        hp: ["HP", "ХП"],
        level: ["lvl", "рів."],
        spellDc: ["Spell save DC", "СЛ заклинань"],
        spellAttack: ["Spell attack", "Атака заклинанням"],
        cantrips: ["Cantrips", "Заговори"],
        preparedSpells: ["Prepared spells", "Підготовлені заклинання"],
        magicItems: ["Magic items", "Чарівні предмети"],
      },
    },
    MAP: {
      mapInfo: ["Map Info", "Інформація про карту"],
      description: ["Description", "Опис"],
      dmNotes: ["DM Notes", "Нотатки Майстра"],
    },
    DM_SCRIPT: {
      summary: ["Summary", "Короткий опис"],
      readAloud: ["Read-aloud", "Зачитай"],
      checks: ["Checks", "Перевірки"],
      contingencies: ["Contingencies", "Запасні варіанти"],
      dmNotes: ["DM Notes", "Нотатки Майстра"],
    },
    DM_SCRIPT_UI: {
      branchSwitcher: ["Scene branch", "Гілка сцени"],
      optionSwitcher: ["Exit option", "Варіант виходу"],
    },
  };
})(typeof window !== "undefined" ? window : this);
