import { MODULE_ID } from "../core/constants.js";
import { parseHexColor } from "../core/colors.js";

const elementalTotemAuraGraphics = new WeakMap();

export function getElementalTotemAuraData(token) {
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

export function drawElementalTotemAura(token) {
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

  graphics.interactive = false;
  graphics.eventMode = "none";
  graphics.zIndex = -1000;

  token.addChildAt(graphics, 0);
  elementalTotemAuraGraphics.set(token, graphics);
}

function redrawElementalTotemAuraForDocument(
  tokenDocument
) {
  if (
    canvas.scene?.id !== tokenDocument?.parent?.id
  ) {
    return;
  }

  const token = tokenDocument.object;
  if (!token) return;

  /*
   * Let Foundry apply its own token refresh flags before
   * measuring the token's current pixel width and height.
   */
  requestAnimationFrame(() => {
    if (!token.destroyed) {
      drawElementalTotemAura(token);
    }
  });
}

export function onUpdateElementalTotemAura(
  tokenDocument,
  changes,
  operation,
  userId
) {
  redrawElementalTotemAuraForDocument(tokenDocument);
}

export function onDeleteElementalTotemAura(
  tokenDocument,
  operation,
  userId
) {
  const token = tokenDocument.object;
  if (token) {
    clearElementalTotemAura(token);
  }
}

export function drawAllElementalTotemAuras() {
  for (const token of canvas.tokens?.placeables ?? []) {
    drawElementalTotemAura(token);
  }
}
