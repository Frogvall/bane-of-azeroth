import {
  applyCommonAnimalAttackStatuses,
} from "./common-animal-status-effects.js";
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

function buildRestrainMessage({
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
    effectType: "restrain",
    attackerName,
    targetName,
    content:
      "<p><strong>Restrain:</strong> " +
      `${safeAttacker} restrains ${safeTarget}. ` +
      `${safeTarget} is unable to move or take ` +
      "actions other than trying to escape with an " +
      `open opposed STR roll against ${strength}. ` +
      `${safeTarget} can still parry while ` +
      "restrained, but cannot evade.</p>",
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

  if (effect.type === "restrain") {
    return buildRestrainMessage({
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

function effectTargetName(targetName) {
  const normalized = String(
    targetName ?? ""
  ).trim();

  return normalized || null;
}

function displayName(document) {
  if (!document) {
    return "";
  }

  if (document.isToken) {
    return String(
      document.token?.name ??
      document.name ??
      ""
    );
  }

  return String(document.name ?? "");
}

/**
 * Build one plain sentence for a supported Common Animal attack effect.
 *
 * The returned text is intended for Dragonbane's existing damage paragraph,
 * not for a separate ChatMessage.
 */
export function buildCommonAnimalAttackEffectText({
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

  const safeAttacker = escapeHtml(
    attackerName
  );
  const normalizedTarget =
    effectTargetName(targetName);
  const safeTarget = normalizedTarget
    ? escapeHtml(normalizedTarget)
    : "the target";

  if (effect.type === "lethalPoison") {
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

    return (
      `${safeAttacker} exposes ${safeTarget} to ` +
      `@UUID[${ruleUuid}]{lethal poison} ` +
      `with a potency of ${potency}, as if the ` +
      "poison had been ingested."
    );
  }

  if (effect.type === "restrain") {
    const strength = finiteNumber(
      effect.strength
    );

    if (strength == null) {
      return null;
    }

    const sentenceTarget = normalizedTarget
      ? safeTarget
      : "The target";

    return (
      `${safeAttacker} restrains ${safeTarget}. ` +
      `${sentenceTarget} is unable to move or take ` +
      "actions other than trying to escape with an " +
      `open opposed STR roll against ${strength}. ` +
      `${sentenceTarget} can still parry while ` +
      "restrained, but cannot evade."
    );
  }

  return null;
}

function insertEffectText(
  content,
  effectText
) {
  const strongParagraphEnd =
    "</strong></p>";

  if (content.includes(
    strongParagraphEnd
  )) {
    return content.replace(
      strongParagraphEnd,
      `</strong> ${effectText}</p>`
    );
  }

  const templateSeparator =
    content.search(
      /\n\s*\n(?=<[A-Za-z!/])/
    );

  if (templateSeparator >= 0) {
    const prefix = content.slice(
      0,
      templateSeparator
    ).trimEnd();
    const suffix = content.slice(
      templateSeparator
    );

    return (
      `${prefix} ${effectText}` +
      suffix
    );
  }

  const firstHtmlTag =
    content.search(
      /<(?=[A-Za-z!/])/
    );

  if (firstHtmlTag > 0) {
    const prefix = content.slice(
      0,
      firstHtmlTag
    );
    const trimmedPrefix =
      prefix.trimEnd();
    const preservedWhitespace =
      prefix.slice(
        trimmedPrefix.length
      );

    return (
      `${trimmedPrefix} ${effectText}` +
      preservedWhitespace +
      content.slice(firstHtmlTag)
    );
  }

  const trimmed = content.trimEnd();
  const trailingWhitespace =
    content.slice(trimmed.length);

  return (
    `${trimmed} ${effectText}` +
    trailingWhitespace
  );
}

/**
 * Append supported effects to Dragonbane's existing damage text.
 *
 * Roll markup and action buttons remain untouched. Calling this function
 * repeatedly with the same effects is idempotent.
 */
export function appendCommonAnimalAttackEffectsToDamageContent({
  content = "",
  effects = [],
  attackerName = "",
  targetName = null,
} = {}) {
  if (!Array.isArray(effects)) {
    return content;
  }

  const effectTexts = effects
    .map(effect =>
      buildCommonAnimalAttackEffectText({
        effect,
        attackerName,
        targetName,
      })
    )
    .filter(Boolean)
    .filter(text =>
      !content.includes(text)
    );

  if (effectTexts.length === 0) {
    return content;
  }

  return insertEffectText(
    content,
    effectTexts.join(" ")
  );
}

function rollDamageContext(message) {
  try {
    return (
      message?.system?.toContext?.() ??
      null
    );
  } catch (error) {
    console.error(
      `${MODULE_ID} | Could not resolve ` +
      "Common Animal rollDamage context.",
      error,
      message
    );
    return null;
  }
}

/**
 * Enrich Dragonbane's existing rollDamage ChatMessage in place.
 *
 * Only the client that created the message performs the update, preventing
 * duplicate work on other connected clients.
 */
export async function onCommonAnimalRollDamageChatMessage(
  message,
  _options,
  userId,
  {
    applyAttackStatuses =
      applyCommonAnimalAttackStatuses,
  } = {}
) {
  if (userId !== game.user.id) {
    return message;
  }
  if (message?.type !== "rollDamage") {
    return message;
  }

  const context = rollDamageContext(message);
  if (!context) {
    return message;
  }

  const effects = context.weapon?.getFlag?.(
    MODULE_ID,
    "attackEffects"
  );
  if (!Array.isArray(effects) || effects.length === 0) {
    return message;
  }

  const content = appendCommonAnimalAttackEffectsToDamageContent({
    content: String(message.content ?? ""),
    effects,
    attackerName: displayName(context.actor),
    targetName: context.targetActor
      ? displayName(context.targetActor)
      : null,
  });
  if (content !== message.content) {
    await message.update({
      content,
    });
  }

  const targetActor = context.targetActor ?? null;
  const targetReference =
    targetActor?.token?.document?.uuid ??
    targetActor?.token?.uuid ??
    targetActor?.uuid ??
    null;
  if (targetActor && targetReference) {
    await applyAttackStatuses({
      effects,
      targets: [targetActor],
    });
  }

  return message;
}

