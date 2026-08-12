import {
  existsSync,
  readFileSync,
} from "node:fs";
import {
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
  "journals",
  "player-options",
  "journal.json",
);
const GENERATED = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
  "Character_Options_BoAJrnlPlayerOpt.json",
);
const OLD_GENERATED = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
  "Player_Options_BoAJrnlPlayerOpt.json",
);
const ADVENTURE = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "_Adventure.json",
);
const README = resolve(
  "README.md",
);
const SYSTEM_MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-assets-and-journals.js",
);

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

describe("Character Options visible Journal rename", () => {
  test("renames only the visible Journal identity", () => {
    expect(
      readJson(SOURCE),
    ).toMatchObject({
      schemaVersion: 1,
      key: "player-options",
      id: "BoAJrnlPlayerOpt",
      name: "Character Options",
      enabled: true,
      sort: 200000,
    });
  });

  test("regenerates the Journal under its new visible filename", () => {
    expect(
      existsSync(GENERATED),
    ).toBe(true);
    expect(
      existsSync(OLD_GENERATED),
    ).toBe(false);

    const journal = readJson(GENERATED);

    expect(journal).toMatchObject({
      _id: "BoAJrnlPlayerOpt",
      name: "Character Options",
      flags: {
        [MODULE_ID]: {
          generatedBy:
            "tools/generate-journals.py",
          contentKey:
            "journal.player-options",
        },
      },
    });

    expect(journal.pages).toHaveLength(7);

    for (const page of journal.pages) {
      expect(
        page.flags?.[MODULE_ID]?.contentKey,
      ).toMatch(
        /^journal-page\.player-options\./,
      );
    }
  });

  test("updates the Adventure reference without changing document IDs", () => {
    const adventure = read(ADVENTURE);

    expect(adventure).toContain(
      "Character_Options_BoAJrnlPlayerOpt.json",
    );
    expect(adventure).not.toContain(
      "Player_Options_BoAJrnlPlayerOpt.json",
    );
    expect(adventure).toContain(
      "BoAJrnlPlayerOpt",
    );
  });

  test("uses Character Options in current documentation", () => {
    const readme = read(README);
expect(readme).toContain(
      "Generated **Character Options** Journal",
    );
    expect(readme).not.toContain(
      "Generated **Player Options** Journal",
    );
});

  test("keeps technical player-options identifiers stable", () => {
    const source = read(SOURCE);
    const macro = read(SYSTEM_MACRO);

    expect(source).toContain(
      '"key": "player-options"',
    );
    expect(source).toContain(
      '"id": "BoAJrnlPlayerOpt"',
    );

    expect(macro).toContain(
      '"journal.player-options"',
    );
    expect(macro).toContain(
      '"journal-page.player-options.illustration"',
    );
    expect(macro).toContain(
      '"journal-page.player-options.spells"',
    );
  });

  test("uses the new visible name in the Foundry runtime contract", () => {
    const macro = read(SYSTEM_MACRO);

    expect(macro).toContain(
      'name: "Character Options"',
    );
    expect(macro).toContain(
      "Imported Character Options Journal exists",
    );
    expect(macro).toContain(
      "Character Options contains the Spells page",
    );
    expect(macro).not.toContain(
      'name: "Player Options"',
    );
    expect(macro).not.toContain(
      "Imported Player Options Journal exists",
    );
  });
});
