import { MODULE_ID } from "../core/constants.js";

function isElementalTotemToken(tokenDocument) {
  return (
    tokenDocument?.flags?.[MODULE_ID]?.summonType
    === "elementalTotem"
  );
}

function changesTokenPosition(changes) {
  return (
    Object.hasOwn(changes ?? {}, "x")
    || Object.hasOwn(changes ?? {}, "y")
  );
}

export function protectElementalTotemMovement(
  tokenDocument,
  changes,
  options,
  userId
) {
  if (
    !isElementalTotemToken(tokenDocument)
    || !changesTokenPosition(changes)
  ) {
    return;
  }

  const user = game.users.get(userId);

  if (user?.isGM) {
    return;
  }

  return false;
}
