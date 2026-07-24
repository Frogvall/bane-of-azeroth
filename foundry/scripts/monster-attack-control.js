import DoD_Utility from "/systems/dragonbane/modules/utility.js";

import { MODULE_ID } from "./core/constants.js";
import { getModuleFlag } from "./core/documents.js";

const CONTROL_SCHEMA_VERSION = 1;
const ATTACK_SCHEMA_VERSION = 1;
const MANUAL_SELECTION_MODE = "manual";
const SYSTEM_ATTACK_DIALOG_TEMPLATE =
  "systems/dragonbane/templates/partials/monster-attack-dialog.hbs";
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

function rawAttackNameFromDescription(description) {
  const match = String(description ?? "").match(
    /<(b|strong)>(.*?)<\/\1>/i,
  );
  return String(match?.[2] ?? "").replace(/[.:]\s*$/, "").trim();
}

function resultLabel(result) {
  const name = String(result?.name ?? "").trim();
  if (name) return name;
  const descriptionName = rawAttackNameFromDescription(result?.description);
  if (descriptionName) return descriptionName;
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

function notifyMissingFallbackAttack(actor) {
  ui.notifications.warn(
    format("BOA.dialog.monsterAttackMissingFallback", {
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

function normalizeAttackSelection(selection) {
  if (!selection || typeof selection !== "object") return null;
  if (selection.mode !== MANUAL_SELECTION_MODE) return null;
  if (
    typeof selection.fallbackAttackKey !== "string" ||
    !selection.fallbackAttackKey
  ) {
    return null;
  }
  return selection;
}

export function getMonsterControl(actor) {
  const control = getModuleFlag(actor, "monsterControl");
  if (!control || typeof control !== "object") return null;
  if (control.schemaVersion !== CONTROL_SCHEMA_VERSION) return null;
  if (typeof control.key !== "string" || !control.key) return null;
  if (!normalizeAttackSelection(control.attackSelection)) return null;
  return control;
}

export function getMonsterAttackSelection(actor) {
  const control = getMonsterControl(actor);
  return normalizeAttackSelection(control?.attackSelection);
}

export function getMonsterAttackMetadata(tableResult) {
  const metadata = getModuleFlag(tableResult, "monsterAttack");
  if (!metadata || typeof metadata !== "object") return null;
  if (metadata.schemaVersion !== ATTACK_SCHEMA_VERSION) return null;
  if (typeof metadata.key !== "string" || !metadata.key) return null;
  return metadata;
}

export function isManualOnlyMonster(actor) {
  return getMonsterAttackSelection(actor)?.mode === MANUAL_SELECTION_MODE;
}

export function getOrderedMonsterAttacks(table) {
  return collectionValues(table?.results)
    .filter(result => getMonsterAttackMetadata(result))
    .sort((left, right) => resultSortValue(left) - resultSortValue(right));
}

export function getFallbackMonsterAttack(actor, table) {
  const fallbackAttackKey = getMonsterAttackSelection(
    actor,
  )?.fallbackAttackKey;
  if (!fallbackAttackKey) return null;
  return getOrderedMonsterAttacks(table).find(
    result => getMonsterAttackMetadata(result)?.key === fallbackAttackKey,
  ) ?? null;
}

export function shouldUseFallbackMonsterAttack(
  event,
  settings = game.settings,
) {
  let skipDialog = Boolean(event?.shiftKey || event?.ctrlKey);
  if (!settings.get("dragonbane", "monsterAttackDialogIsDefault")) {
    skipDialog = !skipDialog;
  }
  return skipDialog;
}

async function prepareMonsterAttackDialogData(table) {
  const attacks = [];
  for (const result of getOrderedMonsterAttacks(table)) {
    let name = String(result?.name ?? "").trim();
    let description = await attackDescriptionHtml(result);
    if (!name) {
      const match = description.match(/<(b|strong)>(.*?)<\/\1>(.*)/is);
      if (match) {
        name = match[2];
        description = match[3];
      } else {
        name = resultLabel(result);
      }
    }
    attacks.push({
      name,
      description,
      index: resultSortValue(result),
      tableResult: result,
    });
  }
  return attacks;
}

export function configureMonsterAttackDialog(
  dialog,
  attacks,
  fallbackIndex,
) {
  const root = dialog?.element;
  const selectEl = root?.querySelector?.(
    "select[name='selectMonsterAttack']",
  );
  const descEl = root?.querySelector?.(".monster-attack-description");
  if (!selectEl || !descEl) return;

  for (const option of Array.from(selectEl.options ?? [])) {
    if (Number(option.value) === 0) option.remove();
  }

  const updateDescription = () => {
    const selectedIndex = Number(selectEl.value);
    const attack = attacks.find(item => item.index === selectedIndex);
    descEl.innerHTML = `<p>${attack?.description ?? ""}</p>`;
  };

  selectEl.value = String(fallbackIndex);
  selectEl.addEventListener("change", updateDescription);
  updateDescription();
}

export async function promptMonsterAttackSelection(
  actor,
  table,
  {
    dialogV2 = foundry.applications.api.DialogV2,
    utility = DoD_Utility,
  } = {},
) {
  const attacks = await prepareMonsterAttackDialogData(table);
  if (attacks.length === 0) return null;

  const fallback = getFallbackMonsterAttack(actor, table);
  if (!fallback) {
    notifyMissingFallbackAttack(actor);
    return null;
  }
  const fallbackIndex = resultSortValue(fallback);
  const content = await utility.renderTemplate(
    SYSTEM_ATTACK_DIALOG_TEMPLATE,
    { attacks },
  );

  const selected = await dialogV2.wait({
    window: {
      title: game.i18n.localize("DoD.ui.dialog.monsterAttackTitle"),
    },
    content,
    buttons: [{
      action: "ok",
      label: game.i18n.localize("Confirm"),
      default: true,
      callback: (_event, button) => (
        button.form.elements.selectMonsterAttack.value
      ),
    }],
    render: (_event, dialog) => {
      configureMonsterAttackDialog(dialog, attacks, fallbackIndex);
    },
    rejectClose: false,
    modal: true,
  });

  if (selected === null || selected === undefined) return null;
  const selectedIndex = Number(selected);
  return attacks.find(attack => attack.index === selectedIndex)?.tableResult
    ?? fallback;
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

export function buildMonsterAttackWpChatContent({
  attackName,
  character,
  amount,
  oldWillPoints,
  newWillPoints,
}) {
  const actorName = escapeHtml(character?.name ?? "");
  const escapedAttackName = escapeHtml(attackName);
  const summary = format("BOA.chat.monsterAttackWpSpent", {
    actor: actorName,
    amount,
    attack: escapedAttackName,
  });
  const willPointsLabel = escapeHtml(
    game.i18n.localize("DoD.ui.character-sheet.wp"),
  );
  const actorUuid = escapeHtml(character?.uuid ?? character?.id ?? "");

  return `
<div>
  <p class="ability-use">${summary}</p>
</div>
<div
  class="damage-details permission-observer"
  data-actor-id="${actorUuid}"
>
  <i class="fa-solid fa-circle-info"></i>
  <div
    class="expandable"
    style="text-align: left; margin-left: 0.5em"
  >
    <b>${willPointsLabel}:</b>
    ${oldWillPoints}
    <i class="fa-solid fa-arrow-right"></i>
    ${newWillPoints}<br>
  </div>
</div>
`;
}

export async function createMonsterAttackWpChatMessage(
  {
    attackName,
    attackKey,
    actor,
    character,
    amount,
    oldWillPoints,
    newWillPoints,
  },
  {
    chatMessageClass = globalThis.ChatMessage,
    user = game.user,
  } = {},
) {
  if (
    typeof chatMessageClass?.create !== "function" ||
    typeof chatMessageClass?.getSpeaker !== "function"
  ) {
    throw new Error("ChatMessage API is unavailable.");
  }

  const content = buildMonsterAttackWpChatContent({
    attackName,
    character,
    amount,
    oldWillPoints,
    newWillPoints,
  });

  return chatMessageClass.create({
    user: user?.id ?? game.user?.id,
    speaker: chatMessageClass.getSpeaker({ actor: character }),
    content,
    flags: {
      [MODULE_ID]: {
        monsterAttackResourcePayment: {
          schemaVersion: 1,
          attackKey,
          resource: "willPoints",
          amount,
          payerActorUuid: character?.uuid ?? null,
          sourceActorUuid: actor?.uuid ?? null,
        },
      },
    },
  });
}

async function deleteMonsterAttackWpChatMessage(message) {
  if (typeof message?.delete !== "function") return;
  try {
    await message.delete();
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to remove a rolled-back monster attack WP message.`,
      error,
    );
  }
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
    chatMessageClass = globalThis.ChatMessage,
    dialogV2 = foundry.applications.api.DialogV2,
    utility = DoD_Utility,
  } = {},
) {
  const metadata = getMonsterAttackMetadata(tableResult);
  const attackName = resultLabel(tableResult);
  const resourceCost = validResourceCost(metadata);
  let paidCharacter = null;
  let originalWillPoints = null;
  let paymentMessage = null;

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

        const newWillPoints = originalWillPoints - resourceCost.amount;
        let willPointsWereSpent = false;
        try {
          await character.update({
            "system.willPoints.value": newWillPoints,
          });
          willPointsWereSpent = true;
          paymentMessage = await createMonsterAttackWpChatMessage(
            {
              attackName,
              attackKey: metadata.key,
              actor,
              character,
              amount: resourceCost.amount,
              oldWillPoints: originalWillPoints,
              newWillPoints,
            },
            {
              chatMessageClass,
              user,
            },
          );
        } catch (error) {
          if (willPointsWereSpent) {
            await refundWillPoints(character, originalWillPoints);
          }
          const localizationKey = willPointsWereSpent
            ? "BOA.dialog.monsterAttackPaymentMessageFailed"
            : "BOA.dialog.monsterAttackPaymentFailed";
          ui.notifications.error(
            format(localizationKey, {
              character: character?.name ?? "",
            }),
          );
          console.error(
            `${MODULE_ID} | Failed to record WP for ${attackName}.`,
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
    if (paymentMessage) {
      await deleteMonsterAttackWpChatMessage(paymentMessage);
    }
    if (paidCharacter && originalWillPoints !== null) {
      await refundWillPoints(paidCharacter, originalWillPoints);
    }
    throw error;
  }
}

export async function handleControlledMonsterAttackClick(
  actor,
  event,
  {
    dialogV2 = foundry.applications.api.DialogV2,
    fromUuidSyncFn = globalThis.fromUuidSync,
    settings = game.settings,
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

    let tableResult;
    if (shouldUseFallbackMonsterAttack(event, settings)) {
      tableResult = getFallbackMonsterAttack(actor, table);
      if (!tableResult) {
        notifyMissingFallbackAttack(actor);
        return null;
      }
    } else {
      tableResult = await promptMonsterAttackSelection(
        actor,
        table,
        { dialogV2, utility },
      );
      if (!tableResult) return null;
    }

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
        void handleControlledMonsterAttackClick(actor, event).catch(error => {
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
