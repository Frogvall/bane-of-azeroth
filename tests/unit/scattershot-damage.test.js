import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import DoDRollDamageMessageData from
  "/systems/dragonbane/modules/data/messages/roll-damage-message.js";

import {
  onScattershotDamageClick,
} from "../../foundry/scripts/weapon-features.js";

const OriginalRoll = globalThis.Roll;

class NumericRoll {
  constructor(formula) {
    this.formula = formula;
    this.terms = [];
    this.total = null;
  }

  async roll() {
    const halved = /^ceil\(\((-?\d+(?:\.\d+)?)\) \/ 2\)$/
      .exec(this.formula);

    if (halved) {
      this.total = Math.ceil(Number(halved[1]) / 2);
      return this;
    }

    this.total = Number(this.formula);
    return this;
  }
}

function makeDamageEvent() {
  const messageElement = {
    dataset: {
      messageId: "scattershot-message",
    },
  };

  const button = {
    closest: vi.fn(selector => (
      selector === ".chat-message, .message"
        ? messageElement
        : null
    )),
  };

  return {
    detail: 1,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    stopPropagation: vi.fn(),
    target: {
      closest: vi.fn(selector => (
        selector === "[data-action='rollWeaponDamage']"
          ? button
          : null
      )),
    },
  };
}

function makeScattershotMessage(baseDamage) {
  const actor = {
    findSkill: vi.fn(() => ({
      system: {
        attribute: "STR",
      },
    })),
    system: {
      damageBonus: {
        STR: {
          value: 0,
        },
      },
    },
  };

  const weapon = {
    hasWeaponFeature: vi.fn(() => false),
    system: {
      damage: String(baseDamage),
      skill: {
        name: "Crossbow",
      },
    },
  };

  return {
    getFlag: vi.fn((moduleId, key) => (
      moduleId === "bane-of-azeroth"
      && key === "scattershotLongRange"
    )),
    system: {
      toContext: () => ({
        action: "ranged",
        actor,
        criticalEffect: "",
        damageType: "piercing",
        extraDamage: 0,
        ignoreArmor: false,
        success: true,
        targetActor: null,
        weapon,
      }),
    },
  };
}

describe("Scattershot long-range damage", () => {
  beforeEach(() => {
    globalThis.Roll = NumericRoll;
    game.messages = new Map();
  });

  afterEach(() => {
    globalThis.Roll = OriginalRoll;
    game.messages = new Map();
    vi.restoreAllMocks();
  });

  test.each([
    [10, 5],
    [9, 5],
    [1, 1],
  ])(
    "halves %i damage to %i and rounds upward",
    async (baseDamage, expectedDamage) => {
      const message = makeScattershotMessage(baseDamage);
      game.messages.set("scattershot-message", message);

      const toMessage = vi.fn(async () => undefined);
      const fromContext = vi
        .spyOn(DoDRollDamageMessageData, "fromContext")
        .mockReturnValue({
          toMessage,
        });

      const event = makeDamageEvent();
      onScattershotDamageClick(event);

      await vi.waitFor(() => {
        expect(fromContext).toHaveBeenCalledOnce();
      });

      expect(fromContext).toHaveBeenCalledWith(
        expect.objectContaining({
          damage: expectedDamage,
          formula: `ceil((${baseDamage}) / 2)`,
        })
      );
      expect(toMessage).toHaveBeenCalledOnce();
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(event.stopPropagation).toHaveBeenCalledOnce();
      expect(event.stopImmediatePropagation).toHaveBeenCalledOnce();
    }
  );
});
