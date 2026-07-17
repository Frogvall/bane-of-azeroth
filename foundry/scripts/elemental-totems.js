import { MODULE_ID } from "./core/constants.js";
import { getContentKey } from "./core/documents.js";
import { isPrimaryActiveGM } from "./core/users.js";

import { parseHexColor } from "./core/colors.js";

import {
  buildTotemOptions,
  getElementalTotemDefinitions,
  getTotemName,
  loadElementalTotemDefinitions,
} from "./elemental-totems/definitions.js";
import {
  buildElementalTotemPlan,
  validateElementalTotemPlanShape,
} from "./elemental-totems/planning.js";

import {
  getPrimaryActiveGMUser,
} from "./core/users.js";
import {
  calculateElementalTotemDistance,
  collectElementalTotemPositions,
  createElementalTotemPreviewDocument,
  getElementalTotemPlacementRange,
} from "./elemental-totems/placement.js";

export { getPrimaryActiveGMUser };

export {
  getElementalTotemPlacementRange,
};

export {
  buildTotemOptions,
  loadElementalTotemDefinitions,
  buildElementalTotemPlan,
  validateElementalTotemPlanShape,
};

export {
  drawAllElementalTotemAuras,
  drawElementalTotemAura,
  getElementalTotemAuraData,
  onDeleteElementalTotemAura,
  onUpdateElementalTotemAura,
} from "./elemental-totems/aura.js";

const ELEMENTAL_TOTEM_CONTENT_KEY = "spells.elemental-totem";
const handledElementalTotemMessages = new Set();
let elementalTotemDialogQueue = Promise.resolve();

function getElementalTotemMessageContext(message) {
  try {
    return message.system?.toContext?.() ?? null;
  } catch (error) {
    console.error(
      `${MODULE_ID} | Could not resolve Elemental Totem message context.`,
      error,
      message
    );
    return null;
  }
}

function isElementalTotemSpellTest(message, context) {
  return (
    message?.type === "spellTest" &&
    getContentKey(context?.spell) === ELEMENTAL_TOTEM_CONTENT_KEY
  );
}

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

const ELEMENTAL_TOTEM_SOCKET = `module.${MODULE_ID}`;
const ELEMENTAL_TOTEM_SOCKET_TIMEOUT_MS = 30000;

const pendingElementalTotemSocketRequests = new Map();
let elementalTotemSocketRegistered = false;

function findWorldElementalTotemActor(totemType) {
  const contentKey = `actors.elemental-totems.${totemType}`;

  return game.actors.find(
    actor => getContentKey(actor) === contentKey
  ) ?? null;
}

export async function validateElementalTotemCreationRequest(
  plan,
  positions,
  requesterUserId
) {
  const definitions = await getElementalTotemDefinitions();
  validateElementalTotemPlanShape(plan, definitions);

  const requester = game.users.get(requesterUserId);
  if (!requester) {
    throw new Error("The requesting user could not be found.");
  }

  const sourceMessage = game.messages.get(plan.sourceMessageId);
  const context = getElementalTotemMessageContext(sourceMessage);
  if (
    !sourceMessage ||
    !context ||
    !isElementalTotemSpellTest(sourceMessage, context) ||
    context.success !== true
  ) {
    throw new Error(
      "The successful Elemental Totem spell message was not found."
    );
  }

  const messageAuthorId =
    sourceMessage.author?.id ??
    sourceMessage.user?.id ??
    sourceMessage.user ??
    null;
  if (messageAuthorId && messageAuthorId !== requesterUserId) {
    throw new Error(
      "The requesting user did not create the spell message."
    );
  }

  const actorDocument = await fromUuid(plan.actorUuid);
  const actor = actorDocument?.actor ?? actorDocument;
  if (actor?.documentName !== "Actor") {
    throw new Error("The caster Actor could not be found.");
  }
  if (
    !requester.isGM &&
    !actor.testUserPermission(
      requester,
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    )
  ) {
    throw new Error(
      "The requesting user does not own the caster Actor."
    );
  }

  const scene = game.scenes.get(plan.sceneId);
  const casterToken = scene?.tokens.get(plan.casterTokenId);
  if (!scene || !casterToken) {
    throw new Error("The caster token or scene could not be found.");
  }

  const contextActorUuid = context.actor?.uuid ?? null;
  if (
    contextActorUuid !== plan.actorUuid ||
    (
      casterToken.actor?.uuid !== plan.actorUuid &&
      casterToken.actor?.id !== actor.id
    )
  ) {
    throw new Error(
      "The caster Actor does not match the caster token."
    );
  }

  const expectedPlacementRange =
    getElementalTotemPlacementRange(context);
  if (Number(plan.placementRange) !== expectedPlacementRange) {
    throw new Error("The Elemental Totem placement range is invalid.");
  }

  if (
    !Array.isArray(positions) ||
    positions.length !== plan.totemTypes.length
  ) {
    throw new Error(
      "The number of positions does not match the number of totems."
    );
  }

  const previewToken = createElementalTotemPreviewDocument(
    scene,
    definitions
  );

  for (const position of positions) {
    if (
      typeof position?.x !== "number" ||
      typeof position?.y !== "number" ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      throw new Error("An Elemental Totem position is invalid.");
    }

    previewToken.updateSource({
      x: position.x,
      y: position.y,
    });
    const distance = calculateElementalTotemDistance(
      scene,
      casterToken,
      previewToken
    );
    if (distance > expectedPlacementRange) {
      throw new Error(
        `An Elemental Totem position is outside range (${distance} m).`
      );
    }
  }

  const totemActors = plan.totemTypes.map(totemType => {
    const actorTemplate = findWorldElementalTotemActor(totemType);
    if (!actorTemplate) {
      throw new Error(
        `The ${totemType} Elemental Totem Actor was not found.`
      );
    }
    return actorTemplate;
  });

  return {
    definitions,
    scene,
    casterToken,
    actor,
    totemActors,
  };
}

export async function configureCreatedElementalTotem(
  token,
  plan
) {
  const actor = token.actor;
  if (!actor?.isToken) {
    throw new Error(
      `Created token ${token.name} has no synthetic Actor.`
    );
  }

  await actor.update({
    "ownership.default":
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
    "system.hitPoints.base": plan.hitPoints,
    "system.hitPoints.max": plan.hitPoints,
    "system.hitPoints.value": plan.hitPoints,
  });

  const armor = actor.items.find(
    item =>
      item.type === "armor" &&
      (
        getContentKey(item).endsWith(".armor") ||
        item.name === "Totem Armor"
      )
  );
  if (!armor) {
    throw new Error(`${token.name} has no Totem Armor item.`);
  }

  await armor.update({
    "system.rating": plan.armorRating,
    "system.worn": true,
  });
}

export async function deletePreviousElementalTotems(
  casterActorUuid,
  currentCastId
) {
  const failedScenes = [];

  for (const scene of game.scenes) {
    const tokenIds = scene.tokens
      .filter(token => {
        const flags = token.flags?.[MODULE_ID];
        return (
          flags?.summonType === "elementalTotem" &&
          flags?.casterActorUuid === casterActorUuid &&
          flags?.castId !== currentCastId
        );
      })
      .map(token => token.id);

    if (tokenIds.length === 0) continue;

    try {
      await scene.deleteEmbeddedDocuments("Token", tokenIds);
    } catch (error) {
      failedScenes.push(scene.name);
      console.error(
        `${MODULE_ID} | Could not remove previous Elemental ` +
        `Totems from ${scene.name}.`,
        error
      );
    }
  }

  return failedScenes;
}

export async function executeElementalTotemCreation(
  plan,
  positions,
  requesterUserId
) {
  const {
    scene,
    totemActors,
  } = await validateElementalTotemCreationRequest(
    plan,
    positions,
    requesterUserId
  );

  const castId = foundry.utils.randomID();
  const tokenData = [];

  for (let index = 0; index < totemActors.length; index += 1) {
    const actorTemplate = totemActors[index];
    const totemType = plan.totemTypes[index];
    const position = positions[index];
    const tokenDocument = await actorTemplate.getTokenDocument(
      {
        x: position.x,
        y: position.y,
        actorLink: false,
      },
      { parent: scene }
    );
    const data = tokenDocument.toObject();

    delete data._id;

    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.summonType`,
      "elementalTotem"
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.casterActorUuid`,
      plan.actorUuid
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.sourceSpell`,
      ELEMENTAL_TOTEM_CONTENT_KEY
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.sourceMessageId`,
      plan.sourceMessageId
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.castId`,
      castId
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.instanceId`,
      foundry.utils.randomID()
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.totemType`,
      totemType
    );
    foundry.utils.setProperty(
      data,
      `flags.${MODULE_ID}.auraRange`,
      plan.auraRange
    );

    tokenData.push(data);
  }

  const createdTokens = await scene.createEmbeddedDocuments(
    "Token",
    tokenData
  );

  try {
    for (const token of createdTokens) {
      await configureCreatedElementalTotem(token, plan);
    }
  } catch (error) {
    await scene.deleteEmbeddedDocuments(
      "Token",
      createdTokens.map(token => token.id)
    );
    throw error;
  }

  const failedCleanupScenes = await deletePreviousElementalTotems(
    plan.actorUuid,
    castId
  );

  return {
    castId,
    createdTokenIds: createdTokens.map(token => token.id),
    failedCleanupScenes,
  };
}

function handleElementalTotemSocketResult(payload) {
  if (payload.requesterUserId !== game.user.id) return;

  const pending = pendingElementalTotemSocketRequests.get(
    payload.requestId
  );
  if (!pending) return;

  clearTimeout(pending.timeoutId);
  pendingElementalTotemSocketRequests.delete(payload.requestId);

  if (payload.success) {
    pending.resolve(payload.result);
  } else {
    pending.reject(
      new Error(
        payload.error || "The GM could not create the totems."
      )
    );
  }
}

async function handleElementalTotemSocketRequest(payload) {
  if (!isPrimaryActiveGM()) return;

  try {
    const result = await executeElementalTotemCreation(
      payload.plan,
      payload.positions,
      payload.requesterUserId
    );

    game.socket.emit(ELEMENTAL_TOTEM_SOCKET, {
      type: "elementalTotemResult",
      requestId: payload.requestId,
      requesterUserId: payload.requesterUserId,
      success: true,
      result,
    });
  } catch (error) {
    console.error(
      `${MODULE_ID} | Elemental Totem creation request failed.`,
      error
    );

    game.socket.emit(ELEMENTAL_TOTEM_SOCKET, {
      type: "elementalTotemResult",
      requestId: payload.requestId,
      requesterUserId: payload.requesterUserId,
      success: false,
      error: error.message,
    });
  }
}

function onElementalTotemSocketMessage(payload) {
  if (!payload || typeof payload !== "object") return;

  if (payload.type === "elementalTotemRequest") {
    void handleElementalTotemSocketRequest(payload);
  } else if (payload.type === "elementalTotemResult") {
    handleElementalTotemSocketResult(payload);
  }
}

export function registerElementalTotemSocket() {
  if (elementalTotemSocketRegistered) return;

  game.socket.on(
    ELEMENTAL_TOTEM_SOCKET,
    onElementalTotemSocketMessage
  );
  elementalTotemSocketRegistered = true;
}

function requestElementalTotemCreation(plan, positions) {
  if (game.user.isGM) {
    return executeElementalTotemCreation(
      plan,
      positions,
      game.user.id
    );
  }

  const activeGM = getPrimaryActiveGMUser();
  if (!activeGM) {
    throw new Error(
      "An active GM is required to create Elemental Totem tokens."
    );
  }

  const requestId = foundry.utils.randomID();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingElementalTotemSocketRequests.delete(requestId);
      reject(new Error("The Elemental Totem request timed out."));
    }, ELEMENTAL_TOTEM_SOCKET_TIMEOUT_MS);

    pendingElementalTotemSocketRequests.set(requestId, {
      resolve,
      reject,
      timeoutId,
    });

    game.socket.emit(ELEMENTAL_TOTEM_SOCKET, {
      type: "elementalTotemRequest",
      requestId,
      requesterUserId: game.user.id,
      gmUserId: activeGM.id,
      plan,
      positions,
    });
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

function redrawElementalTotemAuraForDocument(tokenDocument) {
  if (canvas.scene?.id !== tokenDocument?.parent?.id) return;

  const token = tokenDocument.object;
  if (!token) return;

  /*
   * Let Foundry apply its own token refresh flags before measuring the
   * token's current pixel width and height.
   */
  requestAnimationFrame(() => {
    if (!token.destroyed) {
      drawElementalTotemAura(token);
    }
  });
}

