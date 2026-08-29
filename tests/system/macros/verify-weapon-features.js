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

  const customFeatureRegistry = {
    freehanded:
      "BOA.weaponFeatureTypes.freehanded",
    returning:
      "BOA.weaponFeatureTypes.returning",
    ammunition:
      "BOA.weaponFeatureTypes.ammunition",
    armorPiercing:
      "BOA.weaponFeatureTypes.armorPiercing",
    scattershot:
      "BOA.weaponFeatureTypes.scattershot",
  };

  const liveFeatureTypes =
    CONFIG.DoD?.weaponFeatureTypes ?? {};

  boaCheck(
    checks,
    "Custom weapon features are present in Dragonbane's live CONFIG registry",
    Object.entries(
      customFeatureRegistry,
    ).every(
      ([feature, label]) =>
        liveFeatureTypes[feature] ===
        label,
    ),
    Object.fromEntries(
      Object.keys(
        customFeatureRegistry,
      ).map(
        feature => [
          feature,
          liveFeatureTypes[feature] ??
            null,
        ],
      ),
    ),
  );

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
  const throwingGlaiveSource =
    worldWeapons.find(item =>
      item.name ===
        "Throwing Glaive"
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
  boaCheck(
    checks,
    "Imported Adventure contains the Throwing Glaive source Item",
    Boolean(
      throwingGlaiveSource,
    ),
    throwingGlaiveSource
      ?.uuid ??
      "",
  );

  if (scattershotSource) {
    boaCheck(
      checks,
      "Dragonbane weapon-sheet lookup resolves the real Scattershot feature",
      scattershotSource.system.features
        .filter(
          feature =>
            feature ===
            "scattershot",
        )
        .every(
          feature =>
            Boolean(
              CONFIG.DoD
                ?.weaponFeatureTypes
                ?.[feature],
            ),
        ),
      {
        features:
          scattershotSource.system
            .features,
        scattershotLabel:
          CONFIG.DoD
            ?.weaponFeatureTypes
            ?.scattershot ??
          null,
      },
    );

    boaCheckEqual(
      checks,
      "Real imported Scattershot weapon is recognized by the runtime adapter",
      weaponFeatures.isScattershotRangedWeapon(
        scattershotSource,
      ),
      true,
    );
  }

  if (
    throwingGlaiveSource
  ) {
    let testActor =
      null;
    let rollMessage =
      null;

    try {
      testActor =
        await Actor.create(
          {
            name:
              "[BOA TEST] Throwing Glaive " +
              foundry.utils
                .randomID(6),
            type:
              "character",
            flags: {
              [BOA_TEST_MODULE_ID]: {
                [BOA_TEST_FIXTURE_FLAG]:
                  true,
              },
            },
          },
          {
            renderSheet:
              false,
          },
        );

      await testActor.update({
        "system.attributes.str.base":
          12,
      });

      const glaiveData =
        throwingGlaiveSource
          .toObject();

      delete glaiveData._id;
      delete glaiveData.folder;
      delete glaiveData.ownership;
      delete glaiveData._stats;

      const [
        throwingGlaive,
      ] =
        await testActor
          .createEmbeddedDocuments(
            "Item",
            [
              glaiveData,
            ],
          );

      boaCheckEqual(
        checks,
        "Throwing Glaive resolves its range from the wielder's STR",
        throwingGlaive
          .calculateRange(),
        testActor
          .getAttribute(
            "str",
          ),
      );

      const weaponTest =
        new DoDWeaponTest(
          testActor,
          throwingGlaive,
          {
            noBanesBoons:
              true,
            action:
              "throw",
          },
        );

      weaponTest
        .updateDialogData();

      boaCheck(
        checks,
        "Dragonbane native weapon test exposes Throw for Throwing Glaive",
        weaponTest
          .dialogData
          .actions
          ?.some(
            action =>
              action.id ===
              "throw",
          ) ??
          false,
        weaponTest
          .dialogData
          .actions ??
          [],
      );

      const throwResult =
        await weaponTest.roll();

      rollMessage =
        weaponTest
          .rollMessage ??
        null;

      boaCheckEqual(
        checks,
        "Dragonbane native Throwing Glaive test executes the throw action",
        throwResult
          ?.postRollData
          ?.action,
        "throw",
      );

      boaCheckEqual(
        checks,
        "Dragonbane native Throwing Glaive test marks the attack as ranged",
        throwResult
          ?.postRollData
          ?.isRanged,
        true,
      );
    } catch (error) {
      boaCheck(
        checks,
        "Dragonbane native Throwing Glaive flow completes without an exception",
        false,
        error.stack ??
          error.message,
      );
    } finally {
      if (rollMessage) {
        try {
          await rollMessage
            .delete();
        } catch (error) {
          notes.push(
            "Could not delete temporary Throwing Glaive chat message: " +
              error.message,
          );
        }
      }

      if (testActor) {
        try {
          await testActor
            .delete();
        } catch (error) {
          boaCheck(
            checks,
            "Temporary Throwing Glaive actor cleanup succeeded",
            false,
            error.message,
          );
        }
      }
    }
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
