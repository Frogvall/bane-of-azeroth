import { MODULE_ID } from "./constants.js";

export function getModuleFlag(document, key) {
  return document?.getFlag?.(MODULE_ID, key);
}

export function getContentKey(document) {
  const value = getModuleFlag(document, "contentKey");
  return typeof value === "string" ? value : "";
}
