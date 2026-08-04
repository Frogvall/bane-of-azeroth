const checks = [];
const notes = [];

const settingKey =
  "evokersLegacyAutomation";
const settingPath =
  `${BOA_TEST_MODULE_ID}.${settingKey}`;
const abilityContentKey =
  "heroic-class-ability.evoker.evokers-legacy";

let actor = null;
let originalSetting = null;

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Macro is run by a game master",
    false,
    "Evoker's Legacy tests create a temporary Actor and change a world setting."
  );

  return boaFinish(
    "evokers-legacy",
    "BOA DEV – Verify Evoker's Legacy",
    checks,
    notes
  );
}

const settingsRegistry =
  game.settings?.settings ?? null;
const settingDefinition =
  settingsRegistry?.get?.(settingPath) ?? null;
const settingRegistered = boaCheck(
  checks,
  "Evoker's Legacy automation setting is registered",
  Boolean(settingDefinition),
  settingPath
);

if (settingRegistered) {
  boaCheckEqual(
    checks,
    "Evoker's Legacy automation defaults to enabled",
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
  "Evoker's Legacy world Item exists",
  Boolean(sourceAbility),
  abilityContentKey
);

const sourceSpell =
  boaCollectionValues(game.items)
    .find(item =>
      item.type === "spell" &&
      Number(item.system?.rank) > 0 &&
      typeof item.getSpellCost === "function"
    ) ?? null;

boaCheck(
  checks,
  "A power-level spell is available for the runtime test",
  Boolean(sourceSpell),
  sourceSpell?.uuid ?? ""
);

if (
  sourceAbility &&
  sourceSpell
) {
  try {
    if (settingRegistered) {
      originalSetting = game.settings.get(
        BOA_TEST_MODULE_ID,
        settingKey
      );

      await game.settings.set(
        BOA_TEST_MODULE_ID,
        settingKey,
        true
      );
    }

    actor = await Actor.create(
      {
        name:
          "[BOA TEST] Evoker's Legacy " +
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
      "Temporary Evoker test Actor was created",
      Boolean(actor?.id),
      actor?.uuid ?? ""
    );

    const [spell] =
      await actor.createEmbeddedDocuments(
        "Item",
        [boaCloneEmbeddedItem(sourceSpell)]
      );

    const nativeCosts = [
      spell.getSpellCost(1),
      spell.getSpellCost(2),
      spell.getSpellCost(3),
    ];

    const [ability] =
      await actor.createEmbeddedDocuments(
        "Item",
        [boaCloneEmbeddedItem(sourceAbility)]
      );

    const legacyCosts = [
      spell.getSpellCost(1),
      spell.getSpellCost(2),
      spell.getSpellCost(3),
    ];

    boaCheck(
      checks,
      "Evoker's Legacy reduces spell costs to 2/3/4 WP",
      JSON.stringify(legacyCosts) ===
        JSON.stringify([2, 3, 4]),
      {
        nativeCosts,
        legacyCosts,
      }
    );

    let DoDSpellTest = null;
    let importError = null;

    try {
      const relativePath =
        "systems/dragonbane/modules/tests/spell-test.js";
      const route =
        foundry.utils.getRoute?.(relativePath) ??
        `/${relativePath}`;
      const module =
        await import(route);

      DoDSpellTest =
        module?.default ?? null;
    } catch (error) {
      importError = error;
    }

    boaCheck(
      checks,
      "Dragonbane DoDSpellTest can be loaded",
      typeof DoDSpellTest === "function",
      importError?.stack ??
        importError?.message ??
        ""
    );

    if (typeof DoDSpellTest === "function") {
      await actor.update({
        "system.willPoints.value": 10,
      });

      const test = new DoDSpellTest(
        actor,
        spell,
        {
          autoSuccess: true,
          skipDialog: true,
          powerLevel: 2,
          formula: "1",
        }
      );

      test.updateDialogData();
      test.updatePreRollData();

      boaCheckEqual(
        checks,
        "Dragonbane PL2 pre-roll data uses the reduced 3 WP cost",
        test.preRollData.wpCost,
        3
      );

      test.roll = {
        result: 1,
      };
      test.updatePostRollData();

      let paymentObserved = false;
      try {
        await boaWaitFor(
          () =>
            actor.system.willPoints.value === 7,
          {
            description:
              "Evoker's Legacy PL2 WP payment",
          }
        );
        paymentObserved = true;
      } catch (_error) {
        paymentObserved = false;
      }

      boaCheck(
        checks,
        "Dragonbane PL2 spell payment actually spends 3 WP",
        paymentObserved,
        {
          expected: 7,
          actual:
            actor.system.willPoints.value,
          wpCost:
            test.preRollData.wpCost,
        }
      );
    } else {
      boaSkip(
        checks,
        "Dragonbane PL2 pre-roll data uses the reduced 3 WP cost",
        "DoDSpellTest could not be loaded."
      );
      boaSkip(
        checks,
        "Dragonbane PL2 spell payment actually spends 3 WP",
        "DoDSpellTest could not be loaded."
      );
    }

    if (settingRegistered) {
      await game.settings.set(
        BOA_TEST_MODULE_ID,
        settingKey,
        false
      );

      const disabledCosts = [
        spell.getSpellCost(1),
        spell.getSpellCost(2),
        spell.getSpellCost(3),
      ];

      boaCheck(
        checks,
        "Disabling Evoker's Legacy automation restores native costs",
        JSON.stringify(disabledCosts) ===
          JSON.stringify(nativeCosts),
        {
          nativeCosts,
          disabledCosts,
        }
      );

      await game.settings.set(
        BOA_TEST_MODULE_ID,
        settingKey,
        true
      );
    } else {
      boaSkip(
        checks,
        "Disabling Evoker's Legacy automation restores native costs",
        "The Evoker's Legacy setting is not registered."
      );
    }

    await actor.deleteEmbeddedDocuments(
      "Item",
      [ability.id]
    );

    const removedCosts = [
      spell.getSpellCost(1),
      spell.getSpellCost(2),
      spell.getSpellCost(3),
    ];

    boaCheck(
      checks,
      "Removing Evoker's Legacy restores native costs",
      JSON.stringify(removedCosts) ===
        JSON.stringify(nativeCosts),
      {
        nativeCosts,
        removedCosts,
      }
    );
  } catch (error) {
    boaCheck(
      checks,
      "Evoker's Legacy automation workflow completed",
      false,
      error.stack ?? error.message
    );
  } finally {
    if (actor) {
      try {
        await actor.delete();
        notes.push(
          "Temporary Evoker's Legacy test Actor was deleted."
        );
      } catch (error) {
        boaCheck(
          checks,
          "Temporary Evoker test Actor cleanup succeeded",
          false,
          error.message
        );
      }
    }

    if (
      settingRegistered &&
      originalSetting !== null
    ) {
      try {
        await game.settings.set(
          BOA_TEST_MODULE_ID,
          settingKey,
          originalSetting
        );

        boaCheckEqual(
          checks,
          "Evoker's Legacy automation setting was restored",
          game.settings.get(
            BOA_TEST_MODULE_ID,
            settingKey
          ),
          originalSetting
        );
      } catch (error) {
        boaCheck(
          checks,
          "Evoker's Legacy automation setting was restored",
          false,
          error.message
        );
      }
    }
  }
} else {
  boaSkip(
    checks,
    "Evoker's Legacy runtime workflow",
    "Requires the imported Evoker's Legacy Item and a power-level spell."
  );
}

notes.push(
  "Dragonbane 4.0.1 selects Power Level in its spell dialog and derives " +
  "the actual WP cost from Item#getSpellCost()."
);

return boaFinish(
  "evokers-legacy",
  "BOA DEV – Verify Evoker's Legacy",
  checks,
  notes
);
