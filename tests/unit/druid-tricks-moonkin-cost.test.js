import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID =
  "bane-of-azeroth";
let mechanics;

function settings({
  restriction = true,
  moonkinCost = true,
} = {}) {
  return {
    get: vi.fn((moduleId, key) => {
      if (moduleId !== MODULE_ID) {
        return true;
      }
      if (key === "druidFormSpellRestrictionAutomation") {
        return restriction;
      }
      if (key === "druidMoonkinSpellCostAutomation") {
        return moonkinCost;
      }
      return true;
    }),
  };
}

function actor({
  form = "humanoid",
  stars = null,
} = {}) {
  return {
    id: "druid",
    uuid: "Actor.druid",
    documentName: "Actor",
    type: "character",
    flags: {
      [MODULE_ID]: {
        druidFormState: {
          currentForm: form,
          activations: stars == null
            ? {}
            : {
                stars: {
                  active: true,
                  powerLevel: stars,
                },
              },
        },
      },
    },
    getFlag(moduleId, key) {
      return this.flags?.[moduleId]?.[key];
    },
  };
}

function spell(parent, {
  rank = 1,
  requirement = "Word",
} = {}) {
  return {
    type: "spell",
    parent,
    system: {
      rank,
      requirement,
    },
  };
}

beforeEach(async () => {
  vi.resetModules();
  globalThis.game = {
    system: {
      id: "dragonbane",
    },
    settings: settings(),
    i18n: {
      localize: vi.fn(key => key),
      format: vi.fn(key => key),
    },
  };
  globalThis.ui = {
    notifications: {
      warn: vi.fn(),
    },
  };

  mechanics = await import(
    "../../foundry/scripts/druid-form-mechanics.js"
  );
});

afterEach(() => {
  delete globalThis.game;
  delete globalThis.ui;
});

describe("Druid magic tricks and Moonkin spell costs", () => {
  test("Gesture-only rank-0 tricks are blocked in Travel Bear and Cat", () => {
    for (const form of ["travel", "bear", "cat"]) {
      const druid = actor({ form });
      const puffOfSmoke = spell(druid, {
        rank: 0,
        requirement: "Gesture",
      });

      expect(
        mechanics.isDruidFormSpellAllowed(
          druid,
          puffOfSmoke,
          { settings: settings() },
        ),
      ).toBe(false);
    }
  });

  test("Word-only rank-0 tricks remain allowed in restricted forms", () => {
    const druid = actor({ form: "bear" });
    const trick = spell(druid, {
      rank: 0,
      requirement: "Word",
    });

    expect(
      mechanics.isDruidFormSpellAllowed(
        druid,
        trick,
        { settings: settings() },
      ),
    ).toBe(true);
  });

  test("Moonkin reduces normal spell cost by Stars PL with minimum 1", () => {
    for (const [stars, baseCost, expected] of [
      [1, 6, 5],
      [2, 6, 4],
      [3, 6, 3],
      [3, 2, 1],
    ]) {
      const druid = actor({ form: "moonkin", stars });
      const item = spell(druid, { rank: 2 });

      expect(
        mechanics.getDruidMoonkinSpellCost(
          item,
          3,
          () => baseCost,
          settings(),
        ),
      ).toBe(expected);
    }
  });

  test("Moonkin magic tricks cost 0 WP", () => {
    const druid = actor({ form: "moonkin", stars: 2 });
    const trick = spell(druid, {
      rank: 0,
      requirement: "Gesture",
    });

    expect(
      mechanics.getDruidMoonkinSpellCost(
        trick,
        0,
        () => 1,
        settings(),
      ),
    ).toBe(0);
  });

  test("Stars gives no discount outside current Moonkin Form", () => {
    for (const form of [
      "travel",
      "bear",
      "cat",
      "tree",
      "humanoid",
    ]) {
      const druid = actor({ form, stars: 3 });
      const item = spell(druid, { rank: 2 });

      expect(
        mechanics.getDruidMoonkinSpellCost(
          item,
          2,
          () => 4,
          settings(),
        ),
      ).toBe(4);
    }
  });

  test("Moonkin cost setting disables the discount", () => {
    const druid = actor({ form: "moonkin", stars: 3 });
    const item = spell(druid, { rank: 2 });

    expect(
      mechanics.getDruidMoonkinSpellCost(
        item,
        2,
        () => 4,
        settings({ moonkinCost: false }),
      ),
    ).toBe(4);
  });

  test("an already-free spell remains free when wrappers compose", () => {
    const druid = actor({ form: "moonkin", stars: 3 });
    const item = spell(druid, { rank: 1 });

    expect(
      mechanics.getDruidMoonkinSpellCost(
        item,
        1,
        () => 0,
        settings(),
      ),
    ).toBe(0);
  });

  test("Item getSpellCost wrapper evaluates the live current form", () => {
    class ItemClass {
      constructor(parent, { rank = 1 } = {}) {
        this.type = "spell";
        this.parent = parent;
        this.system = { rank };
      }

      getSpellCost(powerLevel) {
        return Number(powerLevel) * 2;
      }
    }

    expect(
      mechanics.patchDruidMoonkinSpellCost({ ItemClass }),
    ).toBe(true);

    const moonkinSpell = new ItemClass(
      actor({ form: "moonkin", stars: 2 }),
    );
    const bearSpell = new ItemClass(
      actor({ form: "bear", stars: 2 }),
    );
    const moonkinTrick = new ItemClass(
      actor({ form: "moonkin", stars: 2 }),
      { rank: 0 },
    );

    expect(moonkinSpell.getSpellCost(2)).toBe(2);
    expect(bearSpell.getSpellCost(2)).toBe(4);
    expect(moonkinTrick.getSpellCost(0)).toBe(0);
  });

  test("SpellTest roll guard blocks auto-success Gesture tricks", async () => {
    class BaseTest {
      async roll() {
        return "native-roll";
      }
    }

    class SpellTest extends BaseTest {
      constructor(druid, item) {
        super();
        this.actor = druid;
        this.spell = item;
      }

      async getRollOptions() {
        return {
          cancelled: false,
        };
      }
    }

    class WeaponTest {
      async roll() {
        return "native-weapon";
      }
    }

    class ActorSheet {
      async _onDamageRoll() {
        return "native-damage";
      }
    }

    const result = await mechanics.patchDruidFormWeaponUsage({
      WeaponTestClass: WeaponTest,
      ActorSheetClass: ActorSheet,
      SpellTestClass: SpellTest,
    });

    expect(result.spellTest).toBe("patched");
    expect(result.spellRoll).toBe("patched");

    const druid = actor({ form: "bear" });
    const puff = spell(druid, {
      rank: 0,
      requirement: "Gesture",
    });
    const wordTrick = spell(druid, {
      rank: 0,
      requirement: "Word",
    });

    expect(await new SpellTest(druid, puff).roll()).toBe(false);
    expect(await new SpellTest(druid, wordTrick).roll()).toBe(
      "native-roll",
    );
  });
});
