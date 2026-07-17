import {
  describe,
  expect,
  test,
} from "vitest";

import {
  buildElementalTotemPlan,
  buildTotemOptions,
  getElementalTotemAuraData,
  shouldStartElementalTotemDialog,
} from "../../foundry/scripts/elemental-totems.js";

const definitions = {
  baseArmor: 2,
  baseHitPoints: 10,
  baseRange: 10,
  totems: [
    {
      key: "cleansing",
      name: "Cleansing Totem",
    },
    {
      key: "flametongue",
      name: "Flametongue Totem",
    },
    {
      key: "stoneskin",
      name: "Stoneskin Totem",
    },
    {
      key: "windfury",
      name: "Windfury Totem",
    },
  ],
};

const message = {
  id: "message-1",
  speaker: {
    scene: "scene-1",
    token: "token-1",
  },
};

function makeContext(overrides = {}) {
  return {
    actor: {
      uuid: "Actor.caster",
    },
    criticalEffect: "",
    powerLevel: 1,
    spell: {
      uuid: "Actor.caster.Item.elemental-totem",
    },
    ...overrides,
  };
}

function makeSpellMessage({
  contentKey = "spells.elemental-totem",
  criticalEffect = "",
  isDragon = false,
  success = true,
} = {}) {
  const context = {
    criticalEffect,
    isDragon,
    success,
    spell: {
      getFlag(moduleId, key) {
        if (
          moduleId === "bane-of-azeroth" &&
          key === "contentKey"
        ) {
          return contentKey;
        }
        return undefined;
      },
    },
  };

  return {
    id: "spell-message",
    type: "spellTest",
    system: {
      toContext: () => context,
    },
  };
}

describe("Elemental Totem plans", () => {
  test("builds the power-level 1 baseline", () => {
    const plan = buildElementalTotemPlan(
      message,
      makeContext(),
      definitions,
      ["cleansing"],
      0,
      0
    );

    expect(plan).toMatchObject({
      actorUuid: "Actor.caster",
      armorRating: 2,
      auraRange: 10,
      casterTokenId: "token-1",
      hitPoints: 10,
      powerLevel: 1,
      sceneId: "scene-1",
      sourceMessageId: "message-1",
      spellUuid:
        "Actor.caster.Item.elemental-totem",
      totemTypes: [
        "cleansing",
      ],
    });
  });

  test("doubles reach once", () => {
    const plan = buildElementalTotemPlan(
      message,
      makeContext({
        powerLevel: 2,
      }),
      definitions,
      ["flametongue"],
      1,
      0
    );

    expect(plan.auraRange).toBe(20);
    expect(plan.hitPoints).toBe(10);
    expect(plan.armorRating).toBe(2);
  });

  test("doubles reach twice", () => {
    const plan = buildElementalTotemPlan(
      message,
      makeContext({
        powerLevel: 3,
      }),
      definitions,
      ["flametongue"],
      2,
      0
    );

    expect(plan.auraRange).toBe(40);
  });

  test("doubles durability once", () => {
    const plan = buildElementalTotemPlan(
      message,
      makeContext({
        powerLevel: 2,
      }),
      definitions,
      ["stoneskin"],
      0,
      1
    );

    expect(plan.hitPoints).toBe(20);
    expect(plan.armorRating).toBe(4);
    expect(plan.auraRange).toBe(10);
  });

  test("doubles durability twice", () => {
    const plan = buildElementalTotemPlan(
      message,
      makeContext({
        powerLevel: 3,
      }),
      definitions,
      ["stoneskin"],
      0,
      2
    );

    expect(plan.hitPoints).toBe(40);
    expect(plan.armorRating).toBe(8);
  });

  test("rejects duplicate totem types", () => {
    expect(() =>
      buildElementalTotemPlan(
        message,
        makeContext({
          powerLevel: 2,
        }),
        definitions,
        [
          "windfury",
          "windfury",
        ],
        0,
        0
      )
    ).toThrow(/duplicate/i);
  });
});

describe("Elemental Totem option rendering", () => {
  test("excludes already selected totem types", () => {
    const html = buildTotemOptions(
      definitions,
      "",
      [
        "cleansing",
        "flametongue",
      ]
    );

    expect(html).not.toContain(
      'value="cleansing"'
    );
    expect(html).not.toContain(
      'value="flametongue"'
    );
    expect(html).toContain(
      'value="stoneskin"'
    );
    expect(html).toContain(
      'value="windfury"'
    );
  });

  test("marks the selected option", () => {
    const html = buildTotemOptions(
      definitions,
      "windfury"
    );

    expect(html).toContain(
      'value="windfury" selected'
    );
  });
});

describe("Elemental Totem ChatMessage trigger", () => {
  test("starts after a normal success", () => {
    expect(
      shouldStartElementalTotemDialog(
        makeSpellMessage()
      )
    ).toBe(true);
  });

  test("ignores failed spell tests", () => {
    expect(
      shouldStartElementalTotemDialog(
        makeSpellMessage({
          success: false,
        })
      )
    ).toBe(false);
  });

  test("waits for a dragon critical-effect choice", () => {
    expect(
      shouldStartElementalTotemDialog(
        makeSpellMessage({
          isDragon: true,
        })
      )
    ).toBe(false);
  });

  test("starts after the dragon effect is chosen", () => {
    expect(
      shouldStartElementalTotemDialog(
        makeSpellMessage({
          criticalEffect: "doubleRange",
          isDragon: true,
        })
      )
    ).toBe(true);
  });

  test("ignores other spells", () => {
    expect(
      shouldStartElementalTotemDialog(
        makeSpellMessage({
          contentKey: "spells.shadowform",
        })
      )
    ).toBe(false);
  });
});

describe("Elemental Totem aura calculations", () => {
  test("converts world distance to pixel radius", () => {
    const scene = {
      grid: {
        distance: 10,
        size: 100,
      },
    };

    const aura = getElementalTotemAuraData({
      document: {
        flags: {
          "bane-of-azeroth": {
            auraAlpha: 0.28,
            auraColor: "#d9f04a",
            auraRange: 20,
            summonType: "elementalTotem",
          },
        },
        parent: scene,
      },
      scene,
    });

    expect(aura).toEqual({
      alpha: 0.28,
      color: 0xd9f04a,
      radius: 200,
    });
  });

  test("uses safe defaults for invalid optional color data", () => {
    const scene = {
      grid: {
        distance: 10,
        size: 100,
      },
    };

    const aura = getElementalTotemAuraData({
      document: {
        flags: {
          "bane-of-azeroth": {
            auraAlpha: 2,
            auraColor: "not-a-color",
            auraRange: 10,
            summonType: "elementalTotem",
          },
        },
        parent: scene,
      },
      scene,
    });

    expect(aura.alpha).toBe(0.2);
    expect(aura.color).toBe(0x00ff00);
    expect(aura.radius).toBe(100);
  });

  test("ignores ordinary tokens", () => {
    const aura = getElementalTotemAuraData({
      document: {
        flags: {},
      },
    });

    expect(aura).toBeNull();
  });
});
