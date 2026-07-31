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
const SPELL_SOURCE = resolve(
  "foundry",
  "content",
  "spells.json",
);
const PAGE_SOURCE = resolve(
  "foundry",
  "content",
  "journals",
  "player-options",
  "spells.json",
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

function generatedSpells() {
  const result = new Map();

  for (const path of filesBelow(ITEM_DIRECTORY)) {
    if (path.endsWith("_Folder.json")) continue;

    const document = readJson(path);
    const contentKey =
      document.flags?.[MODULE_ID]?.contentKey;

    if (
      typeof contentKey === "string"
      && contentKey.startsWith("spells.")
    ) {
      expect(result.has(contentKey)).toBe(false);
      result.set(contentKey, document);
    }
  }

  return result;
}

function displayMarker(spell) {
  return (
    `@DisplaySpell[Item.${spell.id}]`
    + `{${spell.name}}`
  );
}

describe("Player Options Spells Journal page", () => {
  test("defines the book's Spells page without Spell List headings", () => {
    const page = readJson(PAGE_SOURCE);

    expect(page).toMatchObject({
      schemaVersion: 1,
      key: "spells",
      id: "BoAPgPlayerSpell",
      name: "Spells",
      sort: 700000,
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
        section: "Spells",
        sync: "curated",
        presentation:
          "dragonbane-core-compatible",
        links:
          "generated-spell-items",
      },
    });

    const html = page.source.content;

    expect(html).toContain(
      "Spell casters in Bane of Azeroth uses "
      + "the same spell casting rules and spells "
      + "as are presented in the core rules.",
    );
    expect(html).toContain(
      "explicitly gained by selecting the "
      + "corresponding heroic ability in the "
      + "Heroic Class Abilities chapter.",
    );
    expect(html).not.toContain("Spell List");
    expect(html).not.toContain(
      "<h2>General Magic</h2>",
    );
    expect(html).not.toContain("<h3>Rank ");
  });

  test("renders all six spells in book order through DisplaySpell", () => {
    const source = readJson(SPELL_SOURCE);
    const page = readJson(PAGE_SOURCE);
    const html = page.source.content;
    const spells = source.spells;

    expect(source.expectedCount).toBe(6);
    expect(spells).toHaveLength(6);
    expect(
      spells.map(spell => spell.name),
    ).toEqual([
      "Elemental Totem",
      "Savage Incarnation",
      "Shadowform",
      "Feral Incarnation",
      "Incarnation of Harmony",
      "Incarnation of the Stars",
    ]);
    expect(
      spells.map(spell => spell.rank),
    ).toEqual([
      1,
      1,
      1,
      2,
      2,
      2,
    ]);
    expect(
      new Set(
        spells.map(spell => spell.school),
      ),
    ).toEqual(new Set(["General"]));
    expect(
      occurrences(
        html,
        "@DisplaySpell[Item.",
      ),
    ).toBe(6);

    let previousIndex = -1;

    for (const spell of spells) {
      const marker = displayMarker(spell);

      expect(
        occurrences(html, marker),
      ).toBe(1);

      const index = html.indexOf(marker);
      expect(index).toBeGreaterThan(
        previousIndex,
      );
      previousIndex = index;
    }
  });

  test("generates Spells as the seventh Player Options page", () => {
    const pageSource = readJson(PAGE_SOURCE);
    const journal =
      readJson(GENERATED_JOURNAL);

    expect(journal.pages).toHaveLength(7);
    expect(
      journal.pages.map(page => page.name),
    ).toEqual([
      "Illustration",
      "Introduction",
      "Kin",
      "Derived Ratings",
      "Heroic Class Abilities",
      "Gear",
      "Spells",
    ]);

    const page = journal.pages[6];

    expect(page).toMatchObject({
      _id: "BoAPgPlayerSpell",
      name: "Spells",
      type: "text",
      sort: 700000,
      title: {
        show: true,
        level: 1,
      },
      flags: {
        [MODULE_ID]: {
          contentKey:
            "journal-page.player-options.spells",
        },
      },
    });
    expect(page.text.content).toBe(
      pageSource.source.content,
    );
    expect(
      occurrences(
        page.text.content,
        "@DisplaySpell[Item.",
      ),
    ).toBe(6);
  });

  test("targets every generated Spell Item by stable ID and content key", () => {
    const source = readJson(SPELL_SOURCE);
    const items = generatedSpells();

    expect(items.size).toBe(6);

    for (const spell of source.spells) {
      const contentKey =
        `spells.${spell.key}`;
      const item = items.get(contentKey);

      expect(item).toBeDefined();
      expect(item._id).toBe(spell.id);
      expect(item.name).toBe(spell.name);
      expect(item.type).toBe("spell");
    }
  });

  test("extends the Foundry runtime contract", () => {
    const macro = read(SYSTEM_MACRO);

    for (const marker of [
      "Spell source contains six entries",
      "Player Options contains the Spells page",
      "Spells page contains six DisplaySpell directives",
      "Spells page displays all six generated Spell Items in book order",
      "Spells page follows the book title",
      "Player Options has exactly seven pages",
    ]) {
      expect(macro).toContain(marker);
    }
  });
});
