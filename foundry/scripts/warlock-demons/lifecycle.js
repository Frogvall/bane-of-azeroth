import { MODULE_ID } from "../core/constants.js";
import {
  isPrimaryActiveGM,
} from "../core/users.js";
import {
  deleteWarlockDemonsForCaster,
} from "./creation.js";

export function isWarlockDemonShiftRestUpdate(
  changes,
  {
    getProperty =
      globalThis.foundry?.utils?.getProperty,
  } = {},
) {
  if (
    !changes
    || typeof getProperty !== "function"
  ) {
    return false;
  }

  return (
    getProperty(
      changes,
      "system.canRestRound",
    ) === true
    && getProperty(
      changes,
      "system.canRestStretch",
    ) === true
  );
}

export async function onUpdateWarlockDemonCaster(
  actor,
  changes,
) {
  if (
    !isPrimaryActiveGM()
    || !isWarlockDemonShiftRestUpdate(
      changes,
    )
  ) {
    return;
  }

  const result =
    await deleteWarlockDemonsForCaster(
      actor.uuid,
    );

  if (result.failedScenes.length > 0) {
    console.error(
      `${MODULE_ID} | Warlock demon shift `
      + "cleanup was incomplete.",
      result.failedScenes,
    );
  }
}
