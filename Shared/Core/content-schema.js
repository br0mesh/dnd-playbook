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
    },
    NPC: {
      quickRoleplay: ["Quick Roleplay", "Швидка гра"],
      sampleLines: ["Sample Lines", "Приклади реплік"],
      dmNotes: ["DM Notes", "Нотатки Майстра"],
    },
    CHARACTER: {
      basicInfo: ["Basic Info", "Основна інформація"],
      combat: ["Combat", "Бойові характеристики"],
      mainStats: ["Main Stats", "Основні характеристики"],
      attacks: ["Attacks", "Атаки"],
      skills: ["Good Skills", "Навички"],
      abilities: ["Special Abilities", "Особливі здібності"],
      equipment: ["Equipment & Inventory", "Спорядження"],
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
  };
})(typeof window !== "undefined" ? window : this);
