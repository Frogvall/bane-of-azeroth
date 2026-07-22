const MODULE_ID = "bane-of-azeroth";

function finiteMovementRate(value) {
  if (
    value == null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return null;
  }

  const rate = Number(value);

  return (
    Number.isFinite(rate) &&
    rate >= 0
  )
    ? rate
    : null;
}

function hasAlternateMovementRates(value) {
  return (
    value &&
    typeof value === "object" &&
    Object.keys(value).length > 0
  );
}

/**
 * Resolve the movement rate for one Foundry movement action.
 *
 * The Actor's normal rate is supplied separately. The module flag contains
 * only alternate movement rates such as fly or swim.
 */
export function resolveCommonAnimalMovementRate({
  baseMovement,
  movementRates = null,
  movementAction,
  defaultAction = "walk",
} = {}) {
  const base = finiteMovementRate(
    baseMovement
  );

  if (base == null) {
    return null;
  }

  if (
    !movementAction ||
    movementAction === defaultAction
  ) {
    return base;
  }

  return (
    finiteMovementRate(
      movementRates?.[movementAction]
    ) ??
    base
  );
}

function movementRatesForToken(token) {
  const actor = token?.actor;

  if (!actor) {
    return null;
  }

  return (
    actor.getFlag?.(
      MODULE_ID,
      "movementRates"
    ) ??
    token.baseActor?.getFlag?.(
      MODULE_ID,
      "movementRates"
    ) ??
    null
  );
}

function baseMovementForToken(token) {
  return finiteMovementRate(
    token?.baseActor?.system
      ?.movement?.base ??
    token?.actor?.system
      ?.movement?.base
  );
}

/**
 * Synchronize one unlinked Token's synthetic Actor with its selected action.
 *
 * Updating a synthetic Actor stores the override in that Token's ActorDelta;
 * the base world Actor is not modified. Actors without alternate movement
 * metadata are left entirely to Dragonbane.
 */
export async function synchronizeCommonAnimalTokenMovement({
  token,
  movementAction,
  defaultAction = "walk",
} = {}) {
  if (
    !token ||
    token.actorLink === true ||
    token.isLinked === true
  ) {
    return false;
  }

  const actor = token.actor;

  if (
    !actor ||
    actor.isToken !== true ||
    typeof actor.update !== "function"
  ) {
    return false;
  }

  const movementRates =
    movementRatesForToken(token);

  if (!hasAlternateMovementRates(
    movementRates
  )) {
    return false;
  }

  const movementRate =
    resolveCommonAnimalMovementRate({
      baseMovement:
        baseMovementForToken(token),
      movementRates,
      movementAction,
      defaultAction,
    });

  if (movementRate == null) {
    return false;
  }

  const currentRate = Number(
    actor.system?.movement?.value
  );

  if (currentRate === movementRate) {
    return false;
  }

  await actor.update({
    "system.movement.value":
      movementRate,
  });

  return true;
}

/**
 * React to changes of TokenDocument.movementAction.
 *
 * Only the client that originated the Token update writes the ActorDelta.
 */
export async function onUpdateCommonAnimalMovementToken(
  token,
  changes,
  _options,
  userId,
  {
    currentUserId =
      game.user?.id,
    defaultAction =
      CONFIG.Token?.movement
        ?.defaultAction ??
      "walk",
    synchronizeMovement =
      synchronizeCommonAnimalTokenMovement,
  } = {}
) {
  if (userId !== currentUserId) {
    return false;
  }

  if (
    !changes ||
    !Object.hasOwn(
      changes,
      "movementAction"
    )
  ) {
    return false;
  }

  return synchronizeMovement({
    token,
    movementAction:
      changes.movementAction,
    defaultAction,
  });
}
