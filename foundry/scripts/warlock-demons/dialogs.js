import { MODULE_ID } from "../core/constants.js";
import {
  buildWarlockDemonOptions,
} from "./definitions.js";
import {
  getMessageAuthorId,
  getWarlockDemonMessageContext,
} from "./messages.js";
import {
  buildWarlockDemonPlan,
} from "./planning.js";
import {
  executeWarlockDemonPlan,
} from "./workflow.js";

const handledMessages = new Set();
let dialogQueue = Promise.resolve();

async function chooseWarlockDemon() {
  const formData =
    await foundry.applications.api.DialogV2.input({
      window: {
        title:
          game.i18n.localize(
            "BOA.dialog.warlockDemon.chooseTitle",
          ),
      },
      content: `
        <div class="form-group">
          <label>
            ${game.i18n.localize(
              "BOA.dialog.warlockDemon.demonType",
            )}
          </label>
          <div class="form-fields">
            <select name="demonKey" autofocus>
              ${buildWarlockDemonOptions()}
            </select>
          </div>
        </div>
        <p class="hint">
          ${game.i18n.localize(
            "BOA.dialog.warlockDemon.chooseHint",
          )}
        </p>
      `,
      ok: {
        label:
          game.i18n.localize(
            "BOA.dialog.warlockDemon.continue",
          ),
      },
      rejectClose: false,
      modal: true,
    });

  if (!formData) return null;

  return String(
    formData.demonKey ?? "",
  );
}

export async function shouldStartWarlockDemonDialog(
  message,
  {
    user = globalThis.game?.user,
  } = {},
) {
  if (
    !message?.id
    || getMessageAuthorId(message)
      !== user?.id
    || handledMessages.has(message.id)
  ) {
    return false;
  }

  return Boolean(
    await getWarlockDemonMessageContext(
      message,
    ),
  );
}

export async function runWarlockDemonDialogFlow(
  message,
) {
  const context =
    await getWarlockDemonMessageContext(
      message,
    );

  if (!context?.actor || !context?.ability) {
    throw new Error(
      "The Demonologist ability context "
      + "could not be resolved.",
    );
  }

  const demonKey =
    await chooseWarlockDemon();
  if (!demonKey) return null;

  const plan =
    buildWarlockDemonPlan(
      message,
      context,
      demonKey,
    );

  return executeWarlockDemonPlan(plan);
}

export function queueWarlockDemonDialog(
  message,
) {
  dialogQueue = dialogQueue
    .then(
      () =>
        runWarlockDemonDialogFlow(
          message,
        ),
    )
    .catch(error => {
      console.error(
        `${MODULE_ID} | Warlock demon `
        + "dialog failed.",
        error,
      );
      ui.notifications.error(
        error.message,
      );
    });

  return dialogQueue;
}

export async function onCreateWarlockDemonChatMessage(
  message,
) {
  if (
    !await shouldStartWarlockDemonDialog(
      message,
    )
  ) {
    return;
  }

  handledMessages.add(message.id);
  void queueWarlockDemonDialog(message);
}
