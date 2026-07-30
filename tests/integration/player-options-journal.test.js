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
const CSS = resolve(
  "foundry",
  "styles",
  "bane-of-azeroth.css",
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
  test("enables Player Options with a visible Kin page title", () => {
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
      sort: 100000,
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
  });

  test("uses Dragonbane Journal structure instead of custom presentation CSS", () => {
    const html =
      readJson(KIN_SOURCE).source.content;

    expect(html).toContain(
      "There are 14 playable kin in Azeroth.",
    );
    expect(html).toContain(
      "<h2>LANGUAGE</h2>",
    );
    expect(html).toContain(
      "<h2>DRACTHYR</h2>",
    );
    expect(html).toContain(
      "<h2>DERIVED RATINGS</h2>",
    );
    expect(html).toContain(
      "<h3>BRONZEBEARD</h3>",
    );
    expect(html).toContain(
      "<h3>BLOOD ELF</h3>",
    );

    expect(
      occurrences(
        html,
        '<blockquote class="info">',
      ),
    ).toBe(19);
    expect(
      occurrences(
        html,
        "@DisplayRef[boa:table.",
      ),
    ).toBe(19);
    expect(
      occurrences(
        html,
        "<img ",
      ),
    ).toBe(16);
    expect(
      occurrences(
        html,
        "<table",
      ),
    ).toBe(1);
    expect(
      occurrences(
        html,
        "<h2>",
      ),
    ).toBe(16);

    for (const forbidden of [
      "<article",
      "<h1",
      "boa-journal",
      "boa-heading",
      "boa-rule-box",
      "boa-ability",
      "boa-name-table",
      "boa-roll-table",
      "@DisplayTable[RollTable.",
    ]) {
      expect(html).not.toContain(
        forbidden,
      );
    }

    expect(read(CSS)).not.toContain(
      "/* BOA JOURNAL CONTENT START */",
    );
  });

  test("uses all 16 generated Kin WebP assets", () => {
    const page =
      readJson(KIN_SOURCE);
    const html =
      page.source.content;
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

  test("resolves all symbolic RollTable references in generated output", () => {
    const source =
      readJson(KIN_SOURCE);
    const tableSource =
      readJson(TABLE_SOURCE);
    const journal =
      readJson(GENERATED);

    expect(journal.pages).toHaveLength(1);
    const page = journal.pages[0];

    expect(page.title).toEqual({
      show: true,
      level: 1,
    });
    expect(page.text.format).toBe(1);
    expect(page.text.markdown).toBe("");

    const sourceHtml =
      source.source.content;
    const generatedHtml =
      page.text.content;

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
