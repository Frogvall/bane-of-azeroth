import {
  WARLOCK_DEMON_DEFINITIONS,
  WARLOCK_DEMON_DURATION,
  WARLOCK_DEMON_PLACEMENT_RANGE,
} from "./constants.js";

export function buildWarlockDemonPlan(
  message,
  context,
  demonKey,
) {
  return {
    sourceMessageId: message.id,
    actorUuid: context.actor?.uuid ?? null,
    abilityUuid: context.ability?.uuid ?? null,
    sceneId:
      message.speaker?.scene
      ?? globalThis.canvas?.scene?.id
      ?? null,
    casterTokenId:
      message.speaker?.token
      ?? null,
    demonKey,
    placementRange:
      WARLOCK_DEMON_PLACEMENT_RANGE,
    duration: WARLOCK_DEMON_DURATION,
  };
}

export function validateWarlockDemonPlanShape(
  plan,
) {
  if (!plan || typeof plan !== "object") {
    throw new Error(
      "Missing Warlock demon plan.",
    );
  }

  for (const key of [
    "sourceMessageId",
    "actorUuid",
    "abilityUuid",
    "sceneId",
    "casterTokenId",
    "demonKey",
  ]) {
    if (
      typeof plan[key] !== "string"
      || !plan[key]
    ) {
      throw new Error(
        `Invalid Warlock demon plan field: ${key}.`,
      );
    }
  }

  if (
    !WARLOCK_DEMON_DEFINITIONS.some(
      definition =>
        definition.key === plan.demonKey,
    )
  ) {
    throw new Error(
      "The plan contains an unknown Warlock demon.",
    );
  }

  if (
    Number(plan.placementRange)
    !== WARLOCK_DEMON_PLACEMENT_RANGE
  ) {
    throw new Error(
      "The Warlock demon placement range is invalid.",
    );
  }

  if (
    plan.duration !== WARLOCK_DEMON_DURATION
  ) {
    throw new Error(
      "The Warlock demon duration is invalid.",
    );
  }
}
