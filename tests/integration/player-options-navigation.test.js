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
const SOURCE_DIRECTORY = resolve(
  "foundry",
  "content",
  "journals",
  "player-options",
);
const GENERATED = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
  "Player_Options_BoAJrnlPlayerOpt.json",
);
const JOURNAL_GENERATOR = resolve(
  "tools",
  "generate-journals.py",
);
const COVER_ASSET = resolve(
  "foundry",
  "assets",
  "journals",
  "cover",
  "bane_of_azeroth_cover.webp",
);
const SYMBOLIC_REFERENCE_PREFIX = [
  "@Ref",
  "[",
].join("");

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function sourcePage(name) {
  return readJson(
    join(
      SOURCE_DIRECTORY,
      `${name}.json`,
    ),
  );
}

function contentKey(page) {
  return page.flags?.[MODULE_ID]?.contentKey;
}

describe("Player Options opening and navigation", () => {
  test("defines the official-style opening page order", () => {
    const illustration =
      sourcePage("illustration");
    const introduction =
      sourcePage("introduction");
    const kin = sourcePage("kin");
    const derived =
      sourcePage("derived-ratings");
    const classes =
      sourcePage("heroic-class-abilities");

    expect(illustration).toMatchObject({
      schemaVersion: 1,
      key: "illustration",
      id: "BoAPgPlayerIllus",
      name: "Illustration",
      sort: 100000,
      title: {
        show: false,
        level: 1,
      },
      source: {
        type: "image",
        src:
          "modules/bane-of-azeroth/"
          + "assets/journals/cover/"
          + "bane_of_azeroth_cover.webp",
        caption: "",
      },
    });
    expect(introduction).toMatchObject({
      schemaVersion: 1,
      key: "introduction",
      id: "BoAPgPlayerIntro",
      name: "Introduction",
      sort: 200000,
      title: {
        show: true,
        level: 1,
      },
      source: {
        type: "html",
      },
    });
    expect(kin.sort).toBe(300000);
    expect(derived.sort).toBe(400000);
    expect(classes.sort).toBe(500000);
    expect(existsSync(COVER_ASSET)).toBe(true);

    for (const reference of [
      "kin",
      "derived-ratings",
      "heroic-class-abilities",
    ]) {
      expect(
        introduction.source.content,
      ).toContain(
        SYMBOLIC_REFERENCE_PREFIX
          + "boa:journal-page."
          + `player-options.${reference}]`,
      );
    }
  });

  test("uses readable source capitalization for every Kin heading", () => {
    const html =
      sourcePage("kin").source.content;
    const headings = [
      ...html.matchAll(
        /<h[23]>([^<]+)<\/h[23]>/g,
      ),
    ].map(match => match[1]);

    expect(headings).toHaveLength(38);
    expect(headings).toContain("Language");
    expect(headings).toContain("Dracthyr");
    expect(headings).toContain("Dark Iron");
    expect(headings).toContain(
      "Ability: Draconic Wings",
    );
    expect(headings).toContain(
      "Ability: Two Forms",
    );

    for (const heading of headings) {
      expect(heading).not.toBe(
        heading.toUpperCase(),
      );
    }
  });

  test("generates an image cover followed by the introduction", () => {
    const journal = readJson(GENERATED);

    expect(
      journal.pages.map(page => page.name),
    ).toEqual([
      "Illustration",
      "Introduction",
      "Kin",
      "Derived Ratings",
      "Heroic Class Abilities",
    ]);

    const illustration = journal.pages[0];
    expect(illustration).toMatchObject({
      type: "image",
      title: {
        show: false,
        level: 1,
      },
      image: {
        caption: "",
      },
      text: {
        format: 1,
      },
      src:
        "modules/bane-of-azeroth/"
        + "assets/journals/cover/"
        + "bane_of_azeroth_cover.webp",
    });
    expect(contentKey(illustration)).toBe(
      "journal-page.player-options."
        + "illustration",
    );

    const introduction = journal.pages[1];
    expect(introduction.type).toBe("text");
    expect(introduction.title).toEqual({
      show: true,
      level: 1,
    });
    expect(contentKey(introduction)).toBe(
      "journal-page.player-options."
        + "introduction",
    );
    expect(
      introduction.text.content,
    ).not.toContain(
      SYMBOLIC_REFERENCE_PREFIX,
    );

    for (const [id, label] of [
      ["BoAPgPlayerKin01", "Kin"],
      ["BoAPgDerivedRate", "Derived Ratings"],
      [
        "4f7e06538e580623",
        "Heroic Class Abilities",
      ],
    ]) {
      expect(
        introduction.text.content,
      ).toContain(
        "@UUID[JournalEntry."
          + "BoAJrnlPlayerOpt."
          + `JournalEntryPage.${id}]`
          + `{${label}}`,
      );
    }
  });

  test("supports curated text and image Journal pages generically", () => {
    const generator = read(
      JOURNAL_GENERATOR,
    );

    for (const marker of [
      'source_type not in {"html", "image"}',
      'if source_type == "html":',
      'if source_type == "image":',
      '"type": "image"',
      '"caption": caption',
      '"src": image_src',
    ]) {
      expect(generator).toContain(marker);
    }
  });
});
