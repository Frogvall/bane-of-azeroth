import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  dirname,
  relative,
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
const GENERATOR_NAME =
  "tools/generate-hunter-companions.py";
const LETHAL_POISON_UUID =
  "JournalEntry.SbbSMsuvWeo3HaID." +
  "JournalEntryPage.6WPxPxUjh4W80RNy#poison";

const CONTENT_SOURCE = resolve(
  "foundry",
  "content",
  "hunter-companions.json"
);
const GENERATOR = resolve(
  "tools",
  "generate-hunter-companions.py"
);
const WORKFLOW = resolve(
  ".github",
  "workflows",
  "build-foundry.yml"
);
const GENERATOR_CHECKER = resolve(
  "tools",
  "check-foundry-generators.py"
);
const ADVENTURE_SOURCE = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "_Adventure.json"
);
const ADVENTURE_DIRECTORY = dirname(
  ADVENTURE_SOURCE
);
const ACTOR_ROOT = resolve(
  ADVENTURE_DIRECTORY,
  "Actor"
);

const ID_PATTERN = /^[A-Za-z0-9]{16}$/;

const EXPECTED_COMPANIONS = [
  {
    key: "crocolisk",
    name: "Crocolisk",
    movement: {
      base: 6,
      swim: 12,
    },
    hitPoints: 15,
    armorRating: 1,
    attacks: [
      {
        name: "Bite",
        skillLevel: 12,
        damage: "2D8",
        range: 2,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 10,
      },
      {
        name: "Evade",
        value: 6,
      },
    ],
  },
  {
    key: "dragonhawk",
    name: "Dragonhawk",
    movement: {
      base: 2,
      fly: 14,
    },
    hitPoints: 8,
    armorRating: 0,
    attacks: [
      {
        name: "Beak",
        skillLevel: 10,
        damage: "D10",
        range: 2,
      },
      {
        name: "Talons",
        skillLevel: 12,
        damage: "2D4",
        range: 2,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 14,
      },
      {
        name: "Evade",
        value: 12,
      },
    ],
  },
  {
    key: "giant-bat",
    name: "Giant Bat",
    movement: {
      base: 2,
      fly: 8,
    },
    hitPoints: 10,
    armorRating: 0,
    attacks: [
      {
        name: "Bite",
        skillLevel: 10,
        damage: "D10",
        range: 2,
      },
      {
        name: "Sonic Wave",
        skillLevel: 10,
        damage: "D6",
        range: 10,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 16,
      },
      {
        name: "Evade",
        value: 12,
      },
    ],
  },
  {
    key: "giant-owl",
    name: "Giant Owl",
    movement: {
      base: 2,
      fly: 14,
    },
    hitPoints: 8,
    armorRating: 0,
    attacks: [
      {
        name: "Beak",
        skillLevel: 10,
        damage: "D10",
        range: 2,
      },
      {
        name: "Talons",
        skillLevel: 12,
        damage: "2D4",
        range: 2,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 16,
      },
      {
        name: "Evade",
        value: 10,
      },
    ],
  },
  {
    key: "large-serpent",
    name: "Large Serpent",
    movement: {
      base: 10,
    },
    hitPoints: 8,
    armorRating: 0,
    attacks: [
      {
        name: "Bite",
        skillLevel: 12,
        damage: "D6",
        range: 2,
        lethalPoison: 15,
      },
      {
        name: "Constriction",
        skillLevel: 10,
        damage: "D6",
        range: 2,
        restrain: 12,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 12,
      },
      {
        name: "Evade",
        value: 16,
      },
    ],
  },
  {
    key: "giant-spider",
    name: "Giant Spider",
    movement: {
      base: 8,
    },
    hitPoints: 10,
    armorRating: 0,
    attacks: [
      {
        name: "Bite",
        skillLevel: 10,
        damage: "D4",
        range: 2,
        lethalPoison: 12,
      },
      {
        name: "Web Spray",
        skillLevel: 12,
        damage: null,
        range: 2,
        restrain: 10,
      },
    ],
    skills: [
      {
        name: "Acrobatics",
        value: 16,
      },
      {
        name: "Awareness",
        value: 12,
      },
      {
        name: "Evade",
        value: 12,
      },
      {
        name: "Stealth",
        value: 12,
      },
    ],
  },
  {
    key: "gorilla",
    name: "Gorilla",
    movement: {
      base: 8,
    },
    hitPoints: 16,
    armorRating: 0,
    attacks: [
      {
        name: "Bite",
        skillLevel: 12,
        damage: "2D6",
        range: 2,
      },
      {
        name: "Fist",
        skillLevel: 14,
        damage: "2D4",
        range: 2,
      },
    ],
    skills: [
      {
        name: "Acrobatics",
        value: 14,
      },
      {
        name: "Awareness",
        value: 10,
      },
      {
        name: "Evade",
        value: 14,
      },
    ],
  },
  {
    key: "large-cat",
    name: "Large Cat",
    movement: {
      base: 16,
    },
    hitPoints: 12,
    armorRating: 0,
    attacks: [
      {
        name: "Bite",
        skillLevel: 12,
        damage: "2D6",
        range: 2,
      },
      {
        name: "Claws",
        skillLevel: 14,
        damage: "2D4",
        range: 2,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 12,
      },
      {
        name: "Evade",
        value: 12,
      },
      {
        name: "Stealth",
        value: 14,
      },
    ],
  },
  {
    key: "raptor",
    name: "Raptor",
    movement: {
      base: 16,
    },
    hitPoints: 10,
    armorRating: 0,
    attacks: [
      {
        name: "Bite",
        skillLevel: 12,
        damage: "2D6",
        range: 2,
      },
      {
        name: "Claws",
        skillLevel: 12,
        damage: "2D4",
        range: 2,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 14,
      },
      {
        name: "Evade",
        value: 14,
      },
    ],
  },
  {
    key: "ravager",
    name: "Ravager",
    movement: {
      base: 10,
    },
    hitPoints: 14,
    armorRating: 2,
    attacks: [
      {
        name: "Bite",
        skillLevel: 10,
        damage: "2D4",
        range: 2,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 10,
      },
      {
        name: "Evade",
        value: 14,
      },
    ],
  },
  {
    key: "scorpid",
    name: "Scorpid",
    movement: {
      base: 8,
    },
    hitPoints: 12,
    armorRating: 2,
    attacks: [
      {
        name: "Claws",
        skillLevel: 12,
        damage: "D10",
        range: 2,
      },
      {
        name: "Tail",
        skillLevel: 12,
        damage: "D6",
        range: 2,
        lethalPoison: 12,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 8,
      },
      {
        name: "Evade",
        value: 8,
      },
    ],
  },
  {
    key: "tallstrider",
    name: "Tallstrider",
    movement: {
      base: 20,
    },
    hitPoints: 10,
    armorRating: 0,
    attacks: [
      {
        name: "Beak",
        skillLevel: 10,
        damage: "D10",
        range: 2,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 14,
      },
      {
        name: "Evade",
        value: 14,
      },
    ],
  },
  {
    key: "turtle",
    name: "Turtle",
    movement: {
      base: 6,
      swim: 10,
    },
    hitPoints: 20,
    armorRating: 4,
    attacks: [
      {
        name: "Beak",
        skillLevel: 10,
        damage: "2D6",
        range: 2,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 8,
      },
      {
        name: "Evade",
        value: 6,
      },
    ],
  },
  {
    key: "wind-serpent",
    name: "Wind Serpent",
    movement: {
      base: 2,
      fly: 14,
    },
    hitPoints: 6,
    armorRating: 0,
    attacks: [
      {
        name: "Lightning Breath",
        skillLevel: 12,
        damage: "D10",
        range: 10,
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 12,
      },
      {
        name: "Evade",
        value: 14,
      },
    ],
  },
];

const IMPLEMENTED_COMPANION_KEYS = [
  "crocolisk",
  "dragonhawk",
  "giant-bat",
  "giant-owl",
  "large-serpent",
  "giant-spider",
  "gorilla",
  "large-cat",
  "raptor",
  "ravager",
  "scorpid",
  "tallstrider",
  "turtle",
  "wind-serpent",
];

const REMAINING_COMPANION_KEYS = [
];

const EXPECTED_COMMON_ANIMAL_ARTWORK = {
  "crocolisk": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/crocolisk.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/crocolisk-token.webp",
  },
  "dragonhawk": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/dragonhawk.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/dragonhawk-token.webp",
  },
  "giant-bat": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/giant-bat.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/giant-bat-token.webp",
  },
  "giant-owl": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/giant-owl.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/giant-owl-token.webp",
  },
  "large-serpent": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/large-serpent.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/large-serpent-token.webp",
  },
  "giant-spider": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/giant-spider.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/giant-spider-token.webp",
  },
  "gorilla": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/gorilla.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/gorilla-token.webp",
  },
  "large-cat": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/large-cat.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/large-cat-token.webp",
  },
  "raptor": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/raptor.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/raptor-token.webp",
  },
  "ravager": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/ravager.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/ravager-token.webp",
  },
  "scorpid": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/scorpid.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/scorpid-token.webp",
  },
  "tallstrider": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/tallstrider.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/tallstrider-token.webp",
  },
  "turtle": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/turtle.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/turtle-token.webp",
  },
  "wind-serpent": {
    image:
      "modules/bane-of-azeroth/assets/actors/common-animals/wind-serpent.webp",
    tokenImage:
      "modules/bane-of-azeroth/assets/tokens/common-animals/wind-serpent-token.webp",
  },
};

const EXPECTED_IMPLEMENTED_COMPANIONS =
  EXPECTED_COMPANIONS.filter(
    companion =>
      IMPLEMENTED_COMPANION_KEYS.includes(
        companion.key
      )
  );

const CORE_SKILL_ATTRIBUTES = {
  Acrobatics: "agl",
  Awareness: "int",
  Evade: "agl",
  Stealth: "agl",
};

function readJsonIfExists(path) {
  if (!existsSync(path)) {
    return null;
  }

  return JSON.parse(
    readFileSync(path, "utf-8")
  );
}

function requireJson(path) {
  const value = readJsonIfExists(path);

  expect(value).not.toBeNull();

  return value;
}

function walkJsonFiles(root) {
  if (!existsSync(root)) {
    return [];
  }

  const files = [];

  for (const entry of readdirSync(root, {
    withFileTypes: true,
  })) {
    const path = resolve(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkJsonFiles(path));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".json")
    ) {
      files.push(path);
    }
  }

  return files.sort();
}

function readDocuments(root) {
  return walkJsonFiles(root).map(path => ({
    document: JSON.parse(
      readFileSync(path, "utf-8")
    ),
    path,
  }));
}

function moduleFlags(document) {
  return document?.flags?.[MODULE_ID] ?? {};
}

function repositoryModuleAssetPath(
  moduleAssetPath
) {
  const prefix = `modules/${MODULE_ID}/`;

  expect(
    moduleAssetPath.startsWith(prefix)
  ).toBe(true);

  return resolve(
    "foundry",
    moduleAssetPath.slice(prefix.length)
  );
}

function commonAnimalActorEntries() {
  return readDocuments(ACTOR_ROOT).filter(
    ({ document }) => (
      document.type === "npc" &&
      String(
        moduleFlags(document).contentKey ?? ""
      ).startsWith(
        "actors.common-animals."
      )
    )
  );
}

function folderEntries() {
  return readDocuments(ACTOR_ROOT).filter(
    ({ path }) => path.endsWith(
      "_Folder.json"
    )
  );
}

function folderByContentKey(contentKey) {
  return folderEntries().find(
    ({ document }) => (
      moduleFlags(document).contentKey ===
      contentKey
    )
  );
}

function normalizeAttack(attack) {
  const normalized = {
    name: attack.name,
    skillLevel: attack.skillLevel,
    damage: attack.damage,
    range: attack.range,
  };

  for (const field of [
    "lethalPoison",
    "restrain",
  ]) {
    if (
      Object.prototype.hasOwnProperty.call(
        attack,
        field
      )
    ) {
      normalized[field] = attack[field];
    }
  }

  return normalized;
}

function normalizeCompanion(companion) {
  return {
    key: companion.key,
    name: companion.name,
    movement: companion.movement,
    hitPoints: companion.hitPoints,
    armorRating: companion.armorRating,
    attacks: Array.isArray(companion.attacks)
      ? companion.attacks.map(normalizeAttack)
      : companion.attacks,
    skills: Array.isArray(companion.skills)
      ? companion.skills.map(skill => ({
          name: skill.name,
          value: skill.value,
        }))
      : companion.skills,
  };
}

function expectedAttackEffects(attack) {
  const effects = [];

  if (attack.lethalPoison != null) {
    effects.push({
      type: "lethalPoison",
      potency: attack.lethalPoison,
      ruleUuid: LETHAL_POISON_UUID,
    });
  }

  if (attack.restrain != null) {
    effects.push({
      type: "restrain",
      strength: attack.restrain,
    });
  }

  return effects;
}

function expectedTraits(companion) {
  const paragraphs = [];
  const animalName = companion.name.toLowerCase();

  if (companion.movement.fly != null) {
    paragraphs.push(
      "<p><strong>Fly:</strong> " +
      `The ${animalName} moves freely through the air. ` +
      "While flying, it has a movement rate of " +
      `${companion.movement.fly}. ` +
      "Its movement rate on the ground is " +
      `${companion.movement.base}.</p>`
    );
  }

  if (companion.movement.swim != null) {
    paragraphs.push(
      "<p><strong>Swim:</strong> " +
      `The ${animalName} moves without penalties while swimming ` +
      "and automatically succeeds on SWIMMING rolls. " +
      "While swimming, it has a movement rate of " +
      `${companion.movement.swim}. ` +
      "Its movement rate on land is " +
      `${companion.movement.base}.</p>`
    );
  }

  for (const attack of companion.attacks) {
    if (attack.lethalPoison != null) {
      paragraphs.push(
        "<p><strong>Lethal Poison:</strong> " +
        `If the ${animalName} hits a creature with its ` +
        `${attack.name} attack, the creature is exposed to ` +
        `@UUID[${LETHAL_POISON_UUID}]{lethal poison} with a ` +
        `potency of ${attack.lethalPoison}, as if the poison ` +
        "had been ingested.</p>"
      );
    }

    if (attack.restrain != null) {
      paragraphs.push(
        "<p><strong>Restrain:</strong> " +
        `If the ${animalName} hits a creature with its ` +
        `${attack.name} attack, the creature is unable to move ` +
        "or take actions other than trying to escape with an open " +
        `opposed STR roll against ${attack.restrain}. ` +
        "The creature can still parry while restrained, but " +
        "cannot evade.</p>"
      );
    }
  }

  return paragraphs.join("");
}

function expectFoundryId(value) {
  expect(value).toMatch(ID_PATTERN);
}

function collectSourceIds(source) {
  const ids = [];

  for (const folder of Object.values(
    source.folders ?? {}
  )) {
    ids.push(folder?.id);
  }

  for (const companion of (
    source.companions ?? []
  )) {
    ids.push(companion.id);

    if (companion.armorId != null) {
      ids.push(companion.armorId);
    }

    for (const attack of (
      companion.attacks ?? []
    )) {
      ids.push(attack.skillId);
      ids.push(attack.weaponId);
    }

    for (const skill of (
      companion.skills ?? []
    )) {
      ids.push(skill.id);
    }
  }

  return ids;
}

function findItem(
  actor,
  type,
  name
) {
  return (actor.items ?? []).find(
    item => (
      item.type === type &&
      item.name === name
    )
  );
}

function expectCoreNpcShell(
  actor,
  expected,
  commonAnimalsFolderId
) {
  expect(actor.type).toBe("npc");
  expect(actor.name).toBe(expected.name);
  expect(actor.folder).toBe(commonAnimalsFolderId);

  expect(actor.system.description).toBe("");

  expect(actor.system.movement).toEqual({
    base: expected.movement.base,
    value: expected.movement.base,
  });
  expect(actor.system.hitPoints).toEqual({
    base: expected.hitPoints,
    max: expected.hitPoints,
    value: expected.hitPoints,
  });
  expect(actor.system.willPoints).toEqual({
    base: 0,
    max: 0,
    value: 0,
  });
  expect(actor.system.damageBonus).toEqual({
    agl: {
      base: "none",
      value: "none",
    },
    str: {
      base: "none",
      value: "none",
    },
  });

  expect(actor.prototypeToken).toMatchObject({
    actorLink: false,
    lockRotation: true,
    displayBars: 20,
    bar1: {
      attribute: "hitPoints",
    },
    disposition: 0,
    width: 1,
    height: 1,
  });

  expect(actor.img).toEqual(
    expect.any(String)
  );
  expect(
    actor.prototypeToken.texture.src
  ).toEqual(expect.any(String));
  expect(actor.ownership).toEqual({
    default: 0,
  });
}

describe("Hunter companion source contract", () => {
  test("tracks the complete 14-companion set", () => {
    const source = requireJson(
      CONTENT_SOURCE
    );
    const implementedKeys = (
      source.companions ?? []
    ).map(companion => companion.key);
    const partitionKeys = [
      ...implementedKeys,
      ...(source.remainingKeys ?? []),
    ];
    const plannedKeys =
      EXPECTED_COMPANIONS.map(
        companion => companion.key
      );

    expect(source.schemaVersion).toBe(1);
    expect(source.plannedCount).toBe(14);
    expect(source.expectedCount).toBe(
      EXPECTED_IMPLEMENTED_COMPANIONS.length
    );
    expect(Object.keys(source.folders)).toEqual([
      "root",
      "commonAnimals",
    ]);
    expect(source.folders.commonAnimals).toMatchObject({
      key: "common-animals",
      name: "Common Animals",
    });
    expect(source.defaults.descriptionHtml).toBe("");
    expect(implementedKeys).toEqual(
      IMPLEMENTED_COMPANION_KEYS
    );
    expect(source.remainingKeys).toEqual(
      REMAINING_COMPANION_KEYS
    );
    expect(new Set(partitionKeys).size).toBe(
      plannedKeys.length
    );
    expect([...partitionKeys].sort()).toEqual(
      [...plannedKeys].sort()
    );
    expect(
      (source.companions ?? []).map(
        normalizeCompanion
      )
    ).toEqual(
      EXPECTED_IMPLEMENTED_COMPANIONS
    );
  });

  test("references the exact packaged portrait and token artwork", () => {
    const source = requireJson(
      CONTENT_SOURCE
    );
    const companionsByKey = new Map(
      (source.companions ?? []).map(
        companion => [
          companion.key,
          companion,
        ]
      )
    );

    for (const expected of (
      EXPECTED_IMPLEMENTED_COMPANIONS
    )) {
      const companion = companionsByKey.get(
        expected.key
      );
      const artwork =
        EXPECTED_COMMON_ANIMAL_ARTWORK[
          expected.key
        ];

      expect(companion).toBeDefined();
      expect(artwork).toBeDefined();
      expect(companion).toMatchObject(
        artwork
      );

      for (const moduleAssetPath of [
        artwork.image,
        artwork.tokenImage,
      ]) {
        const repositoryPath =
          repositoryModuleAssetPath(
            moduleAssetPath
          );

        expect(
          existsSync(repositoryPath)
        ).toBe(true);
        expect(
          statSync(repositoryPath).isFile()
        ).toBe(true);
      }
    }
  });

  test("uses deterministic unique Foundry IDs", () => {
    const source = requireJson(
      CONTENT_SOURCE
    );
    const ids = collectSourceIds(source);

    expect(ids.length).toBeGreaterThan(0);

    for (const id of ids) {
      expectFoundryId(id);
    }

    expect(new Set(ids).size).toBe(
      ids.length
    );
  });

  test("is covered by the central GitHub Actions generator check", () => {
    expect(existsSync(GENERATOR)).toBe(true);
    expect(statSync(GENERATOR).isFile()).toBe(
      true
    );
    expect(
      existsSync(GENERATOR_CHECKER)
    ).toBe(true);
    expect(
      statSync(GENERATOR_CHECKER).isFile()
    ).toBe(true);

    const workflow = readFileSync(
      WORKFLOW,
      "utf-8"
    );
    const checker = readFileSync(
      GENERATOR_CHECKER,
      "utf-8"
    );

    expect(workflow).toContain(
      "python3 tools/check-foundry-generators.py"
    );
    expect(checker).toContain(
      'glob("generate-*.py")'
    );
    expect(checker).toContain('"--check"');
    expect(GENERATOR_NAME).toMatch(
      /^tools\/generate-.+\.py$/
    );
  });
});

describe("Generated common-animal Actors", () => {
  test("uses the Bane of Azeroth > Common Animals hierarchy", () => {
    const root = folderByContentKey(
      "actors.folder.bane-of-azeroth"
    );
    const commonAnimals = folderByContentKey(
      "actors.folder.common-animals"
    );
    const oldCompanions = folderByContentKey(
      "actors.folder.companions"
    );
    const oldHunter = folderByContentKey(
      "actors.folder.hunter-companions"
    );

    expect(root).toBeDefined();
    expect(commonAnimals).toBeDefined();
    expect(oldCompanions).toBeUndefined();
    expect(oldHunter).toBeUndefined();

    expect(root.document.name).toBe(
      "Bane of Azeroth"
    );
    expect(root.document.folder).toBeNull();

    expect(commonAnimals.document.name).toBe(
      "Common Animals"
    );
    expect(commonAnimals.document.folder).toBe(
      root.document._id
    );
  });

  test("generates the exact roster as plain core-style NPCs", () => {
    const actors = commonAnimalActorEntries();
    const commonAnimalsFolder = folderByContentKey(
      "actors.folder.common-animals"
    );

    expect(commonAnimalsFolder).toBeDefined();
    expect(
      actors.map(
        ({ document }) => document.name
      ).sort()
    ).toEqual(
      EXPECTED_IMPLEMENTED_COMPANIONS
        .map(companion => companion.name)
        .sort()
    );

    const actorsByName = new Map(
      actors.map(
        ({ document }) => [
          document.name,
          document,
        ]
      )
    );

    for (const expected of (
      EXPECTED_IMPLEMENTED_COMPANIONS
    )) {
      const actor = actorsByName.get(
        expected.name
      );

      expect(actor).toBeDefined();
      expectCoreNpcShell(
        actor,
        expected,
        commonAnimalsFolder.document._id
      );
      const artwork =
        EXPECTED_COMMON_ANIMAL_ARTWORK[
          expected.key
        ];

      expect(artwork).toBeDefined();
      expect(actor.img).toBe(
        artwork.image
      );
      expect(
        actor.prototypeToken.texture.src
      ).toBe(
        artwork.tokenImage
      );
      expect(
        moduleFlags(actor).generatedBy
      ).toBe(GENERATOR_NAME);
      expect(
        moduleFlags(actor).contentKey
      ).toBe(
        `actors.common-animals.${expected.key}`
      );
      const {
        base: _baseMovement,
        ...alternateMovementRates
      } = expected.movement;
      expect(
        moduleFlags(actor).movementRates
      ).toEqual(
        Object.keys(
          alternateMovementRates
        ).length > 0
          ? alternateMovementRates
          : undefined
      );
    }
  });

  test("generates attacks, skills, armor, readable traits, and automation-ready flags", () => {
    const actors = commonAnimalActorEntries();

    expect(actors).toHaveLength(
      EXPECTED_IMPLEMENTED_COMPANIONS.length
    );

    const actorsByName = new Map(
      actors.map(
        ({ document }) => [
          document.name,
          document,
        ]
      )
    );

    for (const expected of (
      EXPECTED_IMPLEMENTED_COMPANIONS
    )) {
      const actor = actorsByName.get(
        expected.name
      );

      for (const attack of expected.attacks) {
        const skill = findItem(
          actor,
          "skill",
          attack.name
        );
        const weapon = findItem(
          actor,
          "weapon",
          attack.name
        );

        expect(skill).toBeDefined();
        expect(weapon).toBeDefined();

        expect(skill.system).toMatchObject({
          skillType: "weapon",
          attribute: "str",
          value: attack.skillLevel,
          hideTrained: true,
        });
        expect(weapon.system.skill.name).toBe(
          attack.name
        );
        expect(
          String(weapon.system.range)
        ).toBe(String(attack.range));

        if (attack.damage == null) {
          expect(
            String(
              weapon.system.damage ?? ""
            ).trim()
          ).toBe("");
        } else {
          expect(weapon.system.damage).toBe(
            attack.damage
          );
        }

        expect(
          weapon.system.itemDescription
        ).toBe("");
        expect(
          moduleFlags(weapon).attackEffects ?? []
        ).toEqual(
          expectedAttackEffects(attack)
        );
        expect(
          moduleFlags(weapon).effectOnly
        ).toBe(
          (
            attack.damage == null &&
            expectedAttackEffects(
              attack
            ).length > 0
          )
            ? true
            : undefined
        );
      }

      for (const expectedSkill of (
        expected.skills
      )) {
        const skill = findItem(
          actor,
          "skill",
          expectedSkill.name
        );

        expect(skill).toBeDefined();
        expect(skill.system).toMatchObject({
          skillType: "core",
          attribute:
            CORE_SKILL_ATTRIBUTES[
              expectedSkill.name
            ],
          value: expectedSkill.value,
        });
      }

      const armorItems = (
        actor.items ?? []
      ).filter(item => item.type === "armor");

      if (expected.armorRating === 0) {
        expect(armorItems).toHaveLength(0);
      } else {
        expect(armorItems).toHaveLength(1);
        expect(
          armorItems[0].system.rating
        ).toBe(expected.armorRating);
        expect(
          armorItems[0].system.worn
        ).toBe(true);
      }

      expect(actor.system.traits).toBe(
        expectedTraits(expected)
      );

      const flagText = JSON.stringify({
        actor: actor.flags ?? {},
        token:
          actor.prototypeToken.flags ?? {},
        items: (actor.items ?? []).map(
          item => item.flags ?? {}
        ),
      });

      expect(flagText).not.toMatch(
        /summonType|casterActorUuid|sourceSpell|auraRange|castId|instanceId|socket/i
      );
    }
  });

  test("includes every generated Actor and folder in the Adventure", () => {
    const adventure = requireJson(
      ADVENTURE_SOURCE
    );
    const actors = commonAnimalActorEntries();
    const requiredFolders = [
      folderByContentKey(
        "actors.folder.bane-of-azeroth"
      ),
      folderByContentKey(
        "actors.folder.common-animals"
      ),
    ];

    expect(actors).toHaveLength(
      EXPECTED_IMPLEMENTED_COMPANIONS.length
    );

    for (const entry of actors) {
      const path = relative(
        ADVENTURE_DIRECTORY,
        entry.path
      ).replaceAll("\\", "/");

      expect(adventure.actors).toContain(
        path
      );
    }

    for (const entry of requiredFolders) {
      expect(entry).toBeDefined();

      const path = relative(
        ADVENTURE_DIRECTORY,
        entry.path
      ).replaceAll("\\", "/");

      expect(adventure.folders).toContain(
        path
      );
    }
  });
});
