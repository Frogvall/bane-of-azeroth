import {
  getContentKey,
} from "../core/documents.js";
import {
  WARLOCK_DEMON_DEFINITIONS,
} from "./constants.js";

export function getWarlockDemonDefinition(key) {
  return WARLOCK_DEMON_DEFINITIONS.find(
    definition => definition.key === key,
  ) ?? null;
}

export function buildWarlockDemonOptions(
  selected = "",
) {
  return WARLOCK_DEMON_DEFINITIONS
    .map(definition => {
      const isSelected =
        definition.key === selected
          ? " selected"
          : "";

      return (
        `<option value="${definition.key}"${isSelected}>`
        + `${definition.name}</option>`
      );
    })
    .join("");
}

export function findWorldWarlockDemonActor(
  key,
  actors = globalThis.game?.actors,
) {
  const definition =
    getWarlockDemonDefinition(key);

  if (!definition || !actors) return null;

  return Array.from(actors).find(
    actor =>
      getContentKey(actor)
      === definition.contentKey,
  ) ?? null;
}
