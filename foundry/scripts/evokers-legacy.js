import {
  isEvokersLegacyAutomationEnabled,
} from "./automation-settings.js";
import {
  getContentKey,
} from "./core/documents.js";

export const EVOKERS_LEGACY_CONTENT_KEY =
  "heroic-class-ability.evoker.evokers-legacy";

const SPELL_COST_PATCH =
  Symbol.for(
    "bane-of-azeroth.evokers-legacy.spell-cost",
  );

export function actorHasEvokersLegacy(
  actor,
) {
  return Boolean(
    actor?.items?.some?.(
      item =>
        item.type === "ability" &&
        getContentKey(item) ===
          EVOKERS_LEGACY_CONTENT_KEY,
    ),
  );
}

export function canUseEvokersLegacySpellCost(
  item,
  settings =
    globalThis.game?.settings,
) {
  const actor =
    item?.parent;

  return Boolean(
    item?.type === "spell" &&
    Number(item?.system?.rank) > 0 &&
    actor?.documentName === "Actor" &&
    actorHasEvokersLegacy(actor) &&
    isEvokersLegacyAutomationEnabled(
      settings,
    )
  );
}

export function getEvokersLegacySpellCost(
  item,
  powerLevel,
  originalGetSpellCost,
  settings =
    globalThis.game?.settings,
) {
  const level =
    Number(powerLevel);

  if (
    canUseEvokersLegacySpellCost(
      item,
      settings,
    ) &&
    Number.isInteger(level) &&
    level >= 1 &&
    level <= 3
  ) {
    return level + 1;
  }

  return originalGetSpellCost.call(
    item,
    powerLevel,
  );
}

/**
 * Dragonbane 4.0.1 derives spell affordability and actual WP payment
 * from Item#getSpellCost(). Keep the override at that native seam so
 * both paths stay synchronized.
 */
export function patchEvokersLegacySpellCost({
  ItemClass =
    globalThis.CONFIG
      ?.Item
      ?.documentClass,
} = {}) {
  const prototype =
    ItemClass?.prototype;
  const current =
    prototype?.getSpellCost;

  if (
    typeof current !== "function"
  ) {
    console.error(
      "bane-of-azeroth | Dragonbane Item#getSpellCost " +
      "was not available for Evoker's Legacy automation.",
    );
    return false;
  }

  if (
    current[SPELL_COST_PATCH] === true
  ) {
    return true;
  }

  const originalGetSpellCost =
    current;

  function boaEvokersLegacyGetSpellCost(
    powerLevel,
  ) {
    return getEvokersLegacySpellCost(
      this,
      powerLevel,
      originalGetSpellCost,
    );
  }

  Object.defineProperty(
    boaEvokersLegacyGetSpellCost,
    SPELL_COST_PATCH,
    {
      value: true,
    },
  );

  prototype.getSpellCost =
    boaEvokersLegacyGetSpellCost;

  return true;
}
