import { MODULE_ID } from "../core/constants.js";

const ELEMENTAL_TOTEM_CONTENT_PATH =
  `modules/${MODULE_ID}/content/elemental-totems.json`;
let elementalTotemDefinitionsPromise = null;

function requirePositiveNumber(value, context) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(`${context} must be a positive number.`);
  }

  return value;
}

export async function loadElementalTotemDefinitions() {
  const contentUrl = foundry.utils.getRoute(
    ELEMENTAL_TOTEM_CONTENT_PATH
  );
  const response = await fetch(contentUrl);

  if (!response.ok) {
    throw new Error(
      `Could not load Elemental Totem content: ` +
      `${response.status} ${response.statusText}`
    );
  }

  const content = await response.json();
  const defaults = content?.defaults;
  const totems = content?.totems;

  if (!defaults || !Array.isArray(totems) || totems.length === 0) {
    throw new Error(
      "Elemental Totem content is missing defaults or totems."
    );
  }

  const definitions = {
    baseRange: requirePositiveNumber(
      defaults.auraRange,
      "defaults.auraRange"
    ),
    baseHitPoints: requirePositiveNumber(
      defaults.hitPoints,
      "defaults.hitPoints"
    ),
    baseArmor: requirePositiveNumber(
      defaults.armorRating,
      "defaults.armorRating"
    ),
    tokenWidth: requirePositiveNumber(
      defaults.tokenWidth,
      "defaults.tokenWidth"
    ),
    tokenHeight: requirePositiveNumber(
      defaults.tokenHeight,
      "defaults.tokenHeight"
    ),
    totems: totems.map(totem => {
      if (
        typeof totem?.key !== "string" ||
        !totem.key ||
        typeof totem?.name !== "string" ||
        !totem.name
      ) {
        throw new Error(
          "Each Elemental Totem must have a key and a name."
        );
      }

      return {
        key: totem.key,
        name: totem.name,
        auraColor: typeof totem.auraColor === "string"
          ? totem.auraColor
          : "#00ff00",
      };
    }),
  };

  const keys = definitions.totems.map(totem => totem.key);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Elemental Totem keys must be unique.");
  }

  return definitions;
}

export function getElementalTotemDefinitions() {
  elementalTotemDefinitionsPromise ??=
    loadElementalTotemDefinitions().catch(error => {
      elementalTotemDefinitionsPromise = null;
      throw error;
    });

  return elementalTotemDefinitionsPromise;
}

export function buildTotemOptions(
  definitions,
  selectedKey = "",
  excludedKeys = []
) {
  const excluded = new Set(excludedKeys);

  return definitions.totems
    .filter(totem => !excluded.has(totem.key))
    .map(totem => {
      const selected = totem.key === selectedKey
        ? " selected"
        : "";

      return (
        `<option value="${totem.key}"${selected}>` +
        `${totem.name}</option>`
      );
    })
    .join("");
}

export function getTotemName(definitions, key) {
  return definitions.totems.find(
    totem => totem.key === key
  )?.name ?? key;
}
