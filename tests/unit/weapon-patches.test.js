import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import optionalRuleSettings from
  "/systems/dragonbane/modules/apps/optional-rule-settings.js";
import DoDWeaponTest from
  "/systems/dragonbane/modules/tests/weapon-test.js";
import DoD_Utility from
  "/systems/dragonbane/modules/utility.js";

import {
  patchWeaponTests,
} from "../../foundry/scripts/bane-of-azeroth.js";

function makeWeapon({
  features = [],
  range = 10,
} = {}) {
  const featureSet = new Set(features);

  return {
    isRangedWeapon: true,
    calculateRange: () => range,
    hasWeaponFeature: feature => featureSet.has(feature),
  };
}

beforeAll(() => {
  patchWeaponTests();
});

beforeEach(() => {
  optionalRuleSettings.damageTypes = true;
  foundry.applications.api.DialogV2.confirm.mockReset();
  canvas.scene = {
    tokens: [],
  };
  DoD_Utility.calculateDistanceBetweenTokens = vi.fn(() => 0);
});

describe("Ammunition weapon patch", () => {
  test("cancels when the missing Ammo Pouch warning is declined", async () => {
    foundry.applications.api.DialogV2.confirm.mockResolvedValue(false);

    const weaponTest = new DoDWeaponTest();
    weaponTest.weapon = makeWeapon({
      features: ["ammunition"],
    });
    weaponTest.actor = {
      items: [],
    };

    await expect(weaponTest.getRollOptions()).resolves.toEqual({
      cancelled: true,
    });
  });

  test("continues when the warning is accepted", async () => {
    foundry.applications.api.DialogV2.confirm.mockResolvedValue(true);

    const weaponTest = new DoDWeaponTest();
    weaponTest.weapon = makeWeapon({
      features: ["ammunition"],
    });
    weaponTest.actor = {
      items: [],
    };

    await expect(weaponTest.getRollOptions()).resolves.toEqual({});
  });

  test("does not warn when an Ammo Pouch is present", async () => {
    const weaponTest = new DoDWeaponTest();
    weaponTest.weapon = makeWeapon({
      features: ["ammunition"],
    });
    weaponTest.actor = {
      items: [
        {
          type: "item",
          name: "Ammo Pouch",
        },
      ],
    };

    await weaponTest.getRollOptions();

    expect(
      foundry.applications.api.DialogV2.confirm
    ).not.toHaveBeenCalled();
  });
});

describe("Armor Piercing weapon patch", () => {
  test("adds Find Weak Spot immediately after the ranged action", () => {
    const weaponTest = new DoDWeaponTest();
    weaponTest.weapon = makeWeapon({
      features: ["piercing", "armorPiercing"],
    });
    weaponTest.dialogData = {
      actions: [
        { id: "ranged" },
        { id: "other" },
      ],
      banes: [],
    };

    weaponTest.updateDialogData();

    expect(
      weaponTest.dialogData.actions.map(action => action.id)
    ).toEqual(["ranged", "weakpoint", "other"]);
  });

  test("does not add a duplicate Find Weak Spot action", () => {
    const weaponTest = new DoDWeaponTest();
    weaponTest.weapon = makeWeapon({
      features: ["piercing", "armorPiercing"],
    });
    weaponTest.dialogData = {
      actions: [
        { id: "ranged" },
        { id: "weakpoint" },
      ],
      banes: [],
    };

    weaponTest.updateDialogData();

    expect(
      weaponTest.dialogData.actions.filter(
        action => action.id === "weakpoint"
      )
    ).toHaveLength(1);
  });

  test("marks ranged Weak Spot before Dragonbane post-roll handling", () => {
    const weaponTest = new DoDWeaponTest();
    weaponTest.weapon = makeWeapon({
      features: ["piercing", "armorPiercing"],
    });
    weaponTest.preRollData = {
      action: "weakpoint",
      isRanged: false,
    };

    weaponTest.updatePostRollData();

    expect(weaponTest.preRollData.isRanged).toBe(true);
  });

  test("does not mark an ordinary action as ranged Weak Spot", () => {
    const weaponTest = new DoDWeaponTest();
    weaponTest.weapon = makeWeapon({
      features: ["piercing", "armorPiercing"],
    });
    weaponTest.preRollData = {
      action: "ranged",
      isRanged: false,
    };

    weaponTest.updatePostRollData();

    expect(weaponTest.preRollData.isRanged).toBe(false);
  });
});

describe("Scattershot weapon patch", () => {
  function makeTargetedTest({ distance }) {
    const actorToken = {
      actor: {
        uuid: "Actor.attacker",
      },
    };
    const targetToken = {
      id: "target",
    };
    canvas.scene.tokens = [actorToken, targetToken];
    DoD_Utility.calculateDistanceBetweenTokens.mockReturnValue(distance);

    const weaponTest = new DoDWeaponTest();
    weaponTest.actor = {
      uuid: "Actor.attacker",
    };
    weaponTest.weapon = makeWeapon({
      features: ["scattershot"],
      range: 10,
    });
    weaponTest.options = {
      targets: [
        {
          document: targetToken,
        },
      ],
    };
    weaponTest.dialogData = {
      actions: [
        { id: "ranged" },
      ],
      banes: [
        {
          source: "DoD.weapon.pointBlank",
        },
        {
          source: "Another bane",
        },
      ],
    };
    return weaponTest;
  }

  test("removes the point-blank bane at 2 meters", () => {
    const weaponTest = makeTargetedTest({ distance: 2 });

    weaponTest.updateDialogData();

    expect(weaponTest.dialogData.banes).toEqual([
      {
        source: "Another bane",
      },
    ]);
  });

  test("marks an attack beyond normal range", async () => {
    const weaponTest = makeTargetedTest({ distance: 11 });

    weaponTest.updateDialogData();
    const messageData = await weaponTest.createMessageData();

    expect(messageData).toMatchObject({
      flags: {
        "bane-of-azeroth": {
          scattershotLongRange: true,
        },
      },
    });
  });

  test("does not mark an attack within normal range", async () => {
    const weaponTest = makeTargetedTest({ distance: 10 });

    weaponTest.updateDialogData();
    const messageData = await weaponTest.createMessageData();

    expect(messageData).not.toHaveProperty(
      "flags.bane-of-azeroth.scattershotLongRange"
    );
  });

  test("does not apply automatic range handling without a target", async () => {
    const weaponTest = new DoDWeaponTest();
    weaponTest.actor = {
      uuid: "Actor.attacker",
    };
    weaponTest.weapon = makeWeapon({
      features: ["scattershot"],
    });
    weaponTest.options = {
      targets: [],
    };
    weaponTest.dialogData = {
      actions: [],
      banes: [
        {
          source: "DoD.weapon.pointBlank",
        },
      ],
    };

    weaponTest.updateDialogData();
    const messageData = await weaponTest.createMessageData();

    expect(weaponTest.dialogData.banes).toHaveLength(1);
    expect(messageData).not.toHaveProperty(
      "flags.bane-of-azeroth.scattershotLongRange"
    );
  });
});

describe("weapon patch registration", () => {
  test("is idempotent", () => {
    const currentGetRollOptions = DoDWeaponTest.prototype.getRollOptions;

    patchWeaponTests();

    expect(DoDWeaponTest.prototype.getRollOptions).toBe(
      currentGetRollOptions
    );
  });
});
