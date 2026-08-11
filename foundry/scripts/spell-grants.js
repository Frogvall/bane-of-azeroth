import { MODULE_ID } from "./core/constants.js";
import {
  externalReferenceUuid,
} from "../generated/external-references.js";
import {
  getContentKey,
  getModuleFlag,
} from "./core/documents.js";
import {
  ensureAutoGrantedSpellsPrepared,
} from "./spell-preparation.js";
import {
  isMageBrillianceAutomationEnabled,
} from "./automation-settings.js";

const SPELL_GRANT_CONTENT_PATH =
  `modules/${MODULE_ID}/content/heroic-class-abilities.json`;
const spellGrantDefinitions = new Map();
const spellGrantUuidDefinitions = new Map();
const MAGES_BRILLIANCE_CONTENT_KEY =
  "heroic-class-ability.mage.mages-brilliance";
let spellGrantReconcileTimer = null;

export async function loadSpellGrantDefinitions() {
  spellGrantDefinitions.clear();
  spellGrantUuidDefinitions.clear();

  const contentUrl = foundry.utils.getRoute(
    SPELL_GRANT_CONTENT_PATH
  );
  const response = await fetch(contentUrl);

  if (!response.ok) {
    throw new Error(
      `Could not load spell grant definitions: ` +
      `${response.status} ${response.statusText}`
    );
  }

  const content = await response.json();
  if (!Array.isArray(content.classes)) {
    throw new Error(
      "Heroic Class Ability content does not contain a classes array."
    );
  }

  for (const classEntry of content.classes) {
    if (
      typeof classEntry?.key !== "string" ||
      !Array.isArray(classEntry.abilities)
    ) {
      continue;
    }

    for (const ability of classEntry.abilities) {
      if (typeof ability?.key !== "string") {
        continue;
      }

      const abilityContentKey =
        `heroic-class-ability.${classEntry.key}.${ability.key}`;

      if (typeof ability.grantsSpell === "string") {
        spellGrantDefinitions.set(
          abilityContentKey,
          `spells.${ability.grantsSpell}`
        );
      }

      if (
        typeof ability.grantsExternalSpell === "string" &&
        ability.grantsExternalSpell
      ) {
        spellGrantUuidDefinitions.set(
          abilityContentKey,
          externalReferenceUuid(ability.grantsExternalSpell)
        );
      }

      if (
        typeof ability.grantsSpellUuid === "string" &&
        ability.grantsSpellUuid
      ) {
        spellGrantUuidDefinitions.set(
          abilityContentKey,
          ability.grantsSpellUuid
        );
      }
    }
  }
}

export function resolveGrantedSpellContentKey(ability) {
  const directValue = getModuleFlag(ability, "grantsSpell");
  if (typeof directValue === "string" && directValue) {
    return directValue;
  }

  return (
    spellGrantDefinitions.get(getContentKey(ability)) ?? ""
  );
}

export function resolveGrantedSpellUuid(ability) {
  const directValue =
    getModuleFlag(ability, "grantsSpellUuid");
  if (typeof directValue === "string" && directValue) {
    return directValue;
  }

  return (
    spellGrantUuidDefinitions.get(
      getContentKey(ability)
    ) ?? ""
  );
}

function isSpellGrantAutomationEnabled(ability) {
  if (
    getContentKey(ability) ===
    MAGES_BRILLIANCE_CONTENT_KEY
  ) {
    return isMageBrillianceAutomationEnabled();
  }

  return true;
}

function findWorldSpell(spellContentKey) {
  return game.items.find(
    item =>
      item.type === "spell" &&
      getContentKey(item) === spellContentKey
  );
}

export function actorHasSpell(actor, spellContentKey) {
  return actor.items.some(
    item =>
      item.type === "spell" &&
      (
        getContentKey(item) === spellContentKey ||
        getModuleFlag(item, "sourceSpell") === spellContentKey
      )
  );
}

function actorHasExternalSpell(
  actor,
  sourceSpell,
  sourceUuid
) {
  return actor.items.some(
    item =>
      item.type === sourceSpell.type &&
      (
        getModuleFlag(item, "sourceUuid") === sourceUuid ||
        item.getFlag?.("core", "sourceId") === sourceUuid ||
        item.name === sourceSpell.name
      )
  );
}

function cloneGrantedSpell(
  sourceSpell,
  abilityContentKey
) {
  const spellData = sourceSpell.toObject();

  delete spellData._id;
  delete spellData.folder;
  delete spellData.ownership;

  foundry.utils.setProperty(
    spellData,
    `flags.${MODULE_ID}.autoGranted`,
    true
  );
  foundry.utils.setProperty(
    spellData,
    `flags.${MODULE_ID}.grantedByAbility`,
    abilityContentKey
  );

  return spellData;
}

export async function grantSpellForAbility(ability) {
  const actor = ability?.parent;
  if (
    actor?.documentName !== "Actor" ||
    ability.type !== "ability" ||
    !isSpellGrantAutomationEnabled(ability)
  ) {
    return;
  }

  const abilityContentKey = getContentKey(ability);
  const spellUuid = resolveGrantedSpellUuid(ability);

  if (spellUuid) {
    const resolveUuid = globalThis.fromUuid;
    if (typeof resolveUuid !== "function") {
      console.warn(
        `${MODULE_ID} | Could not grant ${spellUuid} to ` +
        `${actor.name}: fromUuid is not available.`
      );
      return;
    }

    const sourceSpell = await resolveUuid(spellUuid);
    if (!sourceSpell || sourceSpell.type !== "spell") {
      console.warn(
        `${MODULE_ID} | Could not grant ${spellUuid} to ` +
        `${actor.name}: the source spell could not be resolved.`
      );
      return;
    }

    if (
      actorHasExternalSpell(
        actor,
        sourceSpell,
        spellUuid
      )
    ) {
      return;
    }

    const spellData = cloneGrantedSpell(
      sourceSpell,
      abilityContentKey
    );
    foundry.utils.setProperty(
      spellData,
      `flags.${MODULE_ID}.sourceUuid`,
      spellUuid
    );

    await actor.createEmbeddedDocuments(
      "Item",
      [spellData]
    );
    return;
  }

  const spellContentKey =
    resolveGrantedSpellContentKey(ability);
  if (
    !spellContentKey ||
    actorHasSpell(actor, spellContentKey)
  ) {
    return;
  }

  const sourceSpell = findWorldSpell(spellContentKey);
  if (!sourceSpell) {
    console.warn(
      `${MODULE_ID} | Could not grant ${spellContentKey} to ` +
      `${actor.name}: the source spell was not found among world Items.`
    );
    return;
  }

  const spellData = cloneGrantedSpell(
    sourceSpell,
    abilityContentKey
  );
  foundry.utils.setProperty(
    spellData,
    "system.memorized",
    true
  );
  foundry.utils.setProperty(
    spellData,
    `flags.${MODULE_ID}.sourceSpell`,
    spellContentKey
  );

  await actor.createEmbeddedDocuments(
    "Item",
    [spellData]
  );
}

export async function removeSpellForAbility(ability) {
  const actor = ability?.parent;
  if (
    actor?.documentName !== "Actor" ||
    ability.type !== "ability"
  ) {
    return;
  }

  const spellUuid = resolveGrantedSpellUuid(ability);
  if (spellUuid) {
    const anotherGrantingAbility = actor.items.some(
      item =>
        item.type === "ability" &&
        item.id !== ability.id &&
        resolveGrantedSpellUuid(item) === spellUuid
    );
    if (anotherGrantingAbility) return;

    const spellIds = actor.items
      .filter(
        item =>
          item.type === "spell" &&
          getModuleFlag(item, "autoGranted") === true &&
          getModuleFlag(item, "sourceUuid") === spellUuid
      )
      .map(item => item.id);

    if (spellIds.length > 0) {
      await actor.deleteEmbeddedDocuments(
        "Item",
        spellIds
      );
    }
    return;
  }

  const spellContentKey =
    resolveGrantedSpellContentKey(ability);
  if (!spellContentKey) return;

  const anotherGrantingAbility = actor.items.some(
    item =>
      item.type === "ability" &&
      item.id !== ability.id &&
      resolveGrantedSpellContentKey(item) === spellContentKey
  );
  if (anotherGrantingAbility) return;

  const spellIds = actor.items
    .filter(
      item =>
        item.type === "spell" &&
        getModuleFlag(item, "autoGranted") === true &&
        getModuleFlag(item, "sourceSpell") === spellContentKey
    )
    .map(item => item.id);

  if (spellIds.length > 0) {
    await actor.deleteEmbeddedDocuments(
      "Item",
      spellIds
    );
  }
}

async function removeStaleExternalSpellGrants(actor) {
  const abilityContentKeys = new Set(
    actor.items
      .filter(item => item.type === "ability")
      .map(item => getContentKey(item))
      .filter(Boolean)
  );
  const mageEnabled =
    isMageBrillianceAutomationEnabled();

  const staleIds = actor.items
    .filter(item => {
      if (
        item.type !== "spell" ||
        getModuleFlag(item, "autoGranted") !== true ||
        !getModuleFlag(item, "sourceUuid")
      ) {
        return false;
      }

      const grantedBy =
        getModuleFlag(item, "grantedByAbility");

      if (!abilityContentKeys.has(grantedBy)) {
        return true;
      }

      return (
        grantedBy === MAGES_BRILLIANCE_CONTENT_KEY &&
        !mageEnabled
      );
    })
    .map(item => item.id);

  if (staleIds.length > 0) {
    await actor.deleteEmbeddedDocuments(
      "Item",
      staleIds
    );
  }
}

export async function reconcileSpellGrantsForActor(actor) {
  await removeStaleExternalSpellGrants(actor);

  for (const ability of actor.items.filter(
    item => item.type === "ability"
  )) {
    await grantSpellForAbility(ability);
  }

  await ensureAutoGrantedSpellsPrepared(actor);
}

export async function reconcileSpellGrants() {
  if (!game.user.isGM) return;

  for (const actor of game.actors) {
    await reconcileSpellGrantsForActor(actor);
  }
}

function scheduleSpellGrantReconciliation() {
  if (!game.user.isGM) return;

  if (spellGrantReconcileTimer !== null) {
    clearTimeout(spellGrantReconcileTimer);
  }

  spellGrantReconcileTimer = setTimeout(() => {
    spellGrantReconcileTimer = null;
    void reconcileSpellGrants().catch(error => {
      console.error(
        `${MODULE_ID} | Failed to reconcile spell grants.`,
        error
      );
    });
  }, 250);
}

function isManagedWorldSpellOrAbility(item) {
  if (item?.parent || !["ability", "spell"].includes(item?.type)) {
    return false;
  }

  const contentKey = getContentKey(item);
  return (
    contentKey.startsWith("heroic-class-ability.") ||
    contentKey.startsWith("spells.")
  );
}

export function onCreateItem(item, options, userId) {
  if (userId !== game.user.id) return;

  if (item?.parent?.documentName === "Actor") {
    void grantSpellForAbility(item).catch(error => {
      console.error(
        `${MODULE_ID} | Failed to grant a spell for ${item.name}.`,
        error
      );
    });
    return;
  }

  if (isManagedWorldSpellOrAbility(item)) {
    scheduleSpellGrantReconciliation();
  }
}

export function onUpdateItem(item, changes, options, userId) {
  if (
    userId === game.user.id &&
    isManagedWorldSpellOrAbility(item)
  ) {
    scheduleSpellGrantReconciliation();
  }
}

export function onDeleteItem(item, options, userId) {
  if (
    userId !== game.user.id ||
    item?.parent?.documentName !== "Actor"
  ) {
    return;
  }

  void removeSpellForAbility(item).catch(error => {
    console.error(
      `${MODULE_ID} | Failed to remove a spell for ${item.name}.`,
      error
    );
  });
}
