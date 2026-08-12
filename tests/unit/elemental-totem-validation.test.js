import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  configureCreatedElementalTotem,
  deletePreviousElementalTotems,
  getElementalTotemPlacementRange,
  getPrimaryActiveGMUser,
  validateElementalTotemPlanShape,
} from "../../foundry/scripts/elemental-totems.js";

import {
  makeActor,
  makeCollection,
  makeFlagDocument,
} from "../helpers/documents.js";

const definitions = {
  baseArmor: 2,
  baseHitPoints: 10,
  baseRange: 10,
  tokenHeight: 0.5,
  tokenWidth: 0.5,
  totems: [
    { key: "cleansing", name: "Cleansing Totem" },
    { key: "flametongue", name: "Flametongue Totem" },
    { key: "stoneskin", name: "Stoneskin Totem" },
    { key: "windfury", name: "Windfury Totem" },
  ],
};

function validPlan(overrides = {}) {
  return {
    powerLevel: 1,
    totemTypes: ["cleansing"],
    reachUpgrades: 0,
    durabilityUpgrades: 0,
    auraRange: 10,
    hitPoints: 10,
    armorRating: 2,
    ...overrides,
  };
}

describe("validateElementalTotemPlanShape", () => {
  test("accepts a valid power-level 1 plan", () => {
    expect(() =>
      validateElementalTotemPlanShape(validPlan(), definitions)
    ).not.toThrow();
  });

  test("accepts a valid mixed power-level 3 plan", () => {
    const plan = validPlan({
      powerLevel: 3,
      totemTypes: ["cleansing", "windfury"],
      reachUpgrades: 1,
      auraRange: 20,
    });

    expect(() =>
      validateElementalTotemPlanShape(plan, definitions)
    ).not.toThrow();
  });

  test.each([
    [null, /missing/i],
    [{}, /power level/i],
    [validPlan({ powerLevel: 0 }), /power level/i],
    [validPlan({ powerLevel: 1.5 }), /power level/i],
    [validPlan({ powerLevel: "one" }), /power level/i],
  ])("rejects invalid plan or power level %#", (plan, message) => {
    expect(() =>
      validateElementalTotemPlanShape(plan, definitions)
    ).toThrow(message);
  });

  test.each([
    [validPlan({ reachUpgrades: -1 }), /reach upgrades/i],
    [validPlan({ reachUpgrades: 0.5 }), /reach upgrades/i],
    [validPlan({ durabilityUpgrades: -1 }), /durability upgrades/i],
    [validPlan({ durabilityUpgrades: 0.5 }), /durability upgrades/i],
  ])("rejects invalid upgrade counters %#", (plan, message) => {
    expect(() =>
      validateElementalTotemPlanShape(plan, definitions)
    ).toThrow(message);
  });

  test.each([
    [validPlan({ totemTypes: [] }), /non-empty unique list/i],
    [validPlan({ totemTypes: "cleansing" }), /non-empty unique list/i],
    [
      validPlan({
        powerLevel: 2,
        totemTypes: ["cleansing", "cleansing"],
      }),
      /non-empty unique list/i,
    ],
  ])("rejects an invalid totem list %#", (plan, message) => {
    expect(() =>
      validateElementalTotemPlanShape(plan, definitions)
    ).toThrow(message);
  });

  test("rejects choices that do not add up to power level", () => {
    const plan = validPlan({
      powerLevel: 3,
      totemTypes: ["cleansing"],
      reachUpgrades: 1,
    });

    expect(() =>
      validateElementalTotemPlanShape(plan, definitions)
    ).toThrow(/choices do not match/i);
  });

  test("rejects an unknown totem type", () => {
    expect(() =>
      validateElementalTotemPlanShape(
        validPlan({ totemTypes: ["unknown"] }),
        definitions
      )
    ).toThrow(/unknown totem type/i);
  });

  test.each([
    [validPlan({ auraRange: 20 }), "range"],
    [validPlan({ hitPoints: 20 }), "hit points"],
    [validPlan({ armorRating: 4 }), "armor"],
  ])("rejects manipulated statistics: %s", plan => {
    expect(() =>
      validateElementalTotemPlanShape(plan, definitions)
    ).toThrow(/statistics do not match/i);
  });
});

describe("getElementalTotemPlacementRange", () => {
  test("uses the spell range", () => {
    expect(
      getElementalTotemPlacementRange({
        spell: { system: { range: 6 } },
      })
    ).toBe(6);
  });

  test("doubles range for the Dragonbane doubleRange effect", () => {
    expect(
      getElementalTotemPlacementRange({
        criticalEffect: "doubleRange",
        spell: { system: { range: 6 } },
      })
    ).toBe(12);
  });

  test.each([undefined, 0, -1, "invalid"])(
    "rejects invalid spell range %s",
    range => {
      expect(() =>
        getElementalTotemPlacementRange({
          spell: { system: { range } },
        })
      ).toThrow(/no valid placement range/i);
    }
  );
});

describe("getPrimaryActiveGMUser", () => {
  test("returns the first active GM", () => {
    game.users = makeCollection([
      { id: "player", active: true, isGM: false },
      { id: "gm-1", active: true, isGM: true },
      { id: "gm-2", active: true, isGM: true },
    ]);

    expect(getPrimaryActiveGMUser()?.id).toBe("gm-1");
  });

  test("ignores inactive GMs", () => {
    game.users = makeCollection([
      { id: "gm", active: false, isGM: true },
    ]);

    expect(getPrimaryActiveGMUser()).toBeNull();
  });
});

describe("configureCreatedElementalTotem", () => {
  test("sets Observer ownership, HP, armor, and worn state", async () => {
    const armor = makeFlagDocument({
      id: "armor",
      name: "Totem Armor",
      type: "armor",
      update: vi.fn(async () => undefined),
    });
    const actor = makeActor({
      isToken: true,
      items: [armor],
    });
    const token = {
      id: "token",
      name: "Cleansing Totem",
      actor,
    };

    await configureCreatedElementalTotem(token, {
      hitPoints: 20,
      armorRating: 4,
    });

    expect(actor.update).toHaveBeenCalledWith({
      "ownership.default":
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
      "system.hitPoints.base": 20,
      "system.hitPoints.max": 20,
      "system.hitPoints.value": 20,
    });
    expect(armor.update).toHaveBeenCalledWith({
      "system.rating": 4,
      "system.worn": true,
    });
  });

  test("accepts armor identified by its content key", async () => {
    const armor = makeFlagDocument({
      type: "armor",
      name: "Localized Armor Name",
      flags: {
        "bane-of-azeroth": {
          contentKey: "actors.elemental-totems.cleansing.armor",
        },
      },
      update: vi.fn(async () => undefined),
    });
    const actor = makeActor({ isToken: true, items: [armor] });

    await configureCreatedElementalTotem(
      { name: "Cleansing Totem", actor },
      { hitPoints: 10, armorRating: 2 }
    );

    expect(armor.update).toHaveBeenCalledOnce();
  });

  test("rejects a token without a synthetic Actor", async () => {
    await expect(
      configureCreatedElementalTotem(
        {
          name: "Broken Totem",
          actor: makeActor({ isToken: false }),
        },
        { hitPoints: 10, armorRating: 2 }
      )
    ).rejects.toThrow(/no synthetic Actor/i);
  });

  test("rejects a synthetic Actor without Totem Armor", async () => {
    await expect(
      configureCreatedElementalTotem(
        {
          name: "Broken Totem",
          actor: makeActor({ isToken: true, items: [] }),
        },
        { hitPoints: 10, armorRating: 2 }
      )
    ).rejects.toThrow(/no Totem Armor/i);
  });
});

describe("deletePreviousElementalTotems", () => {
  beforeEach(() => {
    game.scenes = makeCollection([]);
  });

  test("removes older casts from every scene", async () => {
    const sceneA = {
      id: "scene-a",
      name: "Scene A",
      tokens: makeCollection([
        {
          id: "old-a",
          flags: {
            "bane-of-azeroth": {
              summonType: "elementalTotem",
              casterActorUuid: "Actor.caster",
              castId: "old-cast",
            },
          },
        },
      ]),
      deleteEmbeddedDocuments: vi.fn(async () => undefined),
    };
    const sceneB = {
      id: "scene-b",
      name: "Scene B",
      tokens: makeCollection([
        {
          id: "old-b",
          flags: {
            "bane-of-azeroth": {
              summonType: "elementalTotem",
              casterActorUuid: "Actor.caster",
              castId: "another-old-cast",
            },
          },
        },
      ]),
      deleteEmbeddedDocuments: vi.fn(async () => undefined),
    };
    game.scenes = makeCollection([sceneA, sceneB]);

    const failed = await deletePreviousElementalTotems(
      "Actor.caster",
      "current-cast"
    );

    expect(failed).toEqual([]);
    expect(sceneA.deleteEmbeddedDocuments).toHaveBeenCalledWith(
      "Token",
      ["old-a"]
    );
    expect(sceneB.deleteEmbeddedDocuments).toHaveBeenCalledWith(
      "Token",
      ["old-b"]
    );
  });

  test("preserves current-cast, other-caster, and ordinary tokens", async () => {
    const scene = {
      id: "scene",
      name: "Scene",
      tokens: makeCollection([
        {
          id: "current",
          flags: {
            "bane-of-azeroth": {
              summonType: "elementalTotem",
              casterActorUuid: "Actor.caster",
              castId: "current-cast",
            },
          },
        },
        {
          id: "other-caster",
          flags: {
            "bane-of-azeroth": {
              summonType: "elementalTotem",
              casterActorUuid: "Actor.other",
              castId: "old-cast",
            },
          },
        },
        {
          id: "ordinary-token",
          flags: {},
        },
      ]),
      deleteEmbeddedDocuments: vi.fn(async () => undefined),
    };
    game.scenes = makeCollection([scene]);

    const failed = await deletePreviousElementalTotems(
      "Actor.caster",
      "current-cast"
    );

    expect(failed).toEqual([]);
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("reports cleanup failures without hiding other scenes", async () => {
    const failedScene = {
      id: "failed",
      name: "Failed Scene",
      tokens: makeCollection([
        {
          id: "old-failed",
          flags: {
            "bane-of-azeroth": {
              summonType: "elementalTotem",
              casterActorUuid: "Actor.caster",
              castId: "old",
            },
          },
        },
      ]),
      deleteEmbeddedDocuments: vi.fn(async () => {
        throw new Error("delete failed");
      }),
    };
    const successfulScene = {
      id: "success",
      name: "Successful Scene",
      tokens: makeCollection([
        {
          id: "old-success",
          flags: {
            "bane-of-azeroth": {
              summonType: "elementalTotem",
              casterActorUuid: "Actor.caster",
              castId: "old",
            },
          },
        },
      ]),
      deleteEmbeddedDocuments: vi.fn(async () => undefined),
    };
    game.scenes = makeCollection([failedScene, successfulScene]);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const failed = await deletePreviousElementalTotems(
      "Actor.caster",
      "current"
    );

    expect(failed).toEqual(["Failed Scene"]);
    expect(successfulScene.deleteEmbeddedDocuments).toHaveBeenCalledOnce();
  });
});
