import { MODULE_ID } from "./core/constants.js";
import {
  getPrimaryActiveGMUser,
  isPrimaryActiveGM,
} from "./core/users.js";

export const COMMON_ANIMAL_RESTRAIN_STATUS_ID = "restrain";
export const DRUID_MARKED_STATUS_ID = "marked";

const COMMON_ANIMAL_STATUS_SOCKET = `module.${MODULE_ID}`;
const COMMON_ANIMAL_STATUS_SOCKET_TIMEOUT_MS = 30000;
const ALLOWED_STATUS_IDS = new Set([
  COMMON_ANIMAL_RESTRAIN_STATUS_ID,
  DRUID_MARKED_STATUS_ID,
]);
const pendingStatusRequests = new Map();
let commonAnimalStatusSocketRegistered = false;

function normalizeTargetActor(target) {
  return (
    target?.actor ??
    target?.document?.actor ??
    target?.token?.actor ??
    target ??
    null
  );
}

function targetDocumentUuid(target) {
  const actor = normalizeTargetActor(target);
  return String(
    actor?.token?.document?.uuid ??
      actor?.token?.uuid ??
      actor?.uuid ??
      ""
  ).trim();
}

function sourceDocumentUuid(source) {
  const actor = normalizeTargetActor(source);
  return String(
    actor?.baseActor?.uuid ??
      actor?.uuid ??
      ""
  ).trim();
}


function configuredStatusIds() {
  return new Set(
    Array.from(CONFIG.statusEffects ?? [])
      .map(status => String(status?.id ?? "").trim())
      .filter(Boolean)
  );
}

function normalizeAllowedStatusIds(statusIds) {
  return Array.from(new Set(statusIds ?? []))
    .map(statusId => String(statusId ?? "").trim())
    .filter(statusId => ALLOWED_STATUS_IDS.has(statusId));
}

function canUpdateTargetActor(actor) {
  if (!actor) {
    return false;
  }
  if (typeof actor.canUserModify === "function") {
    return actor.canUserModify(game.user, "update");
  }
  return Boolean(game.user?.isGM || actor.isOwner);
}

function userById(userId) {
  return (
    game.users?.get?.(userId) ??
    Array.from(game.users ?? []).find(user => user.id === userId) ??
    null
  );
}

async function actorFromUuid(uuid) {
  const document = await fromUuid(uuid);
  return normalizeTargetActor(document);
}

function attackEffectSettingEnabled(
  effect,
  settings = globalThis.game?.settings,
) {
  const key = String(effect?.settingKey ?? "").trim();
  if (!key || !settings?.get) {
    return true;
  }
  try {
    return settings.get(MODULE_ID, key) !== false;
  } catch (_error) {
    return true;
  }
}

export function statusIdsForCommonAnimalAttackEffects(
  effects = [],
  {
    settings = globalThis.game?.settings,
  } = {},
) {
  if (!Array.isArray(effects)) {
    return [];
  }

  const statusIds = [];
  for (const effect of effects) {
    if (effect?.type === "restrain") {
      statusIds.push(COMMON_ANIMAL_RESTRAIN_STATUS_ID);
    }
    if (
      effect?.type === "marked" &&
      attackEffectSettingEnabled(
        effect,
        settings,
      )
    ) {
      statusIds.push(DRUID_MARKED_STATUS_ID);
    }
  }
  return Array.from(new Set(statusIds));
}

export async function applyCommonAnimalStatusIdsLocally(
  target,
  statusIds,
  {
    sourceUuid = "",
  } = {}
) {
  const actor = normalizeTargetActor(target);
  if (!actor || typeof actor.toggleStatusEffect !== "function") {
    throw new Error(
      "The Common Animal status target is not an updatable Actor."
    );
  }

  const supported = normalizeAllowedStatusIds(statusIds);
  const configured = configuredStatusIds();
  const origin = String(sourceUuid ?? "").trim();
  for (const statusId of supported) {
    if (!configured.has(statusId)) {
      throw new Error(
        `Dragonbane status ${statusId} is not registered.`
      );
    }

    const toggledEffect = await actor.toggleStatusEffect(
      statusId,
      {
        active: true,
      }
    );
    if (
      origin &&
      statusId !== DRUID_MARKED_STATUS_ID &&
      toggledEffect &&
      typeof toggledEffect === "object" &&
      typeof toggledEffect.update === "function" &&
      toggledEffect.origin !== origin
    ) {
      await toggledEffect.update({
        origin,
      });
    }
  }
  return supported;
}

function handleCommonAnimalStatusResult(payload) {
  if (payload.requesterUserId !== game.user.id) {
    return;
  }
  const pending = pendingStatusRequests.get(payload.requestId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  pendingStatusRequests.delete(payload.requestId);
  if (payload.success) {
    pending.resolve(payload.statusIds ?? []);
  } else {
    pending.reject(
      new Error(
        payload.error ||
          "The GM could not apply the Common Animal status."
      )
    );
  }
}

async function handleCommonAnimalStatusRequest(payload) {
  if (!isPrimaryActiveGM()) {
    return;
  }
  if (payload.gmUserId && payload.gmUserId !== game.user.id) {
    return;
  }

  const requester = userById(payload.requesterUserId);
  try {
    if (!requester?.active) {
      throw new Error(
        "The Common Animal status requester is not active."
      );
    }

    const actor = await actorFromUuid(payload.targetUuid);
    if (!actor) {
      throw new Error(
        `Could not resolve Common Animal target ${payload.targetUuid}.`
      );
    }

    const statusIds = await applyCommonAnimalStatusIdsLocally(
      actor,
      payload.statusIds,
      {
        sourceUuid: payload.sourceUuid,
      }
    );
    game.socket.emit(COMMON_ANIMAL_STATUS_SOCKET, {
      type: "commonAnimalStatusResult",
      requestId: payload.requestId,
      requesterUserId: payload.requesterUserId,
      success: true,
      statusIds,
    });
  } catch (error) {
    console.error(
      `${MODULE_ID} | Common Animal status request failed.`,
      error
    );
    game.socket.emit(COMMON_ANIMAL_STATUS_SOCKET, {
      type: "commonAnimalStatusResult",
      requestId: payload.requestId,
      requesterUserId: payload.requesterUserId,
      success: false,
      error: error.message,
    });
  }
}

export function onCommonAnimalStatusSocketMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }
  if (payload.type === "commonAnimalStatusRequest") {
    return handleCommonAnimalStatusRequest(payload);
  }
  if (payload.type === "commonAnimalStatusResult") {
    handleCommonAnimalStatusResult(payload);
  }
}

export function registerCommonAnimalAttackStatusEffects(
  statusEffects = globalThis.CONFIG?.statusEffects,
) {
  if (!Array.isArray(statusEffects)) {
    return false;
  }
  if (
    statusEffects.some(
      status => status?.id === DRUID_MARKED_STATUS_ID,
    )
  ) {
    return true;
  }
  const image =
    "modules/bane-of-azeroth/assets/icons/classes/druid.webp";
  statusEffects.push({
    id: DRUID_MARKED_STATUS_ID,
    name: "BOA.statuses.marked",
    icon: image,
    img: image,
  });
  return true;
}

export function registerCommonAnimalStatusSocket() {
  registerCommonAnimalAttackStatusEffects();
  if (commonAnimalStatusSocketRegistered) {
    return;
  }
  game.socket.on(
    COMMON_ANIMAL_STATUS_SOCKET,
    onCommonAnimalStatusSocketMessage
  );
  commonAnimalStatusSocketRegistered = true;
}

export async function requestCommonAnimalStatusApplication(
  target,
  statusIds,
  {
    sourceUuid = "",
  } = {}
) {
  const actor = normalizeTargetActor(target);
  const supported = normalizeAllowedStatusIds(statusIds);
  const normalizedSourceUuid = String(sourceUuid ?? "").trim();
  if (!actor || supported.length === 0) {
    return [];
  }

  if (canUpdateTargetActor(actor)) {
    return applyCommonAnimalStatusIdsLocally(
      actor,
      supported,
      {
        sourceUuid: normalizedSourceUuid,
      }
    );
  }

  const activeGM = getPrimaryActiveGMUser();
  if (!activeGM) {
    throw new Error(
      "An active GM is required to apply the Restrained status."
    );
  }

  const targetUuid = targetDocumentUuid(actor);
  if (!targetUuid) {
    throw new Error(
      "The Restrained status target has no resolvable UUID."
    );
  }

  const requestId = foundry.utils.randomID();
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingStatusRequests.delete(requestId);
      reject(
        new Error("The Common Animal status request timed out.")
      );
    }, COMMON_ANIMAL_STATUS_SOCKET_TIMEOUT_MS);

    pendingStatusRequests.set(requestId, {
      resolve,
      reject,
      timeoutId,
    });
    game.socket.emit(COMMON_ANIMAL_STATUS_SOCKET, {
      type: "commonAnimalStatusRequest",
      requestId,
      requesterUserId: game.user.id,
      gmUserId: activeGM.id,
      targetUuid,
      sourceUuid: normalizedSourceUuid,
      statusIds: supported,
    });
  });
}

export async function applyCommonAnimalAttackStatuses({
  effects = [],
  targets = [],
  sourceActor = null,
} = {}) {
  const statusIds = statusIdsForCommonAnimalAttackEffects(
    effects,
  );
  if (statusIds.length === 0 || !Array.isArray(targets)) {
    return [];
  }

  const sourceUuid = sourceDocumentUuid(sourceActor);
  const results = [];
  const seen = new Set();
  for (const target of targets) {
    const actor = normalizeTargetActor(target);
    const reference = targetDocumentUuid(actor);
    if (!actor || !reference || seen.has(reference)) {
      continue;
    }
    seen.add(reference);

    try {
      const appliedStatusIds =
        await requestCommonAnimalStatusApplication(
          actor,
          statusIds,
          {
            sourceUuid,
          }
        );
      results.push({
        targetUuid: reference,
        statusIds: appliedStatusIds,
        success: true,
      });
    } catch (error) {
      console.error(
        `${MODULE_ID} | Could not apply Common Animal status effects.`,
        error,
        actor
      );
      results.push({
        targetUuid: reference,
        statusIds: [],
        success: false,
        error: error.message,
      });
    }
  }
  return results;
}

function renderedRoot(html) {
  return html?.querySelectorAll
    ? html
    : html?.[0]?.querySelectorAll
      ? html[0]
      : null;
}

function actorEffects(actor) {
  if (!actor?.effects) {
    return [];
  }
  return Array.from(actor.effects);
}

function effectHasStatus(effect, statusId) {
  return (
    effect?.statuses?.has?.(statusId) === true ||
    Array.from(effect?.statuses ?? []).includes(statusId)
  );
}

function actorUuid(actor) {
  return String(
    actor?.baseActor?.uuid ??
      actor?.uuid ??
      ""
  ).trim();
}

function actorFromSourceUuid(sourceUuid) {
  if (!sourceUuid) {
    return null;
  }

  try {
    const document = globalThis.fromUuidSync?.(sourceUuid);
    const actor = normalizeTargetActor(document);
    if (actor) {
      return actor;
    }
  } catch (error) {
    console.warn(
      `${MODULE_ID} | Could not resolve Restrained source ${sourceUuid}.`,
      error
    );
  }

  const match = /^Actor\.([^.]+)$/.exec(sourceUuid);
  return match
    ? normalizeTargetActor(game.actors?.get?.(match[1]))
    : null;
}

export function commonAnimalRestrainedSourceName(
  effect,
  targetActor
) {
  if (
    !effectHasStatus(
      effect,
      COMMON_ANIMAL_RESTRAIN_STATUS_ID
    )
  ) {
    return null;
  }

  const sourceUuid = String(effect?.origin ?? "").trim();
  if (!sourceUuid || sourceUuid === actorUuid(targetActor)) {
    return null;
  }

  const sourceActor = actorFromSourceUuid(sourceUuid);
  const sourceName = String(sourceActor?.name ?? "").trim();
  return sourceName || null;
}

/**
 * Dragonbane 4 renders effect.parent.name in the Source column. A status
 * Active Effect is embedded in its target Actor, so that value always names
 * the target. Replace the displayed value for module-applied Restrained
 * effects whose origin points at the attacking Common Animal.
 */
export function onRenderCommonAnimalRestrainedSource(
  app,
  html
) {
  const actor = app?.actor ?? app?.document ?? null;
  const root = renderedRoot(html);
  if (!actor || !root) {
    return 0;
  }

  const effectsByUuid = new Map(
    actorEffects(actor)
      .filter(effect => effect?.uuid)
      .map(effect => [String(effect.uuid), effect])
  );
  let updated = 0;

  for (const row of root.querySelectorAll(
    "tr.effect[data-effect-uuid]"
  )) {
    const effectUuid = String(
      row?.dataset?.effectUuid ?? ""
    );
    const effect = effectsByUuid.get(effectUuid);
    const sourceName = commonAnimalRestrainedSourceName(
      effect,
      actor
    );
    if (!sourceName) {
      continue;
    }

    const textCells = Array.from(
      row.querySelectorAll?.("td.text-data") ?? []
    );
    const sourceCell = textCells[1] ?? null;
    if (!sourceCell) {
      continue;
    }

    const sourceText = sourceCell.ownerDocument?.createElement
      ? sourceCell.ownerDocument.createElement("span")
      : { textContent: "" };
    sourceText.textContent = sourceName;
    sourceText.className = "boa-common-animal-status-source";

    if (typeof sourceCell.replaceChildren === "function") {
      sourceCell.replaceChildren(sourceText);
    } else {
      sourceCell.textContent = sourceName;
    }
    updated += 1;
  }

  return updated;
}

