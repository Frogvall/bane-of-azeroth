import {
  existsSync,
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
const KIN_SOURCE = resolve("foundry", "content", "kin.json");
const HEROIC_SOURCE = resolve(
  "foundry",
  "content",
  "heroic-class-abilities.json",
);
const ADVENTURE_DIRECTORY = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
);
const ITEM_DIRECTORY = join(ADVENTURE_DIRECTORY, "Item");
const TABLE_DIRECTORY = join(ADVENTURE_DIRECTORY, "RollTable");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function filesBelow(directory) {
  const result = [];

  function visit(current) {
    for (const entry of readdirSync(current).sort()) {
      const path = join(current, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) {
        visit(path);
      } else if (stats.isFile() && path.endsWith(".json")) {
        result.push(path);
      }
    }
  }

  visit(directory);
  return result;
}

function generatedItemsByContentKey() {
  const result = new Map();
  for (const path of filesBelow(ITEM_DIRECTORY)) {
    if (path.endsWith("_Folder.json")) continue;
    const document = readJson(path);
    const contentKey = document.flags?.[MODULE_ID]?.contentKey;
    if (typeof contentKey !== "string") continue;
    expect(result.has(contentKey)).toBe(false);
    result.set(contentKey, document);
  }
  return result;
}

describe("Bane of Azeroth content icons", () => {
  test("assigns every Kin source entry its dedicated icon", () => {
    const source = readJson(KIN_SOURCE);
    expect(source.kin).toHaveLength(16);

    for (const kin of source.kin) {
      const expected =
        `modules/${MODULE_ID}/assets/icons/kin/${kin.key}.webp`;
      expect(kin.image).toBe(expected);
      expect(
        existsSync(
          resolve(
            "foundry",
            "assets",
            "icons",
            "kin",
            `${kin.key}.webp`,
          ),
        ),
      ).toBe(true);
    }
  });

  test("generates Kin Items with the dedicated icons", () => {
    const source = readJson(KIN_SOURCE);
    const documents = generatedItemsByContentKey();
    for (const kin of source.kin) {
      const document = documents.get(`kin.${kin.key}`);
      expect(document).toBeDefined();
      expect(document.type).toBe("kin");
      expect(document.img).toBe(kin.image);
    }
  });

  test("uses each class icon for all Heroic Class Abilities", () => {
    const source = readJson(HEROIC_SOURCE);
    const documents = generatedItemsByContentKey();
    expect(source.classes).toHaveLength(13);

    let abilityCount = 0;
    for (const classEntry of source.classes) {
      const expected =
        `modules/${MODULE_ID}/assets/icons/classes/`
        + `${classEntry.key}.webp`;
      expect(
        existsSync(
          resolve(
            "foundry",
            "assets",
            "icons",
            "classes",
            `${classEntry.key}.webp`,
          ),
        ),
      ).toBe(true);

      for (const ability of classEntry.abilities) {
        abilityCount += 1;
        expect(ability.image).toBe(expected);
        const contentKey =
          `heroic-class-ability.${classEntry.key}.${ability.key}`;
        const document = documents.get(contentKey);
        expect(document).toBeDefined();
        expect(document.type).toBe("ability");
        expect(document.img).toBe(expected);
      }
    }

    expect(abilityCount).toBe(52);
  });

  test("keeps linked Kin RollTable icons aligned with Kin Items", () => {
    const documents = generatedItemsByContentKey();
    const kinByUuid = new Map();

    for (const [contentKey, document] of documents) {
      if (!contentKey.startsWith("kin.")) continue;
      kinByUuid.set(`Item.${document._id}`, document);
    }

    let linkedResultCount = 0;
    for (const path of filesBelow(TABLE_DIRECTORY)) {
      if (path.endsWith("_Folder.json")) continue;
      const table = readJson(path);
      if (
        table.flags?.[MODULE_ID]?.contentKey
          ?.startsWith("tables.kin.") !== true
      ) {
        continue;
      }

      for (const result of table.results ?? []) {
        if (result.type !== "document") continue;
        const kin = kinByUuid.get(result.documentUuid);
        expect(kin).toBeDefined();
        expect(result.img).toBe(kin.img);
        linkedResultCount += 1;
      }
    }

    expect(linkedResultCount).toBeGreaterThan(0);
  });
});
