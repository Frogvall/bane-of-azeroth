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

const MODULE_ID = "bane-of-azeroth";
const SOURCE = resolve(
  "foundry",
  "content",
  "hunter-companions.json",
);
const JOURNAL_SOURCE = resolve(
  "foundry",
  "content",
  "journals",
  "appendices",
  "journal.json",
);
const PAGE_SOURCE = resolve(
  "foundry",
  "content",
  "journals",
  "appendices",
  "companions.json",
);
const SYSTEM_MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-assets-and-journals.js",
);
const ADVENTURE_DIRECTORY = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
);
const ACTOR_DIRECTORY = join(
  ADVENTURE_DIRECTORY,
  "Actor",
);
const GENERATED_JOURNAL = join(
  ADVENTURE_DIRECTORY,
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
  "Appendices_BoAJrnlAppendix1.json",
);
const ADVENTURE = join(
  ADVENTURE_DIRECTORY,
  "_Adventure.json",
);

const COMMON_ANIMALS_SOURCE_LINK =
  "@Ref[dragonbane-core:journal-page.common-animals]"
  + "{list of such animals}";
const COMMON_ANIMALS_GENERATED_LINK =
  "@UUID[JournalEntry.RSi75ZLYMyFhBqPi."
  + "JournalEntryPage.9gOpHO89C6YKsgH1]"
  + "{list of such animals}";
const BOOK_ORDER = [
  {
    key: "crocolisk",
    id: "NH7xTDsdAaPgm0Xv",
    name: "Crocolisk",
  },
  {
    key: "dragonhawk",
    id: "W7alXfXLGiNx7s7E",
    name: "Dragonhawk",
  },
  {
    key: "giant-bat",
    id: "9da7224216cd2593",
    name: "Giant Bat",
  },
  {
    key: "giant-owl",
    id: "7d6c7e2e4416f9a4",
    name: "Giant Owl",
  },
  {
    key: "giant-spider",
    id: "8db68cb83b2f1331",
    name: "Giant Spider",
  },
  {
    key: "gorilla",
    id: "OelrGFsAvekzqSQi",
    name: "Gorilla",
  },
  {
    key: "large-cat",
    id: "d1067fe3dc538d79",
    name: "Large Cat",
  },
  {
    key: "large-serpent",
    id: "um17JUy9CcBXlloq",
    name: "Large Serpent",
  },
  {
    key: "raptor",
    id: "49c462b6c495e4a9",
    name: "Raptor",
  },
  {
    key: "ravager",
    id: "9a7429aca7ad9296",
    name: "Ravager",
  },
  {
    key: "scorpid",
    id: "0755558cf1561101",
    name: "Scorpid",
  },
  {
    key: "tallstrider",
    id: "adfc46dd0aa95902",
    name: "Tallstrider",
  },
  {
    key: "turtle",
    id: "9ff4f73ac72b45c4",
    name: "Turtle",
  },
  {
    key: "wind-serpent",
    id: "be5c82639dabe7c1",
    name: "Wind Serpent",
  },
];

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function occurrences(value, marker) {
  return String(value).split(marker).length - 1;
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
      } else if (
        stats.isFile()
        && path.endsWith(".json")
      ) {
        result.push(path);
      }
    }
  }

  visit(directory);
  return result;
}

function generatedActors() {
  const result = new Map();

  for (const path of filesBelow(ACTOR_DIRECTORY)) {
    if (path.endsWith("_Folder.json")) continue;

    const document = readJson(path);
    const contentKey =
      document.flags?.[MODULE_ID]?.contentKey;

    if (
      typeof contentKey === "string"
      && contentKey.startsWith(
        "actors.common-animals."
      )
    ) {
      expect(result.has(contentKey)).toBe(false);
      result.set(contentKey, document);
    }
  }

  return result;
}

function sourceCardMarker(spec) {
  return (
    "@DisplayNpcCardRef[boa:actor."
    + `actors.common-animals.${spec.key}]`
  );
}

function generatedCardMarker(spec) {
  return `@DisplayNpcCard[Actor.${spec.id}]`;
}

function materializeCompanionSource(content) {
  let rendered = content.replace(
    COMMON_ANIMALS_SOURCE_LINK,
    COMMON_ANIMALS_GENERATED_LINK,
  );

  for (const spec of BOOK_ORDER) {
    rendered = rendered.replace(
      sourceCardMarker(spec),
      generatedCardMarker(spec),
    );
  }

  return rendered;
}

describe("Appendices Companions Journal page", () => {
  test("enables Appendices and defines one curated Companions page", () => {
    expect(
      readJson(JOURNAL_SOURCE),
    ).toMatchObject({
      schemaVersion: 1,
      key: "appendices",
      id: "BoAJrnlAppendix1",
      name: "Appendices",
      enabled: true,
      sort: 300000,
    });

    expect(
      readJson(PAGE_SOURCE),
    ).toMatchObject({
      schemaVersion: 1,
      key: "companions",
      id: "BoAPgAppendComp1",
      name: "Companions",
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
        section:
          "Appendix A: Companions",
        sync: "curated",
        presentation:
          "dragonbane-core-common-animals",
        links:
          "generated-common-animal-actors",
      },
    });
  });

  test("uses the book introduction and full-width NPC cards", () => {
    const html =
      readJson(PAGE_SOURCE).source.content;

    expect(html).toContain(
      "Hunters on Azeroth tend to find "
      + "companions in a multitude of places.",
    );
    expect(html).toContain(
      COMMON_ANIMALS_SOURCE_LINK,
    );
    expect(html).not.toContain(
      COMMON_ANIMALS_GENERATED_LINK,
    );
    expect(html).toContain(
      "If an animal has more than one attack "
      + "listed, the player choose which one "
      + "to use when commanding their companion.",
    );
    expect(
      occurrences(
        html,
        '<div class="flexrow">',
      ),
    ).toBe(0);
    expect(
      occurrences(
        html,
        '<div style="width:50%">',
      ),
    ).toBe(0);
    expect(
      occurrences(
        html,
        "@DisplayNpcCardRef[boa:actor.",
      ),
    ).toBe(14);
    expect(html).not.toContain("Appendix A");
  });

  test("displays all fourteen generated Actors in exact book order", () => {
    const source = readJson(SOURCE);
    const page = readJson(PAGE_SOURCE);
    const byKey = new Map(
      source.companions.map(
        companion => [
          companion.key,
          companion,
        ],
      ),
    );
    let previousIndex = -1;

    expect(source.expectedCount).toBe(14);
    expect(source.companions).toHaveLength(14);

    for (const spec of BOOK_ORDER) {
      const companion = byKey.get(spec.key);
      const marker = sourceCardMarker(spec);

      expect(companion).toBeDefined();
      expect(companion.id).toBe(spec.id);
      expect(companion.name).toBe(spec.name);
      expect(
        occurrences(
          page.source.content,
          marker,
        ),
      ).toBe(1);

      const index =
        page.source.content.indexOf(marker);

      expect(index).toBeGreaterThan(
        previousIndex,
      );
      previousIndex = index;
    }
  });

  test("generates Appendices with Companions before Demons", () => {
    const sourcePage = readJson(PAGE_SOURCE);
    const journal =
      readJson(GENERATED_JOURNAL);
    const adventure = readJson(ADVENTURE);
    const journalPath =
      "JournalEntry/"
      + "Bane_of_Azeroth_BoAJournals00001/"
      + "Appendices_BoAJrnlAppendix1.json";

    expect(journal).toMatchObject({
      _id: "BoAJrnlAppendix1",
      name: "Appendices",
      folder: "BoAJournals00001",
      flags: {
        [MODULE_ID]: {
          generatedBy:
            "tools/generate-journals.py",
          contentKey:
            "journal.appendices",
        },
      },
    });
    expect(journal.pages).toHaveLength(2);
    expect(
      journal.pages.map(page => page.name),
    ).toEqual([
      "Companions",
      "Demons",
    ]);
    expect(journal.pages[0]).toMatchObject({
      _id: "BoAPgAppendComp1",
      name: "Companions",
      type: "text",
      sort: 100000,
      title: {
        show: true,
        level: 1,
      },
      flags: {
        [MODULE_ID]: {
          contentKey:
            "journal-page.appendices.companions",
        },
      },
    });
    expect(
      sourcePage.source.content,
    ).toContain(
      COMMON_ANIMALS_SOURCE_LINK,
    );
    expect(
      journal.pages[0].text.content,
    ).toBe(
      materializeCompanionSource(
        sourcePage.source.content,
      ),
    );
    expect(
      journal.pages[0].text.content,
    ).toContain(
      COMMON_ANIMALS_GENERATED_LINK,
    );
    expect(
      journal.pages[0].text.content,
    ).not.toContain(
      COMMON_ANIMALS_SOURCE_LINK,
    );
    for (const spec of BOOK_ORDER) {
      expect(
        journal.pages[0].text.content,
      ).toContain(
        generatedCardMarker(spec),
      );
      expect(
        journal.pages[0].text.content,
      ).not.toContain(
        sourceCardMarker(spec),
      );
    }
    expect(
      adventure.journal.filter(
        value => value === journalPath,
      ),
    ).toHaveLength(1);
  });

  test("targets every generated common-animal Actor by stable ID", () => {
    const actors = generatedActors();

    expect(actors.size).toBe(14);

    for (const spec of BOOK_ORDER) {
      const contentKey =
        `actors.common-animals.${spec.key}`;
      const actor = actors.get(contentKey);

      expect(actor).toBeDefined();
      expect(actor._id).toBe(spec.id);
      expect(actor.name).toBe(spec.name);
      expect(actor.type).toBe("npc");
    }
  });

  test("extends the Foundry runtime contract", () => {
    const macro = read(SYSTEM_MACRO);

    for (const marker of [
      "Companion source contains 14 entries",
      "Imported Appendices Journal exists",
      "Appendices contains the Companions page",
      "Companions page contains fourteen NPC cards",
      "Companions page follows Appendix A book order",
      "Companions page uses full-width NPC cards",
      "Companions introduction links the core Common Animals list",
    ]) {
      expect(macro).toContain(marker);
    }
  });
});
