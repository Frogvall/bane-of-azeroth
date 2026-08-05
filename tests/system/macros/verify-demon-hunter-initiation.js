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

const visionModes =
  CONFIG?.Canvas?.visionModes;
const darkvisionMode =
  visionModes?.get?.(
    "darkvision"
  ) ??
  visionModes?.darkvision;
const darkvisionDefaults =
  darkvisionMode?.vision?.defaults ??
  {};

boaCheck(
  checks,
  "Demon Hunter Initiation reconciliation API is exposed",
  typeof reconcileActor === "function",
  "reconcileDemonHunterInitiationActor"
);

boaCheck(
  checks,
  "Foundry Darkvision exposes visual defaults",
  Boolean(darkvisionMode) &&
    typeof darkvisionDefaults === "object",
  darkvisionDefaults
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
            angle: 270,
            attenuation: 0.37,
            saturation: 0.62
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
          !Number.isFinite(
            actor.prototypeToken?.sight?.range
          ) &&
          actor.prototypeToken?.sight?.visionMode === "darkvision"
      );

    boaCheck(
      checks,
      "Initiation gives the prototype token unlimited Darkvision",
      prototypeApplied,
      actor.prototypeToken?.sight?.toObject?.() ??
        actor.prototypeToken?.sight ??
        null
    );

    boaCheckEqual(
      checks,
      "Initiation sets prototype vision mode to Darkvision",
      actor.prototypeToken?.sight?.visionMode,
      "darkvision"
    );

    if (
      Object.hasOwn(
        darkvisionDefaults,
        "attenuation"
      )
    ) {
      boaCheckEqual(
        checks,
        "Initiation applies the Darkvision attenuation preset to the prototype",
        actor.prototypeToken?.sight?.attenuation,
        darkvisionDefaults.attenuation
      );
    }

    if (
      Object.hasOwn(
        darkvisionDefaults,
        "saturation"
      )
    ) {
      boaCheckEqual(
        checks,
        "Initiation applies the Darkvision saturation preset to the prototype",
        actor.prototypeToken?.sight?.saturation,
        darkvisionDefaults.saturation
      );
    }

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
              angle: 180,
              attenuation: 0.44,
              saturation: 0.71
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
            !Number.isFinite(
              current?.sight?.range
            ) &&
            current?.sight?.visionMode === "darkvision"
          );
        }
      );

    boaCheck(
      checks,
      "A token created after Initiation also gets unlimited Darkvision",
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
      "Initiation sets scene-token vision mode to Darkvision",
      scene.tokens.get(
        token.id
      )?.sight?.visionMode,
      "darkvision"
    );

    if (
      Object.hasOwn(
        darkvisionDefaults,
        "attenuation"
      )
    ) {
      boaCheckEqual(
        checks,
        "Initiation applies the Darkvision attenuation preset to the scene token",
        scene.tokens.get(
          token.id
        )?.sight?.attenuation,
        darkvisionDefaults.attenuation
      );
    }

    if (
      Object.hasOwn(
        darkvisionDefaults,
        "saturation"
      )
    ) {
      boaCheckEqual(
        checks,
        "Initiation applies the Darkvision saturation preset to the scene token",
        scene.tokens.get(
          token.id
        )?.sight?.saturation,
        darkvisionDefaults.saturation
      );
    }

    await actor.update({
      "prototypeToken.sight.range": 22,
      "prototypeToken.sight.attenuation": 0.23
    });

    await scene.tokens.get(
      token.id
    ).update({
      "sight.range": 18,
      "sight.attenuation": 0.19
    });

    boaCheck(
      checks,
      "Managed vision can differ from the preset before cleanup",
      Number(
        actor.prototypeToken?.sight?.range
      ) === 22 &&
        actor.prototypeToken?.sight?.attenuation === 0.23 &&
        Number(
          scene.tokens.get(
            token.id
          )?.sight?.range
        ) === 18 &&
        scene.tokens.get(
          token.id
        )?.sight?.attenuation === 0.19,
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
            actor.prototypeToken?.sight?.visionMode === "basic" &&
            actor.prototypeToken?.sight?.attenuation === 0.37 &&
            actor.prototypeToken?.sight?.saturation === 0.62 &&
            currentToken?.sight?.enabled === false &&
            Number(
              currentToken?.sight?.range
            ) === 5 &&
            currentToken?.sight?.visionMode === "basic" &&
            currentToken?.sight?.attenuation === 0.44 &&
            currentToken?.sight?.saturation === 0.71
          );
        }
      );

    boaCheck(
      checks,
      "Removing Initiation restores the complete original prototype and token vision snapshots",
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
  "The automation owns the relevant sight configuration while Initiation is " +
  "active. Removing the ability restores the complete saved original sight " +
  "snapshot even if managed vision values were changed while active."
);

return boaFinish(
  "demon-hunter-initiation",
  "BOA DEV – Verify Demon Hunter Initiation",
  checks,
  notes
);
