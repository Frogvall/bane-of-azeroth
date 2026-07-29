import {
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
const ADVENTURE = join(
  ADVENTURE_DIRECTORY,
  "_Adventure.json",
);
const CSS = resolve(
  "foundry",
  "styles",
  "bane-of-azeroth.css",
);

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function occurrences(value, marker) {
  return value.split(marker).length - 1;
}

describe("curated Player Options Journal", () => {
  test("enables Player Options with one curated Kin source page", () => {
    expect(readJson(JOURNAL_SOURCE)).toEqual({
      schemaVersion: 1,
      key: "player-options",
      id: "BoAJrnlPlayerOpt",
      name: "Player Options",
      enabled: true,
      sort: 200000,
    });

    const page = readJson(KIN_SOURCE);
    expect(page).toMatchObject({
      schemaVersion: 1,
      key: "kin",
      id: "BoAPgPlayerKin01",
      name: "Kin",
      sort: 100000,
      title: {
        show: false,
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
          "omitted-pending-webp-pipeline",
      },
    });
  });

  test("contains the complete curated Kin chapter structure", () => {
    const html = readJson(KIN_SOURCE).source.content;
    expect(html).toContain(
      '<article class="boa-journal '
      + 'boa-player-options boa-kin-page">',
    );
    expect(html).toContain(
      '<h1 class="boa-heading">Kin</h1>',
    );
    expect(html).toContain(
      "There are 14 playable kin in Azeroth.",
    );
    for (const marker of [
      "Any Faction",
      "Alliance",
      "Horde",
      "Language",
      "Dracthyr",
      "Draenei",
      "Bronzebeard",
      "Dark Iron",
      "Blood Elf",
      "Night Elf",
      "Gnome",
      "Goblin",
      "Human",
      "Orc",
      "Pandaren",
      "Tauren",
      "Troll",
      "Undead",
      "Vulpera",
      "Worgen",
      "Derived Ratings",
    ]) {
      expect(html).toContain(marker);
    }
    expect(
      occurrences(
        html,
        'class="boa-rule-box boa-ability"',
      ),
    ).toBe(19);
    expect(
      occurrences(html, "<table"),
    ).toBe(20);
    expect(
      occurrences(
        html,
        'class="boa-table boa-name-table"',
      ),
    ).toBe(16);
    expect(html).toContain(
      "Ability: Draconic Wings",
    );
    expect(html).toContain(
      "Ability: Undead Nature",
    );
    expect(html).toContain(
      "Ability: Two Forms",
    );
    expect(html.length).toBeGreaterThan(30000);
    expect(html).not.toContain("{{");
    expect(html).not.toContain("\\page");
    expect(html).not.toContain("\\column");
    expect(html).not.toContain("i.imgur.com");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("![");
  });

  test("generates a packable Player Options Journal", () => {
    const source = readJson(KIN_SOURCE);
    const journal = readJson(GENERATED);
    expect(journal._key).toBe(
      "!journal!BoAJrnlPlayerOpt",
    );
    expect(journal._id).toBe(
      "BoAJrnlPlayerOpt",
    );
    expect(journal.folder).toBe(
      "BoAJournals00001",
    );
    expect(journal.name).toBe(
      "Player Options",
    );
    expect(journal.pages).toHaveLength(1);
    const page = journal.pages[0];
    expect(page._key).toBe(
      "!journal.pages!"
      + "BoAJrnlPlayerOpt.BoAPgPlayerKin01",
    );
    expect(page._id).toBe(
      "BoAPgPlayerKin01",
    );
    expect(page.name).toBe("Kin");
    expect(page.text.format).toBe(1);
    expect(page.text.markdown).toBe("");
    expect(page.text.content).toBe(
      source.source.content,
    );
  });

  test("adds Player Options to the Adventure exactly once", () => {
    const adventure = readJson(ADVENTURE);
    const path =
      "JournalEntry/"
      + "Bane_of_Azeroth_BoAJournals00001/"
      + "Player_Options_BoAJrnlPlayerOpt.json";
    expect(adventure.journal).toContain(path);
    expect(
      adventure.journal.filter(
        value => value === path,
      ),
    ).toHaveLength(1);
  });

  test("scopes the Kin presentation to BoA Journal classes", () => {
    const css = read(CSS);
    expect(css).toContain(
      "/* BOA JOURNAL CONTENT START */",
    );
    expect(css).toContain(".boa-journal");
    expect(css).toContain(
      ".boa-journal .boa-rule-box",
    );
    expect(css).toContain(
      ".boa-journal .boa-table",
    );
    expect(css).toContain(
      ".boa-journal .boa-name-table",
    );
    expect(css).toContain(
      "@media (max-width: 700px)",
    );
  });
});
