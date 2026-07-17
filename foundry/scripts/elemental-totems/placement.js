import { parseHexColor } from "../core/colors.js";
import {
  getPrimaryActiveGMUser,
} from "../core/users.js";

export function getElementalTotemPlacementRange(context) {
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

export function createElementalTotemPreviewDocument(
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

export function calculateElementalTotemDistance(
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

export async function collectElementalTotemPositions(
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
