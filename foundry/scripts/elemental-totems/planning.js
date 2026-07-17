export function buildElementalTotemPlan(
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

export function validateElementalTotemPlanShape(plan, definitions) {
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
