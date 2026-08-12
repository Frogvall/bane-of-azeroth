const checks = [];
const notes = [];

const settingKey =
  "demonHunterInitiationAutomation";
const contentKey =
  "heroic-class-ability.demon-hunter.demon-hunter-initiation";

let actor = null;
let scene = null;
let originalSetting = null;

function normalizeRange(
  range
) {
  return Number.isFinite(
    range
  )
    ? Number(range)
    : null;
}

function sightSnapshot(
  sight
) {
  const source =
    sight?.toObject?.() ??
    sight ??
    {};

  return {
    enabled:
      Boolean(
        source.enabled
      ),
    range:
      normalizeRange(
        source.range
      ),
    visionMode:
      source.visionMode ??
      "basic",
    angle:
      source.angle ?? null,
    attenuation:
      source.attenuation ?? null,
    saturation:
      source.saturation ?? null,
    brightness:
      source.brightness ?? null,
    contrast:
      source.contrast ?? null,
    color:
      source.color ?? null
  };
}

function sameValue(
  left,
  right
) {
  if (
    typeof left === "number" &&
    typeof right === "number"
  ) {
    return (
      Math.abs(
        left - right
      ) < 0.000001
    );
  }

  return left === right;
}

function sameSight(
  left,
  right
) {
  const fields = [
    "enabled",
    "range",
    "visionMode",
    "angle",
    "attenuation",
    "saturation",
    "brightness",
    "contrast",
    "color"
  ];

  return fields.every(
    field =>
      sameValue(
        left?.[field],
        right?.[field]
      )
  );
}

function isUnlimitedDarkvision(
  sight
) {
  return (
    sight?.enabled === true &&
    !Number.isFinite(
      sight?.range
    ) &&
    sight?.visionMode === "darkvision"
  );
}

async function waitCheck(
  label,
  predicate,
  details
) {
  try {
    const result =
      await boaWaitFor(
        predicate
      );

    const passed =
      result !== false;

    boaCheck(
      checks,
      label,
      passed,
      typeof details === "function"
        ? details()
        : details
    );

    return passed;
  } catch (error) {
    boaCheck(
      checks,
      label,
      false,
      {
        error:
          error.stack ??
          error.message,
        state:
          typeof details === "function"
            ? details()
            : details
      }
    );

    return false;
  }
}

function checkDarkvisionDefaults(
  labelPrefix,
  sight,
  defaults
) {
  if (
    Object.hasOwn(
      defaults,
      "attenuation"
    )
  ) {
    boaCheck(
      checks,
      `${labelPrefix} uses Foundry Darkvision attenuation`,
      sameValue(
        sight?.attenuation,
        defaults.attenuation
      ),
      {
        actual:
          sight?.attenuation,
        expected:
          defaults.attenuation
      }
    );
  }

  if (
    Object.hasOwn(
      defaults,
      "saturation"
    )
  ) {
    boaCheck(
      checks,
      `${labelPrefix} uses Foundry Darkvision saturation`,
      sameValue(
        sight?.saturation,
        defaults.saturation
      ),
      {
        actual:
          sight?.saturation,
        expected:
          defaults.saturation
      }
    );
  }
}

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
  "Foundry Darkvision mode is available",
  Boolean(
    darkvisionMode
  ),
  darkvisionMode ??
    null
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
        type:
          "character",
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

    const prototypeBaseline =
      sightSnapshot(
        actor.prototypeToken?.sight
      );

    boaCheck(
      checks,
      "Prototype-token baseline was captured before Initiation",
      !isUnlimitedDarkvision(
        actor.prototypeToken?.sight
      ),
      prototypeBaseline
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

    const tokenBaseline =
      sightSnapshot(
        scene.tokens.get(
          token.id
        )?.sight
      );

    boaCheck(
      checks,
      "Scene-token baseline was captured before Initiation",
      !isUnlimitedDarkvision(
        scene.tokens.get(
          token.id
        )?.sight
      ),
      tokenBaseline
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

    await waitCheck(
      "Adding Initiation applies unlimited Darkvision to the prototype token",
      () =>
        isUnlimitedDarkvision(
          actor.prototypeToken?.sight
        ),
      () =>
        sightSnapshot(
          actor.prototypeToken?.sight
        )
    );

    checkDarkvisionDefaults(
      "Prototype token",
      actor.prototypeToken?.sight,
      darkvisionDefaults
    );

    boaCheckEqual(
      checks,
      "Initiation preserves prototype sight angle",
      actor.prototypeToken?.sight?.angle,
      prototypeBaseline.angle
    );

    await waitCheck(
      "Adding Initiation applies unlimited Darkvision to an existing scene token",
      () =>
        isUnlimitedDarkvision(
          scene.tokens.get(
            token.id
          )?.sight
        ),
      () =>
        sightSnapshot(
          scene.tokens.get(
            token.id
          )?.sight
        )
    );

    checkDarkvisionDefaults(
      "Scene token",
      scene.tokens.get(
        token.id
      )?.sight,
      darkvisionDefaults
    );

    boaCheckEqual(
      checks,
      "Initiation preserves scene-token sight angle",
      scene.tokens.get(
        token.id
      )?.sight?.angle,
      tokenBaseline.angle
    );

    await game.settings.set(
      BOA_TEST_MODULE_ID,
      settingKey,
      false
    );

    await waitCheck(
      "Disabling Initiation automation restores the prototype-token baseline",
      () =>
        sameSight(
          sightSnapshot(
            actor.prototypeToken?.sight
          ),
          prototypeBaseline
        ),
      () => ({
        expected:
          prototypeBaseline,
        actual:
          sightSnapshot(
            actor.prototypeToken?.sight
          )
      })
    );

    await waitCheck(
      "Disabling Initiation automation restores the scene-token baseline",
      () =>
        sameSight(
          sightSnapshot(
            scene.tokens.get(
              token.id
            )?.sight
          ),
          tokenBaseline
        ),
      () => ({
        expected:
          tokenBaseline,
        actual:
          sightSnapshot(
            scene.tokens.get(
              token.id
            )?.sight
          )
      })
    );

    await game.settings.set(
      BOA_TEST_MODULE_ID,
      settingKey,
      true
    );

    await waitCheck(
      "Re-enabling Initiation automation reapplies prototype Darkvision",
      () =>
        isUnlimitedDarkvision(
          actor.prototypeToken?.sight
        ),
      () =>
        sightSnapshot(
          actor.prototypeToken?.sight
        )
    );

    await waitCheck(
      "Re-enabling Initiation automation reapplies scene-token Darkvision",
      () =>
        isUnlimitedDarkvision(
          scene.tokens.get(
            token.id
          )?.sight
        ),
      () =>
        sightSnapshot(
          scene.tokens.get(
            token.id
          )?.sight
        )
    );

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
      "Managed sight can be changed while Initiation remains active",
      Number(
        actor.prototypeToken?.sight?.range
      ) === 22 &&
        Number(
          scene.tokens.get(
            token.id
          )?.sight?.range
        ) === 18,
      {
        prototype:
          sightSnapshot(
            actor.prototypeToken?.sight
          ),
        token:
          sightSnapshot(
            scene.tokens.get(
              token.id
            )?.sight
          )
      }
    );

    await actor.deleteEmbeddedDocuments(
      "Item",
      [
        embeddedAbility.id
      ]
    );

    await waitCheck(
      "Removing Initiation restores the complete prototype-token baseline",
      () =>
        sameSight(
          sightSnapshot(
            actor.prototypeToken?.sight
          ),
          prototypeBaseline
        ),
      () => ({
        expected:
          prototypeBaseline,
        actual:
          sightSnapshot(
            actor.prototypeToken?.sight
          )
      })
    );

    await waitCheck(
      "Removing Initiation restores the complete scene-token baseline",
      () =>
        sameSight(
          sightSnapshot(
            scene.tokens.get(
              token.id
            )?.sight
          ),
          tokenBaseline
        ),
      () => ({
        expected:
          tokenBaseline,
        actual:
          sightSnapshot(
            scene.tokens.get(
              token.id
            )?.sight
          )
      })
    );

    await waitCheck(
      "Removing Initiation clears managed vision bookkeeping",
      () => {
        const currentToken =
          scene.tokens.get(
            token.id
          );

        return (
          actor.getFlag(
            BOA_TEST_MODULE_ID,
            "demonHunterInitiationManagedPrototypeVision"
          ) === undefined &&
          actor.getFlag(
            BOA_TEST_MODULE_ID,
            "demonHunterInitiationOriginalPrototypeVision"
          ) === undefined &&
          currentToken?.getFlag(
            BOA_TEST_MODULE_ID,
            "demonHunterInitiationManagedTokenVision"
          ) === undefined &&
          currentToken?.getFlag(
            BOA_TEST_MODULE_ID,
            "demonHunterInitiationOriginalTokenVision"
          ) === undefined
        );
      },
      () => {
        const currentToken =
          scene.tokens.get(
            token.id
          );

        return {
          prototypeManaged:
            actor.getFlag(
              BOA_TEST_MODULE_ID,
              "demonHunterInitiationManagedPrototypeVision"
            ),
          prototypeOriginal:
            actor.getFlag(
              BOA_TEST_MODULE_ID,
              "demonHunterInitiationOriginalPrototypeVision"
            ),
          tokenManaged:
            currentToken?.getFlag(
              BOA_TEST_MODULE_ID,
              "demonHunterInitiationManagedTokenVision"
            ),
          tokenOriginal:
            currentToken?.getFlag(
              BOA_TEST_MODULE_ID,
              "demonHunterInitiationOriginalTokenVision"
            )
        };
      }
    );
  } catch (error) {
    boaCheck(
      checks,
      "Demon Hunter Initiation test setup completed",
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
  "This Macro captures Foundry's actual created sight baselines instead of " +
  "assuming requested creation values survive normalization. Every async " +
  "lifecycle stage reports its own failure instead of collapsing into one timeout."
);

return boaFinish(
  "demon-hunter-initiation",
  "BOA DEV – Verify Demon Hunter Initiation",
  checks,
  notes
);
