import {
  MODULE_ID,
  WEAPON_FEATURES,
} from "./core/constants.js";
import {
  getContentVersion,
  promptAdventureImport,
  registerSettings,
} from "./adventure-import.js";
import {
  isAutoGrantedSpell,
  lockAutoGrantedSpellPreparation,
  protectAutoGrantedSpellPreparation,
} from "./spell-preparation.js";

import {
  getContentKey,
  getModuleFlag,
} from "./core/documents.js";
import {
  loadSpellGrantDefinitions,
  onCreateItem,
  onDeleteItem,
  onUpdateItem,
  reconcileSpellGrants,
} from "./spell-grants.js";

import {
  onScattershotDamageClick,
  patchWeaponTests,
} from "./weapon-features.js";

function isPrimaryActiveGM() {
  if (!game.user.isGM) return false;

  const activeGMs = game.users.filter(
    user => user.active && user.isGM
  );
  return activeGMs[0]?.id === game.user.id;
}


const ELEMENTAL_TOTEM_CONTENT_KEY = "spells.elemental-totem";
const ELEMENTAL_TOTEM_CONTENT_PATH =
  `modules/${MODULE_ID}/content/elemental-totems.json`;

const handledElementalTotemMessages = new Set();
let elementalTotemDefinitionsPromise = null;
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

function requirePositiveNumber(value, context) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(`${context} must be a positive number.`);
  }

  return value;
}

async function loadElementalTotemDefinitions() {
  const contentUrl = foundry.utils.getRoute(
    ELEMENTAL_TOTEM_CONTENT_PATH
  );
  const response = await fetch(contentUrl);

  if (!response.ok) {
    throw new Error(
      `Could not load Elemental Totem content: ` +
      `${response.status} ${response.statusText}`
    );
  }

  const content = await response.json();
  const defaults = content?.defaults;
  const totems = content?.totems;

  if (!defaults || !Array.isArray(totems) || totems.length === 0) {
    throw new Error(
      "Elemental Totem content is missing defaults or totems."
    );
  }

  const definitions = {
    baseRange: requirePositiveNumber(
      defaults.auraRange,
      "defaults.auraRange"
    ),
    baseHitPoints: requirePositiveNumber(
      defaults.hitPoints,
      "defaults.hitPoints"
    ),
    baseArmor: requirePositiveNumber(
      defaults.armorRating,
      "defaults.armorRating"
    ),
    tokenWidth: requirePositiveNumber(
      defaults.tokenWidth,
      "defaults.tokenWidth"
    ),
    tokenHeight: requirePositiveNumber(
      defaults.tokenHeight,
      "defaults.tokenHeight"
    ),
    totems: totems.map(totem => {
      if (
        typeof totem?.key !== "string" ||
        !totem.key ||
        typeof totem?.name !== "string" ||
        !totem.name
      ) {
        throw new Error(
          "Each Elemental Totem must have a key and a name."
        );
      }

      return {
        key: totem.key,
        name: totem.name,
        auraColor: typeof totem.auraColor === "string"
          ? totem.auraColor
          : "#00ff00",
      };
    }),
  };

  const keys = definitions.totems.map(totem => totem.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Elemental Totem keys must be unique.");
  }

  return definitions;
}

function getElementalTotemDefinitions() {
  elementalTotemDefinitionsPromise ??=
    loadElementalTotemDefinitions().catch(error => {
      elementalTotemDefinitionsPromise = null;
      throw error;
    });

  return elementalTotemDefinitionsPromise;
}

function buildTotemOptions(
  definitions,
  selectedKey = "",
  excludedKeys = []
) {
  const excluded = new Set(excludedKeys);

  return definitions.totems
    .filter(totem => !excluded.has(totem.key))
    .map(totem => {
      const selected = totem.key === selectedKey
        ? " selected"
        : "";

      return (
        `<option value="${totem.key}"${selected}>` +
        `${totem.name}</option>`
      );
    })
    .join("");
}

function getTotemName(definitions, key) {
  return definitions.totems.find(
    totem => totem.key === key
  )?.name ?? key;
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

function buildElementalTotemPlan(
  message,
  context,
  definitions,
  totemTypes,
  reachUpgrades,
  durabilityUpgrades
) {
  const powerLevel = Number(context.powerLevel);

  if (new Set(totemTypes).size !== totemTypes.length) {
    throw new Error(
      "An Elemental Totem plan cannot contain duplicate totem types."
    );
  }

  return {
    sourceMessageId: message.id,
    actorUuid: context.actor?.uuid ?? null,
    spellUuid: context.spell?.uuid ?? null,
    sceneId: message.speaker?.scene ?? canvas.scene?.id ?? null,
    casterTokenId: message.speaker?.token ?? null,
    powerLevel,
    criticalEffect: context.criticalEffect ?? "",
    totemTypes,
    reachUpgrades,
    durabilityUpgrades,
    auraRange:
      definitions.baseRange * (2 ** reachUpgrades),
    hitPoints:
      definitions.baseHitPoints * (2 ** durabilityUpgrades),
    armorRating:
      definitions.baseArmor * (2 ** durabilityUpgrades),
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

function getPrimaryActiveGMUser() {
  return game.users.find(user => user.active && user.isGM) ?? null;
}

function getElementalTotemPlacementRange(context) {
  let range = Number(context?.spell?.system?.range);
  if (!Number.isFinite(range) || range <= 0) {
    throw new Error("Elemental Totem has no valid placement range.");
  }

  if (context.criticalEffect === "doubleRange") {
    range *= 2;
  }

  return range;
}

function getCanvasPointFromPointerEvent(event) {
  const view = canvas.app.canvas ?? canvas.app.view;
  const rect = view.getBoundingClientRect();
  const screen = canvas.app.renderer.screen;

  const screenPoint = new PIXI.Point(
    (event.clientX - rect.left) * (screen.width / rect.width),
    (event.clientY - rect.top) * (screen.height / rect.height)
  );

  return canvas.stage.toLocal(screenPoint);
}

function createElementalTotemPreviewDocument(
  scene,
  definitions
) {
  return new foundry.documents.TokenDocument(
    {
      name: "Elemental Totem Preview",
      x: 0,
      y: 0,
      width: definitions.tokenWidth,
      height: definitions.tokenHeight,
      actorLink: false,
    },
    { parent: scene }
  );
}

function calculateElementalTotemDistance(
  scene,
  tokenA,
  tokenB
) {
  const gridSize = scene.grid.size;
  const gridDistance = scene.grid.distance;

  const tokenDisplacement = token => ({
    x: Math.max(token.width - 1, 0) * 0.5 * gridSize,
    y: Math.max(token.height - 1, 0) * 0.5 * gridSize,
  });

  const centerA = tokenA.getCenterPoint();
  const centerB = tokenB.getCenterPoint();
  const displacementA = tokenDisplacement(tokenA);
  const displacementB = tokenDisplacement(tokenB);

  if (centerA.x < centerB.x) {
    centerB.x -= Math.min(
      displacementB.x,
      centerB.x - centerA.x
    );
  } else if (centerA.x > centerB.x) {
    centerB.x += Math.min(
      displacementB.x,
      centerA.x - centerB.x
    );
  }
  if (centerA.y < centerB.y) {
    centerB.y -= Math.min(
      displacementB.y,
      centerB.y - centerA.y
    );
  } else if (centerA.y > centerB.y) {
    centerB.y += Math.min(
      displacementB.y,
      centerA.y - centerB.y
    );
  }

  if (centerA.x < centerB.x) {
    centerA.x += Math.min(
      displacementA.x,
      centerB.x - centerA.x
    );
  } else if (centerA.x > centerB.x) {
    centerA.x -= Math.min(
      displacementA.x,
      centerA.x - centerB.x
    );
  }
  if (centerA.y < centerB.y) {
    centerA.y += Math.min(
      displacementA.y,
      centerB.y - centerA.y
    );
  } else if (centerA.y > centerB.y) {
    centerA.y -= Math.min(
      displacementA.y,
      centerA.y - centerB.y
    );
  }

  if (canvas.scene?.id === scene.id) {
    return Math.round(
      canvas.grid.measurePath([centerA, centerB]).distance
    );
  }

  const pixelDistance = Math.hypot(
    centerB.x - centerA.x,
    centerB.y - centerA.y
  );
  return Math.round(
    (pixelDistance / gridSize) * gridDistance
  );
}

function getElementalTotemPlacementCandidate(
  event,
  scene,
  casterToken,
  previewToken,
  placementRange
) {
  const point = getCanvasPointFromPointerEvent(event);
  const size = previewToken.getSize();
  const snapped = previewToken.getSnappedPosition({
    x: point.x - (size.width / 2),
    y: point.y - (size.height / 2),
    width: previewToken.width,
    height: previewToken.height,
  });

  previewToken.updateSource({
    x: snapped.x,
    y: snapped.y,
  });

  const center = previewToken.getCenterPoint();
  const sceneRect = canvas.dimensions?.sceneRect;
  const insideScene = !sceneRect || sceneRect.contains(
    center.x,
    center.y
  );
  const distance = calculateElementalTotemDistance(
    scene,
    casterToken,
    previewToken
  );

  return {
    x: snapped.x,
    y: snapped.y,
    width: size.width,
    height: size.height,
    distance,
    valid: insideScene && distance <= placementRange,
  };
}

function parseHexColor(color, fallback = 0x00ff00) {
  if (typeof color !== "string") return fallback;

  const value = Number.parseInt(color.replace(/^#/, ""), 16);
  return Number.isFinite(value) ? value : fallback;
}

function drawElementalTotemPlacementPreview(
  graphics,
  candidate,
  auraColor
) {
  const color = candidate.valid
    ? parseHexColor(auraColor)
    : 0xff0000;

  graphics.clear();
  graphics.lineStyle(2, color, 0.95);
  graphics.beginFill(color, 0.35);
  graphics.drawRect(
    candidate.x,
    candidate.y,
    candidate.width,
    candidate.height
  );
  graphics.endFill();
}

function chooseElementalTotemPosition({
  scene,
  casterToken,
  previewToken,
  placementRange,
  auraColor,
  totemName,
  index,
  total,
}) {
  return new Promise(resolve => {
    const view = canvas.app.canvas ?? canvas.app.view;
    const previousCursor = view.style.cursor;
    const graphics = new PIXI.Graphics();
    let candidate = null;
    let settled = false;

    canvas.stage.addChild(graphics);
    view.style.cursor = "crosshair";

    const cleanup = () => {
      view.removeEventListener("pointermove", onPointerMove, true);
      view.removeEventListener("pointerdown", onPointerDown, true);
      view.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("keydown", onKeyDown, true);
      view.style.cursor = previousCursor;
      graphics.destroy();
    };

    const finish = value => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const updateCandidate = event => {
      if (canvas.scene?.id !== scene.id) {
        finish(null);
        return null;
      }

      candidate = getElementalTotemPlacementCandidate(
        event,
        scene,
        casterToken,
        previewToken,
        placementRange
      );
      drawElementalTotemPlacementPreview(
        graphics,
        candidate,
        auraColor
      );
      return candidate;
    };

    function onPointerMove(event) {
      updateCandidate(event);
    }

    function onPointerDown(event) {
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const current = updateCandidate(event);
      if (!current) return;

      if (!current.valid) {
        ui.notifications.warn(
          game.i18n.format(
            "BOA.dialog.elementalTotem.placementOutOfRange",
            {
              distance: current.distance,
              range: placementRange,
            }
          )
        );
        return;
      }

      finish({ x: current.x, y: current.y });
    }

    function onContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      finish(null);
    }

    function onKeyDown(event) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      finish(null);
    }

    view.addEventListener("pointermove", onPointerMove, true);
    view.addEventListener("pointerdown", onPointerDown, true);
    view.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("keydown", onKeyDown, true);

    ui.notifications.info(
      game.i18n.format(
        "BOA.dialog.elementalTotem.placementPrompt",
        {
          name: totemName,
          index,
          total,
          range: placementRange,
        }
      )
    );
  });
}

async function collectElementalTotemPositions(
  plan,
  definitions
) {
  const scene = game.scenes.get(plan.sceneId);
  if (!scene || canvas.scene?.id !== scene.id) {
    throw new Error(
      "The scene where Elemental Totem was cast is not active."
    );
  }

  const casterToken = scene.tokens.get(plan.casterTokenId);
  if (!casterToken) {
    throw new Error(
      "The caster token could not be found in the active scene."
    );
  }

  if (!game.user.isGM && !getPrimaryActiveGMUser()) {
    throw new Error(
      "An active GM is required to create Elemental Totem tokens."
    );
  }

  const previewToken = createElementalTotemPreviewDocument(
    scene,
    definitions
  );
  const positions = [];

  for (let index = 0; index < plan.totemTypes.length; index += 1) {
    const totemType = plan.totemTypes[index];
    const totem = definitions.totems.find(
      entry => entry.key === totemType
    );

    if (!totem) {
      throw new Error(`Unknown Elemental Totem type: ${totemType}`);
    }

    const position = await chooseElementalTotemPosition({
      scene,
      casterToken,
      previewToken,
      placementRange: plan.placementRange,
      auraColor: totem.auraColor,
      totemName: totem.name,
      index: index + 1,
      total: plan.totemTypes.length,
    });

    if (!position) return null;
    positions.push(position);
  }

  return positions;
}

function findWorldElementalTotemActor(totemType) {
  const contentKey = `actors.elemental-totems.${totemType}`;

  return game.actors.find(
    actor => getContentKey(actor) === contentKey
  ) ?? null;
}

function validateElementalTotemPlanShape(plan, definitions) {
  if (!plan || typeof plan !== "object") {
    throw new Error("Missing Elemental Totem plan.");
  }

  const powerLevel = Number(plan.powerLevel);
  const reachUpgrades = Number(plan.reachUpgrades);
  const durabilityUpgrades = Number(plan.durabilityUpgrades);

  if (!Number.isInteger(powerLevel) || powerLevel < 1) {
    throw new Error("Invalid Elemental Totem power level.");
  }
  if (!Number.isInteger(reachUpgrades) || reachUpgrades < 0) {
    throw new Error("Invalid Elemental Totem reach upgrades.");
  }
  if (
    !Number.isInteger(durabilityUpgrades) ||
    durabilityUpgrades < 0
  ) {
    throw new Error("Invalid Elemental Totem durability upgrades.");
  }
  if (
    !Array.isArray(plan.totemTypes) ||
    plan.totemTypes.length < 1 ||
    new Set(plan.totemTypes).size !== plan.totemTypes.length
  ) {
    throw new Error(
      "Elemental Totem types must be a non-empty unique list."
    );
  }
  if (
    plan.totemTypes.length +
      reachUpgrades +
      durabilityUpgrades !==
    powerLevel
  ) {
    throw new Error(
      "Elemental Totem choices do not match the power level."
    );
  }

  const validTypes = new Set(
    definitions.totems.map(totem => totem.key)
  );
  if (plan.totemTypes.some(type => !validTypes.has(type))) {
    throw new Error("The plan contains an unknown totem type.");
  }

  const expectedRange =
    definitions.baseRange * (2 ** reachUpgrades);
  const expectedHitPoints =
    definitions.baseHitPoints * (2 ** durabilityUpgrades);
  const expectedArmor =
    definitions.baseArmor * (2 ** durabilityUpgrades);

  if (
    Number(plan.auraRange) !== expectedRange ||
    Number(plan.hitPoints) !== expectedHitPoints ||
    Number(plan.armorRating) !== expectedArmor
  ) {
    throw new Error(
      "Elemental Totem statistics do not match the selected upgrades."
    );
  }
}

async function validateElementalTotemCreationRequest(
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

async function configureCreatedElementalTotem(
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

async function deletePreviousElementalTotems(
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

async function executeElementalTotemCreation(
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

function registerElementalTotemSocket() {
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

function shouldStartElementalTotemDialog(message) {
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

function onCreateElementalTotemChatMessage(
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

function onUpdateElementalTotemChatMessage(
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

const elementalTotemAuraGraphics = new WeakMap();

function getElementalTotemAuraData(token) {
  const flags = token?.document?.flags?.[MODULE_ID];

  if (flags?.summonType !== "elementalTotem") {
    return null;
  }

  const range = Number(flags.auraRange);
  const alpha = Number(flags.auraAlpha);
  const scene = token.scene ?? token.document?.parent ?? canvas.scene;
  const gridSize = Number(scene?.grid?.size);
  const gridDistance = Number(scene?.grid?.distance);

  if (
    !Number.isFinite(range) ||
    range <= 0 ||
    !Number.isFinite(gridSize) ||
    gridSize <= 0 ||
    !Number.isFinite(gridDistance) ||
    gridDistance <= 0
  ) {
    return null;
  }

  return {
    color: parseHexColor(flags.auraColor, 0x00ff00),
    alpha:
      Number.isFinite(alpha) && alpha >= 0 && alpha <= 1
        ? alpha
        : 0.2,
    radius: (range / gridDistance) * gridSize,
  };
}

function clearElementalTotemAura(token) {
  const graphics = elementalTotemAuraGraphics.get(token);
  if (!graphics) return;

  elementalTotemAuraGraphics.delete(token);

  if (!graphics.destroyed) {
    graphics.destroy();
  }
}

function drawElementalTotemAura(token) {
  clearElementalTotemAura(token);

  if (!token || token.destroyed) return;

  const aura = getElementalTotemAuraData(token);
  if (!aura) return;

  const graphics = new PIXI.Graphics();

  /*
   * Foundry 14 currently exposes the classic PIXI Graphics API in this
   * runtime, matching the placement preview used by this module.
   */
  graphics.lineStyle(
    2,
    aura.color,
    Math.min(0.95, aura.alpha + 0.5)
  );
  graphics.beginFill(aura.color, aura.alpha);
  graphics.drawCircle(
    token.w / 2,
    token.h / 2,
    aura.radius
  );
  graphics.endFill();

  graphics.eventMode = "none";
  graphics.interactive = false;
  graphics.zIndex = -1000;

  token.addChildAt(graphics, 0);
  elementalTotemAuraGraphics.set(token, graphics);
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

function onUpdateElementalTotemAura(
  tokenDocument,
  changes,
  operation,
  userId
) {
  redrawElementalTotemAuraForDocument(tokenDocument);
}

function onDeleteElementalTotemAura(
  tokenDocument,
  operation,
  userId
) {
  const token = tokenDocument.object;
  if (token) {
    clearElementalTotemAura(token);
  }
}

function drawAllElementalTotemAuras() {
  for (const token of canvas.tokens?.placeables ?? []) {
    drawElementalTotemAura(token);
  }
}

Hooks.once("init", () => {
  if (game.system.id !== "dragonbane") return;
  Hooks.on("drawToken", drawElementalTotemAura);
  Hooks.on("updateToken", onUpdateElementalTotemAura);
  Hooks.on("deleteToken", onDeleteElementalTotemAura);
  Hooks.on("canvasReady", drawAllElementalTotemAuras);

  registerSettings();
  Hooks.on("createItem", onCreateItem);
  Hooks.on("updateItem", onUpdateItem);
  Hooks.on("deleteItem", onDeleteItem);
  Hooks.on("createChatMessage", onCreateElementalTotemChatMessage);
  Hooks.on("updateChatMessage", onUpdateElementalTotemChatMessage);
  Hooks.on("renderDoDActorBaseSheet", lockAutoGrantedSpellPreparation);
  Hooks.on("preUpdateItem", protectAutoGrantedSpellPreparation);

  const featureTypes = CONFIG.DoD?.weaponFeatureTypes;

  if (!featureTypes) {
    console.error(
      `${MODULE_ID} | Dragonbane weapon features were not available during init.`
    );
    return;
  }

  Object.assign(featureTypes, WEAPON_FEATURES);
  patchWeaponTests();

  console.log(
    `${MODULE_ID} | Registered custom weapon features, Armor Piercing, and Scattershot.`
  );
});

Hooks.once("ready", async () => {
  if (game.system.id !== "dragonbane") return;


  registerElementalTotemSocket();

  try {
    await loadSpellGrantDefinitions();
    if (isPrimaryActiveGM()) {
      await reconcileSpellGrants();
    }
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to initialize spell grant automation.`,
      error
    );
  }

  /*
   * Capture phase ensures the Scattershot handler runs before
   * Dragonbane's ordinary rollWeaponDamage listener.
   */
  document.addEventListener(
    "click",
    onScattershotDamageClick,
    true
  );

  await promptAdventureImport();
});
