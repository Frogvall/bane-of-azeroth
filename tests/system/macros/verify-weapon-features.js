const checks = [];
const notes = [];
const testKey = "weapon-features";
const testName = "BOA DEV – Verify Weapon Features";

try {
  const weaponFeatures = await import(
    `/modules/${BOA_TEST_MODULE_ID}/scripts/weapon-features.js`
  );
  const DoDWeaponTest = (
    await import(
      "/systems/dragonbane/modules/tests/weapon-test.js"
    )
  ).default;

  weaponFeatures.patchWeaponTests();

  boaCheckEqual(
    checks,
    "Dragonbane WeaponTest prototype carries the BoA integration patch",
    DoDWeaponTest.prototype.__baneOfAzerothPatched,
    true,
  );

  function featureWeapon(
    featureNames,
    {
      ranged = true,
    } = {},
  ) {
    const features =
      new Set(featureNames);
    return {
      isRangedWeapon: ranged,
      hasWeaponFeature:
        key => features.has(key),
    };
  }

  boaCheckEqual(
    checks,
    "Scattershot recognizes a ranged Scattershot weapon",
    weaponFeatures.isScattershotRangedWeapon(
      featureWeapon([
        "scattershot",
      ]),
    ),
    true,
  );
  boaCheckEqual(
    checks,
    "Scattershot excludes thrown weapons",
    weaponFeatures.isScattershotRangedWeapon(
      featureWeapon([
        "scattershot",
        "thrown",
      ]),
    ),
    false,
  );

  const fakeAmmoPouch = {
    type: "item",
    name: "Ammo Pouch",
  };
  boaCheckEqual(
    checks,
    "Ammo Pouch is detected by the patched Dragonbane weapon flow",
    weaponFeatures.actorHasAmmoPouch({
      items: [
        fakeAmmoPouch,
      ],
    }),
    true,
  );

  const worldWeapons =
    boaCollectionValues(game.items)
      .filter(item =>
        item.type === "weapon"
      );
  const scattershotSource =
    worldWeapons.find(item =>
      item.hasWeaponFeature?.(
        "scattershot",
      )
    ) ?? null;
  const armorPiercingSource =
    worldWeapons.find(item =>
      item.hasWeaponFeature?.(
        "armorPiercing",
      )
    ) ?? null;
  const ammoPouchSource =
    boaCollectionValues(game.items)
      .find(item =>
        item.type === "item" &&
        item.name === "Ammo Pouch"
      ) ?? null;

  boaCheck(
    checks,
    "Imported Adventure contains a Scattershot weapon source",
    Boolean(scattershotSource),
    scattershotSource?.uuid ?? "",
  );
  boaCheck(
    checks,
    "Imported Adventure contains an Armor Piercing weapon source",
    Boolean(armorPiercingSource),
    armorPiercingSource?.uuid ?? "",
  );
  boaCheck(
    checks,
    "Imported Adventure contains the Ammo Pouch source Item",
    Boolean(ammoPouchSource),
    ammoPouchSource?.uuid ?? "",
  );

  if (scattershotSource) {
    boaCheckEqual(
      checks,
      "Real imported Scattershot weapon is recognized by the runtime adapter",
      weaponFeatures.isScattershotRangedWeapon(
        scattershotSource,
      ),
      true,
    );
  }

  if (ammoPouchSource) {
    boaCheckEqual(
      checks,
      "Real imported Ammo Pouch satisfies the ammunition adapter",
      weaponFeatures.actorHasAmmoPouch({
        items: [
          ammoPouchSource,
        ],
      }),
      true,
    );
  }

  if (armorPiercingSource) {
    const optionalRules = (
      await import(
        "/systems/dragonbane/modules/apps/optional-rule-settings.js"
      )
    ).default;

    if (optionalRules.damageTypes) {
      boaCheckEqual(
        checks,
        "Real Armor Piercing weapon enables Find Weak Spot when Damage Types are active",
        weaponFeatures.isArmorPiercingRangedWeapon(
          armorPiercingSource,
        ),
        true,
      );
    } else {
      boaSkip(
        checks,
        "Real Armor Piercing Find Weak Spot integration",
        "Dragonbane Damage Types optional rule is disabled in this world.",
      );
    }
  }
} catch (error) {
  boaCheck(
    checks,
    "Weapon Feature runtime integration loaded",
    false,
    error.stack ?? error.message,
  );
}

return boaFinish(
  testKey,
  testName,
  checks,
  notes,
);
