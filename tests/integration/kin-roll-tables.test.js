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

const SOURCE = resolve(
  "foundry",
  "content",
  "roll-tables",
  "player-options",
  "kin.json",
);
const ADVENTURE_DIRECTORY = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
);
const ADVENTURE = join(
  ADVENTURE_DIRECTORY,
  "_Adventure.json",
);
const ROOT_DIRECTORY = join(
  ADVENTURE_DIRECTORY,
  "RollTable",
  "Bane_of_Azeroth_BoATables7pQ2mX9",
);
const GENERATOR = resolve(
  "tools",
  "generate-kin-roll-tables.py",
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

function safeFilename(
  name,
  id,
) {
  const stem = name
    .replace(
      /[^A-Za-z0-9]+/g,
      "_",
    )
    .replace(/^_+|_+$/g, "");

  return `${stem}_${id}.json`;
}

describe("generated Kin RollTables", () => {
  test("defines 19 deterministic rollable tables", () => {
    const source =
      readJson(SOURCE);

    expect(source).toMatchObject({
      schemaVersion: 1,
      folder: {
        key: "player-options",
        id: "BoATblPlayerOpt1",
        name: "Player Options",
        parentId: "BoATables7pQ2mX9",
        color: null,
        sorting: "a",
      },
    });
    expect(source.tables).toHaveLength(19);

    const ids = new Set([
      source.folder.id,
    ]);
    const keys = new Set();

    for (const table of source.tables) {
      expect(table.id).toMatch(
        /^[A-Za-z0-9]{16}$/,
      );
      expect(ids.has(table.id)).toBe(false);
      ids.add(table.id);

      expect(keys.has(table.key)).toBe(false);
      keys.add(table.key);

      expect(table.formula).toMatch(
        /^1d\d+$/,
      );
      expect(table.results.length)
        .toBeGreaterThan(0);

      let expected = 1;
      for (const result of table.results) {
        expect(result.id).toMatch(
          /^[A-Za-z0-9]{16}$/,
        );
        expect(ids.has(result.id))
          .toBe(false);
        ids.add(result.id);

        expect(result.range[0]).toBe(
          expected,
        );
        expected =
          result.range[1] + 1;
      }

      const sides = Number(
        table.formula.slice(2),
      );
      expect(expected - 1).toBe(sides);
    }

    expect(
      source.tables.filter(
        table =>
          table.key.startsWith(
            "kin.name.",
          )
      ),
    ).toHaveLength(16);
  });

  test("generates packable RollTables in the Player Options folder", () => {
    const source =
      readJson(SOURCE);
    const directory = join(
      ROOT_DIRECTORY,
      "Player_Options_"
      + source.folder.id,
    );
    const folder = readJson(
      join(
        directory,
        "_Folder.json",
      ),
    );

    expect(folder).toMatchObject({
      type: "RollTable",
      folder: "BoATables7pQ2mX9",
      name: "Player Options",
      color: null,
      sorting: "a",
      _id: "BoATblPlayerOpt1",
    });

    for (const table of source.tables) {
      const path = join(
        directory,
        safeFilename(
          table.name,
          table.id,
        ),
      );
      expect(existsSync(path)).toBe(true);

      const generated = readJson(path);
      expect(generated).toMatchObject({
        name: table.name,
        formula: table.formula,
        replacement: true,
        displayRoll: true,
        folder: "BoATblPlayerOpt1",
        _id: table.id,
      });
      expect(
        generated.results.map(
          result => ({
            id: result._id,
            range: result.range,
            name: result.name,
          }),
        ),
      ).toEqual(
        table.results.map(
          result => ({
            id: result.id,
            range: result.range,
            name: result.name,
          }),
        ),
      );
    }
  });

  test("adds every generated table and folder to the Adventure once", () => {
    const source =
      readJson(SOURCE);
    const adventure =
      readJson(ADVENTURE);
    const directory =
      "RollTable/"
      + "Bane_of_Azeroth_"
      + "BoATables7pQ2mX9/"
      + "Player_Options_"
      + source.folder.id;

    const folderPath =
      `${directory}/_Folder.json`;
    expect(
      adventure.folders.filter(
        value =>
          value === folderPath,
      ),
    ).toHaveLength(1);

    for (const table of source.tables) {
      const path =
        `${directory}/`
        + safeFilename(
          table.name,
          table.id,
        );
      expect(
        adventure.tables.filter(
          value =>
            value === path,
        ),
      ).toHaveLength(1);
    }
  });

  test("is covered by the central generator checker", () => {
    const generator =
      read(GENERATOR);

    expect(generator).toContain(
      '"--check"',
    );
    expect(generator).toMatch(
      /"Checked 19 generated Kin "\s*"RollTables\."/,
    );
    expect(generator).toContain(
      "displayRoll",
    );
    expect(generator).toContain(
      "replace_json_array",
    );
  });
});
