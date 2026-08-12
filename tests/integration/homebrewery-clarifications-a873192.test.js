import {
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const KIN_SOURCE = resolve(
  "foundry",
  "content",
  "kin.json",
);
const HEROIC_SOURCE = resolve(
  "foundry",
  "content",
  "heroic-class-abilities.json",
);
const PACK_ROOT = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
);

const EXPECTED = {
  draconicWings:
    "By spending 3 WP, you can move freely "
    + "through the air during your turn. If you end your "
    + "turn mid air, you safely land in the closest free "
    + "space below you.",
  heroicPresence:
    "Activating this ability (an action in combat) gives "
    + "all allies within 10 meters a boon to all rolls and "
    + "heals the Scared condition. The boon lasts until your "
    + "turn in the next round.",
  luck:
    "You re-roll one D20 roll, that did not result in a "
    + "demon, and must use the new result. If you have boons "
    + "or banes, you must re-roll all dice. This can be used "
    + "in combination with Pushing your Roll, potentially "
    + "re-rolling the same roll twice.",
};

const REFERENCE_LABEL_PATTERN =
  /@(?:UUID|Ref)\[[^\]]+\]\{([^{}]+)\}/g;

function referenceLabels(value) {
  return String(value).replace(
    REFERENCE_LABEL_PATTERN,
    "$1",
  );
}

function readJson(path) {
  return JSON.parse(
    readFileSync(path, "utf-8"),
  );
}

function findKinAbility(
  source,
  kinKey,
  abilityKey,
) {
  const kin = source.kin.find(
    entry => entry.key === kinKey,
  );
  expect(kin).toBeDefined();

  const ability = kin.abilities.find(
    entry => entry.key === abilityKey,
  );
  expect(ability).toBeDefined();
  return ability;
}

function findClassAbility(
  source,
  classKey,
  abilityKey,
) {
  const classEntry = source.classes.find(
    entry => entry.key === classKey,
  );
  expect(classEntry).toBeDefined();

  const ability = classEntry.abilities.find(
    entry => entry.key === abilityKey,
  );
  expect(ability).toBeDefined();
  return ability;
}

function walkJson(root) {
  const documents = [];

  for (
    const entry of readdirSync(
      root,
      {
        withFileTypes: true,
      },
    )
  ) {
    const path = resolve(root, entry.name);

    if (entry.isDirectory()) {
      documents.push(...walkJson(path));
    } else if (
      entry.isFile()
      && entry.name.endsWith(".json")
    ) {
      documents.push(readJson(path));
    }
  }

  return documents;
}

function documentById(documents, id) {
  const document = documents.find(
    entry => entry._id === id,
  );
  expect(document).toBeDefined();
  return document;
}

describe("Homebrewery clarifications from a873192", () => {
  test("updates structured Foundry source content", () => {
    const kin = readJson(KIN_SOURCE);
    const heroic = readJson(HEROIC_SOURCE);

    expect(
      findKinAbility(
        kin,
        "dracthyr",
        "draconic-wings-flying",
      ).description,
    ).toEqual([EXPECTED.draconicWings]);

    expect(
      findKinAbility(
        kin,
        "draenei",
        "heroic-presence",
      ).description,
    ).toEqual([EXPECTED.heroicPresence]);

    expect(
      findKinAbility(
        kin,
        "vulpera",
        "luck",
      ).description.map(referenceLabels),
    ).toEqual([EXPECTED.luck]);

    expect(
      findClassAbility(
        heroic,
        "hunter",
        "hunters-instincts",
      ).requirement,
    ).toBe("Companion Heroic Ability");

    const dirtyFighting = findClassAbility(
      heroic,
      "rogue",
      "dirty-fighting",
    ).description.join("\n");

    expect(dirtyFighting).toContain(
      "one-handed weapon in one hand and "
      + "a one-handed ranged weapon",
    );
    expect(dirtyFighting).not.toContain(
      "one hand a a one-handed ranged weapon",
    );
  });

  test("regenerates matching Adventure Item documents", () => {
    const documents = walkJson(PACK_ROOT);

    const generated = [
      {
        id: "FJf6gBkGcW0bNm9Z",
        text: EXPECTED.draconicWings,
      },
      {
        id: "lP4ldJQM203eVSyo",
        text: EXPECTED.heroicPresence,
      },
      {
        id: "9lZJWda5B6Z5Jb82",
        text: EXPECTED.luck,
      },
      {
        id: "blFEw7MLkYlNpsy4",
        text: "Companion Heroic Ability",
      },
      {
        id: "Gey023AgZFHY2eWb",
        text:
          "one-handed weapon in one hand and "
          + "a one-handed ranged weapon",
      },
    ];

    for (const expected of generated) {
      const document = documentById(
        documents,
        expected.id,
      );
      expect(
        referenceLabels(
          JSON.stringify(document),
        ),
      ).toContain(expected.text);
    }
  });

  test("does not retain the superseded wording", () => {
    const sourceText = [
      readFileSync(KIN_SOURCE, "utf-8"),
      readFileSync(HEROIC_SOURCE, "utf-8"),
    ].join("\n");

    expect(sourceText).not.toContain(
      "Companion Heroic Power",
    );
    expect(sourceText).not.toContain(
      "You re-roll one D20 roll and must use the new result.",
    );
    expect(sourceText).not.toContain(
      "one hand a a one-handed ranged weapon",
    );
  });
});
