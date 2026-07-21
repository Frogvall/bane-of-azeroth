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
        constrain: 12,
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
        name: "Web",
        skillLevel: 10,
        damage: null,
        range: 6,
        constrain: 10,
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
        value: 15,
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

function hunterActorEntries() {
  return readDocuments(ACTOR_ROOT).filter(
    ({ document }) => (
      document.type === "npc" &&
      String(
        moduleFlags(document).contentKey ?? ""
      ).startsWith(
        "actors.hunter-companions."
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
    "constrain",
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
  hunterFolderId
) {
  expect(actor.type).toBe("npc");
  expect(actor.name).toBe(expected.name);
  expect(actor.folder).toBe(hunterFolderId);

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
  test("defines exactly the 14 companions from Appendix A", () => {
    const source = requireJson(
      CONTENT_SOURCE
    );

    expect(source.schemaVersion).toBe(1);
    expect(source.expectedCount).toBe(14);
    expect(
      (source.companions ?? []).map(
        normalizeCompanion
      )
    ).toEqual(EXPECTED_COMPANIONS);
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

  test("has a generator checked by GitHub Actions", () => {
    expect(existsSync(GENERATOR)).toBe(true);
    expect(statSync(GENERATOR).isFile()).toBe(
      true
    );

    const workflow = readFileSync(
      WORKFLOW,
      "utf-8"
    );

    expect(workflow).toMatch(
      /python3 tools\/generate-hunter-companions\.py --check/
    );
  });
});

describe("Generated Hunter companion Actors", () => {
  test("uses the Bane of Azeroth > Companions > Hunter Companions hierarchy", () => {
    const root = folderByContentKey(
      "actors.folder.bane-of-azeroth"
    );
    const companions = folderByContentKey(
      "actors.folder.companions"
    );
    const hunter = folderByContentKey(
      "actors.folder.hunter-companions"
    );

    expect(root).toBeDefined();
    expect(companions).toBeDefined();
    expect(hunter).toBeDefined();

    expect(root.document.name).toBe(
      "Bane of Azeroth"
    );
    expect(root.document.folder).toBeNull();

    expect(companions.document.name).toBe(
      "Companions"
    );
    expect(companions.document.folder).toBe(
      root.document._id
    );

    expect(hunter.document.name).toBe(
      "Hunter Companions"
    );
    expect(hunter.document.folder).toBe(
      companions.document._id
    );
  });

  test("generates the exact roster as plain core-style NPCs", () => {
    const actors = hunterActorEntries();
    const hunterFolder = folderByContentKey(
      "actors.folder.hunter-companions"
    );

    expect(hunterFolder).toBeDefined();
    expect(
      actors.map(
        ({ document }) => document.name
      ).sort()
    ).toEqual(
      EXPECTED_COMPANIONS
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
      EXPECTED_COMPANIONS
    )) {
      const actor = actorsByName.get(
        expected.name
      );

      expect(actor).toBeDefined();
      expectCoreNpcShell(
        actor,
        expected,
        hunterFolder.document._id
      );
      expect(
        moduleFlags(actor).generatedBy
      ).toBe(GENERATOR_NAME);
      expect(
        moduleFlags(actor).contentKey
      ).toBe(
        `actors.hunter-companions.${expected.key}`
      );
    }
  });

  test("generates attacks, skills, armor, and alternate movement without automation", () => {
    const actors = hunterActorEntries();

    expect(actors).toHaveLength(
      EXPECTED_COMPANIONS.length
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
      EXPECTED_COMPANIONS
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

        const description = String(
          weapon.system.itemDescription ?? ""
        );

        if (attack.lethalPoison != null) {
          expect(description).toMatch(
            new RegExp(
              `lethal[\\s\\S]{0,40}` +
              `${attack.lethalPoison}`,
              "i"
            )
          );
        }

        if (attack.constrain != null) {
          expect(description).toMatch(
            new RegExp(
              `constrain[\\s\\S]{0,40}` +
              `${attack.constrain}`,
              "i"
            )
          );
        }
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

      const traits = String(
        actor.system.traits ?? ""
      );

      for (const movementType of [
        "fly",
        "swim",
      ]) {
        const value =
          expected.movement[movementType];

        if (value == null) {
          continue;
        }

        expect(traits).toMatch(
          new RegExp(
            `${movementType}` +
            `[\\s\\S]{0,40}${value}`,
            "i"
          )
        );
      }

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
    const actors = hunterActorEntries();
    const requiredFolders = [
      folderByContentKey(
        "actors.folder.bane-of-azeroth"
      ),
      folderByContentKey(
        "actors.folder.companions"
      ),
      folderByContentKey(
        "actors.folder.hunter-companions"
      ),
    ];

    expect(actors).toHaveLength(
      EXPECTED_COMPANIONS.length
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
