#!/usr/bin/env python3
"""Add Elemental Totem token placement and summon creation to Bane of Azeroth."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


JS_BLOCK = r"""
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

  graphics
    .clear()
    .rect(
      candidate.x,
      candidate.y,
      candidate.width,
      candidate.height
    )
    .fill({ color, alpha: 0.35 })
    .stroke({ color, alpha: 0.95, width: 2 });
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
""".strip()


TRANSLATIONS = {
    "placementPrompt": (
        "Place {name} ({index}/{total}) within {range} m. "
        "Left-click to place; right-click or press Escape to cancel."
    ),
    "placementOutOfRange": (
        "That position is {distance} m away; the maximum range is {range} m."
    ),
    "placementCancelled": "Elemental Totem placement cancelled.",
    "tokensCreated": "Created {count} Elemental Totem token(s).",
    "cleanupWarning": (
        "The new totems were created, but old totems could not be removed "
        "from: {scenes}."
    ),
    "placementError": (
        "The Elemental Totem tokens could not be created. "
        "See the console for details."
    ),
}


def patch_javascript(path: Path) -> None:
    text = path.read_text(encoding="utf-8")

    if "async function executeElementalTotemCreation(" not in text:
        marker = "async function runElementalTotemDialogFlow(message) {"
        index = text.find(marker)
        if index < 0:
            raise SystemExit(
                "Could not find runElementalTotemDialogFlow() in "
                f"{path}. Apply the dialog-flow patch first."
            )
        text = text[:index] + JS_BLOCK + "\n\n" + text[index:]

    # Add token dimensions and colors to the loaded definitions.
    old_definitions = """    baseArmor: requirePositiveNumber(
      defaults.armorRating,
      \"defaults.armorRating\"
    ),
    totems: totems.map(totem => {
"""
    new_definitions = """    baseArmor: requirePositiveNumber(
      defaults.armorRating,
      \"defaults.armorRating\"
    ),
    tokenWidth: requirePositiveNumber(
      defaults.tokenWidth,
      \"defaults.tokenWidth\"
    ),
    tokenHeight: requirePositiveNumber(
      defaults.tokenHeight,
      \"defaults.tokenHeight\"
    ),
    totems: totems.map(totem => {
"""
    if "tokenWidth: requirePositiveNumber(" not in text:
        if text.count(old_definitions) != 1:
            raise SystemExit(
                "Could not locate the Elemental Totem definitions block."
            )
        text = text.replace(old_definitions, new_definitions, 1)

    old_totem_return = """      return {
        key: totem.key,
        name: totem.name,
      };
"""
    new_totem_return = """      return {
        key: totem.key,
        name: totem.name,
        auraColor: typeof totem.auraColor === \"string\"
          ? totem.auraColor
          : \"#00ff00\",
      };
"""
    if "auraColor: typeof totem.auraColor" not in text:
        if text.count(old_totem_return) != 1:
            raise SystemExit(
                "Could not locate the Elemental Totem definition mapping."
            )
        text = text.replace(old_totem_return, new_totem_return, 1)

    # Give the plan a server-verifiable placement range.
    plan_marker = """  const plan = buildElementalTotemPlan(
    message,
    context,
    definitions,
    totemTypes,
    reachUpgrades,
    durabilityUpgrades
  );
"""
    plan_replacement = plan_marker + """
  plan.placementRange = getElementalTotemPlacementRange(context);
"""
    if "plan.placementRange = getElementalTotemPlacementRange" not in text:
        if text.count(plan_marker) != 1:
            raise SystemExit(
                "Could not locate the Elemental Totem plan creation block."
            )
        text = text.replace(plan_marker, plan_replacement, 1)

    # Replace the temporary console-only completion with real placement.
    old_tail_pattern = re.compile(
        r"\n  console\.info\(\n"
        r"    `\$\{MODULE_ID\} \| Elemental Totem plan confirmed\.`,\n"
        r"    plan\n"
        r"  \);\n\n"
        r"  ui\.notifications\.info\([\s\S]*?\n  \);\n\n"
        r"  /\*[\s\S]*?Token placement is intentionally implemented"
        r"[\s\S]*?\*/\n",
        re.MULTILINE,
    )
    new_tail = """
  const positions = await collectElementalTotemPositions(
    plan,
    definitions
  );
  if (!positions) {
    ui.notifications.info(
      game.i18n.localize(
        \"BOA.dialog.elementalTotem.placementCancelled\"
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
      \"BOA.dialog.elementalTotem.tokensCreated\",
      { count: result.createdTokenIds.length }
    )
  );

  if (result.failedCleanupScenes.length > 0) {
    ui.notifications.warn(
      game.i18n.format(
        \"BOA.dialog.elementalTotem.cleanupWarning\",
        { scenes: result.failedCleanupScenes.join(\", \") }
      )
    );
  }
"""
    if "const positions = await collectElementalTotemPositions(" not in text:
        text, count = old_tail_pattern.subn("\n" + new_tail, text, count=1)
        if count != 1:
            raise SystemExit(
                "Could not locate the temporary dialog-flow completion block."
            )

    # Register the module socket once the game is ready.
    ready_marker = """Hooks.once(\"ready\", async () => {
  if (game.system.id !== \"dragonbane\") return;
"""
    ready_replacement = ready_marker + """

  registerElementalTotemSocket();
"""
    if "registerElementalTotemSocket();" not in text:
        if text.count(ready_marker) != 1:
            raise SystemExit("Could not locate the ready hook.")
        text = text.replace(ready_marker, ready_replacement, 1)

    path.write_text(text, encoding="utf-8")


def patch_translations(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    elemental_totem = (
        data.setdefault("BOA", {})
        .setdefault("dialog", {})
        .setdefault("elementalTotem", {})
    )
    elemental_totem.update(TRANSLATIONS)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def patch_manifest(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    data["socket"] = True
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    repo_root = (
        Path(sys.argv[1]).resolve()
        if len(sys.argv) > 1
        else Path.cwd().resolve()
    )
    js_path = repo_root / "foundry" / "scripts" / "bane-of-azeroth.js"
    lang_path = repo_root / "foundry" / "lang" / "en.json"
    manifest_path = repo_root / "foundry" / "module.json"

    for path in (js_path, lang_path, manifest_path):
        if not path.is_file():
            raise SystemExit(f"Missing required file: {path}")

    patch_javascript(js_path)
    patch_translations(lang_path)
    patch_manifest(manifest_path)

    print("Added Elemental Totem token placement and creation.")
    print("Updated:")
    print(f"  {js_path.relative_to(repo_root)}")
    print(f"  {lang_path.relative_to(repo_root)}")
    print(f"  {manifest_path.relative_to(repo_root)}")
    print()
    print("Review with:")
    print(
        "  git diff --check && git diff -- "
        "foundry/scripts/bane-of-azeroth.js foundry/lang/en.json "
        "foundry/module.json"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
