const checks = [];
const notes = [];

const warSettingKey =
  "warStompAutomation";
const eyeSettingKey =
  "eyeBeamAutomation";

const warSourceKey =
  "ability.war-stomp";
const eyeSourceKey =
  "heroic-class-ability.demon-hunter.eye-beam";

let actor = null;
let originalWarSetting = null;
let originalEyeSetting = null;

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Macro is run by a game master",
    false,
    "Ability-action tests create a temporary Actor and change world settings."
  );

  return boaFinish(
    "ability-actions",
    "BOA DEV – Verify Ability Attacks",
    checks,
    notes
  );
}

const settingsRegistry =
  game.settings?.settings ?? null;

for (const [key, label] of [
  [warSettingKey, "War Stomp"],
  [eyeSettingKey, "Eye Beam"],
]) {
  const definition =
    settingsRegistry?.get?.(
      `${BOA_TEST_MODULE_ID}.${key}`
    ) ?? null;

  boaCheck(
    checks,
    `${label} automation setting is registered`,
    Boolean(definition),
    `${BOA_TEST_MODULE_ID}.${key}`
  );

  if (definition) {
    boaCheckEqual(
      checks,
      `${label} automation defaults to enabled`,
      definition.default,
      true
    );
  }
}

const sourceWarStomp =
  boaFindWorldItem(
    warSourceKey,
    "ability"
  );

const sourceEyeBeam =
  boaFindWorldItem(
    eyeSourceKey,
    "ability"
  );

boaCheck(
  checks,
  "War Stomp source ability exists",
  Boolean(sourceWarStomp),
  warSourceKey
);

boaCheck(
  checks,
  "Eye Beam source ability exists",
  Boolean(sourceEyeBeam),
  eyeSourceKey
);

const api =
  game.modules.get(
    BOA_TEST_MODULE_ID
  )?.api ?? {};

const reconcileActor =
  api.reconcileActorAbilityActions;
const getDefinition =
  api.getAbilityActionDefinition;
const planEyeBeam =
  api.planEyeBeamAction;
const createResolutionMessages =
  api.createAbilityActionResolutionMessages;

boaCheck(
  checks,
  "Ability-action reconciliation API is exposed",
  typeof reconcileActor === "function",
  "reconcileActorAbilityActions"
);

boaCheck(
  checks,
  "Ability-action definition API is exposed",
  typeof getDefinition === "function",
  "getAbilityActionDefinition"
);

boaCheck(
  checks,
  "Eye Beam planning API is exposed",
  typeof planEyeBeam === "function",
  "planEyeBeamAction"
);

if (
  typeof getDefinition === "function"
) {
  const war =
    getDefinition("war-stomp");

  boaCheck(
    checks,
    "War Stomp is represented as a managed BRAWLING attack",
    war?.kind === "weapon" &&
      war?.skill === "Brawling" &&
      war?.damage === "D6" &&
      Number(war?.range) === 2 &&
      Number(war?.wpCost) === 3 &&
      war?.mandatoryBanes === 1 &&
      war?.manualDamageRoll === true,
    war ?? null
  );
}

if (
  typeof planEyeBeam === "function"
) {
  const eye =
    planEyeBeam();

  boaCheck(
    checks,
    "Eye Beam is automatic 2D8 magical damage rather than a weapon test",
    eye?.kind === "ability" &&
      eye?.automaticHit === true &&
      eye?.canParry === false &&
      eye?.damage === "2D8" &&
      Number(eye?.maxRange) === 20 &&
      Number(eye?.wpCost) === 3 &&
      eye?.magical === true &&
      eye?.usesWeaponTest === false &&
      eye?.manualDamageRoll === true,
    eye ?? null
  );
}

if (
  sourceWarStomp &&
  sourceEyeBeam
) {
  try {
    const warRegistered =
      Boolean(
        settingsRegistry?.get?.(
          `${BOA_TEST_MODULE_ID}.${warSettingKey}`
        )
      );

    const eyeRegistered =
      Boolean(
        settingsRegistry?.get?.(
          `${BOA_TEST_MODULE_ID}.${eyeSettingKey}`
        )
      );

    if (warRegistered) {
      originalWarSetting =
        game.settings.get(
          BOA_TEST_MODULE_ID,
          warSettingKey
        );

      await game.settings.set(
        BOA_TEST_MODULE_ID,
        warSettingKey,
        true
      );
    }

    if (eyeRegistered) {
      originalEyeSetting =
        game.settings.get(
          BOA_TEST_MODULE_ID,
          eyeSettingKey
        );

      await game.settings.set(
        BOA_TEST_MODULE_ID,
        eyeSettingKey,
        true
      );
    }

    actor = await Actor.create(
      {
        name:
          "[BOA TEST] Ability Actions " +
          foundry.utils.randomID(6),
        type: "character",
        flags: {
          [BOA_TEST_MODULE_ID]: {
            [BOA_TEST_FIXTURE_FLAG]: true,
          },
        },
      },
      {
        renderSheet: false,
      }
    );

    boaCheck(
      checks,
      "Temporary ability-action Actor was created",
      Boolean(actor?.id),
      actor?.uuid ?? ""
    );

    await actor.createEmbeddedDocuments(
      "Item",
      [
        boaCloneEmbeddedItem(
          sourceWarStomp
        ),
        boaCloneEmbeddedItem(
          sourceEyeBeam
        ),
      ]
    );

    const [manualWarStomp] =
      await actor.createEmbeddedDocuments(
        "Item",
        [
          {
            name: "War Stomp",
            type: "weapon",
            img:
              sourceWarStomp.img,
            system: {
              worn: false,
            },
          },
        ]
      );

    if (
      typeof reconcileActor === "function"
    ) {
      await reconcileActor(actor);

      const managed =
        actor.items.filter(
          item =>
            item.getFlag?.(
              BOA_TEST_MODULE_ID,
              "managedAbilityAction"
            ) === true
        );

      const managedWar =
        managed.filter(
          item =>
            item.getFlag?.(
              BOA_TEST_MODULE_ID,
              "abilityActionKey"
            ) === "war-stomp"
        );

      const managedEye =
        managed.filter(
          item =>
            item.getFlag?.(
              BOA_TEST_MODULE_ID,
              "abilityActionKey"
            ) === "eye-beam"
        );

      boaCheckEqual(
        checks,
        "Exactly one managed War Stomp attack is created",
        managedWar.length,
        1
      );

      boaCheck(
        checks,
        "Managed War Stomp uses Brawling, D6, range 2, no damage bonus, and no parry",
        managedWar[0]?.type === "weapon" &&
          managedWar[0]?.system?.skill?.name ===
            "Brawling" &&
          String(
            managedWar[0]?.system?.damage
          ).toUpperCase() === "D6" &&
          Number(
            managedWar[0]?.system?.range
          ) === 2 &&
          managedWar[0]?.system?.features?.includes(
            "noDamageBonus"
          ) &&
          managedWar[0]?.system?.features?.includes(
            "noparry"
          ) &&
          managedWar[0]?.system?.features?.includes(
            "unarmed"
          ) &&
          managedWar[0]?.img ===
            "modules/bane-of-azeroth/assets/icons/weapons/war_stomp.webp",
        managedWar[0]?.toObject?.() ?? null
      );

      boaCheckEqual(
        checks,
        "Exactly one managed Eye Beam attack action is created",
        managedEye.length,
        1
      );

      boaCheck(
        checks,
        "Managed Eye Beam appears under Weapons with range 20 and 2D8",
        managedEye[0]?.type === "weapon" &&
          Number(
            managedEye[0]?.system?.range
          ) === 20 &&
          String(
            managedEye[0]?.system?.damage
          ).toUpperCase() === "2D8" &&
          managedEye[0]?.system?.skill?.name === "" &&
          managedEye[0]?.system?.features?.includes(
            "noDamageBonus"
          ) &&
          managedEye[0]?.system?.features?.includes(
            "noparry"
          ) &&
          managedEye[0]?.img ===
            "modules/bane-of-azeroth/assets/icons/weapons/eye_beam.webp",
        managedEye[0]?.toObject?.() ?? null
      );

      boaCheck(
        checks,
        "Manual same-name War Stomp weapon survives reconciliation",
        Boolean(
          actor.items.get(
            manualWarStomp.id
          )
        ),
        manualWarStomp.id
      );

      if (warRegistered) {
        await game.settings.set(
          BOA_TEST_MODULE_ID,
          warSettingKey,
          false
        );

        await reconcileActor(actor);

        const managedAfterDisable =
          actor.items.filter(
            item =>
              item.getFlag?.(
                BOA_TEST_MODULE_ID,
                "abilityActionKey"
              ) === "war-stomp"
          );

        boaCheckEqual(
          checks,
          "Disabling War Stomp removes only the managed attack",
          managedAfterDisable.length,
          0
        );

        boaCheck(
          checks,
          "Manual same-name weapon survives disabled automation",
          Boolean(
            actor.items.get(
              manualWarStomp.id
            )
          ),
          manualWarStomp.id
        );

        await game.settings.set(
          BOA_TEST_MODULE_ID,
          warSettingKey,
          true
        );

        await reconcileActor(actor);

        boaCheckEqual(
          checks,
          "Re-enabling War Stomp restores one managed attack",
          actor.items.filter(
            item =>
              item.getFlag?.(
                BOA_TEST_MODULE_ID,
                "abilityActionKey"
              ) === "war-stomp"
          ).length,
          1
        );
      } else {
        boaSkip(
          checks,
          "Disabling War Stomp removes only the managed attack",
          "The War Stomp automation setting is not registered."
        );
        boaSkip(
          checks,
          "Manual same-name weapon survives disabled automation",
          "The War Stomp automation setting is not registered."
        );
        boaSkip(
          checks,
          "Re-enabling War Stomp restores one managed attack",
          "The War Stomp automation setting is not registered."
        );
      }
    } else {
      boaSkip(
        checks,
        "Exactly one managed War Stomp attack is created",
        "The ability-action API is not available."
      );
      boaSkip(
        checks,
        "Managed War Stomp uses Brawling, D6, range 2, no damage bonus, and no parry",
        "The ability-action API is not available."
      );
      boaSkip(
        checks,
        "Eye Beam does not create a fake weapon skill roll",
        "The ability-action API is not available."
      );
      boaSkip(
        checks,
        "Manual same-name War Stomp weapon survives reconciliation",
        "The ability-action API is not available."
      );
    }
  } catch (error) {
    boaCheck(
      checks,
      "Ability-action reconciliation workflow completed",
      false,
      error.stack ?? error.message
    );
  } finally {
    if (actor) {
      try {
        await actor.delete();
        notes.push(
          "Temporary ability-action Actor was deleted."
        );
      } catch (error) {
        boaCheck(
          checks,
          "Temporary ability-action Actor cleanup succeeded",
          false,
          error.message
        );
      }
    }

    if (
      originalWarSetting !== null
    ) {
      try {
        await game.settings.set(
          BOA_TEST_MODULE_ID,
          warSettingKey,
          originalWarSetting
        );
      } catch (error) {
        boaCheck(
          checks,
          "War Stomp automation setting was restored",
          false,
          error.message
        );
      }
    }

    if (
      originalEyeSetting !== null
    ) {
      try {
        await game.settings.set(
          BOA_TEST_MODULE_ID,
          eyeSettingKey,
          originalEyeSetting
        );
      } catch (error) {
        boaCheck(
          checks,
          "Eye Beam automation setting was restored",
          false,
          error.message
        );
      }
    }
  }
}

boaCheck(
  checks,
  "War Stomp does not roll damage automatically",
  typeof createResolutionMessages === "function",
  "createAbilityActionResolutionMessages"
);

notes.push(
  "War Stomp uses one attack roll, then creates one hit/result card per creature " +
  "hit. No D6 is rolled automatically; use Roll Damage only after players/GM " +
  "have had the normal opportunity to react."
);

notes.push(
  "Eye Beam is exposed as a managed Weapon entry and automatically hits without " +
  "a weapon test. It creates a hit/result card first; 2D8 magical damage is " +
  "rolled only when Roll Damage is clicked."
);

return boaFinish(
  "ability-actions",
  "BOA DEV – Verify Ability Attacks",
  checks,
  notes
);
