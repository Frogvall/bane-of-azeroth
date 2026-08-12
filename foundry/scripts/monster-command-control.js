import DoD_Utility from "/systems/dragonbane/modules/utility.js";

import { MODULE_ID } from "./core/constants.js";
import { getModuleFlag } from "./core/documents.js";

const CONTROL_SCHEMA_VERSION = 1;
const ATTACK_SCHEMA_VERSION = 1;
const SYSTEM_ATTACK_DIALOG_TEMPLATE =
  "systems/dragonbane/templates/partials/monster-attack-dialog.hbs";
const ATTACK_ACTION_SELECTOR = '[data-action="monsterAttack"]';
const attachedButtons = new WeakSet();
const pendingActors = new Set();

function collectionValues(collection) {
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection?.contents)) return collection.contents;
  if (typeof collection?.values === "function") {
    return Array.from(collection.values());
  }
  return [];
}

function format(key, data = {}) {
  return game.i18n.format(key, data);
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

function attackMetadata(result) {
  const metadata = getModuleFlag(result, "monsterAttack");
  if (!metadata || typeof metadata !== "object") return null;
  if (metadata.schemaVersion !== ATTACK_SCHEMA_VERSION) return null;
  if (typeof metadata.key !== "string" || !metadata.key) return null;
  return metadata;
}

function rawAttackName(description) {
  const match = String(description ?? "").match(
    /<(b|strong)>(.*?)<\/\1>/i,
  );
  return String(match?.[2] ?? "")
    .replace(/[.:]\s*$/, "")
    .trim();
}

function resultLabel(result) {
  const name = String(result?.name ?? "").trim();
  if (name) return name;
  const descriptionName = rawAttackName(result?.description);
  if (descriptionName) return descriptionName;
  return attackMetadata(result)?.key ?? String(resultSortValue(result));
}

async function attackDescriptionHtml(result) {
  const description = String(result?.description ?? "");
  const enrich = CONFIG.DoD?.TextEditor?.enrichHTML;
  if (typeof enrich !== "function") return description;
  return enrich(description, { async: true });
}

export function getMonsterCommand(actor) {
  const control = getModuleFlag(actor, "monsterControl");
  if (!control || typeof control !== "object") return null;
  if (control.schemaVersion !== CONTROL_SCHEMA_VERSION) return null;
  if (typeof control.key !== "string" || !control.key) return null;
  if (control.attackSelection?.mode !== "system-default") return null;

  const command = control.command;
  if (!command || typeof command !== "object") return null;
  if (command.resource !== "willPoints") return null;
  if (command.payer !== "assigned-character") return null;
  if (!Number.isInteger(command.amount) || command.amount < 1) return null;
  if (command.freeActionWhenPaid !== true) return null;
  return command;
}

export function getOrderedCommandAttacks(table) {
  return collectionValues(table?.results)
    .filter(result => attackMetadata(result))
    .sort((left, right) => resultSortValue(left) - resultSortValue(right));
}

export function shouldBypassMonsterCommandDialog(
  event,
  settings = game.settings,
) {
  let skipDialog = Boolean(event?.shiftKey || event?.ctrlKey);
  if (!settings.get("dragonbane", "monsterAttackDialogIsDefault")) {
    skipDialog = !skipDialog;
  }
  return skipDialog;
}

async function prepareDialogAttacks(table) {
  const attacks = [];
  for (const result of getOrderedCommandAttacks(table)) {
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

function configureDialog(dialog, attacks, fallbackIndex) {
  const root = dialog?.element;
  const select = root?.querySelector?.(
    "select[name='selectMonsterAttack']",
  );
  const description = root?.querySelector?.(
    ".monster-attack-description",
  );
  if (!select || !description) return;

  for (const option of Array.from(select.options ?? [])) {
    if (Number(option.value) === 0) option.remove();
  }

  const updateDescription = () => {
    const selectedIndex = Number(select.value);
    const attack = attacks.find(item => item.index === selectedIndex);
    description.innerHTML = `<p>${attack?.description ?? ""}</p>`;
  };

  select.value = String(fallbackIndex);
  select.addEventListener("change", updateDescription);
  updateDescription();
}

function selectedAttackIndex(button) {
  return button?.form?.elements?.selectMonsterAttack?.value;
}

export async function promptMonsterCommandAttack(
  actor,
  table,
  command,
  {
    dialogV2 = foundry.applications.api.DialogV2,
    user = game.user,
    utility = DoD_Utility,
  } = {},
) {
  const attacks = await prepareDialogAttacks(table);
  if (attacks.length === 0) {
    ui.notifications.warn(
      format("BOA.dialog.monsterCommandMissingAttack", {
        actor: actor?.name ?? "",
      }),
    );
    return null;
  }

  const fallback = attacks[0];
  const character = user?.character ?? null;
  const canPay = Boolean(
    !user?.isGM
    && character
    && character.isOwner !== false
    && actorWillPoints(character) >= command.amount
  );

  const content = await utility.renderTemplate(
    SYSTEM_ATTACK_DIALOG_TEMPLATE,
    { attacks },
  );

  const buttons = [
    {
      action: "action",
      label: game.i18n.localize(
        "BOA.dialog.monsterCommandUseAction",
      ),
      default: true,
      callback: (_event, button) => ({
        attackIndex: selectedAttackIndex(button),
        choice: "action",
      }),
    },
  ];

  if (!user?.isGM) {
    buttons.push({
      action: "pay",
      label: format(
        "BOA.dialog.monsterCommandSpendWp",
        { amount: command.amount },
      ),
      disabled: !canPay,
      callback: (_event, button) => ({
        attackIndex: selectedAttackIndex(button),
        choice: "pay",
      }),
    });
  }

  buttons.push({
    action: "cancel",
    label: game.i18n.localize(
      "BOA.dialog.monsterAttackCancel",
    ),
    callback: () => null,
  });

  const selected = await dialogV2.wait({
    window: {
      title: game.i18n.localize(
        "DoD.ui.dialog.monsterAttackTitle",
      ),
    },
    content,
    buttons,
    render: (_event, dialog) => {
      configureDialog(dialog, attacks, fallback.index);
    },
    rejectClose: false,
    modal: true,
  });

  if (!selected) return null;

  const selectedIndex = Number(selected.attackIndex);
  return {
    tableResult: attacks.find(
      attack => attack.index === selectedIndex,
    )?.tableResult ?? fallback.tableResult,
    choice: selected.choice,
  };
}

function buildPaymentContent({
  attackName,
  character,
  commandActor,
  amount,
  oldWillPoints,
  newWillPoints,
}) {
  const summary = format("BOA.chat.monsterCommandWpSpent", {
    actor: escapeHtml(character?.name ?? ""),
    amount,
    attack: escapeHtml(attackName),
    demon: escapeHtml(commandActor?.name ?? ""),
  });
  const wpLabel = escapeHtml(
    game.i18n.localize("DoD.ui.character-sheet.wp"),
  );
  const actorUuid = escapeHtml(
    character?.uuid ?? character?.id ?? "",
  );

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
    <b>${wpLabel}:</b>
    ${oldWillPoints}
    <i class="fa-solid fa-arrow-right"></i>
    ${newWillPoints}<br>
  </div>
</div>
`;
}

async function createPaymentMessage(
  {
    actor,
    attackName,
    attackKey,
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
    typeof chatMessageClass?.create !== "function"
    || typeof chatMessageClass?.getSpeaker !== "function"
  ) {
    throw new Error("ChatMessage API is unavailable.");
  }

  return chatMessageClass.create({
    user: user?.id ?? game.user?.id,
    speaker: chatMessageClass.getSpeaker({ actor: character }),
    content: buildPaymentContent({
      attackName,
      character,
      commandActor: actor,
      amount,
      oldWillPoints,
      newWillPoints,
    }),
    flags: {
      [MODULE_ID]: {
        monsterCommandResourcePayment: {
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

async function refundWillPoints(character, value) {
  try {
    await character.update({
      "system.willPoints.value": value,
    });
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to refund WP after a monster command error.`,
      error,
    );
  }
}

async function deletePaymentMessage(message) {
  if (typeof message?.delete !== "function") return;
  try {
    await message.delete();
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to remove a rolled-back monster command WP message.`,
      error,
    );
  }
}

export async function performMonsterCommandAttack(
  {
    actor,
    choice,
    command,
    table,
    tableResult,
    user = game.user,
  },
  {
    chatMessageClass = globalThis.ChatMessage,
    utility = DoD_Utility,
  } = {},
) {
  const attackName = resultLabel(tableResult);
  const metadata = attackMetadata(tableResult);
  let character = null;
  let oldWillPoints = null;
  let paymentMessage = null;

  if (choice === "pay" && !user?.isGM) {
    character = user?.character ?? null;
    if (!character || character.isOwner === false) {
      ui.notifications.warn(
        game.i18n.localize(
          "BOA.dialog.monsterCommandCannotPay",
        ),
      );
      return { status: "cancelled", paid: false, result: null };
    }

    oldWillPoints = actorWillPoints(character);
    if (oldWillPoints < command.amount) {
      ui.notifications.warn(
        format("BOA.dialog.monsterAttackInsufficientWp", {
          amount: command.amount,
          character: character?.name ?? "",
        }),
      );
      return { status: "cancelled", paid: false, result: null };
    }

    const newWillPoints = oldWillPoints - command.amount;
    let spent = false;
    try {
      await character.update({
        "system.willPoints.value": newWillPoints,
      });
      spent = true;
      paymentMessage = await createPaymentMessage(
        {
          actor,
          attackName,
          attackKey: metadata?.key ?? "",
          character,
          amount: command.amount,
          oldWillPoints,
          newWillPoints,
        },
        { chatMessageClass, user },
      );
    } catch (error) {
      if (spent) {
        await refundWillPoints(character, oldWillPoints);
      }
      ui.notifications.error(
        format("BOA.dialog.monsterAttackPaymentMessageFailed", {
          character: character?.name ?? "",
        }),
      );
      console.error(
        `${MODULE_ID} | Failed to record WP for ${attackName}.`,
        error,
      );
      return { status: "cancelled", paid: false, result: null };
    }
  }

  try {
    const result = await utility.monsterAttack(
      actor,
      table,
      tableResult,
    );
    return {
      status: "attacked",
      paid: Boolean(paymentMessage),
      result,
    };
  } catch (error) {
    if (paymentMessage) {
      await deletePaymentMessage(paymentMessage);
    }
    if (character && oldWillPoints !== null) {
      await refundWillPoints(character, oldWillPoints);
    }
    throw error;
  }
}

export async function handleMonsterCommandAttackClick(
  actor,
  event,
  {
    chatMessageClass = globalThis.ChatMessage,
    dialogV2 = foundry.applications.api.DialogV2,
    fromUuidSyncFn = globalThis.fromUuidSync,
    settings = game.settings,
    user = game.user,
    utility = DoD_Utility,
  } = {},
) {
  const command = getMonsterCommand(actor);
  if (!actor?.isOwner || !command) return null;

  const pendingKey = actorPendingKey(actor);
  if (!pendingKey || pendingActors.has(pendingKey)) return null;
  pendingActors.add(pendingKey);

  try {
    const tableUuid = String(actor.system?.attackTable ?? "");
    const table = tableUuid ? fromUuidSyncFn?.(tableUuid) : null;
    if (!table) {
      ui.notifications.warn(
        format("BOA.dialog.monsterAttackMissingTable", {
          actor: actor?.name ?? "",
        }),
      );
      return null;
    }

    let tableResult;
    let choice;
    if (shouldBypassMonsterCommandDialog(event, settings)) {
      tableResult = getOrderedCommandAttacks(table)[0] ?? null;
      choice = "action";
      if (!tableResult) {
        ui.notifications.warn(
          format("BOA.dialog.monsterCommandMissingAttack", {
            actor: actor?.name ?? "",
          }),
        );
        return null;
      }
    } else {
      const selected = await promptMonsterCommandAttack(
        actor,
        table,
        command,
        { dialogV2, user, utility },
      );
      if (!selected) return null;
      ({ tableResult, choice } = selected);
    }

    return performMonsterCommandAttack(
      {
        actor,
        choice,
        command,
        table,
        tableResult,
        user,
      },
      { chatMessageClass, utility },
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

export function onRenderMonsterCommandSheet(app, html) {
  const actor = app?.actor;
  if (!actor?.isOwner || actor.type !== "monster") return false;
  if (!getMonsterCommand(actor)) return false;

  const root = rootElement(html);
  if (!root) return false;

  for (const button of root.querySelectorAll(ATTACK_ACTION_SELECTOR)) {
    if (attachedButtons.has(button)) continue;
    attachedButtons.add(button);
    button.addEventListener(
      "click",
      event => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.currentTarget?.blur?.();
        void handleMonsterCommandAttackClick(actor, event).catch(error => {
          console.error(
            `${MODULE_ID} | Commanded monster attack failed.`,
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

  return true;
}
