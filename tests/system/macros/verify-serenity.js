const checks = [];
const notes = [];

const settingKey =
  "serenityAutomation";

const serenityContentKey =
  "heroic-class-ability.monk.monks-serenity";

let actor = null;
let originalSetting = null;

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Macro is run by a game master",
    false,
    "Serenity tests create a temporary Actor and change a world setting."
  );

  return boaFinish(
    "serenity",
    "BOA DEV – Verify Monk's Serenity",
    checks,
    notes
  );
}

const definition =
  game.settings?.settings?.get?.(
    `${BOA_TEST_MODULE_ID}.${settingKey}`
  );

boaCheck(
  checks,
  "Serenity automation setting is registered",
  Boolean(definition),
  `${BOA_TEST_MODULE_ID}.${settingKey}`
);

if (definition) {
  boaCheckEqual(
    checks,
    "Serenity automation defaults to enabled",
    definition.default,
    true
  );
}

const sourceSerenity =
  boaFindWorldItem(
    serenityContentKey,
    "ability"
  );

const worldItems =
  boaCollectionValues(
    game.items
  );

const sourceUnarmed =
  worldItems.find(
    item =>
      item?.type === "weapon" &&
      item?.name === "Unarmed" &&
      item?.system?.skill?.name === "Brawling" &&
      item?.system?.features?.includes?.(
        "unarmed"
      )
  ) ?? null;

const sourceIronFist =
  worldItems.find(
    item =>
      item?.type === "ability" &&
      item?.name === "Iron Fist"
  ) ?? null;

boaCheck(
  checks,
  "Monk's Serenity source ability exists",
  Boolean(sourceSerenity),
  serenityContentKey
);

boaCheck(
  checks,
  "Dragonbane Unarmed source weapon exists",
  Boolean(sourceUnarmed),
  sourceUnarmed?.uuid ?? "Unarmed"
);

boaCheck(
  checks,
  "Dragonbane Iron Fist source ability exists",
  Boolean(sourceIronFist),
  sourceIronFist?.uuid ?? "Iron Fist"
);

if (sourceUnarmed) {
  boaCheckEqual(
    checks,
    "Source Unarmed damage is D6 before the actor test",
    String(
      sourceUnarmed.system?.damage
    ).toUpperCase(),
    "D6"
  );
}

if (sourceIronFist) {
  boaCheck(
    checks,
    "Source Iron Fist description contains 2D6",
    String(
      sourceIronFist.system?.itemDescription ?? ""
    ).includes("2D6"),
    sourceIronFist.system?.itemDescription ?? ""
  );
}

const api =
  game.modules.get(
    BOA_TEST_MODULE_ID
  )?.api ?? {};

const reconcileActor =
  api.reconcileSerenityActor;

boaCheck(
  checks,
  "Serenity reconciliation API is exposed",
  typeof reconcileActor === "function",
  "reconcileSerenityActor"
);

if (
  sourceSerenity &&
  sourceUnarmed &&
  sourceIronFist
) {
  try {
    if (definition) {
      originalSetting =
        game.settings.get(
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
          "[BOA TEST] Serenity " +
          foundry.utils.randomID(6),
        type: "character",
        flags: {
          [BOA_TEST_MODULE_ID]: {
            [BOA_TEST_FIXTURE_FLAG]: true
          }
        }
      },
      {
        renderSheet: false
      }
    );

    const [serenity] =
      await actor.createEmbeddedDocuments(
        "Item",
        [
          boaCloneEmbeddedItem(
            sourceSerenity
          )
        ]
      );

    boaCheck(
      checks,
      "Serenity can exist before Unarmed",
      Boolean(serenity) &&
        actor.items.filter(
          item =>
            item.name === "Unarmed"
        ).length === 0,
      serenity?.uuid ?? ""
    );

    const [unarmed] =
      await actor.createEmbeddedDocuments(
        "Item",
        [
          boaCloneEmbeddedItem(
            sourceUnarmed
          )
        ]
      );

    const unarmedUpdated =
      await boaWaitFor(
        () =>
          String(
            actor.items.get(
              unarmed.id
            )?.system?.damage ??
            ""
          ).toUpperCase() === "D10"
      );

    boaCheck(
      checks,
      "Unarmed dragged in after Serenity is automatically changed to D10",
      unarmedUpdated,
      actor.items.get(
        unarmed.id
      )?.system?.damage ?? ""
    );

    const [ironFist] =
      await actor.createEmbeddedDocuments(
        "Item",
        [
          boaCloneEmbeddedItem(
            sourceIronFist
          )
        ]
      );

    const ironFistUpdated =
      await boaWaitFor(
        () => {
          const description =
            String(
              actor.items.get(
                ironFist.id
              )?.system?.itemDescription ??
              ""
            );

          return (
            description.includes("2D10") &&
            !description.includes("2D6")
          );
        }
      );

    boaCheck(
      checks,
      "Iron Fist dragged in after Serenity changes only the embedded copy to 2D10",
      ironFistUpdated,
      actor.items.get(
        ironFist.id
      )?.system?.itemDescription ?? ""
    );

    boaCheckEqual(
      checks,
      "World Unarmed source remains D6",
      String(
        sourceUnarmed.system?.damage
      ).toUpperCase(),
      "D6"
    );

    boaCheck(
      checks,
      "World Iron Fist source remains 2D6",
      String(
        sourceIronFist.system?.itemDescription ?? ""
      ).includes("2D6"),
      sourceIronFist.system?.itemDescription ?? ""
    );

    await actor.deleteEmbeddedDocuments(
      "Item",
      [
        serenity.id
      ]
    );

    const cleanupWorked =
      await boaWaitFor(
        () => {
          const localUnarmed =
            actor.items.get(
              unarmed.id
            );

          const localIronFist =
            actor.items.get(
              ironFist.id
            );

          return (
            String(
              localUnarmed?.system?.damage ??
              ""
            ).toUpperCase() === "D6" &&
            String(
              localIronFist?.system?.itemDescription ??
              ""
            ).includes("2D6")
          );
        }
      );

    boaCheck(
      checks,
      "Removing Serenity restores local Unarmed and Iron Fist",
      cleanupWorked,
      {
        unarmed:
          actor.items.get(
            unarmed.id
          )?.system?.damage,
        ironFist:
          actor.items.get(
            ironFist.id
          )?.system?.itemDescription
      }
    );
  } catch (error) {
    boaCheck(
      checks,
      "Serenity lifecycle workflow completed",
      false,
      error.stack ?? error.message
    );
  } finally {
    if (actor) {
      try {
        await actor.delete();
      } catch (error) {
        boaCheck(
          checks,
          "Temporary Serenity Actor cleanup succeeded",
          false,
          error.message
        );
      }
    }

    if (
      originalSetting !== null
    ) {
      try {
        await game.settings.set(
          BOA_TEST_MODULE_ID,
          settingKey,
          originalSetting
        );
      } catch (error) {
        boaCheck(
          checks,
          "Serenity automation setting was restored",
          false,
          error.message
        );
      }
    }
  }
}

notes.push(
  "Serenity modifies only embedded character Items. World/source Unarmed and " +
  "Iron Fist documents must remain unchanged."
);

return boaFinish(
  "serenity",
  "BOA DEV – Verify Monk's Serenity",
  checks,
  notes
);
