export const LETHAL_POISON_RULE_UUID =
  "JournalEntry.SbbSMsuvWeo3HaID." +
  "JournalEntryPage.6WPxPxUjh4W80RNy#poison";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function finiteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function buildLethalPoisonMessage({
  effect,
  attackerName,
  targetName,
}) {
  const potency = finiteNumber(
    effect.potency
  );

  if (potency == null) {
    return null;
  }

  const ruleUuid = String(
    effect.ruleUuid ??
      LETHAL_POISON_RULE_UUID
  ).trim();

  if (!ruleUuid) {
    return null;
  }

  const safeAttacker = escapeHtml(
    attackerName
  );
  const safeTarget = escapeHtml(
    targetName
  );

  return {
    effectType: "lethalPoison",
    attackerName,
    targetName,
    content:
      "<p><strong>Lethal Poison:</strong> " +
      `${safeAttacker} exposes ${safeTarget} to ` +
      `@UUID[${ruleUuid}]{lethal poison} ` +
      `with a potency of ${potency}, as if the ` +
      "poison had been ingested.</p>",
  };
}

function buildConstrainMessage({
  effect,
  attackerName,
  targetName,
}) {
  const strength = finiteNumber(
    effect.strength
  );

  if (strength == null) {
    return null;
  }

  const safeAttacker = escapeHtml(
    attackerName
  );
  const safeTarget = escapeHtml(
    targetName
  );

  return {
    effectType: "constrain",
    attackerName,
    targetName,
    content:
      "<p><strong>Constrain:</strong> " +
      `${safeAttacker} constrains ${safeTarget}. ` +
      `${safeTarget} is unable to move or take ` +
      "actions other than trying to escape with an " +
      `open opposed STR roll against ${strength}. ` +
      `${safeTarget} can still parry while ` +
      "constrained, but cannot evade.</p>",
  };
}

/**
 * Build one informational chat-message plan for a supported attack effect.
 */
export function buildCommonAnimalAttackEffectMessage({
  effect,
  attackerName,
  targetName,
} = {}) {
  if (
    !effect ||
    typeof effect !== "object"
  ) {
    return null;
  }

  if (effect.type === "lethalPoison") {
    return buildLethalPoisonMessage({
      effect,
      attackerName,
      targetName,
    });
  }

  if (effect.type === "constrain") {
    return buildConstrainMessage({
      effect,
      attackerName,
      targetName,
    });
  }

  return null;
}

/**
 * Build informational message plans after a successful targeted attack.
 */
export function planCommonAnimalAttackEffectMessages({
  successful = false,
  effects = [],
  attackerName = "",
  targetNames = [],
} = {}) {
  if (!successful) {
    return [];
  }

  if (
    !Array.isArray(effects) ||
    !Array.isArray(targetNames)
  ) {
    return [];
  }

  const messages = [];

  for (const targetName of targetNames) {
    for (const effect of effects) {
      const message =
        buildCommonAnimalAttackEffectMessage({
          effect,
          attackerName,
          targetName,
        });

      if (message) {
        messages.push(message);
      }
    }
  }

  return messages;
}
