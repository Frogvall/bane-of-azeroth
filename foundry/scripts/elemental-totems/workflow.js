import {
  isElementalTotemAutomationEnabled,
} from "../automation-settings.js";
import { MODULE_ID } from "../core/constants.js";
import { getTotemName } from "./definitions.js";
import {
  collectElementalTotemPositions,
} from "./placement.js";
import {
  requestElementalTotemCreation,
} from "./socket.js";

const MANUAL_PLACEMENT_SCHEMA_VERSION = 1;

function escapeHtml(value) {
  const escape = globalThis.foundry?.utils?.escapeHTML;
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

function sourceSpeaker(plan, messages, chatMessageClass) {
  const sourceMessage = messages?.get?.(plan.sourceMessageId);
  return sourceMessage?.speaker
    ?? chatMessageClass?.getSpeaker?.()
    ?? {};
}

function manualPlacementFlag(plan) {
  return {
    schemaVersion: MANUAL_PLACEMENT_SCHEMA_VERSION,
    actorUuid: plan.actorUuid,
    sourceMessageId: plan.sourceMessageId,
    powerLevel: plan.powerLevel,
    totemTypes: [...plan.totemTypes],
    automationEnabled: false,
  };
}

export function buildManualElementalTotemMessageContent(
  plan,
  definitions,
  { i18n = globalThis.game?.i18n } = {},
) {
  const totemNames = plan.totemTypes.map(
    key => getTotemName(definitions, key),
  );
  const title = localize(
    i18n,
    "BOA.dialog.elementalTotem.manualTitle",
  );
  const powerLevel = format(
    i18n,
    "BOA.dialog.elementalTotem.manualPowerLevel",
    { powerLevel: plan.powerLevel },
  );
  const selectedTotems = format(
    i18n,
    "BOA.dialog.elementalTotem.manualTotems",
    { totems: totemNames.join(", ") },
  );
  const instructions = localize(
    i18n,
    "BOA.dialog.elementalTotem.manualAutomationDisabled",
  );

  return `
    <div class="dragonbane chat-card boa-elemental-totem-manual">
      <header class="card-header">
        <h3>${escapeHtml(title)}</h3>
      </header>
      <div class="card-content">
        <p>${escapeHtml(powerLevel)}</p>
        <p>${escapeHtml(selectedTotems)}</p>
        <p class="hint">${escapeHtml(instructions)}</p>
      </div>
    </div>
  `;
}

export async function postManualElementalTotemInstructions(
  plan,
  definitions,
  {
    chatMessageClass = globalThis.ChatMessage,
    i18n = globalThis.game?.i18n,
    messages = globalThis.game?.messages,
  } = {},
) {
  if (!chatMessageClass?.create) {
    throw new Error(
      "ChatMessage.create is unavailable for manual "
      + "Elemental Totem instructions.",
    );
  }

  return chatMessageClass.create({
    speaker: sourceSpeaker(plan, messages, chatMessageClass),
    content: buildManualElementalTotemMessageContent(
      plan,
      definitions,
      { i18n },
    ),
    flags: {
      [MODULE_ID]: {
        elementalTotemManualPlacement: manualPlacementFlag(plan),
      },
    },
  });
}

export async function executeElementalTotemPlan(
  plan,
  definitions,
  {
    automationEnabled = undefined,
    chatMessageClass = globalThis.ChatMessage,
    collectPositionsFn = collectElementalTotemPositions,
    i18n = globalThis.game?.i18n,
    messages = globalThis.game?.messages,
    notifications = globalThis.ui?.notifications,
    postManualInstructionsFn = postManualElementalTotemInstructions,
    requestCreationFn = requestElementalTotemCreation,
    settings = globalThis.game?.settings,
  } = {},
) {
  const enabled = automationEnabled === undefined
    ? isElementalTotemAutomationEnabled(settings)
    : automationEnabled !== false;

  if (!enabled) {
    const message = await postManualInstructionsFn(
      plan,
      definitions,
      { chatMessageClass, i18n, messages },
    );
    notifications?.info?.(
      localize(
        i18n,
        "BOA.dialog.elementalTotem.manualNotification",
      ),
    );
    return {
      status: "manual",
      message,
      positions: null,
      result: null,
    };
  }

  const positions = await collectPositionsFn(plan, definitions);
  if (!positions) {
    notifications?.info?.(
      localize(
        i18n,
        "BOA.dialog.elementalTotem.placementCancelled",
      ),
    );
    return {
      status: "cancelled",
      message: null,
      positions: null,
      result: null,
    };
  }

  const result = await requestCreationFn(plan, positions);
  notifications?.info?.(
    format(
      i18n,
      "BOA.dialog.elementalTotem.tokensCreated",
      { count: result?.createdTokenIds?.length ?? 0 },
    ),
  );

  const failedScenes = result?.failedCleanupScenes ?? [];
  if (failedScenes.length > 0) {
    notifications?.warn?.(
      format(
        i18n,
        "BOA.dialog.elementalTotem.cleanupWarning",
        { scenes: failedScenes.join(", ") },
      ),
    );
  }

  return {
    status: "created",
    message: null,
    positions,
    result,
  };
}
