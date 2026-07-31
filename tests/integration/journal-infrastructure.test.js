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

const ROOT = process.cwd();
const SOURCE_DIRECTORY = resolve(
  "foundry",
  "content",
  "journals",
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
const JOURNAL_DIRECTORY = join(
  ADVENTURE_DIRECTORY,
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
);
const GENERATOR = resolve(
  "tools",
  "generate-journals.py",
);

const EXPECTED_DOCUMENTS = {
  credits: {
    id: "BoAJrnlCredits01",
    name: "Credits",
    enabled: true,
  },
  "player-options": {
    id: "BoAJrnlPlayerOpt",
    name: "Player Options",
    enabled: true,
  },
  appendices: {
    id: "BoAJrnlAppendix1",
    name: "Appendices",
    enabled: false,
  },
  "foundry-vtt-guide": {
    id: "BoAJrnlFoundry01",
    name: "Foundry VTT Guide",
    enabled: false,
  },
};

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

function sourceDocuments() {
  return readdirSync(
    SOURCE_DIRECTORY,
  )
    .map(entry =>
      join(
        SOURCE_DIRECTORY,
        entry,
      )
    )
    .filter(path =>
      statSync(path).isDirectory()
    )
    .map(directory =>
      readJson(
        join(
          directory,
          "journal.json",
        ),
      )
    );
}

function generatedJournalDocuments() {
  return readdirSync(
    JOURNAL_DIRECTORY,
  )
    .filter(
      file =>
        file.endsWith(".json")
        && file !== "_Folder.json",
    )
    .map(file =>
      readJson(
        join(
          JOURNAL_DIRECTORY,
          file,
        ),
      )
    );
}

describe("generated Journal infrastructure", () => {
  test("reserves stable IDs for all four top-level journals", () => {
    const documents = sourceDocuments();
    const byKey = Object.fromEntries(
      documents.map(
        document => [
          document.key,
          {
            id: document.id,
            name: document.name,
            enabled: document.enabled,
          },
        ],
      ),
    );

    expect(byKey).toEqual(
      EXPECTED_DOCUMENTS,
    );

    for (const document of documents) {
      expect(document.schemaVersion).toBe(1);
      expect(document.id).toMatch(
        /^[A-Za-z0-9]{16}$/,
      );
    }
  });

  test("keeps Credits generated as a complete journal", () => {
    const documents =
      generatedJournalDocuments();

    expect(documents).toHaveLength(2);

    const credits = documents.find(
      document =>
        document._id === "BoAJrnlCredits01",
    );
    expect(credits).toBeDefined();
    expect(credits._id).toBe(
      "BoAJrnlCredits01",
    );
    expect(credits.folder).toBe(
      "BoAJournals00001",
    );
    expect(credits.name).toBe(
      "Credits",
    );
    expect(
      credits.flags["bane-of-azeroth"]
        .generatedBy,
    ).toBe(
      "tools/generate-journals.py",
    );
    expect(credits.pages).toHaveLength(1);

    const page = credits.pages[0];
    expect(page._id).toBe(
      "BoAPgCredits0001",
    );
    expect(page.type).toBe("text");
    expect(page.title).toEqual({
      show: false,
      level: 1,
    });
    expect(page.text.format).toBe(1);
    expect(page.text.markdown).toBe("");

    const html = page.text.content;
    expect(html).toContain(
      "modules/bane-of-azeroth/assets/"
      + "adventure/logo.webp",
    );
    expect(html).toContain("Auvreannia");
    expect(html).toContain(
      "Champions of Azeroth",
    );
    expect(html).toContain("Silverblade");
    expect(html).toContain(
      "Dragonbane Third Party "
      + "Supplement License",
    );
    expect(html).toContain(
      "Except for separately credited "
      + "background textures",
    );
    expect(html).toContain("Alex Horley");
    expect(html).toContain("Zoltan Boros");

    for (const heading of [
      "Author",
      "Version",
      "Credits",
      "Artwork",
      "Made With",
    ]) {
      expect(html).toContain(
        `<h4>${heading}</h4>`,
      );
    }
    expect(html).not.toMatch(
      /<h4>[A-Z][A-Z ]+<\/h4>/,
    );
    expect(html).not.toContain("{{");
    expect(html).not.toContain("\\page");
  });

  test("emits fvtt-cli LevelDB keys for Journal documents but not the embedded folder", () => {
    const credits =
      generatedJournalDocuments().find(
        document =>
          document._id === "BoAJrnlCredits01",
      );
    expect(credits).toBeDefined();
    const folder = readJson(
      join(
        JOURNAL_DIRECTORY,
        "_Folder.json",
      ),
    );

    expect(credits._key).toBe(
      "!journal!BoAJrnlCredits01",
    );
    expect(folder).not.toHaveProperty(
      "_key",
    );

    for (const page of credits.pages) {
      expect(page._key).toBe(
        `!journal.pages!${credits._id}.${page._id}`,
      );
    }

    expect(credits.pages[0]._key).toBe(
      "!journal.pages!BoAJrnlCredits01.BoAPgCredits0001",
    );
  });

  test("adds the Credits journal and folder to the Adventure", () => {
    const adventure = readJson(
      ADVENTURE,
    );
    const journalPath =
      "JournalEntry/"
      + "Bane_of_Azeroth_BoAJournals00001/"
      + "Credits_BoAJrnlCredits01.json";
    const folderPath =
      "JournalEntry/"
      + "Bane_of_Azeroth_BoAJournals00001/"
      + "_Folder.json";

    expect(adventure.journal).toContain(
      journalPath,
    );
    expect(
      adventure.journal.filter(
        value => value === journalPath,
      ),
    ).toHaveLength(1);

    expect(adventure.folders).toContain(
      folderPath,
    );
    expect(
      adventure.folders.filter(
        value => value === folderPath,
      ),
    ).toHaveLength(1);

    expect(
      adventure.journal.some(
        value =>
          value.includes(
            "BoAJrnlPlayerOpt",
          ),
      ),
    ).toBe(true);
  });

  test("keeps journal sources curated, split, and reference-ready", () => {
    const entries = readdirSync(
      SOURCE_DIRECTORY,
    ).sort();
    expect(entries).toEqual([
      "appendices",
      "credits",
      "foundry-vtt-guide",
      "player-options",
    ]);
    expect(
      entries.every(entry =>
        statSync(
          join(
            SOURCE_DIRECTORY,
            entry,
          ),
        ).isDirectory()
      ),
    ).toBe(true);

    const creditsJournal = readJson(
      join(
        SOURCE_DIRECTORY,
        "credits",
        "journal.json",
      ),
    );
    const creditsPage = readJson(
      join(
        SOURCE_DIRECTORY,
        "credits",
        "credits.json",
      ),
    );

    expect(creditsJournal).not.toHaveProperty(
      "pages",
    );
    expect(creditsPage).toMatchObject({
      schemaVersion: 1,
      key: "credits",
      id: "BoAPgCredits0001",
      name: "Credits",
      source: {
        type: "html",
      },
      provenance: {
        canonicalSource:
          "homebrewery/Bane of Azeroth.md",
        section: "Credits",
        sync: "curated",
      },
    });
    expect(
      creditsPage.source.content,
    ).toContain(
      "modules/bane-of-azeroth/assets/"
      + "adventure/logo.webp",
    );

    const generator = read(
      GENERATOR,
    );
    expect(generator).toContain(
      'glob("*/journal.json")',
    );
    expect(generator).toContain(
      'path.name != "journal.json"',
    );
    expect(generator).not.toContain(
      "homebrewery-section",
    );
    expect(generator).not.toContain(
      "extract_homebrewery_section",
    );
    expect(generator).not.toContain(
      "markdown_inline",
    );
    expect(generator).toMatch(
      /repo_root\s*\/\s*"foundry"\s*\/\s*"config"\s*\/\s*"references"\s*\/\s*"external-references\.json"/,
    );
    expect(generator).not.toMatch(
      /repo_root\s*\/\s*"foundry"\s*\/\s*"content"\s*\/\s*"references"\s*\/\s*"external-references\.json"/,
    );
    expect(generator).toContain(
      "@DisplayRef",
    );
    expect(generator).toContain(
      "@UUID[",
    );
    expect(generator).toContain(
      "--check",
    );
    expect(generator).toContain(
      "JournalEntryPage",
    );
    expect(generator).not.toContain(
      "subprocess",
    );
  });
});
