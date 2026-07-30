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

const SOURCE_DIRECTORY = resolve(
  "foundry",
  "content",
  "journals",
  "player-options",
);
const HEROIC_SOURCE = resolve(
  "foundry",
  "content",
  "heroic-class-abilities.json",
);
const ASSET_MANIFEST = resolve(
  "foundry",
  "config",
  "journal-assets.json",
);
const JOURNAL_GENERATOR = resolve(
  "tools",
  "generate-journals.py",
);
const SYSTEM_MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-assets-and-journals.js",
);
const ADVENTURE_DIRECTORY = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
);
const ITEM_DIRECTORY = join(
  ADVENTURE_DIRECTORY,
  "Item",
);
const GENERATED = join(
  ADVENTURE_DIRECTORY,
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

function generatedItemsByContentKey() {
  const result = new Map();

  for (const path of filesBelow(ITEM_DIRECTORY)) {
    if (path.endsWith("_Folder.json")) continue;

    const document = readJson(path);
    const contentKey =
      document.flags?.[MODULE_ID]?.contentKey;

    if (typeof contentKey !== "string") continue;

    expect(result.has(contentKey)).toBe(false);
    result.set(contentKey, document);
  }

  return result;
}

function occurrences(value, marker) {
  return value.split(marker).length - 1;
}

describe("Heroic Class Abilities Journal pages", () => {
  test("defines one parent page and thirteen class pages", () => {
    const heroic = readJson(HEROIC_SOURCE);
    const intro = readJson(
      join(
        SOURCE_DIRECTORY,
        "heroic-class-abilities.json",
      ),
    );

    expect(heroic.classes).toHaveLength(13);
    expect(
      heroic.classes.flatMap(
        entry => entry.abilities,
      ),
    ).toHaveLength(52);

    expect(intro).toMatchObject({
      schemaVersion: 1,
      key: "heroic-class-abilities",
      name: "Heroic Class Abilities",
      sort: 300000,
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
        section: "Heroic Class Abilities",
        sync: "curated",
        presentation:
          "dragonbane-core-compatible",
      },
    });

    expect(
      occurrences(
        intro.source.content,
        "@Ref[boa:journal-page."
        + "player-options.class-",
      ),
    ).toBe(13);

    for (
      let index = 0;
      index < heroic.classes.length;
      index += 1
    ) {
      const classEntry =
        heroic.classes[index];
      const path = join(
        SOURCE_DIRECTORY,
        `class-${classEntry.key}.json`,
      );

      expect(existsSync(path)).toBe(true);

      const page = readJson(path);
      expect(page).toMatchObject({
        schemaVersion: 1,
        key: `class-${classEntry.key}`,
        name: classEntry.name,
        sort: 310000 + index * 10000,
        title: {
          show: true,
          level: 2,
        },
        source: {
          type: "html",
        },
        provenance: {
          canonicalSource:
            "homebrewery/Bane of Azeroth.md",
          section:
            `Heroic Class Abilities / ${classEntry.name}`,
          sync: "curated",
          artwork:
            "included-from-journal-assets",
          presentation:
            "dragonbane-core-compatible",
          links:
            "generated-heroic-class-ability-items",
        },
      });

      expect(page.id).toMatch(
        /^[A-Za-z0-9]{16}$/,
      );
      expect(
        occurrences(
          page.source.content,
          '<blockquote class="info">',
        ),
      ).toBe(4);

      for (const ability of classEntry.abilities) {
        expect(page.source.content).toContain(
          "@Ref[boa:item."
          + "heroic-class-ability."
          + `${classEntry.key}.${ability.key}]`
          + `{${ability.name}}`,
        );
      }
    }
  });

  test("uses all thirteen generated class illustrations", () => {
    const heroic = readJson(HEROIC_SOURCE);
    const manifest = readJson(ASSET_MANIFEST);

    for (const classEntry of heroic.classes) {
      const sourcePath =
        "homebrewery/images/classes/"
        + `${classEntry.key.replaceAll("-", "_")}.png`;
      const asset = manifest.assets.find(
        entry => entry.source === sourcePath,
      );

      expect(asset).toBeDefined();
      expect(existsSync(asset.asset)).toBe(true);

      const page = readJson(
        join(
          SOURCE_DIRECTORY,
          `class-${classEntry.key}.json`,
        ),
      );

      expect(page.source.content).toContain(
        `src="${asset.modulePath}"`,
      );
    }
  });

  test("generates sixteen ordered pages and resolves all Item links", () => {
    const heroic = readJson(HEROIC_SOURCE);
    const items = generatedItemsByContentKey();
    const journal = readJson(GENERATED);

    expect(journal.pages).toHaveLength(16);
    expect(
      journal.pages.slice(0, 3).map(
        page => page.name,
      ),
    ).toEqual([
      "Kin",
      "Derived Ratings",
      "Heroic Class Abilities",
    ]);

    const intro = journal.pages.find(
      page =>
        page.flags?.[MODULE_ID]?.contentKey
        === (
          "journal-page.player-options."
          + "heroic-class-abilities"
        ),
    );

    expect(intro).toBeDefined();
    expect(intro.title).toEqual({
      show: true,
      level: 1,
    });
    expect(
      occurrences(
        intro.text.content,
        "@UUID[JournalEntry.",
      ),
    ).toBe(13);
    expect(intro.text.content).not.toContain(
      "@Ref[",
    );

    let linkedAbilities = 0;

    for (const classEntry of heroic.classes) {
      const page = journal.pages.find(
        candidate =>
          candidate.flags?.[MODULE_ID]?.contentKey
          === (
            "journal-page.player-options."
            + `class-${classEntry.key}`
          ),
      );

      expect(page).toBeDefined();
      expect(page.title).toEqual({
        show: true,
        level: 2,
      });
      expect(page.text.content).not.toContain(
        "@Ref[",
      );

      for (const ability of classEntry.abilities) {
        const contentKey =
          "heroic-class-ability."
          + `${classEntry.key}.${ability.key}`;
        const item = items.get(contentKey);

        expect(item).toBeDefined();
        expect(page.text.content).toContain(
          `@UUID[Item.${item._id}]`
          + `{${ability.name}}`,
        );
        linkedAbilities += 1;
      }
    }

    expect(linkedAbilities).toBe(52);
  });

  test("loads internal Item references generically", () => {
    const source = read(JOURNAL_GENERATOR);

    expect(source).toContain(
      "def load_internal_item_references(",
    );
    expect(source).toContain(
      'f"boa:item.{content_key}"',
    );
    expect(source).toContain(
      '"documentType": "Item"',
    );
    expect(source).toContain(
      "load_internal_item_references("
      + "\n            adventure_directory",
    );
  });

  test("extends the runtime Assets and Journals Macro", () => {
    const source = read(SYSTEM_MACRO);

    for (const marker of [
      "UUID_ITEM_PREFIX",
      "journal-page.player-options.heroic-class-abilities",
      "Player Options contains 13 class pages",
      "Class pages contain 52 linked Heroic Class Abilities",
      "Player Options has exactly sixteen pages",
    ]) {
      expect(source).toContain(marker);
    }
  });
});
