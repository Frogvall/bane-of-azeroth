const checks = [];
const notes = [];

const settingKey =
  "demonHunterInitiationAutomation";
const contentKey =
  "heroic-class-ability.demon-hunter.demon-hunter-initiation";

let actor = null;
let scene = null;
let originalSetting = null;

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Macro is run by a game master",
    false,
    "The test creates temporary Actor/Scene documents and changes a world setting."
  );

  return boaFinish(
    "demon-hunter-initiation",
    "BOA DEV – Verify Demon Hunter Initiation",
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
  "Demon Hunter Initiation automation setting is registered",
  Boolean(definition),
  `${BOA_TEST_MODULE_ID}.${settingKey}`
);

if (definition) {
  boaCheckEqual(
    checks,
    "Demon Hunter Initiation automation defaults to enabled",
    definition.default,
    true
  );
}

const sourceAbility =
  boaFindWorldItem(
    contentKey,
    "ability"
  );

boaCheck(
  checks,
  "Demon Hunter Initiation source ability exists",
  Boolean(sourceAbility),
  contentKey
);

const api =
  game.modules.get(
    BOA_TEST_MODULE_ID
  )?.api ?? {};

const reconcileActor =
  api.reconcileDemonHunterInitiationActor;

boaCheck(
  checks,
  "Demon Hunter Initiation reconciliation API is exposed",
  typeof reconcileActor === "function",
  "reconcileDemonHunterInitiationActor"
);

if (
  sourceAbility &&
  typeof reconcileActor === "function"
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
          "[BOA TEST] Demon Hunter Vision " +
          foundry.utils.randomID(6),
        type: "character",
        prototypeToken: {
          sight: {
            enabled: false,
            range: 7,
            visionMode: "basic",
            angle: 270
          }
        },
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

    const [embeddedAbility] =
      await actor.createEmbeddedDocuments(
        "Item",
        [
          boaCloneEmbeddedItem(
            sourceAbility
          )
        ]
      );

    const prototypeApplied =
      await boaWaitFor(
        () =>
          actor.prototypeToken?.sight?.enabled === true &&
          actor.prototypeToken?.sight?.range === null
      );

    boaCheck(
      checks,
      "Initiation gives the prototype token unlimited sight in darkness",
      prototypeApplied,
      actor.prototypeToken?.sight?.toObject?.() ??
        actor.prototypeToken?.sight ??
        null
    );

    boaCheckEqual(
      checks,
      "Initiation preserves prototype vision mode",
      actor.prototypeToken?.sight?.visionMode,
      "basic"
    );

    boaCheckEqual(
      checks,
      "Initiation preserves prototype sight angle",
      actor.prototypeToken?.sight?.angle,
      270
    );

    scene = await Scene.create({
      name:
        "[BOA TEST] Demon Hunter Vision " +
        foundry.utils.randomID(6),
      width: 1000,
      height: 1000,
      grid: {
        size: 100,
        distance: 2
      },
      tokenVision: true,
      flags: {
        [BOA_TEST_MODULE_ID]: {
          [BOA_TEST_FIXTURE_FLAG]: true
        }
      }
    });

    const [token] =
      await scene.createEmbeddedDocuments(
        "Token",
        [
          {
            name: actor.name,
            actorId: actor.id,
            actorLink: true,
            x: 100,
            y: 100,
            sight: {
              enabled: false,
              range: 5,
              visionMode: "basic",
              angle: 180
            }
          }
        ]
      );

    const tokenApplied =
      await boaWaitFor(
        () => {
          const current =
            scene.tokens.get(
              token.id
            );

          return (
            current?.sight?.enabled === true &&
            current?.sight?.range === null
          );
        }
      );

    boaCheck(
      checks,
      "A token created after Initiation also gets unlimited sight in darkness",
      tokenApplied,
      scene.tokens.get(
        token.id
      )?.sight?.toObject?.() ??
        scene.tokens.get(
          token.id
        )?.sight ??
        null
    );

    boaCheckEqual(
      checks,
      "Initiation preserves scene-token vision mode",
      scene.tokens.get(
        token.id
      )?.sight?.visionMode,
      "basic"
    );

    await actor.deleteEmbeddedDocuments(
      "Item",
      [
        embeddedAbility.id
      ]
    );

    const restored =
      await boaWaitFor(
        () => {
          const currentToken =
            scene.tokens.get(
              token.id
            );

          return (
            actor.prototypeToken?.sight?.enabled === false &&
            Number(
              actor.prototypeToken?.sight?.range
            ) === 7 &&
            currentToken?.sight?.enabled === false &&
            Number(
              currentToken?.sight?.range
            ) === 5
          );
        }
      );

    boaCheck(
      checks,
      "Removing Initiation restores prototype and token vision settings",
      restored,
      {
        prototype:
          actor.prototypeToken?.sight?.toObject?.() ??
          actor.prototypeToken?.sight ??
          null,
        token:
          scene.tokens.get(
            token.id
          )?.sight?.toObject?.() ??
          scene.tokens.get(
            token.id
          )?.sight ??
          null
      }
    );
  } catch (error) {
    boaCheck(
      checks,
      "Demon Hunter Initiation vision workflow completed",
      false,
      error.stack ?? error.message
    );
  } finally {
    if (scene) {
      try {
        await scene.delete();
      } catch (error) {
        boaCheck(
          checks,
          "Temporary Demon Hunter vision Scene cleanup succeeded",
          false,
          error.message
        );
      }
    }

    if (actor) {
      try {
        await actor.delete();
      } catch (error) {
        boaCheck(
          checks,
          "Temporary Demon Hunter vision Actor cleanup succeeded",
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
          originalSetting
        );
      } catch (error) {
        boaCheck(
          checks,
          "Demon Hunter Initiation automation setting was restored",
          false,
          error.message
        );
      }
    }
  }
}

notes.push(
  "The automation changes only sight.enabled and sight.range. Vision mode, " +
  "angle, and other token vision presentation settings remain untouched."
);

return boaFinish(
  "demon-hunter-initiation",
  "BOA DEV – Verify Demon Hunter Initiation",
  checks,
  notes
);
