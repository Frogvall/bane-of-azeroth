import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import DoDWeaponTest from
  "/systems/dragonbane/modules/tests/weapon-test.js";

import {
  patchWeaponTests,
} from "../../foundry/scripts/weapon-features.js";
import {
  getWarlockDemonDefenseBane,
} from "../../foundry/scripts/warlock-demons/defenses.js";

const CONTENT_KEYS = Object.freeze({
  felhunter: "actors.summoned-monsters.felhunter",
  imp: "actors.summoned-monsters.imp",
  sayaad: "actors.summoned-monsters.sayaad",
});

function makeActor(contentKey) {
  return {
    getFlag: (moduleId, key) => {
      if (
        moduleId === "bane-of-azeroth"
        && key === "contentKey"
      ) {
        return contentKey;
      }
      return undefined;
    },
  };
}

function makeTargetToken(contentKey) {
  return {
    actor: makeActor(contentKey),
  };
}

function makeWeapon({
  isRangedWeapon = false,
} = {}) {
  return {
    isRangedWeapon,
    calculateRange: () => 10,
    hasWeaponFeature: () => false,
  };
}

function makeWeaponTest({
  contentKey,
  isRangedWeapon = false,
  noBanesBoons = false,
} = {}) {
  const weaponTest = new DoDWeaponTest();
  weaponTest.weapon = makeWeapon({ isRangedWeapon });
  weaponTest.options = {
    targets: [
      {
        document: makeTargetToken(contentKey),
      },
    ],
  };
  weaponTest.dialogData = {
    actions: [],
    banes: [],
    boons: [],
  };
  weaponTest.noBanesBoons = noBanesBoons;
  return weaponTest;
}

beforeAll(() => {
  patchWeaponTests();
});

beforeEach(() => {
  canvas.scene = {
    tokens: [],
  };
});

describe("Warlock demon defense bane selection", () => {
  test.each([
    false,
    true,
  ])(
    "presents Phase Shift against an Imp when ranged=%s",
    isRangedWeapon => {
      const bane = getWarlockDemonDefenseBane({
        targetToken: makeTargetToken(CONTENT_KEYS.imp),
        weapon: makeWeapon({ isRangedWeapon }),
      });

      expect(bane).toEqual({
        source:
          "BOA.dialog.warlockDemon.phaseShiftBane",
        value: true,
      });
    },
  );

  test("presents Seductive for a melee weapon", () => {
    const bane = getWarlockDemonDefenseBane({
      targetToken: makeTargetToken(CONTENT_KEYS.sayaad),
      weapon: makeWeapon({ isRangedWeapon: false }),
    });

    expect(bane).toEqual({
      source:
        "BOA.dialog.warlockDemon.seductiveBane",
      value: true,
    });
  });

  test("does not present Seductive for a ranged weapon", () => {
    const bane = getWarlockDemonDefenseBane({
      targetToken: makeTargetToken(CONTENT_KEYS.sayaad),
      weapon: makeWeapon({ isRangedWeapon: true }),
    });

    expect(bane).toBeNull();
  });

  test("ignores other Warlock demons", () => {
    const bane = getWarlockDemonDefenseBane({
      targetToken: makeTargetToken(CONTENT_KEYS.felhunter),
      weapon: makeWeapon(),
    });

    expect(bane).toBeNull();
  });
});

describe("Warlock demon defense weapon-test patch", () => {
  test("adds a checked Phase Shift bane to the dialog", () => {
    const weaponTest = makeWeaponTest({
      contentKey: CONTENT_KEYS.imp,
      isRangedWeapon: true,
    });

    weaponTest.updateDialogData();

    expect(weaponTest.dialogData.banes).toEqual([
      {
        source:
          "BOA.dialog.warlockDemon.phaseShiftBane",
        value: true,
      },
    ]);
  });

  test("adds the defense bane no more than once", () => {
    const weaponTest = makeWeaponTest({
      contentKey: CONTENT_KEYS.sayaad,
    });

    weaponTest.updateDialogData();
    weaponTest.updateDialogData();

    expect(weaponTest.dialogData.banes).toEqual([
      {
        source:
          "BOA.dialog.warlockDemon.seductiveBane",
        value: true,
      },
    ]);
  });

  test("respects Dragonbane's no-banes-and-boons mode", () => {
    const weaponTest = makeWeaponTest({
      contentKey: CONTENT_KEYS.imp,
      noBanesBoons: true,
    });

    weaponTest.updateDialogData();

    expect(weaponTest.dialogData.banes).toEqual([]);
  });
});
