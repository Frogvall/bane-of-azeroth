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

const MODULE_ID = "bane-of-azeroth";
const SOURCE = resolve(
  "foundry",
  "content",
  "roll-tables",
  "player-options",
  "kin.json",
);
const ADVENTURE_ROOT = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
);
const ADVENTURE = join(
  ADVENTURE_ROOT,
  "_Adventure.json",
);
const ROLL_TABLE_ROOT = join(
  ADVENTURE_ROOT,
  "RollTable",
  "Bane_of_Azeroth_BoATables7pQ2mX9",
);
const NEW_DIRECTORY = join(
  ROLL_TABLE_ROOT,
  "Character_Options_BoATblPlayerOpt1",
);
const OLD_DIRECTORY = join(
  ROLL_TABLE_ROOT,
  "Player_Options_BoATblPlayerOpt1",
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

describe("Character Options Kin RollTable folder rename", () => {
  test("renames only the visible source folder identity", () => {
    const source = readJson(SOURCE);

    expect(source.folder).toMatchObject({
      key: "player-options",
      id: "BoATblPlayerOpt1",
      name: "Character Options",
      parentId: "BoATables7pQ2mX9",
      color: null,
      sorting: "a",
      sort: 200000,
    });
  });

  test("regenerates under the new visible directory name", () => {
    expect(
      existsSync(NEW_DIRECTORY),
    ).toBe(true);
    expect(
      existsSync(OLD_DIRECTORY),
    ).toBe(false);

    const folder = readJson(
      join(
        NEW_DIRECTORY,
        "_Folder.json",
      ),
    );

    expect(folder).toMatchObject({
      type: "RollTable",
      folder: "BoATables7pQ2mX9",
      name: "Character Options",
      sorting: "a",
      sort: 200000,
      _id: "BoATblPlayerOpt1",
      flags: {
        [MODULE_ID]: {
          generatedBy:
            "tools/generate-kin-roll-tables.py",
          contentKey:
            "tables.folder.player-options",
        },
      },
    });
  });

  test("migrates Adventure references without changing technical IDs", () => {
    const adventure = read(ADVENTURE);

    expect(adventure).toContain(
      "Character_Options_BoATblPlayerOpt1",
    );
    expect(adventure).not.toContain(
      "Player_Options_BoATblPlayerOpt1",
    );
    expect(adventure).toContain(
      "BoATblPlayerOpt1",
    );
  });

  test("keeps the runtime folder contract explicit", () => {
    const macro = read(SYSTEM_MACRO);

    expect(macro).toContain(
      "Imported Character Options RollTable folder exists",
    );
    expect(macro).toContain(
      '"tables.folder.player-options"',
    );
    expect(macro).toContain(
      'name: "Character Options"',
    );
    expect(macro).toContain(
      'id: "BoATblPlayerOpt1"',
    );
  });
});
