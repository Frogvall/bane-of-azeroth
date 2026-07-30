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
const ITEM_DIRECTORY = join(
  ADVENTURE_DIRECTORY,
  "Item",
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

function filesBelow(directory) {
  const result = [];

  function visit(current) {
    for (
      const entry
      of readdirSync(current).sort()
    ) {
      const path = join(
        current,
        entry,
      );
      const stats = statSync(path);

      if (stats.isDirectory()) {
        visit(path);
      } else if (stats.isFile()) {
        result.push(path);
      }
    }
  }

  visit(directory);
  return result;
}

function kinDocuments() {
  const documents = new Map();

  for (
    const path
    of filesBelow(ITEM_DIRECTORY)
  ) {
    if (
      !path.endsWith(".json")
      || path.endsWith("_Folder.json")
    ) {
      continue;
    }

    const document = readJson(path);
    if (document.type !== "kin") {
      continue;
    }

    const key =
      document.flags?.["bane-of-azeroth"]
        ?.contentKey;
    expect(key).toMatch(
      /^kin\.[a-z0-9]+(?:-[a-z0-9]+)*$/,
    );
    expect(documents.has(key)).toBe(false);

    documents.set(
      key,
      document,
    );
  }

  return documents;
}

describe("generated Kin RollTables", () => {
  test("defines three document tables and sixteen text tables", () => {
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

    const documentTables =
      source.tables.filter(
        table =>
          table.resultType
          === "document",
      );
    const textTables =
      source.tables.filter(
        table =>
          table.resultType
          === "text",
      );

    expect(documentTables).toHaveLength(3);
    expect(textTables).toHaveLength(16);
    expect(
      textTables.every(
        table =>
          table.key.startsWith(
            "kin.name.",
          )
      ),
    ).toBe(true);

    const documentKeys = new Set();

    for (const table of source.tables) {
      expect(table.formula).toMatch(
        /^1d\d+$/,
      );

      let expected = 1;
      for (const result of table.results) {
        expect(result.id).toMatch(
          /^[A-Za-z0-9]{16}$/,
        );
        expect(result.range[0]).toBe(
          expected,
        );
        expected =
          result.range[1] + 1;

        if (
          table.resultType
          === "document"
        ) {
          expect(
            result.documentKey,
          ).toMatch(
            /^kin\.[a-z0-9]+(?:-[a-z0-9]+)*$/,
          );
          documentKeys.add(
            result.documentKey,
          );
        } else {
          expect(result).not.toHaveProperty(
            "documentKey",
          );
        }
      }

      const sides = Number(
        table.formula.slice(2),
      );
      expect(expected - 1).toBe(sides);
    }

    expect(documentKeys.size).toBe(16);
  });

  test("generates linked kin results and visible name results", () => {
    const source =
      readJson(SOURCE);
    const documents =
      kinDocuments();
    const directory = join(
      ROOT_DIRECTORY,
      "Player_Options_"
      + source.folder.id,
    );

    expect(documents.size).toBe(16);

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

      expect(generated.results).toHaveLength(
        table.results.length,
      );

      for (
        let index = 0;
        index < table.results.length;
        index += 1
      ) {
        const sourceResult =
          table.results[index];
        const result =
          generated.results[index];

        expect(result._id).toBe(
          sourceResult.id,
        );
        expect(result.range).toEqual(
          sourceResult.range,
        );
        expect(result.weight).toBe(
          sourceResult.range[1]
          - sourceResult.range[0]
          + 1,
        );

        if (
          table.resultType
          === "document"
        ) {
          const document =
            documents.get(
              sourceResult.documentKey,
            );
          expect(document).toBeDefined();
          expect(result).toMatchObject({
            type: "document",
            name: document.name,
            description: "",
            img: document.img,
            documentUuid:
              `Item.${document._id}`,
          });
        } else {
          expect(result).toMatchObject({
            type: "text",
            name: "",
            description:
              sourceResult.name,
            img:
              "icons/svg/d20-black.svg",
          });
          expect(result).not.toHaveProperty(
            "documentUuid",
          );
        }
      }
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
      "load_kin_documents",
    );
    expect(generator).toContain(
      '"documentUuid"',
    );
    expect(generator).toContain(
      '"icons/svg/d20-black.svg"',
    );
    expect(generator).toContain(
      "merge_managed_paths",
    );
  });
});
