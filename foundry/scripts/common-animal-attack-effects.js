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

const MODULE_ID = "bane-of-azeroth";

function normalizeTargetActor(target) {
  return (
    target?.actor ??
    target?.document?.actor ??
    target ??
    null
  );
}

function normalizeTargets(targets) {
  return Array.from(targets ?? [])
    .map(normalizeTargetActor)
    .filter(
      target =>
        target &&
        typeof target.name === "string" &&
        target.name.length > 0
    );
}

function currentUserTargets() {
  return normalizeTargets(
    game.user?.targets ?? []
  );
}

function chatMessageCreator() {
  return data =>
    ChatMessage.create(data);
}

/**
 * Create informational ChatMessages for one normalized attack result.
 *
 * This function deliberately does not mutate the attacker or any target.
 */
export async function processCommonAnimalAttackResult({
  successful = false,
  attackerActor = null,
  weaponItem = null,
  targets = [],
  createChatMessage = null,
} = {}) {
  if (!successful) {
    return [];
  }

  const effects =
    weaponItem?.getFlag?.(
      MODULE_ID,
      "attackEffects"
    );

  if (
    !Array.isArray(effects) ||
    effects.length === 0
  ) {
    return [];
  }

  const normalizedTargets =
    normalizeTargets(targets);

  if (normalizedTargets.length === 0) {
    return [];
  }

  const plans =
    planCommonAnimalAttackEffectMessages({
      successful: true,
      effects,
      attackerName:
        String(attackerActor?.name ?? ""),
      targetNames:
        normalizedTargets.map(
          target => target.name
        ),
    });

  if (plans.length === 0) {
    return [];
  }

  const createMessage =
    createChatMessage ??
    chatMessageCreator();
  const createdMessages = [];

  for (const plan of plans) {
    const message =
      await createMessage({
        user: game.user.id,
        content: plan.content,
      });

    if (message) {
      createdMessages.push(message);
    }
  }

  return createdMessages;
}

function weaponTestContext(message) {
  try {
    return (
      message?.system?.toContext?.() ??
      null
    );
  } catch (error) {
    console.error(
      `${MODULE_ID} | Could not resolve ` +
      "Common Animal weapon-test context.",
      error,
      message
    );
    return null;
  }
}

/**
 * Handle Dragonbane's created weaponTest ChatMessage.
 *
 * Only the client that created the source ChatMessage performs the follow-up
 * work, preventing duplicate informational messages on other clients.
 */
export async function onCommonAnimalWeaponTestChatMessage(
  message,
  _options,
  userId,
  {
    processAttackResult =
      processCommonAnimalAttackResult,
  } = {}
) {
  if (userId !== game.user.id) {
    return [];
  }

  if (message?.type !== "weaponTest") {
    return [];
  }

  const context =
    weaponTestContext(message);

  if (!context) {
    return [];
  }

  const targets =
    context.targetActor
      ? [context.targetActor]
      : currentUserTargets();

  return processAttackResult({
    successful:
      context.success === true,
    attackerActor:
      context.actor ?? null,
    weaponItem:
      context.weapon ?? null,
    targets,
  });
}

