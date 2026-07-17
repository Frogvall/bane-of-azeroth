import {
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import optionalRuleSettings from
  "/systems/dragonbane/modules/apps/optional-rule-settings.js";

import {
  actorHasAmmoPouch,
  isArmorPiercingRangedWeapon,
  isScattershotRangedWeapon,
} from "../../foundry/scripts/weapon-features.js";

function makeWeapon({
  isRangedWeapon = true,
  features = [],
} = {}) {
  const featureSet = new Set(features);

  return {
    isRangedWeapon,
    hasWeaponFeature: feature =>
      featureSet.has(feature),
  };
}

describe("Armor Piercing eligibility", () => {
  beforeEach(() => {
    optionalRuleSettings.damageTypes = true;
  });

  test("accepts a ranged, non-thrown piercing weapon", () => {
    const weapon = makeWeapon({
      features: [
        "piercing",
        "armorPiercing",
      ],
    });

    expect(
      isArmorPiercingRangedWeapon(weapon)
    ).toBe(true);
  });

  test("requires the Damage Types optional rule", () => {
    optionalRuleSettings.damageTypes = false;

    const weapon = makeWeapon({
      features: [
        "piercing",
        "armorPiercing",
      ],
    });

    expect(
      isArmorPiercingRangedWeapon(weapon)
    ).toBe(false);
  });

  test("rejects thrown weapons", () => {
    const weapon = makeWeapon({
      features: [
        "thrown",
        "piercing",
        "armorPiercing",
      ],
    });

    expect(
      isArmorPiercingRangedWeapon(weapon)
    ).toBe(false);
  });

  test("requires Piercing", () => {
    const weapon = makeWeapon({
      features: [
        "armorPiercing",
      ],
    });

    expect(
      isArmorPiercingRangedWeapon(weapon)
    ).toBe(false);
  });

  test("requires Armor Piercing", () => {
    const weapon = makeWeapon({
      features: [
        "piercing",
      ],
    });

    expect(
      isArmorPiercingRangedWeapon(weapon)
    ).toBe(false);
  });

  test("rejects melee weapons", () => {
    const weapon = makeWeapon({
      isRangedWeapon: false,
      features: [
        "piercing",
        "armorPiercing",
      ],
    });

    expect(
      isArmorPiercingRangedWeapon(weapon)
    ).toBe(false);
  });
});

describe("Scattershot eligibility", () => {
  test("accepts a ranged, non-thrown Scattershot weapon", () => {
    const weapon = makeWeapon({
      features: [
        "scattershot",
      ],
    });

    expect(
      isScattershotRangedWeapon(weapon)
    ).toBe(true);
  });

  test("rejects thrown Scattershot weapons", () => {
    const weapon = makeWeapon({
      features: [
        "scattershot",
        "thrown",
      ],
    });

    expect(
      isScattershotRangedWeapon(weapon)
    ).toBe(false);
  });

  test("rejects melee Scattershot weapons", () => {
    const weapon = makeWeapon({
      isRangedWeapon: false,
      features: [
        "scattershot",
      ],
    });

    expect(
      isScattershotRangedWeapon(weapon)
    ).toBe(false);
  });
});

describe("Ammo Pouch detection", () => {
  test("finds an Ammo Pouch item", () => {
    const actor = {
      items: [
        {
          type: "item",
          name: "Ammo Pouch",
        },
      ],
    };

    expect(actorHasAmmoPouch(actor)).toBe(true);
  });

  test("ignores case and surrounding whitespace", () => {
    const actor = {
      items: [
        {
          type: "item",
          name: "  aMmO pOuCh  ",
        },
      ],
    };

    expect(actorHasAmmoPouch(actor)).toBe(true);
  });

  test("requires the Dragonbane item type", () => {
    const actor = {
      items: [
        {
          type: "ability",
          name: "Ammo Pouch",
        },
      ],
    };

    expect(actorHasAmmoPouch(actor)).toBe(false);
  });

  test("handles a missing Actor or item collection", () => {
    expect(actorHasAmmoPouch(null)).toBe(false);
    expect(actorHasAmmoPouch({})).toBe(false);
  });
});
