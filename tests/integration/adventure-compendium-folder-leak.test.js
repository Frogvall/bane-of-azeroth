import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  basename,
  join,
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const ADVENTURE_DIRECTORY = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
);
const JOURNAL_FOLDER = join(
  ADVENTURE_DIRECTORY,
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
  "_Folder.json",
);
const JOURNAL_GENERATOR = resolve(
  "tools",
  "generate-journals.py",
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
      } else if (stats.isFile()) {
        result.push(path);
      }
    }
  }

  visit(directory);
  return result;
}

describe("Adventure embedded folder sources", () => {
  test("do not expose LevelDB keys as top-level compendium folders", () => {
    const folderFiles = filesBelow(
      ADVENTURE_DIRECTORY,
    ).filter(
      path => basename(path) === "_Folder.json",
    );

    expect(folderFiles.length).toBeGreaterThan(0);

    for (const path of folderFiles) {
      expect(
        readJson(path),
        path,
      ).not.toHaveProperty("_key");
    }
  });

  test("keeps the blue Journal folder embedded in the Adventure", () => {
    expect(
      readJson(JOURNAL_FOLDER),
    ).toMatchObject({
      type: "JournalEntry",
      folder: null,
      name: "Bane of Azeroth",
      color: "#0000ff",
      _id: "BoAJournals00001",
      flags: {
        "bane-of-azeroth": {
          generatedBy:
            "tools/generate-journals.py",
          contentKey:
            "journals.folder.bane-of-azeroth",
        },
      },
    });
  });

  test("prevents the Journal generator from restoring the leaked key", () => {
    const source = read(JOURNAL_GENERATOR);
    const start = source.indexOf(
      "def render_folder()",
    );
    const end = source.indexOf(
      "def locate_json_array(",
      start,
    );

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const renderFolder = source.slice(
      start,
      end,
    );

    expect(renderFolder).not.toContain(
      '"_key"',
    );
    expect(renderFolder).not.toContain(
      "!folders!",
    );
    expect(renderFolder).toContain(
      '"type": "JournalEntry"',
    );
  });
});
