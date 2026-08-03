import {
  isMageBrillianceAutomationEnabled,
} from "./automation-settings.js";
import {
  getContentKey,
  getModuleFlag,
} from "./core/documents.js";

export const MAGES_BRILLIANCE_CONTENT_KEY =
  "heroic-class-ability.mage.mages-brilliance";
export const SENSE_MAGIC_UUID =
  "Item.RPnxXYVb8z7EG5Wl";

const SPELL_COST_PATCH =
  Symbol.for(
    "bane-of-azeroth.mage-brilliance.spell-cost",
  );

export function actorHasMagesBrilliance(actor) {
  return Boolean(
    actor?.items?.some?.(
      item =>
        item.type === "ability" &&
        getContentKey(item) ===
          MAGES_BRILLIANCE_CONTENT_KEY,
    ),
  );
}

export function isSenseMagicItem(item) {
  if (item?.type !== "spell") return false;

  // Managed grants have the stable external source UUID.
  if (
    getModuleFlag(item, "sourceUuid") ===
    SENSE_MAGIC_UUID
  ) {
    return true;
  }

  // A manually dragged/copied source can preserve the original
  // Foundry source UUID in core provenance.
  if (
    item.getFlag?.("core", "sourceId") ===
    SENSE_MAGIC_UUID
  ) {
    return true;
  }

  // The existing grant reconciler deliberately treats a manually
  // owned spell with the same source name as the same Sense Magic
  // and does not create a duplicate. Mirror that graceful fallback
  // here so such a manual Item also receives the rule benefit.
  return (
    item.name === "Sense Magic" &&
    Number(item.system?.rank) === 0
  );
}

export function isFreeMagesBrillianceSenseMagic(
  item,
  settings = globalThis.game?.settings,
) {
  const actor = item?.parent;

  return Boolean(
    actor?.documentName === "Actor" &&
    actorHasMagesBrilliance(actor) &&
    isSenseMagicItem(item) &&
    isMageBrillianceAutomationEnabled(settings)
  );
}

export function getMagesBrillianceSpellCost(
  item,
  powerLevel,
  originalGetSpellCost,
  settings = globalThis.game?.settings,
) {
  if (
    isFreeMagesBrillianceSenseMagic(
      item,
      settings,
    )
  ) {
    return 0;
  }

  return originalGetSpellCost.call(
    item,
    powerLevel,
  );
}

/**
 * Dragonbane 4.0.1 derives both spell affordability and the WP
 * recorded for payment from Item#getSpellCost(). Patch that single
 * contract rather than maintaining separate dialog/payment hooks.
 */
export function patchMageBrillianceSpellCost({
  ItemClass =
    globalThis.CONFIG?.Item?.documentClass,
} = {}) {
  const prototype = ItemClass?.prototype;
  const current = prototype?.getSpellCost;

  if (typeof current !== "function") {
    console.error(
      "bane-of-azeroth | Dragonbane Item#getSpellCost " +
      "was not available for Mage's Brilliance automation.",
    );
    return false;
  }

  if (current[SPELL_COST_PATCH] === true) {
    return true;
  }

  const originalGetSpellCost = current;

  function boaMagesBrillianceGetSpellCost(
    powerLevel,
  ) {
    return getMagesBrillianceSpellCost(
      this,
      powerLevel,
      originalGetSpellCost,
    );
  }

  Object.defineProperty(
    boaMagesBrillianceGetSpellCost,
    SPELL_COST_PATCH,
    {
      value: true,
    },
  );

  prototype.getSpellCost =
    boaMagesBrillianceGetSpellCost;

  return true;
}
