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

const REFERENCE_LABEL_PATTERN =
  /@(?:UUID|Ref)\[[^\]]+\]\{([^{}]+)\}/g;

function readableText(value) {
  return String(value ?? "")
    .replace(
      REFERENCE_LABEL_PATTERN,
      "$1",
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function abilityDescriptionMarker(ability) {
  const source =
    typeof ability.descriptionHtml === "string"
      ? ability.descriptionHtml
      : (ability.description ?? []).join(" ");

  return readableText(source)
    .slice(0, 50);
}

describe("Heroic Class Abilities Journal page", () => {
  test("keeps all thirteen classes on one professions-style page", () => {
    const heroic = readJson(HEROIC_SOURCE);
    const page = readJson(
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

    expect(page).toMatchObject({
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
        artwork:
          "included-from-journal-assets",
        presentation:
          "dragonbane-core-compatible",
        links:
          "generated-heroic-class-ability-items",
      },
    });

    expect(
      occurrences(
        page.source.content,
        "<h2>",
      ),
    ).toBe(13);
    expect(
      occurrences(
        page.source.content,
        '<blockquote class="info">',
      ),
    ).toBe(52);

    for (const classEntry of heroic.classes) {
      expect(page.source.content).toContain(
        `<h2>${classEntry.name}</h2>`,
      );

      const legacyPath = join(
        SOURCE_DIRECTORY,
        `class-${classEntry.key}.json`,
      );
      expect(existsSync(legacyPath)).toBe(false);

      for (const ability of classEntry.abilities) {
        expect(page.source.content).toContain(
          "@Ref[boa:item."
          + "heroic-class-ability."
          + `${classEntry.key}.${ability.key}]`
          + `{${ability.name}}`,
        );

        const marker =
          abilityDescriptionMarker(ability);
        expect(marker).not.toBe("");
        expect(
          readableText(
            page.source.content,
          ),
        ).toContain(marker);
      }
    }
  });

  test("uses all thirteen class illustrations on the same page", () => {
    const heroic = readJson(HEROIC_SOURCE);
    const manifest = readJson(ASSET_MANIFEST);
    const page = readJson(
      join(
        SOURCE_DIRECTORY,
        "heroic-class-abilities.json",
      ),
    );

    for (const classEntry of heroic.classes) {
      const sourcePath =
        "homebrewery/images/classes/"
        + `${classEntry.key.replaceAll("-", "_")}.png`;
      const asset = manifest.assets.find(
        entry => entry.source === sourcePath,
      );

      expect(asset).toBeDefined();
      expect(existsSync(asset.asset)).toBe(true);
      expect(page.source.content).toContain(
        `src="${asset.modulePath}"`,
      );
    }
  });

  test("generates exactly three Player Options pages", () => {
    const heroic = readJson(HEROIC_SOURCE);
    const items = generatedItemsByContentKey();
    const journal = readJson(GENERATED);

    expect(journal.pages).toHaveLength(3);
    expect(
      journal.pages.map(
        page => page.name,
      ),
    ).toEqual([
      "Kin",
      "Derived Ratings",
      "Heroic Class Abilities",
    ]);

    const page = journal.pages[2];

    expect(page.title).toEqual({
      show: true,
      level: 1,
    });
    expect(page.text.content).not.toContain(
      "@Ref[",
    );
    expect(
      occurrences(
        page.text.content,
        "<h2>",
      ),
    ).toBe(13);
    expect(
      occurrences(
        page.text.content,
        '<blockquote class="info">',
      ),
    ).toBe(52);

    let linkedAbilities = 0;

    for (const classEntry of heroic.classes) {
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
        expect(
          readableText(
            page.text.content,
          ),
        ).toContain(
          abilityDescriptionMarker(ability),
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
  });

  test("extends runtime verification for the one-page layout", () => {
    const source = read(SYSTEM_MACRO);

    for (const marker of [
      "Player Options has exactly three pages",
      "Heroic Class Abilities contains 13 class headings",
      "Heroic Class Abilities contains 52 overview boxes",
      "Ability box titles link to all 52 Ability Items",
      "Ability boxes contain all 52 descriptions",
      "Spell-granting Ability descriptions link all six Spell Items",
      "Spell-granting Journal boxes link all six Spell Items",
    ]) {
      expect(source).toContain(marker);
    }

    expect(source).not.toContain(
      "Player Options contains 13 class pages",
    );
  });
});
