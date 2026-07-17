import { MODULE_ID } from "./core/constants.js";
import {
  getContentKey,
  getModuleFlag,
} from "./core/documents.js";
import {
  ensureAutoGrantedSpellsPrepared,
} from "./spell-preparation.js";

const SPELL_GRANT_CONTENT_PATH =
  `modules/${MODULE_ID}/content/heroic-class-abilities.json`;
const spellGrantDefinitions = new Map();
let spellGrantReconcileTimer = null;

export async function loadSpellGrantDefinitions() {
  spellGrantDefinitions.clear();

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
      if (
        typeof ability?.key !== "string" ||
        typeof ability?.grantsSpell !== "string"
      ) {
        continue;
      }

      const abilityContentKey =
        `heroic-class-ability.${classEntry.key}.${ability.key}`;
      const spellContentKey = `spells.${ability.grantsSpell}`;

      spellGrantDefinitions.set(
        abilityContentKey,
        spellContentKey
      );
    }
  }
}

export function resolveGrantedSpellContentKey(ability) {
  const directValue = getModuleFlag(ability, "grantsSpell");
  if (typeof directValue === "string" && directValue) {
    return directValue;
  }

  return spellGrantDefinitions.get(getContentKey(ability)) ?? "";
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

export async function grantSpellForAbility(ability) {
  const actor = ability?.parent;
  if (
    actor?.documentName !== "Actor" ||
    ability.type !== "ability"
  ) {
    return;
  }

  const spellContentKey =
    resolveGrantedSpellContentKey(ability);
  if (!spellContentKey || actorHasSpell(actor, spellContentKey)) {
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

  const abilityContentKey = getContentKey(ability);
  const spellData = sourceSpell.toObject();

  delete spellData._id;
  delete spellData.folder;
  delete spellData.ownership;

  foundry.utils.setProperty(
    spellData,
    "system.memorized",
    true
  );
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
  foundry.utils.setProperty(
    spellData,
    `flags.${MODULE_ID}.sourceSpell`,
    spellContentKey
  );

  await actor.createEmbeddedDocuments("Item", [spellData]);
}

export async function removeSpellForAbility(ability) {
  const actor = ability?.parent;
  if (
    actor?.documentName !== "Actor" ||
    ability.type !== "ability"
  ) {
    return;
  }

  const spellContentKey =
    resolveGrantedSpellContentKey(ability);
  if (!spellContentKey) return;

  const anotherGrantingAbility = actor.items.some(
    item =>
      item.type === "ability" &&
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
    await actor.deleteEmbeddedDocuments("Item", spellIds);
  }
}

export async function reconcileSpellGrantsForActor(actor) {
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
