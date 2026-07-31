import {
  existsSync,
  readFileSync,
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

const SOURCE_DIRECTORY = resolve(
  "foundry",
  "content",
  "journals",
  "player-options",
);
const JOURNAL_SOURCE = join(
  SOURCE_DIRECTORY,
  "journal.json",
);
const KIN_SOURCE = join(
  SOURCE_DIRECTORY,
  "kin.json",
);
const DERIVED_SOURCE = join(
  SOURCE_DIRECTORY,
  "derived-ratings.json",
);
const TABLE_SOURCE = resolve(
  "foundry",
  "content",
  "roll-tables",
  "player-options",
  "kin.json",
);
const ASSET_MANIFEST = resolve(
  "foundry",
  "config",
  "journal-assets.json",
);
const ADVENTURE_DIRECTORY = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
);
const GENERATED = join(
  ADVENTURE_DIRECTORY,
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
  "Player_Options_BoAJrnlPlayerOpt.json",
);

function read(path) {
  return readFileSync(
    path,
    "utf8",
  );
}

function readJson(path) {
  return JSON.parse(
    read(path),
  );
}

function occurrences(
  value,
  marker,
) {
  return value.split(marker).length - 1;
}

describe("curated Player Options Journal", () => {
  test("defines Kin and Derived Ratings as separate visible pages", () => {
    expect(
      readJson(JOURNAL_SOURCE),
    ).toMatchObject({
      schemaVersion: 1,
      key: "player-options",
      id: "BoAJrnlPlayerOpt",
      name: "Player Options",
      enabled: true,
      sort: 200000,
    });

    expect(
      readJson(KIN_SOURCE),
    ).toMatchObject({
      schemaVersion: 1,
      key: "kin",
      id: "BoAPgPlayerKin01",
      name: "Kin",
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
        section: "Kin",
        sync: "curated",
        artwork:
          "included-from-journal-assets",
        presentation:
          "dragonbane-core-compatible",
      },
    });

    expect(
      readJson(DERIVED_SOURCE),
    ).toMatchObject({
      schemaVersion: 1,
      key: "derived-ratings",
      id: "BoAPgDerivedRate",
      name: "Derived Ratings",
      sort: 400000,
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
        section: "Kin / Derived Ratings",
        sync: "curated",
        presentation:
          "dragonbane-core-compatible",
      },
    });
  });

  test("keeps the Kin page focused and gives Derived Ratings its own table page", () => {
    const kinHtml =
      readJson(KIN_SOURCE).source.content;
    const derivedHtml =
      readJson(DERIVED_SOURCE).source.content;

    expect(kinHtml).toContain(
      "There are 14 playable kin in Azeroth.",
    );
    expect(kinHtml).toContain(
      "<h2>Language</h2>",
    );
    expect(kinHtml).toContain(
      "<h2>Dracthyr</h2>",
    );
    expect(kinHtml).not.toContain(
      "DERIVED RATINGS",
    );
    expect(kinHtml).not.toContain(
      "<table",
    );

    expect(
      occurrences(
        kinHtml,
        '<blockquote class="info">',
      ),
    ).toBe(19);
    expect(
      occurrences(
        kinHtml,
        "@DisplayRef[boa:table.",
      ),
    ).toBe(19);
    expect(
      occurrences(
        kinHtml,
        "<img ",
      ),
    ).toBe(16);

    expect(derivedHtml).toContain(
      '<div class="display-table">',
    );
    expect(
      occurrences(
        derivedHtml,
        "<table",
      ),
    ).toBe(1);
    expect(derivedHtml).not.toContain(
      "<h2>",
    );
    expect(derivedHtml).toContain(
      "Movement",
    );
  });

  test("uses all 16 generated Kin WebP illustrations", () => {
    const html =
      readJson(KIN_SOURCE).source.content;
    const manifest =
      readJson(ASSET_MANIFEST);
    const kinAssets =
      manifest.assets.filter(
        asset =>
          asset.source.startsWith(
            "homebrewery/images/kin/",
          )
      );

    expect(kinAssets).toHaveLength(16);

    for (const asset of kinAssets) {
      expect(
        existsSync(asset.asset),
      ).toBe(true);
      expect(html).toContain(
        `src="${asset.modulePath}"`,
      );
    }
  });

  test("generates Player Options pages and resolves every symbolic RollTable reference", () => {
    const kinSource =
      readJson(KIN_SOURCE);
    const derivedSource =
      readJson(DERIVED_SOURCE);
    const tableSource =
      readJson(TABLE_SOURCE);
    const journal =
      readJson(GENERATED);

    expect(journal.pages).toHaveLength(5);

    const kinPage =
      journal.pages.find(
        page =>
          page._id === "BoAPgPlayerKin01",
      );
    const derivedPage =
      journal.pages.find(
        page =>
          page._id === "BoAPgDerivedRate",
      );

    expect(kinPage).toBeDefined();
    expect(derivedPage).toBeDefined();
    expect(
      journal.pages.slice(2, 4).map(
        page => page._id,
      ),
    ).toEqual([
      "BoAPgPlayerKin01",
      "BoAPgDerivedRate",
    ]);

    expect(kinPage.title).toEqual({
      show: true,
      level: 1,
    });
    expect(derivedPage.title).toEqual({
      show: true,
      level: 1,
    });
    expect(
      derivedPage.text.content,
    ).toBe(
      derivedSource.source.content,
    );

    const sourceHtml =
      kinSource.source.content;
    const generatedHtml =
      kinPage.text.content;

    expect(
      occurrences(
        sourceHtml,
        "@DisplayRef[boa:table.",
      ),
    ).toBe(19);
    expect(
      occurrences(
        generatedHtml,
        "@DisplayTable[RollTable.",
      ),
    ).toBe(19);
    expect(generatedHtml).not.toContain(
      "@DisplayRef[",
    );

    for (
      const table
      of tableSource.tables
    ) {
      expect(sourceHtml).toContain(
        `@DisplayRef[boa:table.${table.key}]`,
      );
      expect(generatedHtml).toContain(
        `@DisplayTable[RollTable.${table.id}]`,
      );
    }
  });
});
