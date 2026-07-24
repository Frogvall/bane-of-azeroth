import DoD_Utility from "/systems/dragonbane/modules/utility.js";

import { MODULE_ID } from "./core/constants.js";
import { getModuleFlag } from "./core/documents.js";

const CONTROL_SCHEMA_VERSION = 1;
const ATTACK_SCHEMA_VERSION = 1;
const MANUAL_ONLY = "manual-only";
const ATTACK_ACTION_SELECTOR = '[data-action="monsterAttack"]';
const attachedAttackButtons = new WeakSet();
const pendingActors = new Set();

function collectionValues(collection) {
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection?.contents)) return collection.contents;
  if (typeof collection?.values === "function") {
    return Array.from(collection.values());
  }
  return [];
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character],
  );
}

function format(key, data = {}) {
  return game.i18n.format(key, data);
}

function actorPendingKey(actor) {
  return actor?.uuid ?? actor?.id ?? actor?._id ?? "";
}

function actorWillPoints(actor) {
  const value = Number(actor?.system?.willPoints?.value);
  return Number.isFinite(value) ? value : 0;
}

function resultSortValue(result) {
  const value = Number(result?.range?.[0]);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function resultLabel(result) {
  const name = String(result?.name ?? "").trim();
  if (name) return name;
  const metadata = getMonsterAttackMetadata(result);
  if (metadata?.key) return metadata.key;
  return String(resultSortValue(result));
}

async function attackDescriptionHtml(result) {
  const description = String(result?.description ?? "");
  const enrich = CONFIG.DoD?.TextEditor?.enrichHTML;
  if (typeof enrich !== "function") return description;
  return enrich(description, { async: true });
}

function notifyMissingAttackTable(actor) {
  ui.notifications.warn(
    format("BOA.dialog.monsterAttackMissingTable", {
      actor: actor?.name ?? "",
    }),
  );
}

function notifyMissingAssignedCharacter(attackName) {
  ui.notifications.warn(
    format("BOA.dialog.monsterAttackMissingCharacter", {
      attack: attackName,
    }),
  );
}

function notifyUnownedAssignedCharacter(character, attackName) {
  ui.notifications.warn(
    format("BOA.dialog.monsterAttackUnownedCharacter", {
      attack: attackName,
      character: character?.name ?? "",
    }),
  );
}

function notifyInsufficientWillPoints(character, amount) {
  ui.notifications.warn(
    format("BOA.dialog.monsterAttackInsufficientWp", {
      amount,
      character: character?.name ?? "",
    }),
  );
}

export function getMonsterControl(actor) {
  const control = getModuleFlag(actor, "monsterControl");
  if (!control || typeof control !== "object") return null;
  if (control.schemaVersion !== CONTROL_SCHEMA_VERSION) return null;
  if (typeof control.key !== "string" || !control.key) return null;
  if (typeof control.attackSelection !== "string") return null;
  return control;
}

export function getMonsterAttackMetadata(tableResult) {
  const metadata = getModuleFlag(tableResult, "monsterAttack");
  if (!metadata || typeof metadata !== "object") return null;
  if (metadata.schemaVersion !== ATTACK_SCHEMA_VERSION) return null;
  if (typeof metadata.key !== "string" || !metadata.key) return null;
  return metadata;
}

export function isManualOnlyMonster(actor) {
  return getMonsterControl(actor)?.attackSelection === MANUAL_ONLY;
}

export function getOrderedMonsterAttacks(table) {
  return collectionValues(table?.results)
    .filter(result => getMonsterAttackMetadata(result))
    .sort((left, right) => resultSortValue(left) - resultSortValue(right));
}

export async function promptMonsterAttackSelection(
  actor,
  table,
  { dialogV2 = foundry.applications.api.DialogV2 } = {},
) {
  const attacks = getOrderedMonsterAttacks(table);
  if (attacks.length === 0) return null;

  const buttons = attacks.map((result, index) => ({
    action: `attack-${result.id ?? result._id}`,
    label: resultLabel(result),
    default: index === 0,
    callback: () => result.id ?? result._id,
  }));
  buttons.push({
    action: "cancel",
    label: game.i18n.localize("BOA.dialog.monsterAttackCancel"),
    callback: () => null,
  });

  const descriptions = await Promise.all(
    attacks.map(async result => (
      `<section class="boa-monster-attack-option">` +
      `<h3>${escapeHtml(resultLabel(result))}</h3>` +
      `<div>${await attackDescriptionHtml(result)}</div>` +
      `</section>`
    )),
  );
  const selectedId = await dialogV2.wait({
    window: {
      title: game.i18n.localize("BOA.dialog.monsterAttackTitle"),
    },
    content: (
      `<p>${escapeHtml(format(
        "BOA.dialog.monsterAttackChoose",
        { actor: actor?.name ?? "" },
      ))}</p>` + descriptions.join("")
    ),
    buttons,
    rejectClose: false,
    modal: true,
  });

  if (!selectedId) return null;
  return attacks.find(result => (result.id ?? result._id) === selectedId) ?? null;
}

export async function promptMonsterAttackResourceCost(
  {
    attackName,
    character,
    resourceCost,
  },
  { dialogV2 = foundry.applications.api.DialogV2 } = {},
) {
  const amount = resourceCost.amount;
  const current = actorWillPoints(character);
  const canPay = current >= amount;
  const allowUnpaid = resourceCost.allowUnpaid === true;

  return dialogV2.wait({
    window: {
      title: game.i18n.localize("BOA.dialog.monsterAttackWpTitle"),
    },
    content: `<p>${escapeHtml(format(
      "BOA.dialog.monsterAttackWpContent",
      {
        amount,
        attack: attackName,
        character: character?.name ?? "",
        current,
      },
    ))}</p>`,
    buttons: [
      {
        action: "pay",
        label: game.i18n.localize("BOA.dialog.monsterAttackYes"),
        default: canPay,
        disabled: !canPay,
        callback: () => "pay",
      },
      {
        action: "unpaid",
        label: game.i18n.localize("BOA.dialog.monsterAttackNo"),
        disabled: !allowUnpaid,
        callback: () => "unpaid",
      },
      {
        action: "cancel",
        label: game.i18n.localize("BOA.dialog.monsterAttackCancel"),
        callback: () => null,
      },
    ],
    rejectClose: false,
    modal: true,
  });
}

function validResourceCost(metadata) {
  const cost = metadata?.resourceCost;
  if (!cost || typeof cost !== "object") return null;
  if (cost.resource !== "willPoints") return null;
  if (cost.payer !== "assigned-character") return null;
  if (!Number.isInteger(cost.amount) || cost.amount < 1) return null;
  if (cost.prompt !== true) return null;
  return cost;
}

async function refundWillPoints(character, value) {
  try {
    await character.update({
      "system.willPoints.value": value,
    });
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to refund WP after a monster attack error.`,
      error,
    );
  }
}

export async function performControlledMonsterAttack(
  {
    actor,
    table,
    tableResult,
    user = game.user,
  },
  {
    dialogV2 = foundry.applications.api.DialogV2,
    utility = DoD_Utility,
  } = {},
) {
  const metadata = getMonsterAttackMetadata(tableResult);
  const attackName = resultLabel(tableResult);
  const resourceCost = validResourceCost(metadata);
  let paidCharacter = null;
  let originalWillPoints = null;

  if (!user?.isGM && resourceCost) {
    const character = user.character ?? null;
    if (!character) {
      notifyMissingAssignedCharacter(attackName);
    } else if (character.isOwner === false) {
      notifyUnownedAssignedCharacter(character, attackName);
    } else {
      const choice = await promptMonsterAttackResourceCost(
        {
          attackName,
          character,
          resourceCost,
        },
        { dialogV2 },
      );

      if (choice === null || choice === undefined || choice === "cancel") {
        return { status: "cancelled", paid: false, result: null };
      }
      if (choice === "unpaid") {
        if (resourceCost.allowUnpaid !== true) {
          return { status: "cancelled", paid: false, result: null };
        }
      } else if (choice === "pay") {
        originalWillPoints = actorWillPoints(character);
        if (originalWillPoints < resourceCost.amount) {
          notifyInsufficientWillPoints(character, resourceCost.amount);
          return { status: "cancelled", paid: false, result: null };
        }
        try {
          await character.update({
            "system.willPoints.value":
              originalWillPoints - resourceCost.amount,
          });
        } catch (error) {
          ui.notifications.error(
            format("BOA.dialog.monsterAttackPaymentFailed", {
              character: character?.name ?? "",
            }),
          );
          console.error(
            `${MODULE_ID} | Failed to spend WP for ${attackName}.`,
            error,
          );
          return { status: "cancelled", paid: false, result: null };
        }
        paidCharacter = character;
      } else {
        return { status: "cancelled", paid: false, result: null };
      }
    }
  }

  try {
    const result = await utility.monsterAttack(actor, table, tableResult);
    return {
      status: "attacked",
      paid: Boolean(paidCharacter),
      result,
    };
  } catch (error) {
    if (paidCharacter && originalWillPoints !== null) {
      await refundWillPoints(paidCharacter, originalWillPoints);
    }
    throw error;
  }
}

export async function handleControlledMonsterAttackClick(
  actor,
  {
    dialogV2 = foundry.applications.api.DialogV2,
    fromUuidSyncFn = globalThis.fromUuidSync,
    user = game.user,
    utility = DoD_Utility,
  } = {},
) {
  if (!actor?.isOwner || !isManualOnlyMonster(actor)) return null;

  const pendingKey = actorPendingKey(actor);
  if (!pendingKey || pendingActors.has(pendingKey)) return null;
  pendingActors.add(pendingKey);

  try {
    const tableUuid = String(actor.system?.attackTable ?? "");
    const table = tableUuid ? fromUuidSyncFn?.(tableUuid) : null;
    if (!table) {
      notifyMissingAttackTable(actor);
      return null;
    }

    const tableResult = await promptMonsterAttackSelection(
      actor,
      table,
      { dialogV2 },
    );
    if (!tableResult) return null;

    return performControlledMonsterAttack(
      { actor, table, tableResult, user },
      { dialogV2, utility },
    );
  } finally {
    pendingActors.delete(pendingKey);
  }
}

function rootElement(html) {
  if (html?.querySelectorAll) return html;
  if (html?.[0]?.querySelectorAll) return html[0];
  return null;
}

export function onRenderControlledMonsterSheet(app, html) {
  const actor = app?.actor;
  if (!actor?.isOwner || actor.type !== "monster") return;
  if (!isManualOnlyMonster(actor)) return;

  const root = rootElement(html);
  if (!root) return;

  for (const button of root.querySelectorAll(ATTACK_ACTION_SELECTOR)) {
    if (attachedAttackButtons.has(button)) continue;
    attachedAttackButtons.add(button);
    button.addEventListener(
      "click",
      event => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.currentTarget?.blur?.();
        void handleControlledMonsterAttackClick(actor).catch(error => {
          console.error(
            `${MODULE_ID} | Controlled monster attack failed.`,
            error,
          );
          ui.notifications.error(
            game.i18n.localize("BOA.dialog.monsterAttackFailed"),
          );
        });
      },
      { capture: true },
    );
  }
}
