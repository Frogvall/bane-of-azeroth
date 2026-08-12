import {
  isDemonAutomationEnabled,
} from "../automation-settings.js";
import { MODULE_ID } from "../core/constants.js";
import {
  WARLOCK_DEMON_DURATION,
} from "./constants.js";
import {
  getWarlockDemonDefinition,
} from "./definitions.js";
import {
  collectWarlockDemonPosition,
} from "./placement.js";
import {
  requestWarlockDemonCreation,
} from "./socket.js";

function escapeHtml(value) {
  const escape =
    globalThis.foundry?.utils?.escapeHTML;

  if (typeof escape === "function") {
    return escape(String(value ?? ""));
  }

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localize(i18n, key) {
  return i18n?.localize?.(key) ?? key;
}

function format(i18n, key, data) {
  return i18n?.format?.(key, data) ?? key;
}

export function buildManualWarlockDemonMessageContent(
  plan,
  {
    i18n = globalThis.game?.i18n,
  } = {},
) {
  const definition =
    getWarlockDemonDefinition(
      plan.demonKey,
    );
  const title = localize(
    i18n,
    "BOA.dialog.warlockDemon.manualTitle",
  );
  const demon = format(
    i18n,
    "BOA.dialog.warlockDemon.manualDemon",
    {
      demon:
        definition?.name
        ?? plan.demonKey,
    },
  );
  const duration = format(
    i18n,
    "BOA.dialog.warlockDemon.manualDuration",
    {
      duration:
        WARLOCK_DEMON_DURATION,
    },
  );
  const instructions = localize(
    i18n,
    "BOA.dialog.warlockDemon.manualAutomationDisabled",
  );

  return `
    <div class="dragonbane chat-card boa-warlock-demon-manual">
      <header class="card-header">
        <h3>${escapeHtml(title)}</h3>
      </header>
      <div class="card-content">
        <p>${escapeHtml(demon)}</p>
        <p>${escapeHtml(duration)}</p>
        <p class="hint">${escapeHtml(instructions)}</p>
      </div>
    </div>
  `;
}

export async function postManualWarlockDemonInstructions(
  plan,
  {
    chatMessageClass =
      globalThis.ChatMessage,
    i18n = globalThis.game?.i18n,
    messages = globalThis.game?.messages,
  } = {},
) {
  if (!chatMessageClass?.create) {
    throw new Error(
      "ChatMessage.create is unavailable "
      + "for manual Warlock demon instructions.",
    );
  }

  const sourceMessage =
    messages?.get?.(
      plan.sourceMessageId,
    );

  return chatMessageClass.create({
    speaker:
      sourceMessage?.speaker
      ?? chatMessageClass.getSpeaker?.()
      ?? {},
    content:
      buildManualWarlockDemonMessageContent(
        plan,
        { i18n },
      ),
    flags: {
      [MODULE_ID]: {
        warlockDemonManualPlacement: {
          schemaVersion: 1,
          actorUuid: plan.actorUuid,
          sourceMessageId:
            plan.sourceMessageId,
          demonKey: plan.demonKey,
          duration: plan.duration,
          automationEnabled: false,
        },
      },
    },
  });
}

export async function executeWarlockDemonPlan(
  plan,
  {
    automationEnabled = undefined,
    chatMessageClass =
      globalThis.ChatMessage,
    collectPositionFn =
      collectWarlockDemonPosition,
    i18n = globalThis.game?.i18n,
    messages = globalThis.game?.messages,
    notifications =
      globalThis.ui?.notifications,
    postManualInstructionsFn =
      postManualWarlockDemonInstructions,
    requestCreationFn =
      requestWarlockDemonCreation,
    settings =
      globalThis.game?.settings,
  } = {},
) {
  const enabled =
    automationEnabled === undefined
      ? isDemonAutomationEnabled(settings)
      : automationEnabled !== false;

  if (!enabled) {
    const message =
      await postManualInstructionsFn(
        plan,
        {
          chatMessageClass,
          i18n,
          messages,
        },
      );

    notifications?.info?.(
      localize(
        i18n,
        "BOA.dialog.warlockDemon.manualNotification",
      ),
    );

    return {
      status: "manual",
      message,
      position: null,
      result: null,
    };
  }

  const position =
    await collectPositionFn(plan);

  if (!position) {
    notifications?.info?.(
      localize(
        i18n,
        "BOA.dialog.warlockDemon.placementCancelled",
      ),
    );

    return {
      status: "cancelled",
      message: null,
      position: null,
      result: null,
    };
  }

  const result =
    await requestCreationFn(
      plan,
      position,
    );
  const definition =
    getWarlockDemonDefinition(
      plan.demonKey,
    );

  notifications?.info?.(
    format(
      i18n,
      "BOA.dialog.warlockDemon.tokenCreated",
      {
        name:
          definition?.name
          ?? plan.demonKey,
      },
    ),
  );

  const failedScenes =
    result?.failedCleanupScenes ?? [];
  if (failedScenes.length > 0) {
    notifications?.warn?.(
      format(
        i18n,
        "BOA.dialog.warlockDemon.cleanupWarning",
        {
          scenes:
            failedScenes.join(", "),
        },
      ),
    );
  }

  return {
    status: "created",
    message: null,
    position,
    result,
  };
}
