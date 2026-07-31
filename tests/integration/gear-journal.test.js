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
const GEAR_SOURCE = resolve(
  "foundry",
  "content",
  "gear.json",
);
const PAGE_SOURCE = resolve(
  "foundry",
  "content",
  "journals",
  "player-options",
  "gear.json",
);
const SYSTEM_MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-assets-and-journals.js",
);
const ADVENTURE = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
);
const ITEM_DIRECTORY = join(
  ADVENTURE,
  "Item",
);
const GENERATED_JOURNAL = join(
  ADVENTURE,
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
  "Player_Options_BoAJrnlPlayerOpt.json",
);

const TABLE_TYPES = new Map([
  ["melee-weapons", "melee"],
  ["ranged-weapons", "ranged"],
  ["trade-goods", "trade"],
]);

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function occurrences(value, marker) {
  return String(value).split(marker).length - 1;
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

function generatedItems() {
  const result = new Map();

  for (const path of filesBelow(ITEM_DIRECTORY)) {
    if (path.endsWith("_Folder.json")) continue;

    const document = readJson(path);
    const key =
      document.flags?.[MODULE_ID]?.contentKey;

    if (
      typeof key === "string"
      && key.startsWith("gear.")
    ) {
      expect(result.has(key)).toBe(false);
      result.set(key, document);
    }
  }

  return result;
}

function gearEntries(source) {
  return source.categories.flatMap(
    category =>
      category.items.map(item => ({
        categoryKey: category.key,
        documentType:
          category.documentType,
        ...item,
      })),
  );
}

describe("Player Options Gear Journal page", () => {
  test("defines one visible page after Heroic Class Abilities", () => {
    const page = readJson(PAGE_SOURCE);

    expect(page).toMatchObject({
      schemaVersion: 1,
      key: "gear",
      id: "BoAPgPlayerGear1",
      name: "Gear",
      sort: 600000,
      title: {
        show: true,
        level: 1,
      },
      source: {
        type: "html",
      },
      provenance: {
        canonicalSource:
          "homebrewery/Bane of Azeroth.md",
        section: "Gear",
        sync: "curated",
        presentation:
          "dragonbane-core-compatible",
        links:
          "generated-gear-items",
      },
    });

    const headings = [
      ...page.source.content.matchAll(
        /<h2>([^<]+)<\/h2>/g,
      ),
    ].map(match => match[1]);

    expect(headings).toEqual([
      "Firearms",
      "Glaives",
      "Melee Weapons",
      "Ranged Weapons",
      "Trade Goods",
    ]);

    for (const heading of headings) {
      expect(heading).not.toBe(
        heading.toUpperCase(),
      );
    }
  });

  test("uses Dragonbane Gear directives for all eight generated Items", () => {
    const gear = readJson(GEAR_SOURCE);
    const page = readJson(PAGE_SOURCE);
    const html = page.source.content;
    const entries = gearEntries(gear);

    expect(entries).toHaveLength(8);
    expect(
      occurrences(
        html,
        "@GearTableStart[",
      ),
    ).toBe(3);
    expect(
      occurrences(html, "@GearTableEnd"),
    ).toBe(3);
    expect(
      occurrences(html, "@Gear[Item."),
    ).toBe(8);

    for (const category of gear.categories) {
      const tableType = TABLE_TYPES.get(
        category.key,
      );
      expect(tableType).toBeDefined();
      expect(html).toContain(
        `@GearTableStart[${tableType}]`
        + `{${category.folder}}`,
      );
    }

    for (const entry of entries) {
      expect(
        occurrences(
          html,
          `@Gear[Item.${entry.id}]`
          + `{${entry.name}}`,
        ),
      ).toBe(1);
    }

    expect(html).not.toContain("<table");
    expect(html).not.toContain("| Weapon");
  });

  test("mirrors the Gear chapter prose and feature rules", () => {
    const html =
      readJson(PAGE_SOURCE).source.content;

    for (const marker of [
      "All standard Dragonbane equipment "
        + "remains available in Azeroth.",
      "<h2>Firearms</h2>",
      "audible out to 500 meters.",
      "<h2>Glaives</h2>",
      "<strong>Freehanded:</strong>",
      "<strong>Returning:</strong>",
      "<strong>Armor Piercing:</strong>",
      "<strong>Scattershot:</strong>",
    ]) {
      expect(html).toContain(marker);
    }
  });

  test("generates the sixth page and preserves every Gear directive", () => {
    const pageSource = readJson(PAGE_SOURCE);
    const journal =
      readJson(GENERATED_JOURNAL);

    expect(journal.pages).toHaveLength(6);
    expect(
      journal.pages.map(page => page.name),
    ).toEqual([
      "Illustration",
      "Introduction",
      "Kin",
      "Derived Ratings",
      "Heroic Class Abilities",
      "Gear",
    ]);

    const page = journal.pages[5];
    expect(page).toMatchObject({
      _id: "BoAPgPlayerGear1",
      name: "Gear",
      type: "text",
      sort: 600000,
      title: {
        show: true,
        level: 1,
      },
      flags: {
        [MODULE_ID]: {
          contentKey:
            "journal-page.player-options.gear",
        },
      },
    });
    expect(page.text.content).toBe(
      pageSource.source.content,
    );
    expect(
      occurrences(
        page.text.content,
        "@Gear[Item.",
      ),
    ).toBe(8);
  });

  test("targets the generated Gear Items by stable ID and content key", () => {
    const gear = readJson(GEAR_SOURCE);
    const items = generatedItems();
    const entries = gearEntries(gear);

    expect(items).toHaveLength(8);

    for (const entry of entries) {
      const contentKey =
        `gear.${entry.key}`;
      const item = items.get(contentKey);

      expect(item).toBeDefined();
      expect(item._id).toBe(entry.id);
      expect(item.name).toBe(entry.name);
      expect(item.type).toBe(
        entry.documentType,
      );
    }
  });

  test("extends the Foundry runtime contract", () => {
    const macro = read(SYSTEM_MACRO);

    for (const marker of [
      "Player Options contains the Gear page",
      "Gear page contains three Gear tables",
      "Gear page links all eight generated Gear Items",
      "Gear page includes the 500 meter firearm report",
      "Player Options has exactly six pages",
    ]) {
      expect(macro).toContain(marker);
    }
  });
});
