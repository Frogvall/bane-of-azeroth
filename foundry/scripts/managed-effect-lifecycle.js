import { MODULE_ID } from "./core/constants.js";
import { deleteSummonsExpiredByRest } from "./core/summon-duration-lifecycle.js";
import { getPrimaryActiveGMUser, isPrimaryActiveGM } from "./core/users.js";
import { getDruidFormState } from "./druid-forms.js";
import {
  endDruidIncarnation,
  expireDruidIncarnationsForRest,
} from "./druid-form-lifecycle.js";

const SOCKET_NAME = `module.${MODULE_ID}`;
const REQUEST_TYPE = "managed-effect-lifecycle-request";
const RESULT_TYPE = "managed-effect-lifecycle-result";
const REQUEST_TIMEOUT_MS = 10000;
const pendingRequests = new Map();
let socketRegistered = false;

const DRUID_LABELS = Object.freeze({
  savage: "Savage Incarnation",
  feral: "Feral Incarnation",
  harmony: "Incarnation of Harmony",
  stars: "Incarnation of the Stars",
});

const DRUID_CONTENT_KEYS = new Set([
  "spells.savage-incarnation",
  "spells.feral-incarnation",
  "spells.incarnation-of-harmony",
  "spells.incarnation-of-the-stars",
]);

function values(collection) {
  if (!collection) return [];
  if (typeof collection.values === "function") return Array.from(collection.values());
  return Array.from(collection);
}

function collectionGet(collection, id) {
  return collection?.get?.(id)
    ?? values(collection).find(value => value?.id === id)
    ?? null;
}

function itemContentKey(item) {
  return item?.getFlag?.(MODULE_ID, "contentKey")
    ?? item?.flags?.[MODULE_ID]?.contentKey
    ?? null;
}

function ownsDruidIncarnation(actor) {
  return values(actor?.items).some(item =>
    DRUID_CONTENT_KEYS.has(itemContentKey(item))
  );
}

function managedSummonFlags(token) {
  const flags = token?.flags?.[MODULE_ID];
  if (flags?.summonType === "elementalTotem" && flags?.duration === "stretch") {
    return flags;
  }
  if (flags?.summonType === "warlock-demon" && flags?.duration === "shift") {
    return flags;
  }
  return null;
}

export function getManagedEffectsForActor(
  actor,
  { scenes = globalThis.game?.scenes } = {},
) {
  if (!actor) return [];
  const effects = [];
  const state = getDruidFormState(actor);

  for (const [key, activation] of Object.entries(state?.activations ?? {})) {
    if (activation?.active !== true) continue;
    effects.push({
      id: `druid:${key}`,
      type: "druid",
      key,
      label: DRUID_LABELS[key] ?? key,
      duration: activation.duration ?? null,
    });
  }

  for (const scene of values(scenes)) {
    for (const token of values(scene?.tokens)) {
      const flags = managedSummonFlags(token);
      if (!flags || flags.casterActorUuid !== actor.uuid) continue;
      effects.push({
        id: `summon:${scene.id}:${token.id}`,
        type: "summon",
        sceneId: scene.id,
        tokenId: token.id,
        summonType: flags.summonType,
        duration: flags.duration,
        label: String(token?.name ?? "").trim()
          || (flags.summonType === "elementalTotem" ? "Elemental Totem" : "Warlock Demon"),
      });
    }
  }

  return effects;
}

function canManageActor(
  actor,
  user = globalThis.game?.user,
  ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3,
) {
  if (!actor) return false;
  if (!user) return true;
  if (user.isGM === true) return true;
  if (user.id === globalThis.game?.user?.id && actor.isOwner === true) return true;
  return actor.testUserPermission?.(user, ownerLevel) === true;
}

export async function endManagedEffectNow(
  actor,
  effectId,
  { scenes = globalThis.game?.scenes } = {},
) {
  const effect = getManagedEffectsForActor(actor, { scenes })
    .find(candidate => candidate.id === effectId);

  if (!effect) {
    throw new Error("The selected Bane of Azeroth effect is no longer active.");
  }

  if (effect.type === "druid") {
    return endDruidIncarnation(actor, effect.key, { bypassAuthority: true });
  }

  const scene = collectionGet(scenes, effect.sceneId);
  const token = collectionGet(scene?.tokens, effect.tokenId);
  const flags = managedSummonFlags(token);

  if (!scene || !token || !flags || flags.casterActorUuid !== actor.uuid) {
    throw new Error("The selected managed summon no longer exists.");
  }

  await scene.deleteEmbeddedDocuments("Token", [token.id]);
  return { ok: true, action: "end", effectId, type: "summon" };
}

export async function endAllManagedEffectsNow(
  actor,
  { scenes = globalThis.game?.scenes } = {},
) {
  const before = getManagedEffectsForActor(actor, { scenes });
  const state = getDruidFormState(actor);

  if (Object.values(state?.activations ?? {}).some(a => a?.active === true)) {
    await expireDruidIncarnationsForRest(
      actor,
      "shift",
      { bypassAuthority: true },
    );
  }

  let summonResult = { deletedCount: 0, failedScenes: [] };
  if (typeof actor?.uuid === "string" && actor.uuid) {
    summonResult = await deleteSummonsExpiredByRest(
      actor.uuid,
      "shift",
      { scenes },
    );
  }

  return {
    ok: true,
    action: "endAll",
    endedCount: before.length,
    summonResult,
  };
}

export async function executeManagedEffectLifecycleRequest(
  payload,
  {
    users = globalThis.game?.users,
    actors = globalThis.game?.actors,
    scenes = globalThis.game?.scenes,
    ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3,
  } = {},
) {
  const requester = collectionGet(users, payload?.requesterUserId);
  if (!requester || requester.active !== true) {
    throw new Error("The requesting User is not active.");
  }

  const actor = collectionGet(actors, payload?.actorId);
  if (!actor) throw new Error("The requested Actor does not exist.");

  if (!canManageActor(actor, requester, ownerLevel)) {
    throw new Error("The requesting User does not own this Actor.");
  }

  if (payload?.action === "end") {
    return endManagedEffectNow(actor, payload.effectId, { scenes });
  }
  if (payload?.action === "endAll") {
    return endAllManagedEffectsNow(actor, { scenes });
  }

  throw new Error(`Unknown managed-effect lifecycle action: ${String(payload?.action)}`);
}

function handleResult(payload) {
  if (payload?.requesterUserId !== globalThis.game?.user?.id) return;
  const pending = pendingRequests.get(payload.requestId);
  if (!pending) return;
  clearTimeout(pending.timeoutId);
  pendingRequests.delete(payload.requestId);
  if (payload.success === true) {
    pending.resolve(payload.result);
  } else {
    pending.reject(new Error(payload.error ?? "The GM could not end the managed effect."));
  }
}

async function handleRequest(payload) {
  const user = globalThis.game?.user;
  const gm = getPrimaryActiveGMUser();
  if (user?.isGM !== true || gm?.id !== user.id || payload?.gmUserId !== user.id) return;

  try {
    const result = await executeManagedEffectLifecycleRequest(payload);
    globalThis.game?.socket?.emit?.(SOCKET_NAME, {
      type: RESULT_TYPE,
      requestId: payload.requestId,
      requesterUserId: payload.requesterUserId,
      success: true,
      result,
    });
  } catch (error) {
    console.error(`${MODULE_ID} | Managed effect lifecycle request failed.`, error);
    globalThis.game?.socket?.emit?.(SOCKET_NAME, {
      type: RESULT_TYPE,
      requestId: payload.requestId,
      requesterUserId: payload.requesterUserId,
      success: false,
      error: error.message,
    });
  }
}

function onSocketMessage(payload) {
  if (payload?.type === REQUEST_TYPE) {
    void handleRequest(payload);
  } else if (payload?.type === RESULT_TYPE) {
    handleResult(payload);
  }
}

export function registerManagedEffectLifecycleSocket() {
  if (socketRegistered) return false;
  const socket = globalThis.game?.socket;
  if (typeof socket?.on !== "function") return false;
  socket.on(SOCKET_NAME, onSocketMessage);
  socketRegistered = true;
  return true;
}

function requestAction(actor, action, effectId = null) {
  const user = globalThis.game?.user;
  if (!user) return Promise.reject(new Error("A User is required to end a managed effect."));
  if (!canManageActor(actor, user)) return Promise.reject(new Error("You do not own this Actor."));

  if (isPrimaryActiveGM()) {
    return action === "endAll"
      ? endAllManagedEffectsNow(actor)
      : endManagedEffectNow(actor, effectId);
  }

  const gm = getPrimaryActiveGMUser();
  if (!gm) return Promise.reject(new Error("An active GM is required to end Bane of Azeroth effects."));

  const socket = globalThis.game?.socket;
  const randomID = globalThis.foundry?.utils?.randomID;
  if (typeof socket?.emit !== "function") {
    return Promise.reject(new Error("The managed-effect lifecycle socket is unavailable."));
  }

  const requestId = typeof randomID === "function"
    ? randomID()
    : `${Date.now()}-${Math.random()}`;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("The managed-effect lifecycle request timed out."));
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(requestId, { resolve, reject, timeoutId });
    socket.emit(SOCKET_NAME, {
      type: REQUEST_TYPE,
      requestId,
      requesterUserId: user.id,
      gmUserId: gm.id,
      actorId: actor.id,
      action,
      effectId,
    });
  });
}

export function endManagedEffect(actor, effectId, options = {}) {
  if (options.bypassAuthority === true || !globalThis.game?.user) {
    return endManagedEffectNow(actor, effectId, options);
  }
  return requestAction(actor, "end", effectId);
}

export function endAllManagedEffects(actor, options = {}) {
  if (options.bypassAuthority === true || !globalThis.game?.user) {
    return endAllManagedEffectsNow(actor, options);
  }
  return requestAction(actor, "endAll");
}

function formValue(form, name) {
  return form?.elements?.namedItem?.(name)?.value ?? "";
}

export async function openManagedEffectEndDialog(actor) {
  if (!canManageActor(actor, globalThis.game?.user)) return false;

  const effects = getManagedEffectsForActor(actor);
  if (effects.length === 0) {
    globalThis.ui?.notifications?.info?.(
      "There are no active Bane of Azeroth effects to end.",
    );
    return false;
  }

  const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
  if (typeof DialogV2?.wait !== "function") return false;

  const optionHtml = effects
    .map(effect => `<option value="${effect.id}">${effect.label}</option>`)
    .join("");

  const form = await DialogV2.wait({
    window: { title: "End Effect" },
    content:
      `<form class="boa-managed-effect-end-dialog">`
      + `<div class="form-group"><label>Effect</label>`
      + `<select name="effectId">`
      + optionHtml
      + `<option value="__all__">End All</option>`
      + `</select></div></form>`,
    buttons: [
      {
        action: "end",
        label: "End Effect",
        default: true,
        callback: (_event, button) => button?.form ?? null,
      },
      {
        action: "cancel",
        label: "Cancel",
      },
    ],
    close: () => null,
  });

  if (!form) return false;
  const effectId = formValue(form, "effectId");
  const result = effectId === "__all__"
    ? await endAllManagedEffects(actor)
    : await endManagedEffect(actor, effectId);

  actor.sheet?.render?.(false);
  return result;
}

function sheetRoot(html) {
  const HTMLElementClass = globalThis.HTMLElement;
  if (HTMLElementClass && html instanceof HTMLElementClass) return html;
  if (HTMLElementClass && html?.[0] instanceof HTMLElementClass) return html[0];
  return html?.element ?? html ?? null;
}

export function onRenderManagedEffectLifecycleActorSheet(app, html) {
  const actor = app?.actor ?? app?.document ?? null;
  const root = sheetRoot(html);

  if (
    !actor ||
    actor.type !== "character" ||
    !root?.querySelector ||
    !canManageActor(actor, globalThis.game?.user)
  ) {
    return false;
  }

  root.querySelector(".boa-managed-effect-end-button")?.remove?.();

  const effects = getManagedEffectsForActor(actor);
  if (effects.length === 0) return false;

  const tabs = root.querySelector(
    ".sheet-tabs, nav.tabs, "
    + '[data-group="primary"].tabs, '
    + '[data-application-part="tabs"]',
  );
  if (!tabs?.parentElement?.insertBefore) return false;

  let controls = root.querySelector(".boa-druid-form-artwork-controls");
  if (!controls) {
    controls = globalThis.document?.createElement?.("div");
    if (controls) {
      controls.classList.add("boa-druid-form-artwork-controls");
      tabs.parentElement.insertBefore(controls, tabs);
    }
  }

  const button = globalThis.document?.createElement?.("button");
  if (!controls || !button) return false;

  button.type = "button";
  button.classList.add("boa-managed-effect-end-button");
  button.innerHTML = '<i class="fa-solid fa-hourglass-end"></i> End Effect';
  button.title = "End an active Bane of Azeroth effect.";
  button.addEventListener("click", event => {
    event.preventDefault?.();
    event.stopPropagation?.();
    void openManagedEffectEndDialog(actor);
  });

  if (typeof controls.append === "function") controls.append(button);
  else controls.appendChild?.(button);

  return true;
}
