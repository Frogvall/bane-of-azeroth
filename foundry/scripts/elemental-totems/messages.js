import { MODULE_ID } from "../core/constants.js";
import { getContentKey } from "../core/documents.js";
import {
  ELEMENTAL_TOTEM_CONTENT_KEY,
} from "./constants.js";

export function getElementalTotemMessageContext(message) {
  try {
    return message.system?.toContext?.() ?? null;
  } catch (error) {
    console.error(
      `${MODULE_ID} | Could not resolve Elemental Totem message context.`,
      error,
      message
    );
    return null;
  }
}

export function isElementalTotemSpellTest(message, context) {
  return (
    message?.type === "spellTest" &&
    getContentKey(context?.spell) === ELEMENTAL_TOTEM_CONTENT_KEY
  );
}
