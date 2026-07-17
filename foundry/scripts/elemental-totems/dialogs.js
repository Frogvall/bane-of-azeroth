import { MODULE_ID } from "../core/constants.js";
import {
  buildTotemOptions,
  getElementalTotemDefinitions,
  getTotemName,
} from "./definitions.js";
import {
  getElementalTotemMessageContext,
  isElementalTotemSpellTest,
} from "./messages.js";
import {
  buildElementalTotemPlan,
} from "./planning.js";
import {
  collectElementalTotemPositions,
  getElementalTotemPlacementRange,
} from "./placement.js";
import {
  requestElementalTotemCreation,
} from "./socket.js";

const handledElementalTotemMessages = new Set();
let elementalTotemDialogQueue = Promise.resolve();

async function chooseInitialTotem(definitions, powerLevel) {
  const formData =
    await foundry.applications.api.DialogV2.input({
      window: {
        title: game.i18n.format(
          "BOA.dialog.elementalTotem.initialTitle",
          { powerLevel }
        ),
      },
      content: `
        <div class="form-group">
          <label>
            ${game.i18n.localize(
              "BOA.dialog.elementalTotem.totemType"
            )}
          </label>
          <div class="form-fields">
            <select name="totemType" autofocus>
              ${buildTotemOptions(definitions)}
            </select>
          </div>
        </div>
        <p class="hint">
          ${game.i18n.localize(
            "BOA.dialog.elementalTotem.initialHint"
          )}
        </p>
      `,
      ok: {
        label: game.i18n.localize(
          "BOA.dialog.elementalTotem.continue"
        ),
      },
      rejectClose: false,
      modal: true,
    });

  if (!formData) return null;

  const totemType = String(formData.totemType ?? "");
  if (!definitions.totems.some(
    totem => totem.key === totemType
  )) {
    throw new Error(`Unknown Elemental Totem type: ${totemType}`);
  }

  return totemType;
}

async function chooseTotemUpgrade(
  definitions,
  step,
  powerLevel,
  selectedTotemTypes
) {
  const formData =
    await foundry.applications.api.DialogV2.input({
      window: {
        title: game.i18n.format(
          "BOA.dialog.elementalTotem.upgradeTitle",
          { step, powerLevel }
        ),
      },
      content: `
        <fieldset>
          <legend>
            ${game.i18n.localize(
              "BOA.dialog.elementalTotem.chooseUpgrade"
            )}
          </legend>

          <label class="checkbox">
            <input
              type="radio"
              name="upgrade"
              value="additionalTotem"
              checked
            >
            ${game.i18n.localize(
              "BOA.dialog.elementalTotem.additionalTotem"
            )}
          </label>

          <div class="form-group">
            <label>
              ${game.i18n.localize(
                "BOA.dialog.elementalTotem.additionalTotemType"
              )}
            </label>
            <div class="form-fields">
              <select name="totemType">
                ${buildTotemOptions(
                  definitions,
                  "",
                  selectedTotemTypes
                )}
              </select>
            </div>
          </div>

          <label class="checkbox">
            <input
              type="radio"
              name="upgrade"
              value="doubleReach"
            >
            ${game.i18n.localize(
              "BOA.dialog.elementalTotem.doubleReach"
            )}
          </label>

          <label class="checkbox">
            <input
              type="radio"
              name="upgrade"
              value="doubleDurability"
            >
            ${game.i18n.localize(
              "BOA.dialog.elementalTotem.doubleDurability"
            )}
          </label>
        </fieldset>
      `,
      ok: {
        label: game.i18n.localize(
          "BOA.dialog.elementalTotem.continue"
        ),
      },
      rejectClose: false,
      modal: true,
    });

  if (!formData) return null;

  const upgrade = String(formData.upgrade ?? "");
  if (![
    "additionalTotem",
    "doubleReach",
    "doubleDurability",
  ].includes(upgrade)) {
    throw new Error(
      `Unknown Elemental Totem upgrade: ${upgrade}`
    );
  }

  if (upgrade !== "additionalTotem") {
    return { upgrade };
  }

  const totemType = String(formData.totemType ?? "");
  if (!definitions.totems.some(
    totem => totem.key === totemType
  )) {
    throw new Error(`Unknown Elemental Totem type: ${totemType}`);
  }

  if (selectedTotemTypes.includes(totemType)) {
    throw new Error(
      `Elemental Totem type already selected: ${totemType}`
    );
  }

  return {
    upgrade,
    totemType,
  };
}

async function confirmElementalTotemPlan(
  definitions,
  plan
) {
  const totemNames = plan.totemTypes
    .map(
      key =>
        `<li>${getTotemName(definitions, key)}</li>`
    )
    .join("");

  return foundry.applications.api.DialogV2.confirm({
    window: {
      title: game.i18n.localize(
        "BOA.dialog.elementalTotem.summaryTitle"
      ),
    },
    content: `
      <p>
        ${game.i18n.format(
          "BOA.dialog.elementalTotem.summaryPowerLevel",
          { powerLevel: plan.powerLevel }
        )}
      </p>

      <h3>
        ${game.i18n.localize(
          "BOA.dialog.elementalTotem.summaryTotems"
        )}
      </h3>
      <ul>${totemNames}</ul>

      <table>
        <tbody>
          <tr>
            <th>
              ${game.i18n.localize(
                "BOA.dialog.elementalTotem.summaryRange"
              )}
            </th>
            <td>${plan.auraRange} m</td>
          </tr>
          <tr>
            <th>
              ${game.i18n.localize(
                "BOA.dialog.elementalTotem.summaryHitPoints"
              )}
            </th>
            <td>${plan.hitPoints}</td>
          </tr>
          <tr>
            <th>
              ${game.i18n.localize(
                "BOA.dialog.elementalTotem.summaryArmor"
              )}
            </th>
            <td>${plan.armorRating}</td>
          </tr>
        </tbody>
      </table>

      <p class="hint">
        ${game.i18n.localize(
          "BOA.dialog.elementalTotem.summaryHint"
        )}
      </p>
    `,
    yes: {
      label: game.i18n.localize(
        "BOA.dialog.elementalTotem.confirm"
      ),
    },
    no: {
      label: game.i18n.localize(
        "DoD.ui.dialog.cancelAction"
      ),
    },
    rejectClose: false,
    modal: true,
  });
}

async function runElementalTotemDialogFlow(message) {
  const context = getElementalTotemMessageContext(message);
  if (
    !context ||
    !isElementalTotemSpellTest(message, context) ||
    context.success !== true
  ) {
    return;
  }

  const powerLevel = Number(context.powerLevel);
  if (!Number.isInteger(powerLevel) || powerLevel < 1) {
    throw new Error(
      `Invalid Elemental Totem power level: ${context.powerLevel}`
    );
  }

  const definitions = await getElementalTotemDefinitions();
  const initialTotem = await chooseInitialTotem(
    definitions,
    powerLevel
  );
  if (!initialTotem) return;

  const totemTypes = [initialTotem];
  let reachUpgrades = 0;
  let durabilityUpgrades = 0;

  for (let step = 2; step <= powerLevel; step += 1) {
    const choice = await chooseTotemUpgrade(
      definitions,
      step,
      powerLevel,
      totemTypes
    );
    if (!choice) return;

    switch (choice.upgrade) {
      case "additionalTotem":
        totemTypes.push(choice.totemType);
        break;
      case "doubleReach":
        reachUpgrades += 1;
        break;
      case "doubleDurability":
        durabilityUpgrades += 1;
        break;
    }
  }

  const plan = buildElementalTotemPlan(
    message,
    context,
    definitions,
    totemTypes,
    reachUpgrades,
    durabilityUpgrades
  );

  plan.placementRange = getElementalTotemPlacementRange(context);

  const confirmed = await confirmElementalTotemPlan(
    definitions,
    plan
  );
  if (!confirmed) return;


  const positions = await collectElementalTotemPositions(
    plan,
    definitions
  );
  if (!positions) {
    ui.notifications.info(
      game.i18n.localize(
        "BOA.dialog.elementalTotem.placementCancelled"
      )
    );
    return;
  }

  const result = await requestElementalTotemCreation(
    plan,
    positions
  );

  console.info(
    `${MODULE_ID} | Elemental Totems created.`,
    { plan, positions, result }
  );

  ui.notifications.info(
    game.i18n.format(
      "BOA.dialog.elementalTotem.tokensCreated",
      { count: result.createdTokenIds.length }
    )
  );

  if (result.failedCleanupScenes.length > 0) {
    ui.notifications.warn(
      game.i18n.format(
        "BOA.dialog.elementalTotem.cleanupWarning",
        { scenes: result.failedCleanupScenes.join(", ") }
      )
    );
  }
}

function queueElementalTotemDialog(message) {
  if (handledElementalTotemMessages.has(message.id)) return;
  handledElementalTotemMessages.add(message.id);

  elementalTotemDialogQueue =
    elementalTotemDialogQueue
      .then(() => runElementalTotemDialogFlow(message))
      .catch(error => {
        console.error(
          `${MODULE_ID} | Elemental Totem dialog flow failed.`,
          error
        );

        ui.notifications.error(
          game.i18n.localize(
            "BOA.dialog.elementalTotem.error"
          )
        );
      });
}

export function shouldStartElementalTotemDialog(message) {
  const context = getElementalTotemMessageContext(message);

  if (
    !context ||
    !isElementalTotemSpellTest(message, context) ||
    context.success !== true
  ) {
    return false;
  }

  /*
   * A dragon result is updated after the critical effect is chosen.
   * Wait for that update so later token placement can respect it.
   */
  if (context.isDragon && !context.criticalEffect) {
    return false;
  }

  return true;
}

export function onCreateElementalTotemChatMessage(
  message,
  operation,
  userId
) {
  if (
    userId !== game.user.id ||
    !shouldStartElementalTotemDialog(message)
  ) {
    return;
  }

  queueElementalTotemDialog(message);
}

export function onUpdateElementalTotemChatMessage(
  message,
  changes,
  operation,
  userId
) {
  if (
    userId !== game.user.id ||
    !shouldStartElementalTotemDialog(message)
  ) {
    return;
  }

  queueElementalTotemDialog(message);
}
