import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  join,
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
const ADVENTURE = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
);
const KIN_SOURCE = resolve(
  "foundry",
  "content",
  "kin.json",
);
const HEROIC_SOURCE = resolve(
  "foundry",
  "content",
  "heroic-class-abilities.json",
);
const KIN_JOURNAL_SOURCE = resolve(
  "foundry",
  "content",
  "journals",
  "player-options",
  "kin.json",
);
const HEROIC_JOURNAL_SOURCE = resolve(
  "foundry",
  "content",
  "journals",
  "player-options",
  "heroic-class-abilities.json",
);
const SYSTEM_MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-assets-and-journals.js",
);

const LINKS = {
  falling:
    "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
    + "JournalEntryPage.6WPxPxUjh4W80RNy"
    + "#falling]{falling}",
  magicTricks:
    "@UUID[JournalEntry.BHzSGEPaCGVadFsb."
    + "JournalEntryPage.cvFSLoFtdJOQcxtU"
    + "#magic-tricks]{Magic Tricks}",
  hardToCatch:
    "@UUID[Item.GiE0TwixaYnxFT6i]"
    + "{Hard to Catch}",
  rally:
    "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
    + "JournalEntryPage.CJjqkHzpow39ViUi"
    + "#death]{rally}",
  fastHealer:
    "@UUID[Item.SY62xmX9uBVml786]"
    + "{Fast Healer}",
  deathRoll:
    "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
    + "JournalEntryPage.CJjqkHzpow39ViUi"
    + "#death]{Death Roll}",
  pushing:
    "@UUID[JournalEntry.V4R4dCuKSK2mi8RF."
    + "JournalEntryPage.eIQgHhYPUczg7kbZ"
    + "#pushing-your-roll]"
    + "{Pushing your Roll}",
  human:
    "@UUID[JournalEntry.BoAJrnlPlayerOpt."
    + "JournalEntryPage.BoAPgPlayerKin01"
    + "#human]{Human}",
  ghoul:
    "@UUID[Actor.GhoulAct6Kp9T2xP]"
    + "{ghoul}",
  dash:
    "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
    + "JournalEntryPage.KrSXg7HKmfo7xRcI"
    + "#movement]{dash}",
  twinShot:
    "@UUID[Item.J6l8QwCJhBirvg03]"
    + "{Twin Shot}",
  senseMagic:
    "@UUID[Item.RPnxXYVb8z7EG5Wl]"
    + "{Sense Magic}",
  ironFist:
    "@UUID[Item.O7p7ZWnZNgxP8PFw]"
    + "{Iron Fist}",
  sneakAttack:
    "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
    + "JournalEntryPage.KrSXg7HKmfo7xRcI"
    + "#sneak-attack]{sneak attack}",
  poison:
    "@UUID[JournalEntry.SbbSMsuvWeo3HaID."
    + "JournalEntryPage.6WPxPxUjh4W80RNy"
    + "#poison]{poison}",
  powerFromBody:
    "@UUID[JournalEntry.BHzSGEPaCGVadFsb."
    + "JournalEntryPage.C0stUmhj95JFgL4f"
    + "#power-level]{Power from the Body}",
  dualWield:
    "@UUID[Item.JrQqkQrSOFJzR7H9]"
    + "{Dual Wield}",
};

const SOURCE_LINKS = new Map([
  [
    LINKS.falling,
    "@Ref[dragonbane-core:rule.falling]{falling}",
  ],
  [
    LINKS.magicTricks,
    "@Ref[dragonbane-core:rule.magic-tricks]{Magic Tricks}",
  ],
  [
    LINKS.hardToCatch,
    "@Ref[dragonbane-core:kin-ability.hard-to-catch]{Hard to Catch}",
  ],
  [
    LINKS.rally,
    "@Ref[dragonbane-core:rule.death]{rally}",
  ],
  [
    LINKS.fastHealer,
    "@Ref[dragonbane-core:kin-ability.fast-healer]{Fast Healer}",
  ],
  [
    LINKS.deathRoll,
    "@Ref[dragonbane-core:rule.death]{Death Roll}",
  ],
  [
    LINKS.pushing,
    "@Ref[dragonbane-core:rule.pushing-your-roll]{Pushing your Roll}",
  ],
  [
    LINKS.dash,
    "@Ref[dragonbane-core:rule.dash]{dash}",
  ],
  [
    LINKS.twinShot,
    "@Ref[dragonbane-core:heroic-ability.twin-shot]{Twin Shot}",
  ],
  [
    LINKS.senseMagic,
    "@Ref[dragonbane-core:spell.sense-magic]{Sense Magic}",
  ],
  [
    LINKS.ironFist,
    "@Ref[dragonbane-core:heroic-ability.iron-fist]{Iron Fist}",
  ],
  [
    LINKS.sneakAttack,
    "@Ref[dragonbane-core:rule.sneak-attack]{sneak attack}",
  ],
  [
    LINKS.poison,
    "@Ref[dragonbane-core:journal-page.combat-damage.poison]{poison}",
  ],
  [
    LINKS.powerFromBody,
    "@Ref[dragonbane-core:rule.power-from-the-body]{Power from the Body}",
  ],
  [
    LINKS.dualWield,
    "@Ref[dragonbane-core:heroic-ability.dual-wield]{Dual Wield}",
  ],
]);

function sourceReference(link) {
  return SOURCE_LINKS.get(link) ?? link;
}
const KIN_SPECS = [
  ["draconic-wings-falling", LINKS.falling],
  ["arcane-affinity", LINKS.magicTricks],
  ["escape-artist", LINKS.hardToCatch],
  ["relentless", LINKS.rally],
  ["regeneration", LINKS.fastHealer],
  ["touch-of-the-grave", LINKS.deathRoll],
  ["luck", LINKS.pushing],
  ["two-forms", LINKS.human],
];

const HEROIC_SPECS = [
  [
    "death-knight",
    "summon-ghoul",
    LINKS.ghoul,
  ],
  ["evoker", "tailwind", LINKS.dash],
  ["hunter", "aimed-shot", LINKS.twinShot],
  [
    "mage",
    "mages-brilliance",
    LINKS.senseMagic,
  ],
  [
    "monk",
    "monks-serenity",
    LINKS.ironFist,
  ],
  [
    "rogue",
    "roguish-cunning",
    LINKS.sneakAttack,
  ],
  [
    "rogue",
    "envenom-weapons",
    LINKS.poison,
  ],
  [
    "warlock",
    "warlocks-ambition",
    LINKS.powerFromBody,
  ],
  [
    "warrior",
    "warriors-rage",
    LINKS.dualWield,
  ],
];

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function filesBelow(directory) {
  const result = [];

  function visit(current) {
    for (
      const entry
      of readdirSync(current).sort()
    ) {
      const path = join(current, entry);
      const stats = statSync(path);

      if (stats.isDirectory()) {
        visit(path);
      } else if (
        stats.isFile()
        && path.endsWith(".json")
      ) {
        result.push(path);
      }
    }
  }

  visit(directory);
  return result;
}

const DOCUMENTS = filesBelow(ADVENTURE)
  .filter(
    path => !path.endsWith("_Folder.json"),
  )
  .map(readJson);

function contentKey(document) {
  return document.flags?.[MODULE_ID]?.contentKey;
}

function generatedDocument(key) {
  const matches = DOCUMENTS.filter(
    document => contentKey(document) === key,
  );

  expect(matches).toHaveLength(1);
  return matches[0];
}

function abilityText(ability) {
  if (
    typeof ability.descriptionHtml === "string"
  ) {
    return ability.descriptionHtml;
  }

  return (ability.description ?? []).join("\n");
}

function kinAbility(source, key) {
  const matches = source.kin.flatMap(
    kin => kin.abilities ?? [],
  ).filter(
    ability => ability.key === key,
  );

  expect(matches).toHaveLength(1);
  return matches[0];
}

function heroicAbility(
  source,
  classKey,
  abilityKey,
) {
  const classEntry = source.classes.find(
    entry => entry.key === classKey,
  );
  expect(classEntry).toBeDefined();

  const matches = classEntry.abilities.filter(
    ability => ability.key === abilityKey,
  );
  expect(matches).toHaveLength(1);
  return matches[0];
}

function occurrences(value, marker) {
  return String(value).split(marker).length - 1;
}

function generatedPage(key) {
  const journal = generatedDocument(
    "journal.player-options",
  );
  const matches = journal.pages.filter(
    page => contentKey(page) === key,
  );

  expect(matches).toHaveLength(1);
  return matches[0];
}

describe("Ability rule-reference links", () => {
  test("publishes every Kin link in source, Item, and Journal", () => {
    const source = readJson(KIN_SOURCE);
    const journalSource =
      readJson(KIN_JOURNAL_SOURCE)
        .source.content;
    const generatedJournal =
      generatedPage(
        "journal-page.player-options.kin",
      ).text.content;

    for (const [key, link] of KIN_SPECS) {
      const sourceText = abilityText(
        kinAbility(source, key),
      );
      const item = generatedDocument(
        `ability.${key}`,
      );

      expect(
        occurrences(
          sourceText,
          sourceReference(link),
        ),
      ).toBe(1);
      expect(
        occurrences(
          item.system.itemDescription,
          link,
        ),
      ).toBe(1);
      expect(
        occurrences(
          journalSource,
          sourceReference(link),
        ),
      ).toBe(1);
      expect(
        occurrences(generatedJournal, link),
      ).toBe(1);
    }
  });

  test("publishes every class link in source, Item, and Journal", () => {
    const source = readJson(HEROIC_SOURCE);
    const journalSource =
      readJson(HEROIC_JOURNAL_SOURCE)
        .source.content;
    const generatedJournal =
      generatedPage(
        "journal-page.player-options."
        + "heroic-class-abilities",
      ).text.content;

    for (
      const [classKey, abilityKey, link]
      of HEROIC_SPECS
    ) {
      const sourceText = abilityText(
        heroicAbility(
          source,
          classKey,
          abilityKey,
        ),
      );
      const item = generatedDocument(
        "heroic-class-ability."
        + `${classKey}.${abilityKey}`,
      );

      expect(
        occurrences(
          sourceText,
          sourceReference(link),
        ),
      ).toBe(1);
      expect(
        occurrences(
          item.system.itemDescription,
          link,
        ),
      ).toBe(1);
      expect(
        occurrences(
          journalSource,
          sourceReference(link),
        ),
      ).toBe(1);
      expect(
        occurrences(generatedJournal, link),
      ).toBe(1);
    }
  });

  test("targets the existing Ghoul Actor and Human section", () => {
    const ghoul = DOCUMENTS.find(
      document =>
        document._id === "GhoulAct6Kp9T2xP",
    );
    expect(ghoul).toBeDefined();
    expect(ghoul.name).toBe("Ghoul");
    expect(ghoul.type).toBe("monster");

    const kinSource =
      readJson(KIN_JOURNAL_SOURCE)
        .source.content;
    expect(kinSource).toContain(
      "<h2>Human</h2>",
    );
    expect(LINKS.human).toContain(
      "#human]{Human}",
    );
  });

  test("uses an inline D3 roll and removes the stale demon appendix text", () => {
    const source = readJson(HEROIC_SOURCE);
    const journalSource =
      readJson(HEROIC_JOURNAL_SOURCE)
        .source.content;
    const generatedJournal =
      generatedPage(
        "journal-page.player-options."
        + "heroic-class-abilities",
      ).text.content;

    const souls = abilityText(
      heroicAbility(
        source,
        "warlock",
        "souls-collector",
      ),
    );
    const soulsItem = generatedDocument(
      "heroic-class-ability."
      + "warlock.souls-collector",
    );

    for (const value of [
      souls,
      soulsItem.system.itemDescription,
      journalSource,
      generatedJournal,
    ]) {
      expect(value).toContain(
        "recover [[/roll D3]] WP",
      );
      expect(value).not.toContain(
        "recover D3 WP",
      );
    }

    const demonologist = abilityText(
      heroicAbility(
        source,
        "warlock",
        "demonologist",
      ),
    );
    const demonologistItem =
      generatedDocument(
        "heroic-class-ability."
        + "warlock.demonologist",
      );

    for (const value of [
      demonologist,
      demonologistItem.system.itemDescription,
      journalSource,
      generatedJournal,
    ]) {
      expect(value).not.toContain(
        "Appendix B in this book",
      );
    }

    expect(demonologist).toContain(
      "summon a demon into an empty space",
    );
    expect(demonologist).not.toMatch(
      /summon an? @(?:UUID|Ref)\[[^\]]+\]/
    );
  });

  test("extends Foundry runtime verification", () => {
    const macro = read(SYSTEM_MACRO);

    for (const marker of [
      "Ability and Journal rule links are present",
      "Ghoul rule link targets the imported Actor",
      "Souls Collector uses an inline D3 roll",
      "Demonologist no longer references a missing appendix",
    ]) {
      expect(macro).toContain(marker);
    }

    expect(
      macro.match(
        /const classesHtml\s*=/g,
      ) ?? [],
    ).toHaveLength(1);
  });
});
