import {
  getContentKey,
} from "../core/documents.js";
import {
  getWarlockDemonDefinition,
} from "./definitions.js";

const PHASE_SHIFT_LOCALIZATION_KEY =
  "BOA.dialog.warlockDemon.phaseShiftBane";
const SEDUCTIVE_LOCALIZATION_KEY =
  "BOA.dialog.warlockDemon.seductiveBane";

function getTargetActor(targetToken) {
  return targetToken?.actor
    ?? targetToken?.document?.actor
    ?? null;
}

export function getWarlockDemonDefenseBane({
  targetToken,
  weapon,
} = {}) {
  if (!targetToken || !weapon) return null;

  const contentKey = getContentKey(
    getTargetActor(targetToken),
  );
  const impContentKey =
    getWarlockDemonDefinition("imp")?.contentKey;
  const sayaadContentKey =
    getWarlockDemonDefinition("sayaad")?.contentKey;

  let localizationKey = "";

  if (contentKey === impContentKey) {
    localizationKey = PHASE_SHIFT_LOCALIZATION_KEY;
  } else if (
    contentKey === sayaadContentKey
    && !weapon.isRangedWeapon
  ) {
    localizationKey = SEDUCTIVE_LOCALIZATION_KEY;
  }

  if (!localizationKey) return null;

  return {
    source: game.i18n.localize(localizationKey),
    value: true,
  };
}

export function applyWarlockDemonDefenseBane(test) {
  if (test?.noBanesBoons) return false;

  const banes = test?.dialogData?.banes;
  if (!Array.isArray(banes)) return false;

  const targetToken =
    test.options?.targets?.[0]?.document
    ?? null;
  const bane = getWarlockDemonDefenseBane({
    targetToken,
    weapon: test.weapon,
  });

  if (!bane) return false;
  if (banes.some(entry => entry?.source === bane.source)) {
    return false;
  }

  banes.push(bane);
  return true;
}
