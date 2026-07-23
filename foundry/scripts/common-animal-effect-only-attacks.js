import {
  appendCommonAnimalAttackEffectsToDamageContent,
} from "./common-animal-attack-effects.js";

const MODULE_ID = "bane-of-azeroth";

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

function weaponTestContext(message) {
  try {
    return (
      message?.system?.toContext?.() ??
      null
    );
  } catch (error) {
    console.error(
      `${MODULE_ID} | Could not resolve ` +
      "Common Animal effect-only " +
      "weapon-test context.",
      error,
      message
    );
    return null;
  }
}

function attackEffects(weapon) {
  const effects =
    weapon?.getFlag?.(
      MODULE_ID,
      "attackEffects"
    );

  return Array.isArray(effects)
    ? effects
    : [];
}

/**
 * Return true only for an explicitly generated, non-damaging attack
 * with at least one supported Common Animal attack effect.
 */
export function isCommonAnimalEffectOnlyWeapon(
  weapon
) {
  if (
    !weapon ||
    weapon.type !== "weapon"
  ) {
    return false;
  }

  if (
    weapon.getFlag?.(
      MODULE_ID,
      "effectOnly"
    ) !== true
  ) {
    return false;
  }

  if (
    String(
      weapon.system?.damage ?? ""
    ).trim()
  ) {
    return false;
  }

  return attackEffects(weapon).length > 0;
}

/**
 * Correct Dragonbane's generic normal-attack classification before the
 * weaponTest ChatMessage is created.
 *
 * Dragonbane otherwise marks a normal melee attack as damaging even when its
 * damage formula is empty. Persisting isDamaging=false keeps Roll Damage and
 * Double Weapon Damage out of the resulting message while leaving the normal
 * melee mishap and Extra Attack critical option intact.
 */
export function onPreCreateCommonAnimalEffectOnlyWeaponTestMessage(
  message,
  data,
  _options,
  userId
) {
  if (
    userId &&
    userId !== game.user.id
  ) {
    return message;
  }

  const messageType =
    message?.type ??
    data?.type;

  if (messageType !== "weaponTest") {
    return message;
  }

  const context =
    weaponTestContext(message);

  if (
    !context ||
    !isCommonAnimalEffectOnlyWeapon(
      context.weapon
    )
  ) {
    return message;
  }

  message.updateSource?.({
    system: {
      isDamaging: false,
    },
  });

  return message;
}

export function removeCommonAnimalEffectOnlyDamageButton(
  content
) {
  return String(content ?? "").replace(
    /<button\b(?=[^>]*\bdata-action=(["'])rollWeaponDamage\1)[^>]*>[\s\S]*?<\/button>/gi,
    ""
  );
}

async function enrichEffectOnlyWeaponTestMessage(
  message,
  userId
) {
  if (
    userId &&
    userId !== game.user.id
  ) {
    return message;
  }

  if (message?.type !== "weaponTest") {
    return message;
  }

  const context =
    weaponTestContext(message);

  if (
    !context ||
    context.success !== true ||
    !isCommonAnimalEffectOnlyWeapon(
      context.weapon
    )
  ) {
    return message;
  }

  const content =
    appendCommonAnimalAttackEffectsToDamageContent({
      content:
        removeCommonAnimalEffectOnlyDamageButton(
          message.content
        ),
      effects:
        attackEffects(
          context.weapon
        ),
      attackerName:
        displayName(context.actor),
      targetName:
        context.targetActor
          ? displayName(
              context.targetActor
            )
          : null,
    });

  if (content === message.content) {
    return message;
  }

  await message.update({
    content,
  });

  return message;
}

/**
 * Add effect-only attack text to a newly created successful weaponTest card.
 */
export async function onCreateCommonAnimalEffectOnlyWeaponTestMessage(
  message,
  _options,
  userId
) {
  return enrichEffectOnlyWeaponTestMessage(
    message,
    userId
  );
}

/**
 * Restore effect-only attack text after Dragonbane rebuilds a dragon-result
 * card when the user confirms the remaining Extra Attack critical option.
 */
export async function onUpdateCommonAnimalEffectOnlyWeaponTestMessage(
  message,
  _changes,
  _options,
  userId
) {
  return enrichEffectOnlyWeaponTestMessage(
    message,
    userId
  );
}

/**
 * Remove Dragonbane's empty damage parentheses from one rendered weapon link.
 */
export function removeEmptyDamageParenthesesAfterWeaponElement(
  element
) {
  let sibling =
    element?.nextSibling ??
    null;

  while (sibling) {
    if (sibling.nodeType === 3) {
      const before =
        String(
          sibling.textContent ?? ""
        );
      const after = before.replace(
        /^\s*\(\s*\)/,
        ""
      );

      if (after !== before) {
        sibling.textContent = after;
        return true;
      }

      if (before.trim()) {
        return false;
      }

      sibling =
        sibling.nextSibling ??
        null;
      continue;
    }

    return false;
  }

  return false;
}

function renderedRoot(html) {
  return (
    html?.querySelectorAll
      ? html
      : html?.[0]?.querySelectorAll
        ? html[0]
        : null
  );
}

function effectOnlyWeapons(actor) {
  return Array.from(
    actor?.items ?? []
  ).filter(
    isCommonAnimalEffectOnlyWeapon
  );
}

/**
 * Clean the compact Dragonbane NPC weapon summary without altering the Item.
 */
export function onRenderCommonAnimalEffectOnlyActorSheet(
  app,
  html
) {
  const actor =
    app?.actor ??
    app?.document ??
    null;
  const root =
    renderedRoot(html);

  if (
    actor?.type !== "npc" ||
    !root
  ) {
    return 0;
  }

  let cleaned = 0;
  const handled = new Set();

  for (const weapon of (
    effectOnlyWeapons(actor)
  )) {
    const weaponId =
      String(
        weapon.id ??
        weapon._id ??
        ""
      );

    if (!weaponId) {
      continue;
    }

    const elements =
      root.querySelectorAll(
        `[data-item-id="${weaponId}"]`
      );

    for (const element of (
      elements
    )) {
      const link =
        element.matches?.("a")
          ? element
          : element.querySelector?.(
              "a"
            );

      if (
        !link ||
        handled.has(link)
      ) {
        continue;
      }

      handled.add(link);

      if (
        removeEmptyDamageParenthesesAfterWeaponElement(
          link
        )
      ) {
        cleaned += 1;
      }
    }
  }

  return cleaned;
}
