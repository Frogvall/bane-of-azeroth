import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

let api;

function legacySkillRollHandler() {
  const title = "castMagicTrickTitle";
  if (
    this.actor.system.willPoints.value < 1
  ) {
    return title;
  }
  const oldWP =
    this.actor.system.willPoints.value;
  return oldWP - 1;
}

function makeLegacyApp({
  item,
  actor,
}) {
  let listener = null;
  const element = {
    addEventListener: vi.fn(
      (_name, callback, capture) => {
        listener = callback;
        expect(capture).toBe(true);
      },
    ),
    removeEventListener: vi.fn(),
  };
  const items = new Map([
    [item.id, item],
  ]);
  actor.items = items;

  const app = {
    actor,
    element,
    options: {
      actions: {
        skillRoll: {
          handler: legacySkillRollHandler,
        },
      },
    },
  };

  const row = {
    dataset: {
      itemId: item.id,
    },
  };
  const actionTarget = {
    closest: vi.fn(selector => (
      selector === ".sheet-table-data"
        ? row
        : null
    )),
  };
  const event = {
    type: "click",
    button: 0,
    target: {
      closest: vi.fn(selector => (
        selector ===
          '[data-action="skillRoll"]'
          ? actionTarget
          : null
      )),
    },
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  };

  return {
    app,
    event,
    getListener: () => listener,
  };
}

beforeEach(async () => {
  vi.resetModules();
  globalThis.game = {
    settings: {
      get: vi.fn(() => true),
    },
    i18n: {
      format: vi.fn(key => key),
      localize: vi.fn(key => key),
    },
    user: {
      id: "user",
    },
  };
  globalThis.ui = {
    notifications: {
      warn: vi.fn(),
    },
  };
  api = await import(
    "../../foundry/scripts/spellcasting.js"
  );
  api.clearBoASpellcastingPoliciesForTests();
});

describe("shared BoA spellcasting", () => {
  test("one getSpellCost patch composes cost policies", () => {
    class ItemClass {
      getSpellCost(powerLevel) {
        return Number(powerLevel) * 2;
      }
    }

    api.registerBoASpellCostPolicy(
      "free",
      ({ item, cost }) =>
        item.free
          ? 0
          : cost,
    );
    api.registerBoASpellCostPolicy(
      "discount",
      ({ item, cost }) =>
        item.discount
          ? Math.max(1, cost - 2)
          : cost,
    );

    expect(
      api.patchBoASpellCost({ ItemClass }),
    ).toBe(true);

    const free = new ItemClass();
    free.free = true;
    free.discount = true;

    const discounted = new ItemClass();
    discounted.discount = true;

    expect(
      free.getSpellCost(2),
    ).toBe(0);
    expect(
      discounted.getSpellCost(3),
    ).toBe(4);
  });

  test("Mage, Evoker, and Druid keep the same shared wrapper", async () => {
    const mage = await import(
      "../../foundry/scripts/mage-brilliance.js"
    );
    const evoker = await import(
      "../../foundry/scripts/evokers-legacy.js"
    );
    const druid = await import(
      "../../foundry/scripts/druid-form-mechanics.js"
    );

    class ItemClass {
      getSpellCost(powerLevel) {
        return Number(powerLevel) * 2;
      }
    }

    expect(
      mage.patchMageBrillianceSpellCost({
        ItemClass,
      }),
    ).toBe(true);
    const sharedWrapper =
      ItemClass.prototype.getSpellCost;

    expect(
      evoker.patchEvokersLegacySpellCost({
        ItemClass,
      }),
    ).toBe(true);
    expect(
      ItemClass.prototype.getSpellCost,
    ).toBe(sharedWrapper);

    expect(
      druid.patchDruidMoonkinSpellCost({
        ItemClass,
      }),
    ).toBe(true);
    expect(
      ItemClass.prototype.getSpellCost,
    ).toBe(sharedWrapper);
  });

  test("shared cast policies can block a legacy magic trick", async () => {
    api.registerBoASpellCastPolicy(
      "word-only",
      () => false,
    );

    const actor = {
      documentName: "Actor",
      type: "character",
      isObserver: true,
      system: {
        willPoints: {
          value: 5,
        },
      },
    };
    const item = {
      id: "puff",
      name: "Puff of Smoke",
      type: "spell",
      parent: actor,
      system: {
        rank: 0,
        requirement: "Gesture",
      },
    };
    const {
      app,
      event,
      getListener,
    } = makeLegacyApp({
      actor,
      item,
    });
    const cast = vi.fn();

    expect(
      api.attachBoALegacyMagicTrickAdapter(
        app,
        { cast },
      ),
    ).toBe(true);

    await getListener()(event);

    expect(event.preventDefault)
      .toHaveBeenCalledOnce();
    expect(event.stopImmediatePropagation)
      .toHaveBeenCalledOnce();
    expect(cast)
      .not.toHaveBeenCalled();
    expect(
      globalThis.ui.notifications.warn,
    ).toHaveBeenCalledOnce();
  });

  test("shared cost policies can make a legacy magic trick free", async () => {
    api.registerBoASpellCostPolicy(
      "free-trick",
      ({ item, cost }) =>
        Number(item.system?.rank) === 0
          ? 0
          : cost,
    );

    const actor = {
      documentName: "Actor",
      type: "character",
      isObserver: true,
      system: {
        willPoints: {
          value: 0,
        },
      },
    };
    const item = {
      id: "trick",
      name: "Magic Trick",
      type: "spell",
      parent: actor,
      system: {
        rank: 0,
        requirement: "Word",
      },
    };
    const {
      app,
      event,
      getListener,
    } = makeLegacyApp({
      actor,
      item,
    });
    const cast = vi.fn(
      async () => ({
        handled: true,
        cast: true,
        wpCost: 0,
      }),
    );

    expect(
      api.attachBoALegacyMagicTrickAdapter(
        app,
        { cast },
      ),
    ).toBe(true);

    await getListener()(event);

    expect(cast)
      .toHaveBeenCalledWith(
        actor,
        item,
        {
          wpCost: 0,
        },
      );
  });
  test("native Dragonbane spell-test dialog reflects a free magic trick", () => {
    class SpellTest {
      constructor(spell) {
        this.spell = spell;
        this.options = {
          content:
            "Spend 1 WP to cast Sense Magic?",
        };
        this.dialogData = {};
      }

      updateDialogData() {
        this.dialogData.wpSources = [
          {
            name: "Actor",
          },
          {
            name: "Power Source",
          },
        ];
        return "native";
      }
    }

    const spell = {
      name: "Sense Magic",
      type: "spell",
      system: {
        rank: 0,
      },
      getSpellCost: vi.fn(
        () => 0,
      ),
    };

    expect(
      api.patchBoASpellTestDialog({
        SpellTestClass: SpellTest,
      }),
    ).toBe(true);

    const testInstance =
      new SpellTest(spell);

    expect(
      testInstance.updateDialogData(),
    ).toBe("native");
    expect(
      testInstance.options.noWpCost,
    ).toBe(true);
    expect(
      testInstance.options.content,
    ).toBe(
      "Cast Sense Magic without spending WP?",
    );
    expect(
      testInstance.dialogData.wpSources,
    ).toBeUndefined();
  });

  test("native Dragonbane spell-test dialog leaves an ordinary 1 WP trick unchanged", () => {
    class SpellTest {
      constructor(spell) {
        this.spell = spell;
        this.options = {
          content:
            "Spend 1 WP to cast Magic Trick?",
        };
        this.dialogData = {};
      }

      updateDialogData() {
        this.dialogData.wpSources = [
          {
            name: "Actor",
          },
          {
            name: "Power Source",
          },
        ];
      }
    }

    const spell = {
      name: "Magic Trick",
      type: "spell",
      system: {
        rank: 0,
      },
      getSpellCost: vi.fn(
        () => 1,
      ),
    };

    expect(
      api.patchBoASpellTestDialog({
        SpellTestClass: SpellTest,
      }),
    ).toBe(true);

    const testInstance =
      new SpellTest(spell);
    testInstance.updateDialogData();

    expect(
      testInstance.options.noWpCost,
    ).toBeUndefined();
    expect(
      testInstance.options.content,
    ).toBe(
      "Spend 1 WP to cast Magic Trick?",
    );
    expect(
      testInstance.dialogData.wpSources,
    ).toHaveLength(2);
  });

});
