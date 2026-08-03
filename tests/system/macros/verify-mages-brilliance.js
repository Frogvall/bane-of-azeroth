const checks = [];
const notes = [];
let actor = null;
let originalSetting = null;
let settingRegistered = false;

const settingKey = "mageBrillianceAutomation";
const settingPath =
  `${BOA_TEST_MODULE_ID}.${settingKey}`;
const abilityContentKey =
  "heroic-class-ability.mage.mages-brilliance";
const senseMagicUuid = "Item.RPnxXYVb8z7EG5Wl";

function actorSenseMagicItems(
  targetActor,
  sourceSenseMagic,
) {
  return boaCollectionValues(targetActor?.items)
    .filter(item =>
      item.type === sourceSenseMagic.type &&
      item.name === sourceSenseMagic.name
    );
}

function automaticSenseMagic(
  targetActor,
  sourceSenseMagic,
) {
  return actorSenseMagicItems(
    targetActor,
    sourceSenseMagic,
  ).find(item =>
    boaGetFlag(item, "autoGranted") === true &&
    boaGetFlag(
      item,
      "grantedByAbility",
    ) === abilityContentKey
  ) ?? null;
}

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Macro is run by a game master",
    false,
    "Mage's Brilliance tests create a temporary Actor and change a world setting."
  );

  return boaFinish(
    "mages-brilliance",
    "BOA DEV – Verify Mage's Brilliance",
    checks,
    notes
  );
}

const settingsRegistry =
  game.settings?.settings ?? null;
const settingDefinition =
  settingsRegistry?.get?.(settingPath) ?? null;

settingRegistered = boaCheck(
  checks,
  "Mage's Brilliance automation setting is registered",
  Boolean(settingDefinition),
  settingPath
);

if (settingRegistered) {
  boaCheckEqual(
    checks,
    "Mage's Brilliance automation defaults to enabled",
    settingDefinition.default,
    true
  );
}

const sourceAbility = boaFindWorldItem(
  abilityContentKey,
  "ability"
);

boaCheck(
  checks,
  "Mage's Brilliance world Item exists",
  Boolean(sourceAbility),
  abilityContentKey
);

let sourceSenseMagic = null;
let senseMagicResolutionError = null;

try {
  sourceSenseMagic = await fromUuid(
    senseMagicUuid
  );
} catch (error) {
  senseMagicResolutionError = error;
}

boaCheck(
  checks,
  "Dragonbane Sense Magic source Item resolves",
  Boolean(sourceSenseMagic),
  {
    uuid: senseMagicUuid,
    error:
      senseMagicResolutionError?.stack ??
      senseMagicResolutionError?.message ??
      null,
  }
);

if (
  settingRegistered &&
  sourceAbility &&
  sourceSenseMagic
) {
  try {
    originalSetting = game.settings.get(
      BOA_TEST_MODULE_ID,
      settingKey,
    );

    await game.settings.set(
      BOA_TEST_MODULE_ID,
      settingKey,
      true,
    );

    actor = await Actor.create({
      name:
        `[BOA TEST] Mage's Brilliance ` +
        foundry.utils.randomID(6),
      type: "character",
      flags: {
        [BOA_TEST_MODULE_ID]: {
          [BOA_TEST_FIXTURE_FLAG]: true,
        },
      },
    }, {
      renderSheet: false,
    });

    boaCheck(
      checks,
      "Temporary Mage test Actor was created",
      Boolean(actor?.id),
      actor?.uuid ?? ""
    );

    const [ability] =
      await actor.createEmbeddedDocuments(
        "Item",
        [boaCloneEmbeddedItem(sourceAbility)]
      );

    let managedSenseMagic = null;
    try {
      managedSenseMagic = await boaWaitFor(
        () => automaticSenseMagic(
          actor,
          sourceSenseMagic,
        ),
        {
          description:
            "automatic Sense Magic grant",
        }
      );
    } catch (error) {
      boaCheck(
        checks,
        "Adding Mage's Brilliance grants Sense Magic",
        false,
        error.message
      );
    }

    if (managedSenseMagic) {
      boaCheck(
        checks,
        "Adding Mage's Brilliance grants Sense Magic",
        true
      );
      boaCheckEqual(
        checks,
        "Granted Sense Magic keeps external-source provenance",
        boaGetFlag(
          managedSenseMagic,
          "sourceUuid",
        ),
        senseMagicUuid
      );
      boaCheckEqual(
        checks,
        "Granted Sense Magic records the granting ability",
        boaGetFlag(
          managedSenseMagic,
          "grantedByAbility",
        ),
        abilityContentKey
      );
    }

    await game.settings.set(
      BOA_TEST_MODULE_ID,
      settingKey,
      false,
    );

    try {
      await boaWaitFor(
        () => !automaticSenseMagic(
          actor,
          sourceSenseMagic,
        ),
        {
          description:
            "managed Sense Magic cleanup after disabling automation",
        }
      );
      boaCheck(
        checks,
        "Disabling Mage's Brilliance automation removes managed Sense Magic",
        true
      );
    } catch (error) {
      boaCheck(
        checks,
        "Disabling Mage's Brilliance automation removes managed Sense Magic",
        false,
        error.message
      );
    }

    await game.settings.set(
      BOA_TEST_MODULE_ID,
      settingKey,
      true,
    );

    try {
      await boaWaitFor(
        () => automaticSenseMagic(
          actor,
          sourceSenseMagic,
        ),
        {
          description:
            "Sense Magic reconciliation after re-enabling automation",
        }
      );
      boaCheck(
        checks,
        "Re-enabling Mage's Brilliance automation restores Sense Magic",
        true
      );
    } catch (error) {
      boaCheck(
        checks,
        "Re-enabling Mage's Brilliance automation restores Sense Magic",
        false,
        error.message
      );
    }

    await actor.deleteEmbeddedDocuments(
      "Item",
      [ability.id]
    );

    try {
      await boaWaitFor(
        () => !automaticSenseMagic(
          actor,
          sourceSenseMagic,
        ),
        {
          description:
            "managed Sense Magic removal after ability deletion",
        }
      );
      boaCheck(
        checks,
        "Removing Mage's Brilliance removes managed Sense Magic",
        true
      );
    } catch (error) {
      boaCheck(
        checks,
        "Removing Mage's Brilliance removes managed Sense Magic",
        false,
        error.message
      );
    }

    const [manualSenseMagic] =
      await actor.createEmbeddedDocuments(
        "Item",
        [boaCloneEmbeddedItem(sourceSenseMagic)]
      );
    const [manualPhaseAbility] =
      await actor.createEmbeddedDocuments(
        "Item",
        [boaCloneEmbeddedItem(sourceAbility)]
      );

    await new Promise(
      resolve => setTimeout(resolve, 250)
    );

    const matchingSenseMagic =
      actorSenseMagicItems(
        actor,
        sourceSenseMagic,
      );

    boaCheck(
      checks,
      "A manual Sense Magic prevents an automatic duplicate",
      matchingSenseMagic.length === 1 &&
        matchingSenseMagic[0].id ===
          manualSenseMagic.id &&
        boaGetFlag(
          matchingSenseMagic[0],
          "autoGranted",
        ) !== true,
      String(matchingSenseMagic.length)
    );

    await actor.deleteEmbeddedDocuments(
      "Item",
      [manualPhaseAbility.id]
    );

    await new Promise(
      resolve => setTimeout(resolve, 250)
    );

    boaCheck(
      checks,
      "Manual Sense Magic remains after Mage's Brilliance removal",
      actor.items.has(manualSenseMagic.id) &&
        boaGetFlag(
          manualSenseMagic,
          "autoGranted",
        ) !== true
    );

    await actor.deleteEmbeddedDocuments(
      "Item",
      [manualSenseMagic.id]
    );

    await game.settings.set(
      BOA_TEST_MODULE_ID,
      settingKey,
      false,
    );

    const [disabledAbility] =
      await actor.createEmbeddedDocuments(
        "Item",
        [boaCloneEmbeddedItem(sourceAbility)]
      );

    await new Promise(
      resolve => setTimeout(resolve, 250)
    );

    boaCheck(
      checks,
      "Disabled Mage's Brilliance automation does not grant Sense Magic",
      !automaticSenseMagic(
        actor,
        sourceSenseMagic,
      )
    );

    await actor.deleteEmbeddedDocuments(
      "Item",
      [disabledAbility.id]
    );
  } catch (error) {
    boaCheck(
      checks,
      "Mage's Brilliance automation workflow completed",
      false,
      error.stack ?? error.message
    );
  } finally {
    if (actor) {
      try {
        await actor.delete();
        notes.push(
          "Temporary Mage's Brilliance test Actor was deleted."
        );
      } catch (error) {
        boaCheck(
          checks,
          "Temporary Mage test Actor cleanup succeeded",
          false,
          error.message
        );
      }
    }

    if (originalSetting !== null) {
      try {
        await game.settings.set(
          BOA_TEST_MODULE_ID,
          settingKey,
          originalSetting,
        );
        boaCheckEqual(
          checks,
          "Mage's Brilliance automation setting was restored",
          game.settings.get(
            BOA_TEST_MODULE_ID,
            settingKey,
          ),
          originalSetting
        );
      } catch (error) {
        boaCheck(
          checks,
          "Mage's Brilliance automation setting was restored",
          false,
          error.message
        );
      }
    }
  }
} else {
  boaSkip(
    checks,
    "Mage's Brilliance enabled/disabled runtime workflow",
    "Requires the automation setting, imported Mage's Brilliance Item, and Dragonbane Sense Magic source Item."
  );
}

notes.push(
  "This is the initial 0.11.0 RED contract. It covers the granular world setting, " +
  "external Sense Magic grant provenance, reconciliation, manual-item safety, " +
  "and the disabled path. Free Sense Magic casting and the LANGUAGES result-10 " +
  "choice are intentionally added in subsequent red contracts after the Dragonbane " +
  "casting and skill-roll hooks have been inspected."
);

return boaFinish(
  "mages-brilliance",
  "BOA DEV – Verify Mage's Brilliance",
  checks,
  notes
);
