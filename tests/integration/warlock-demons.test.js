import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  dirname,
  relative,
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
const GENERATOR_NAME = "tools/generate-summoned-monsters.py";
const CONTENT_SOURCE = resolve(
  "foundry",
  "content",
  "summoned-monsters.json",
);
const ADVENTURE_SOURCE = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "_Adventure.json",
);
const ADVENTURE_DIRECTORY = dirname(ADVENTURE_SOURCE);
const ID_PATTERN = /^[A-Za-z0-9]{16}$/;

const EXPECTED = Object.freeze({
  felhunter: {
    name: "Felhunter",
    movement: 14,
    hitPoints: 10,
    armor: 2,
    trait: "Magic Resistance",
    attackName: "Mana Bite",
    attackKey: "mana-bite",
    attackText: [
      "[[/damage D10]]",
      "slashing damage",
      "damage-dealing spell",
      "gets a boon",
    ],
  },
  imp: {
    name: "Imp",
    movement: 10,
    hitPoints: 6,
    armor: 0,
    trait: "Phase Shift",
    attackName: "Firebolt",
    attackKey: "firebolt",
    attackText: [
      "within 20 meters",
      "parried with a shield",
      "[[/damage 2D4]]",
    ],
  },
  sayaad: {
    name: "Sayaad",
    movement: 10,
    hitPoints: 10,
    armor: 1,
    trait: "Seductive",
    attackName: "Soothing Kiss",
    attackKey: "soothing-kiss",
    attackText: [
      "non-monster creature",
      "within 6 meters",
      "loses its next action",
    ],
  },
  voidwalker: {
    name: "Voidwalker",
    movement: 8,
    hitPoints: 16,
    armor: 6,
    trait: "Suffering",
    attackName: "Torment",
    attackKey: "torment",
    attackText: [
      "[[/damage D6]]",
      "bane when attacking any other creature",
      "warlock's turn in the next round",
    ],
  },
});

function requireJson(path) {
  expect(existsSync(path)).toBe(true);
  return JSON.parse(readFileSync(path, "utf-8"));
}

function walkJsonFiles(root) {
  if (!existsSync(root)) return [];

  const files = [];
  for (const entry of readdirSync(root, {
    withFileTypes: true,
  })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsonFiles(path));
    } else if (
      entry.isFile()
      && entry.name.endsWith(".json")
    ) {
      files.push(path);
    }
  }
  return files.sort();
}

function documentEntries() {
  return walkJsonFiles(ADVENTURE_DIRECTORY).map(path => ({
    document: JSON.parse(readFileSync(path, "utf-8")),
    path,
  }));
}

function moduleFlags(document) {
  return document?.flags?.[MODULE_ID] ?? {};
}

function entryByContentKey(contentKey) {
  return documentEntries().find(
    ({ document }) =>
      moduleFlags(document).contentKey === contentKey,
  );
}

function adventurePath(entry) {
  return relative(ADVENTURE_DIRECTORY, entry.path)
    .replaceAll("\\", "/");
}

describe("Warlock demon source contract", () => {
  test("defines all four demons with deterministic IDs", () => {
    const source = requireJson(CONTENT_SOURCE);
    const demons = source.monsters.filter(
      monster => monster.category === "demons",
    );

    expect(source.schemaVersion).toBe(1);
    expect(source.expectedCount).toBe(5);
    expect(source.actorFolders.demons).toMatchObject({
      id: "ZIY5EouNXixTTKSe",
      name: "Demons",
      color: null,
      sort: 400000,
    });
    expect(demons.map(monster => monster.key)).toEqual(
      Object.keys(EXPECTED),
    );

    const ids = [
      source.actorFolders.demons.id,
      ...demons.flatMap(monster => [
        monster.id,
        monster.attackTable.id,
        ...monster.attackTable.results.map(
          result => result.id,
        ),
      ]),
    ];

    for (const id of ids) {
      expect(id).toMatch(ID_PATTERN);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each(Object.entries(EXPECTED))(
    "defines %s from the Appendix B stat block",
    (key, expected) => {
      const source = requireJson(CONTENT_SOURCE);
      const monster = source.monsters.find(
        candidate => candidate.key === key,
      );

      expect(monster).toMatchObject({
        key,
        name: expected.name,
        category: "demons",
        summonType: "warlock-demon",
        image: "icons/svg/mystery-man.svg",
        tokenImage: "icons/svg/mystery-man.svg",
        movement: expected.movement,
        hitPoints: expected.hitPoints,
        armor: expected.armor,
        ferocity: 1,
        size: "normal",
        tokenWidth: 1,
        tokenHeight: 1,
        tokenDisposition: 1,
        monsterControl: {
          schemaVersion: 1,
          key,
          attackSelection: {
            mode: "system-default",
          },
        },
        attackTable: {
          name: `Monster Attacks – ${expected.name}`,
          formula: "1",
        },
      });

      expect(monster.traitsHtml).toContain(
        expected.trait,
      );
      expect(monster.attackTable.results).toHaveLength(1);

      const result = monster.attackTable.results[0];
      expect(result).toMatchObject({
        range: [1, 1],
        weight: 1,
        name: expected.attackName,
        monsterAttack: {
          schemaVersion: 1,
          key: expected.attackKey,
        },
      });
      expect(
        result.monsterAttack.resourceCost,
      ).toBeUndefined();

      for (const snippet of expected.attackText) {
        expect(result.description).toContain(snippet);
      }
    },
  );
});

describe("Generated Warlock demon content", () => {
  test("creates the Demons Actor folder", () => {
    const source = requireJson(CONTENT_SOURCE);
    const entry = entryByContentKey(
      "actors.folder.demons",
    );

    expect(entry).toBeDefined();
    expect(entry.document).toMatchObject({
      type: "Actor",
      _id: source.actorFolders.demons.id,
      folder: source.actorRoot.id,
      name: "Demons",
      color: null,
    });
  });

  test.each(Object.entries(EXPECTED))(
    "generates %s as a core-style monster Actor",
    (key, expected) => {
      const source = requireJson(CONTENT_SOURCE);
      const monster = source.monsters.find(
        candidate => candidate.key === key,
      );
      const entry = entryByContentKey(
        `actors.summoned-monsters.${key}`,
      );

      expect(entry).toBeDefined();
      expect(entry.document).toMatchObject({
        _id: monster.id,
        folder: source.actorFolders.demons.id,
        name: expected.name,
        type: "monster",
        img: "icons/svg/mystery-man.svg",
        system: {
          description: "",
          movement: {
            base: expected.movement,
            value: expected.movement,
          },
          hitPoints: {
            base: expected.hitPoints,
            max: expected.hitPoints,
            value: expected.hitPoints,
          },
          armor: expected.armor,
          ferocity: {
            base: 1,
            value: 1,
          },
          size: "normal",
          attackTable: `RollTable.${monster.attackTable.id}`,
          previousMonsterAttack: "",
        },
        prototypeToken: {
          actorLink: false,
          disposition: 1,
          lockRotation: true,
          width: 1,
          height: 1,
          texture: {
            src: "icons/svg/mystery-man.svg",
          },
          bar1: {
            attribute: "hitPoints",
          },
        },
        items: [],
        effects: [],
        ownership: {
          default: 0,
        },
      });

      expect(entry.document.system.traits).toContain(
        expected.trait,
      );
      expect(moduleFlags(entry.document)).toMatchObject({
        generatedBy: GENERATOR_NAME,
        contentKey:
          `actors.summoned-monsters.${key}`,
        summonType: "warlock-demon",
        monsterControl: {
          schemaVersion: 1,
          key,
          attackSelection: {
            mode: "system-default",
          },
        },
      });
      expect(
        entry.document.prototypeToken.flags[MODULE_ID],
      ).toMatchObject({
        summonType: "warlock-demon",
        sourceActorContentKey:
          `actors.summoned-monsters.${key}`,
      });
    },
  );

  test.each(Object.entries(EXPECTED))(
    "generates the flat %s attack table",
    (key, expected) => {
      const source = requireJson(CONTENT_SOURCE);
      const monster = source.monsters.find(
        candidate => candidate.key === key,
      );
      const entry = entryByContentKey(
        `tables.monster-attacks.${key}`,
      );

      expect(entry).toBeDefined();
      expect(entry.document).toMatchObject({
        _id: monster.attackTable.id,
        name: `Monster Attacks – ${expected.name}`,
        folder: source.tableFolders.monsterAttacks.id,
        formula: "1",
        replacement: true,
        displayRoll: false,
        ownership: {
          default: 0,
        },
      });
      expect(entry.document.results).toHaveLength(1);

      const result = entry.document.results[0];
      expect(result).toMatchObject({
        range: [1, 1],
        name: "",
        flags: {
          "bane-of-azeroth": {
            monsterAttack: {
              schemaVersion: 1,
              key: expected.attackKey,
            },
          },
        },
      });
      expect(
        result.flags["bane-of-azeroth"]
          .monsterAttack.resourceCost,
      ).toBeUndefined();

      for (const snippet of expected.attackText) {
        expect(result.description).toContain(snippet);
      }
    },
  );

  test("includes the folder, Actors, and tables in the Adventure", () => {
    const source = requireJson(CONTENT_SOURCE);
    const adventure = requireJson(ADVENTURE_SOURCE);

    const folder = entryByContentKey(
      "actors.folder.demons",
    );
    expect(folder).toBeDefined();
    expect(adventure.folders).toContain(
      adventurePath(folder),
    );

    for (const key of Object.keys(EXPECTED)) {
      const actor = entryByContentKey(
        `actors.summoned-monsters.${key}`,
      );
      const table = entryByContentKey(
        `tables.monster-attacks.${key}`,
      );

      expect(actor).toBeDefined();
      expect(table).toBeDefined();
      expect(adventure.actors).toContain(
        adventurePath(actor),
      );
      expect(adventure.tables).toContain(
        adventurePath(table),
      );
    }

    expect(source.monsters).toHaveLength(5);
  });
});
