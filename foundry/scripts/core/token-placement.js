import {
  parseHexColor,
} from "./colors.js";

function canvasPoint(event, canvasInstance, PointClass) {
  const view = canvasInstance.app.canvas ?? canvasInstance.app.view;
  const rect = view.getBoundingClientRect();
  const screen = canvasInstance.app.renderer.screen;
  const point = new PointClass(
    (event.clientX - rect.left) * (screen.width / rect.width),
    (event.clientY - rect.top) * (screen.height / rect.height),
  );
  return canvasInstance.stage.toLocal(point);
}

export function calculateTokenDistance(
  scene,
  tokenA,
  tokenB,
  { canvasInstance = globalThis.canvas } = {},
) {
  const gridSize = scene.grid.size;
  const gridDistance = scene.grid.distance;
  const displacement = token => ({
    x: Math.max(token.width - 1, 0) * 0.5 * gridSize,
    y: Math.max(token.height - 1, 0) * 0.5 * gridSize,
  });

  const centerA = tokenA.getCenterPoint();
  const centerB = tokenB.getCenterPoint();
  const a = displacement(tokenA);
  const b = displacement(tokenB);

  if (centerA.x < centerB.x) {
    centerB.x -= Math.min(b.x, centerB.x - centerA.x);
  } else if (centerA.x > centerB.x) {
    centerB.x += Math.min(b.x, centerA.x - centerB.x);
  }
  if (centerA.y < centerB.y) {
    centerB.y -= Math.min(b.y, centerB.y - centerA.y);
  } else if (centerA.y > centerB.y) {
    centerB.y += Math.min(b.y, centerA.y - centerB.y);
  }
  if (centerA.x < centerB.x) {
    centerA.x += Math.min(a.x, centerB.x - centerA.x);
  } else if (centerA.x > centerB.x) {
    centerA.x -= Math.min(a.x, centerA.x - centerB.x);
  }
  if (centerA.y < centerB.y) {
    centerA.y += Math.min(a.y, centerB.y - centerA.y);
  } else if (centerA.y > centerB.y) {
    centerA.y -= Math.min(a.y, centerA.y - centerB.y);
  }

  if (canvasInstance.scene?.id === scene.id) {
    return Math.round(
      canvasInstance.grid.measurePath([centerA, centerB]).distance,
    );
  }

  const pixels = Math.hypot(
    centerB.x - centerA.x,
    centerB.y - centerA.y,
  );
  return Math.round((pixels / gridSize) * gridDistance);
}

export function getTokenPlacementCandidate(
  event,
  {
    scene,
    originToken,
    previewToken,
    maxDistance,
    validateCandidate,
    canvasInstance = globalThis.canvas,
    PointClass = globalThis.PIXI?.Point,
  },
) {
  if (!PointClass) {
    throw new Error("PIXI.Point is unavailable for token placement.");
  }

  const point = canvasPoint(event, canvasInstance, PointClass);
  const size = previewToken.getSize();
  const snapped = previewToken.getSnappedPosition({
    x: point.x - (size.width / 2),
    y: point.y - (size.height / 2),
    width: previewToken.width,
    height: previewToken.height,
  });
  previewToken.updateSource({ x: snapped.x, y: snapped.y });

  const center = previewToken.getCenterPoint();
  const sceneRect = canvasInstance.dimensions?.sceneRect;
  const insideScene =
    !sceneRect || sceneRect.contains(center.x, center.y);
  const distance = calculateTokenDistance(
    scene,
    originToken,
    previewToken,
    { canvasInstance },
  );

  const candidate = {
    x: snapped.x,
    y: snapped.y,
    width: size.width,
    height: size.height,
    distance,
    valid: insideScene && distance <= maxDistance,
  };

  if (!candidate.valid) {
    candidate.invalidReason = "range";
  }
  const validationResult =
    candidate.valid
      ? validateCandidate?.(candidate)
      : null;

  if (validationResult === false) {
    candidate.valid = false;
  } else if (
    validationResult
    && typeof validationResult === "object"
  ) {
    candidate.valid =
      candidate.valid
      && validationResult.valid !== false;

    if (
      !candidate.valid
      && validationResult.invalidReason
    ) {
      candidate.invalidReason =
        validationResult.invalidReason;
    }
  }

  if (candidate.valid) {
    delete candidate.invalidReason;
  }

  return candidate;
}

export function drawTokenPlacementPreview(
  graphics,
  candidate,
  validColor,
  { invalidColor = 0xff0000 } = {},
) {
  const color = candidate.valid
    ? parseHexColor(validColor)
    : invalidColor;

  graphics.clear();
  graphics.lineStyle(2, color, 0.95);
  graphics.beginFill(color, 0.35);
  graphics.drawRect(
    candidate.x,
    candidate.y,
    candidate.width,
    candidate.height,
  );
  graphics.endFill();
}

export function chooseTokenPosition({
  scene,
  originToken,
  previewToken,
  maxDistance,
  validColor,
  validateCandidate,
  onPrompt,
  onInvalid,
  canvasInstance = globalThis.canvas,
  windowInstance = globalThis.window,
  GraphicsClass = globalThis.PIXI?.Graphics,
  PointClass = globalThis.PIXI?.Point,
}) {
  if (!GraphicsClass) {
    throw new Error("PIXI.Graphics is unavailable for token placement.");
  }
  if (!windowInstance?.addEventListener) {
    throw new Error("Window events are unavailable for token placement.");
  }

  return new Promise(resolve => {
    const view =
      canvasInstance.app.canvas ?? canvasInstance.app.view;
    const previousCursor = view.style.cursor;
    const graphics = new GraphicsClass();
    let settled = false;

    canvasInstance.stage.addChild(graphics);
    view.style.cursor = "crosshair";

    const cleanup = () => {
      view.removeEventListener("pointermove", onPointerMove, true);
      view.removeEventListener("pointerdown", onPointerDown, true);
      view.removeEventListener("contextmenu", onContextMenu, true);
      windowInstance.removeEventListener("keydown", onKeyDown, true);
      view.style.cursor = previousCursor;
      graphics.destroy();
    };
    const finish = value => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const update = event => {
      if (canvasInstance.scene?.id !== scene.id) {
        finish(null);
        return null;
      }
      const candidate = getTokenPlacementCandidate(event, {
        scene,
        originToken,
        previewToken,
        maxDistance,
        validateCandidate,
        canvasInstance,
        PointClass,
      });
      drawTokenPlacementPreview(graphics, candidate, validColor);
      return candidate;
    };

    function onPointerMove(event) {
      update(event);
    }
    function onPointerDown(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const candidate = update(event);
      if (!candidate) return;
      if (!candidate.valid) {
        onInvalid?.(candidate);
        return;
      }
      finish({ x: candidate.x, y: candidate.y });
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
    windowInstance.addEventListener("keydown", onKeyDown, true);
    onPrompt?.();
  });
}
