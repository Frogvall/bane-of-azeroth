import {
  readFileSync,
  readdirSync,
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

const SOURCE_ROOT = resolve(
  "foundry",
  "content",
  "journals",
);
const GENERATED_ROOT = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
);
const FOLDER = join(
  GENERATED_ROOT,
  "_Folder.json",
);
const GENERATOR = resolve(
  "tools",
  "generate-journals.py",
);
const SYSTEM_MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-assets-and-journals.js",
);

const EXPECTED = [
  {
    key: "credits",
    name: "Credits",
    sort: 100000,
  },
  {
    key: "player-options",
    name: "Player Options",
    sort: 200000,
  },
  {
    key: "appendices",
    name: "Appendices",
    sort: 300000,
  },
];

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function sourceJournal(key) {
  return readJson(
    join(
      SOURCE_ROOT,
      key,
      "journal.json",
    ),
  );
}

function generatedJournals() {
  return readdirSync(GENERATED_ROOT)
    .filter(
      file =>
        file.endsWith(".json")
        && file !== "_Folder.json",
    )
    .map(file =>
      readJson(
        join(GENERATED_ROOT, file),
      ),
    );
}

describe("deterministic Journal folder order", () => {
  test("keeps the source order explicit", () => {
    for (const expected of EXPECTED) {
      expect(
        sourceJournal(expected.key),
      ).toMatchObject({
        name: expected.name,
        enabled: true,
        sort: expected.sort,
      });
    }
  });

  test("uses manual sorting and generated JournalEntry sort values", () => {
    const folder = readJson(FOLDER);
    const journals = generatedJournals();
    const byKey = new Map(
      journals.map(journal => [
        journal.flags?.["bane-of-azeroth"]
          ?.contentKey,
        journal,
      ]),
    );

    expect(folder.sorting).toBe("m");

    for (const expected of EXPECTED) {
      const journal = byKey.get(
        `journal.${expected.key}`,
      );

      expect(journal).toBeDefined();
      expect(journal.name).toBe(
        expected.name,
      );
      expect(journal.sort).toBe(
        expected.sort,
      );
    }

    expect(
      EXPECTED
        .map(expected =>
          byKey.get(
            `journal.${expected.key}`,
          ),
        )
        .sort(
          (left, right) =>
            left.sort - right.sort,
        )
        .map(journal => journal.name),
    ).toEqual([
      "Credits",
      "Player Options",
      "Appendices",
    ]);
  });

  test("generator preserves source sort instead of alphabetizing", () => {
    const generator = read(GENERATOR);

    expect(generator).toContain(
      '"sort": int(document.get("sort", 0)),',
    );
    expect(generator).toContain(
      '"sorting": "m",',
    );
    expect(generator).not.toContain(
      '"sorting": "a",',
    );
  });

  test("extends the Foundry runtime contract", () => {
    const macro = read(SYSTEM_MACRO);

    for (const marker of [
      "Journal folder uses deterministic manual sorting",
      "Generated Journals follow source sort order",
      "Credits",
      "Player Options",
      "Appendices",
    ]) {
      expect(macro).toContain(marker);
    }
  });
});
