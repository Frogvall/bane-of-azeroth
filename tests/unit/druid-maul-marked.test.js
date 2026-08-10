import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  buildDruidFormAttackData,
} from "../../foundry/scripts/druid-form-mechanics.js";
import {
  applyCommonAnimalStatusIdsLocally,
  registerCommonAnimalStatusSocket,
  statusIdsForCommonAnimalAttackEffects,
} from "../../foundry/scripts/common-animal-status-effects.js";
const MODULE_ID = "bane-of-azeroth";
const MARKED_STATUS_ID = "marked";

function skill(name, value, skillType = "core") {
  return {
    type: "skill",
    name,
    system: {
      value,
      skillType,
    },
  };
}

function druid() {
  return {
    type: "character",
    items: [
      skill("Brawling", 14),
      skill("Elementalism", 16, "magic"),
    ],
  };
}

function settings(value = true) {
  return {
    get: vi.fn(
      (_moduleId, key) =>
        key === "druidMaulMarkedAutomation"
          ? value
          : true,
    ),
  };
}

beforeEach(() => {
  globalThis.CONFIG = {
    statusEffects: [
      {
        id: "restrain",
        name: "DoD.conditions.restrained",
      },
    ],
  };
  globalThis.game = {
    settings: settings(),
    socket: {
      on: vi.fn(),
    },
  };
});

describe("Druid Maul Marked", () => {
  test("puts Marked metadata on Maul but not Shred", () => {
    const actor = druid();
    const maul =
      buildDruidFormAttackData(actor, "bear", 2);
    const shred =
      buildDruidFormAttackData(actor, "cat", 2);

    expect(
      maul.flags[MODULE_ID].attackEffects,
    ).toEqual([
      {
        type: "marked",
        settingKey: "druidMaulMarkedAutomation",
      },
    ]);
    expect(
      shred.flags[MODULE_ID].attackEffects,
    ).toEqual([]);
  });

  test("maps Marked only while its independent automation is enabled", () => {
    const effect = {
      type: "marked",
      settingKey: "druidMaulMarkedAutomation",
    };

    expect(
      statusIdsForCommonAnimalAttackEffects(
        [effect],
        { settings: settings(true) },
      ),
    ).toEqual([MARKED_STATUS_ID]);

    expect(
      statusIdsForCommonAnimalAttackEffects(
        [effect],
        { settings: settings(false) },
      ),
    ).toEqual([]);
  });

  test("registers Marked as an idempotent reminder status", () => {
    registerCommonAnimalStatusSocket();
    registerCommonAnimalStatusSocket();

    expect(
      CONFIG.statusEffects.filter(
        status => status?.id === MARKED_STATUS_ID,
      ),
    ).toHaveLength(1);
    expect(
      CONFIG.statusEffects.find(
        status => status?.id === MARKED_STATUS_ID,
      ),
    ).toMatchObject({
      id: MARKED_STATUS_ID,
      name: "BOA.statuses.marked",
    });
  });

  test("reapplying Marked keeps it active and never overwrites an existing origin", async () => {
    CONFIG.statusEffects.push({
      id: MARKED_STATUS_ID,
      name: "BOA.statuses.marked",
    });

    const existingEffect = {
      origin: "Actor.other-druid",
      update: vi.fn(),
    };
    const target = {
      toggleStatusEffect: vi.fn(
        async () => existingEffect,
      ),
    };

    await applyCommonAnimalStatusIdsLocally(
      target,
      [MARKED_STATUS_ID],
      {
        sourceUuid: "Actor.current-druid",
      },
    );

    expect(
      target.toggleStatusEffect,
    ).toHaveBeenCalledWith(
      MARKED_STATUS_ID,
      { active: true },
    );
    expect(
      existingEffect.update,
    ).not.toHaveBeenCalled();
  });

});
