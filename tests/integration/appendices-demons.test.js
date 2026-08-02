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
const SOURCE = resolve(
  "foundry",
  "content",
  "summoned-monsters.json",
);
const ASSET_MANIFEST = resolve(
  "foundry",
  "config",
  "journal-assets.json",
);
const PAGE_SOURCE = resolve(
  "foundry",
  "content",
  "journals",
  "appendices",
  "demons.json",
);
const SYSTEM_MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-assets-and-journals.js",
);
const DEMON_IMAGE = resolve(
  "foundry",
  "assets",
  "journals",
  "demons",
  "demons.webp",
);
const ADVENTURE_DIRECTORY = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
);
const GENERATED_JOURNAL = join(
  ADVENTURE_DIRECTORY,
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
  "Appendices_BoAJrnlAppendix1.json",
);

const BOOK_ORDER = [
  {
    key: "felhunter",
    actorId: "syJzyyJogXrRtT8q",
    name: "Felhunter",
    tableId: "Y6MEcCH35zRiBNUw",
    tableName: "Monster Attacks – Felhunter",
  },
  {
    key: "imp",
    actorId: "Qi1FF2P06TdSMzMK",
    name: "Imp",
    tableId: "jCvoh99OvzeHfaFv",
    tableName: "Monster Attacks – Imp",
  },
  {
    key: "sayaad",
    actorId: "864KRsH0wP5fqVFi",
    name: "Sayaad",
    tableId: "3ZfDwi2LubfhYg8O",
    tableName: "Monster Attacks – Sayaad",
  },
  {
    key: "voidwalker",
    actorId: "sarzEcMOkSvjbci2",
    name: "Voidwalker",
    tableId: "xzXFOx5qZnY3FTT4",
    tableName: "Monster Attacks – Voidwalker",
  },
];

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

function generatedDocuments(prefix) {
  const result = new Map();

  for (
    const path
    of filesBelow(ADVENTURE_DIRECTORY)
  ) {
    if (path.endsWith("_Folder.json")) continue;

    const document = readJson(path);
    const contentKey =
      document.flags?.[MODULE_ID]?.contentKey;

    if (
      typeof contentKey === "string"
      && contentKey.startsWith(prefix)
    ) {
      expect(result.has(contentKey)).toBe(false);
      result.set(contentKey, document);
    }
  }

  return result;
}

function monsterMarker(spec) {
  return (
    `@DisplayMonster[Actor.${spec.actorId}]`
    + `{${spec.name}}`
  );
}

function tableMarker(spec) {
  return (
    `@DisplayTable[RollTable.${spec.tableId}]`
    + `{${spec.tableName}}`
  );
}

describe("Appendices Demons Journal page", () => {
  test("defines Demons as the second curated Appendices page", () => {
    expect(
      readJson(PAGE_SOURCE),
    ).toMatchObject({
      schemaVersion: 1,
      key: "demons",
      id: "BoAPgAppendDmn01",
      name: "Demons",
      sort: 200000,
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
        section: "Appendix B: Demons",
        sync: "curated",
        presentation:
          "dragonbane-core-monsters",
        links:
          "generated-summoned-monsters-and-attack-tables",
      },
    });
  });

  test("uses full-width monster blocks and attack tables in book order", () => {
    const page = readJson(PAGE_SOURCE);
    const html = page.source.content;
    let previousIndex = -1;

    expect(html).toContain(
      "Warlocks with the Demonologist heroic "
      + "ability can summon one of the demons below.",
    );
    expect(
      occurrences(
        html,
        "@DisplayMonster[Actor.",
      ),
    ).toBe(4);
    expect(
      occurrences(
        html,
        "@DisplayTable[RollTable.",
      ),
    ).toBe(4);
    expect(
      occurrences(
        html,
        '<div class="flexrow">',
      ),
    ).toBe(0);
    expect(
      occurrences(
        html,
        '<div style="width:50%">',
      ),
    ).toBe(0);

    for (const spec of BOOK_ORDER) {
      const monster = monsterMarker(spec);
      const table = tableMarker(spec);

      expect(
        occurrences(html, monster),
      ).toBe(1);
      expect(
        occurrences(html, table),
      ).toBe(1);

      const monsterIndex =
        html.indexOf(monster);
      const tableIndex =
        html.indexOf(table);

      expect(monsterIndex).toBeGreaterThan(
        previousIndex,
      );
      expect(tableIndex).toBeGreaterThan(
        monsterIndex,
      );

      previousIndex = tableIndex;
    }
  });

  test("uses the existing composite demons illustration from the book", () => {
    const page = readJson(PAGE_SOURCE);
    const html = page.source.content;
    const manifest = readJson(ASSET_MANIFEST);
    const asset = manifest.assets.find(
      candidate =>
        candidate.source
        === "homebrewery/images/demons/demons.png",
    );

    expect(asset).toMatchObject({
      source:
        "homebrewery/images/demons/demons.png",
      asset:
        "foundry/assets/journals/demons/demons.webp",
      modulePath:
        "modules/bane-of-azeroth/"
        + "assets/journals/demons/demons.webp",
      width: 1536,
      height: 1024,
      sourceHasAlphaChannel: true,
      assetHasAlpha: true,
    });
    expect(
      statSync(DEMON_IMAGE).isFile(),
    ).toBe(true);
    expect(
      occurrences(
        html,
        '<img src="modules/bane-of-azeroth/'
        + 'assets/journals/demons/demons.webp" '
        + 'style="width:100%;height:auto" '
        + 'alt="Warlock demons">',
      ),
    ).toBe(1);
  });

  test("targets all four generated demon Actors and attack tables", () => {
    const source = readJson(SOURCE);
    const actors = generatedDocuments(
      "actors.summoned-monsters.",
    );
    const tables = generatedDocuments(
      "tables.monster-attacks.",
    );
    const demons =
      source.monsters.filter(
        monster =>
          monster.summonType === "warlock-demon",
      );

    expect(demons).toHaveLength(4);
    expect(
      demons.map(monster => monster.key),
    ).toEqual(
      BOOK_ORDER.map(spec => spec.key),
    );

    for (const spec of BOOK_ORDER) {
      const sourceMonster =
        demons.find(
          monster => monster.key === spec.key,
        );
      const actor = actors.get(
        `actors.summoned-monsters.${spec.key}`,
      );
      const table = tables.get(
        `tables.monster-attacks.${spec.key}`,
      );

      expect(sourceMonster).toBeDefined();
      expect(sourceMonster.id).toBe(
        spec.actorId,
      );
      expect(
        sourceMonster.attackTable.id,
      ).toBe(spec.tableId);
      expect(
        sourceMonster.attackTable.name,
      ).toBe(spec.tableName);

      expect(actor).toBeDefined();
      expect(actor._id).toBe(spec.actorId);
      expect(actor.name).toBe(spec.name);
      expect(actor.type).toBe("monster");

      expect(table).toBeDefined();
      expect(table._id).toBe(spec.tableId);
      expect(table.name).toBe(
        spec.tableName,
      );
    }
  });

  test("generates Appendices in Companions, Demons order", () => {
    const pageSource = readJson(PAGE_SOURCE);
    const journal =
      readJson(GENERATED_JOURNAL);

    expect(journal.pages).toHaveLength(2);
    expect(
      journal.pages.map(page => page.name),
    ).toEqual([
      "Companions",
      "Demons",
    ]);

    const page = journal.pages[1];

    expect(page).toMatchObject({
      _id: "BoAPgAppendDmn01",
      name: "Demons",
      type: "text",
      sort: 200000,
      title: {
        show: true,
        level: 1,
      },
      flags: {
        [MODULE_ID]: {
          contentKey:
            "journal-page.appendices.demons",
        },
      },
    });
    expect(
      page.text.content,
    ).toBe(pageSource.source.content);
  });

  test("extends the Foundry runtime contract", () => {
    const macro = read(SYSTEM_MACRO);

    for (const marker of [
      "Demon source contains four Warlock demons",
      "Appendices contains the Demons page",
      "Demons page contains four Monster blocks",
      "Demons page contains four attack tables",
      "Demons page follows Appendix B book order",
      "Demons page uses full-width blocks",
      "Demons page includes the book illustration",
    ]) {
      expect(macro).toContain(marker);
    }
  });
});
