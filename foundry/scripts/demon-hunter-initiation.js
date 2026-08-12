import {
  MODULE_ID,
} from "./core/constants.js";
import {
  getContentKey,
} from "./core/documents.js";
import {
  getPrimaryActiveGMUser,
  isPrimaryActiveGM,
} from "./core/users.js";
import {
  isDemonHunterInitiationAutomationEnabled,
} from "./automation-settings.js";

export const DEMON_HUNTER_INITIATION_CONTENT_KEY =
  "heroic-class-ability.demon-hunter.demon-hunter-initiation";

const SOCKET_NAME =
  `module.${MODULE_ID}`;
const RECONCILE_REQUEST_TYPE =
  "demonHunterInitiationReconcileRequest";
const RECONCILE_RESULT_TYPE =
  "demonHunterInitiationReconcileResult";
const RECONCILE_TIMEOUT_MS =
  10000;

const pendingReconcileRequests =
  new Map();
let reconcileSocketRegistered =
  false;

const PROTOTYPE_MANAGED_FLAG =
  "demonHunterInitiationManagedPrototypeVision";
const PROTOTYPE_ORIGINAL_FLAG =
  "demonHunterInitiationOriginalPrototypeVision";
const TOKEN_MANAGED_FLAG =
  "demonHunterInitiationManagedTokenVision";
const TOKEN_ORIGINAL_FLAG =
  "demonHunterInitiationOriginalTokenVision";

const VISION_DEFAULT_FIELDS = [
  "color",
  "saturation",
  "contrast",
  "attenuation",
  "brightness",
];

const reconcileQueues =
  new WeakMap();

function flag(
  document,
  key,
) {
  return (
    document?.getFlag?.(
      MODULE_ID,
      key,
    ) ??
    document?.flags?.[
      MODULE_ID
    ]?.[key]
  );
}

async function setFlagSafe(
  document,
  key,
  value,
) {
  if (
    typeof document?.setFlag ===
      "function"
  ) {
    await document.setFlag(
      MODULE_ID,
      key,
      value,
    );
    return;
  }

  document.flags ??= {};
  document.flags[
    MODULE_ID
  ] ??= {};
  document.flags[
    MODULE_ID
  ][key] = value;
}

async function unsetFlagSafe(
  document,
  key,
) {
  if (
    typeof document?.unsetFlag ===
      "function"
  ) {
    await document.unsetFlag(
      MODULE_ID,
      key,
    );
    return;
  }

  if (
    document?.flags?.[
      MODULE_ID
    ]
  ) {
    delete document.flags[
      MODULE_ID
    ][key];
  }
}

function visionModeDefaults(
  modeId,
) {
  const modes =
    globalThis.CONFIG?.Canvas
      ?.visionModes;

  const mode =
    modes?.get?.(
      modeId,
    ) ??
    modes?.[modeId];

  const defaults =
    mode?.vision?.defaults ??
    {};

  const result = {};

  for (
    const field of
      VISION_DEFAULT_FIELDS
  ) {
    if (
      Object.hasOwn(
        defaults,
        field,
      )
    ) {
      result[field] =
        defaults[field];
    }
  }

  return result;
}

function visionSnapshot(
  sight,
) {
  const source =
    sight?.toObject?.() ??
    sight ??
    {};

  const snapshot = {
    enabled:
      Boolean(
        source.enabled,
      ),
    range:
      Number.isFinite(
        source.range,
      )
        ? source.range
        : null,
    visionMode:
      source.visionMode ??
      "basic",
  };

  for (
    const field of
      VISION_DEFAULT_FIELDS
  ) {
    if (
      source[field] !==
        undefined
    ) {
      snapshot[field] =
        source[field];
    }
  }

  return snapshot;
}

function hasUnlimitedRange(
  range,
) {
  return (
    range === null ||
    range ===
      Number.POSITIVE_INFINITY
  );
}

function hasManagedVision(
  sight,
) {
  if (
    sight?.enabled !== true ||
    !hasUnlimitedRange(
      sight?.range,
    ) ||
    sight?.visionMode !==
      "darkvision"
  ) {
    return false;
  }

  const defaults =
    visionModeDefaults(
      "darkvision",
    );

  return VISION_DEFAULT_FIELDS.every(
    field =>
      !Object.hasOwn(
        defaults,
        field,
      ) ||
      sight?.[field] ===
        defaults[field],
  );
}

function managedVisionUpdate(
  prefix,
) {
  const update = {
    [`${prefix}.enabled`]:
      true,
    [`${prefix}.range`]:
      null,
    [`${prefix}.visionMode`]:
      "darkvision",
  };

  for (
    const [
      field,
      value,
    ] of Object.entries(
      visionModeDefaults(
        "darkvision",
      ),
    )
  ) {
    update[
      `${prefix}.${field}`
    ] = value;
  }

  return update;
}

function originalVisionUpdate(
  prefix,
  original,
) {
  const update = {
    [`${prefix}.enabled`]:
      Boolean(
        original.enabled,
      ),
    [`${prefix}.range`]:
      original.range,
    [`${prefix}.visionMode`]:
      original.visionMode ??
      "basic",
  };

  for (
    const field of
      VISION_DEFAULT_FIELDS
  ) {
    if (
      Object.hasOwn(
        original,
        field,
      )
    ) {
      update[
        `${prefix}.${field}`
      ] = original[field];
    }
  }

  return update;
}

export function isDemonHunterInitiationAbility(
  item,
) {
  return (
    item?.type === "ability" &&
    getContentKey(
      item,
    ) ===
      DEMON_HUNTER_INITIATION_CONTENT_KEY
  );
}

function actorItems(
  actor,
) {
  return Array.from(
    actor?.items ??
    [],
  );
}

function hasInitiation(
  actor,
) {
  return actorItems(
    actor,
  ).some(
    isDemonHunterInitiationAbility,
  );
}

export function needsAutomaticDemonHunterInitiationReconcile(
  actor,
  {
    scenes =
      globalThis.game?.scenes,
  } = {},
) {
  if (!actor) {
    return false;
  }

  if (
    hasInitiation(
      actor,
    ) ||
    flag(
      actor,
      PROTOTYPE_MANAGED_FLAG,
    ) === true
  ) {
    return true;
  }

  return actorSceneTokens(
    actor,
    scenes,
  ).some(
    token =>
      flag(
        token,
        TOKEN_MANAGED_FLAG,
      ) === true,
  );
}

export function actorSceneTokens(
  actor,
  scenes =
    globalThis.game?.scenes,
) {
  if (
    !actor ||
    !scenes
  ) {
    return [];
  }

  const result = [];

  for (const scene of Array.from(
    scenes,
  )) {
    for (const token of Array.from(
      scene?.tokens ??
      [],
    )) {
      if (
        token?.actorId ===
          actor.id ||
        token?.actor?.id ===
          actor.id
      ) {
        result.push(
          token,
        );
      }
    }
  }

  return result;
}

async function applyPrototypeVision(
  actor,
) {
  const sight =
    actor?.prototypeToken
      ?.sight;

  if (!sight) {
    return;
  }

  if (
    flag(
      actor,
      PROTOTYPE_MANAGED_FLAG,
    ) !== true
  ) {
    await setFlagSafe(
      actor,
      PROTOTYPE_ORIGINAL_FLAG,
      visionSnapshot(
        sight,
      ),
    );

    await setFlagSafe(
      actor,
      PROTOTYPE_MANAGED_FLAG,
      true,
    );
  }

  if (
    !hasManagedVision(
      sight,
    )
  ) {
    await actor.update(
      managedVisionUpdate(
        "prototypeToken.sight",
      ),
    );
  }
}

async function restorePrototypeVision(
  actor,
) {
  if (
    flag(
      actor,
      PROTOTYPE_MANAGED_FLAG,
    ) !== true
  ) {
    return;
  }

  const original =
    flag(
      actor,
      PROTOTYPE_ORIGINAL_FLAG,
    );

  const sight =
    actor?.prototypeToken
      ?.sight;

  if (original) {
    await actor.update(
      originalVisionUpdate(
        "prototypeToken.sight",
        original,
      ),
    );
  }

  await unsetFlagSafe(
    actor,
    PROTOTYPE_MANAGED_FLAG,
  );

  await unsetFlagSafe(
    actor,
    PROTOTYPE_ORIGINAL_FLAG,
  );
}

async function applyTokenVision(
  token,
) {
  const sight =
    token?.sight;

  if (!sight) {
    return;
  }

  if (
    flag(
      token,
      TOKEN_MANAGED_FLAG,
    ) !== true
  ) {
    await setFlagSafe(
      token,
      TOKEN_ORIGINAL_FLAG,
      visionSnapshot(
        sight,
      ),
    );

    await setFlagSafe(
      token,
      TOKEN_MANAGED_FLAG,
      true,
    );
  }

  if (
    !hasManagedVision(
      sight,
    )
  ) {
    await token.update(
      managedVisionUpdate(
        "sight",
      ),
    );
  }
}

async function restoreTokenVision(
  token,
) {
  if (
    flag(
      token,
      TOKEN_MANAGED_FLAG,
    ) !== true
  ) {
    return;
  }

  const original =
    flag(
      token,
      TOKEN_ORIGINAL_FLAG,
    );

  if (original) {
    await token.update(
      originalVisionUpdate(
        "sight",
        original,
      ),
    );
  }

  await unsetFlagSafe(
    token,
    TOKEN_MANAGED_FLAG,
  );

  await unsetFlagSafe(
    token,
    TOKEN_ORIGINAL_FLAG,
  );
}

async function reconcileDemonHunterInitiationActorNow(
  actor,
  {
    settings =
      globalThis.game
        ?.settings,
    scenes =
      globalThis.game
        ?.scenes,
  } = {},
) {
  if (
    !actor ||
    actor.type !==
      "character"
  ) {
    return false;
  }

  const active =
    isDemonHunterInitiationAutomationEnabled(
      settings,
    ) &&
    hasInitiation(
      actor,
    );

  if (active) {
    await applyPrototypeVision(
      actor,
    );
  } else {
    await restorePrototypeVision(
      actor,
    );
  }

  for (const token of actorSceneTokens(
    actor,
    scenes,
  )) {
    if (active) {
      await applyTokenVision(
        token,
      );
    } else {
      await restoreTokenVision(
        token,
      );
    }
  }

  return true;
}

export function reconcileDemonHunterInitiationActor(
  actor,
  options = {},
) {
  if (!actor) {
    return Promise.resolve(
      false,
    );
  }

  const previous =
    reconcileQueues.get(
      actor,
    ) ??
    Promise.resolve();

  const next =
    previous
      .catch(
        () =>
          undefined,
      )
      .then(
        () =>
          reconcileDemonHunterInitiationActorNow(
            actor,
            options,
          ),
      );

  reconcileQueues.set(
    actor,
    next,
  );

  return next.finally(
    () => {
      if (
        reconcileQueues.get(
          actor,
        ) === next
      ) {
        reconcileQueues.delete(
          actor,
        );
      }
    },
  );
}

export async function reconcileDemonHunterInitiation(
  actor = null,
) {
  if (
    globalThis.game?.user &&
    !isPrimaryActiveGM()
  ) {
    return false;
  }

  if (actor) {
    return reconcileDemonHunterInitiationActor(
      actor,
    );
  }

  const actors =
    globalThis.game?.actors
      ? Array.from(
          globalThis.game.actors,
        )
      : [];

  for (const candidate of actors) {
    await reconcileDemonHunterInitiationActor(
      candidate,
    );
  }

  return true;
}

export async function executeDemonHunterInitiationReconcileRequest(
  payload,
  {
    users =
      globalThis.game?.users,
    actors =
      globalThis.game?.actors,
    reconcileActor =
      reconcileDemonHunterInitiationActor,
    ownerLevel =
      globalThis.CONST
        ?.DOCUMENT_OWNERSHIP_LEVELS
        ?.OWNER ??
      3,
  } = {},
) {
  const requesterUserId =
    payload?.requesterUserId;
  const actorId =
    payload?.actorId;

  if (
    !requesterUserId ||
    !actorId
  ) {
    throw new Error(
      "The Demon Hunter Initiation reconciliation request is incomplete.",
    );
  }

  const requester =
    users?.get?.(
      requesterUserId,
    ) ??
    null;

  if (
    !requester ||
    requester.active !== true
  ) {
    throw new Error(
      "The requesting User is not active.",
    );
  }

  const actor =
    actors?.get?.(
      actorId,
    ) ??
    null;

  if (!actor) {
    throw new Error(
      "The requested Demon Hunter Initiation Actor does not exist.",
    );
  }

  const mayManageActor =
    requester.isGM === true ||
    actor.testUserPermission?.(
      requester,
      ownerLevel,
    ) === true;

  if (!mayManageActor) {
    throw new Error(
      "The requesting User does not own the Demon Hunter Initiation Actor.",
    );
  }

  await reconcileActor(
    actor,
  );

  return {
    actorId:
      actor.id,
  };
}

function handleDemonHunterInitiationReconcileResult(
  payload,
) {
  if (
    payload?.requesterUserId !==
      globalThis.game?.user?.id
  ) {
    return;
  }

  const pending =
    pendingReconcileRequests.get(
      payload.requestId,
    );

  if (!pending) {
    return;
  }

  clearTimeout(
    pending.timeoutId,
  );

  pendingReconcileRequests.delete(
    payload.requestId,
  );

  if (
    payload.success === true
  ) {
    pending.resolve(
      payload.result,
    );
  } else {
    pending.reject(
      new Error(
        payload.error ||
        "The GM could not reconcile Demon Hunter Initiation.",
      ),
    );
  }
}

async function handleDemonHunterInitiationReconcileRequest(
  payload,
) {
  if (
    !isPrimaryActiveGM()
  ) {
    return;
  }

  if (
    payload?.gmUserId &&
    payload.gmUserId !==
      globalThis.game?.user?.id
  ) {
    return;
  }

  try {
    const result =
      await executeDemonHunterInitiationReconcileRequest(
        payload,
      );

    globalThis.game.socket.emit(
      SOCKET_NAME,
      {
        type:
          RECONCILE_RESULT_TYPE,
        requestId:
          payload.requestId,
        requesterUserId:
          payload.requesterUserId,
        success:
          true,
        result,
      },
    );
  } catch (error) {
    console.error(
      `${MODULE_ID} | Demon Hunter Initiation `
      + "reconciliation request failed.",
      error,
    );

    globalThis.game.socket.emit(
      SOCKET_NAME,
      {
        type:
          RECONCILE_RESULT_TYPE,
        requestId:
          payload?.requestId,
        requesterUserId:
          payload?.requesterUserId,
        success:
          false,
        error:
          error.message,
      },
    );
  }
}

function onDemonHunterInitiationSocketMessage(
  payload,
) {
  if (
    !payload ||
    typeof payload !==
      "object"
  ) {
    return;
  }

  if (
    payload.type ===
      RECONCILE_REQUEST_TYPE
  ) {
    void handleDemonHunterInitiationReconcileRequest(
      payload,
    );
  } else if (
    payload.type ===
      RECONCILE_RESULT_TYPE
  ) {
    handleDemonHunterInitiationReconcileResult(
      payload,
    );
  }
}

export function registerDemonHunterInitiationSocket() {
  if (
    reconcileSocketRegistered
  ) {
    return;
  }

  globalThis.game?.socket?.on?.(
    SOCKET_NAME,
    onDemonHunterInitiationSocketMessage,
  );

  reconcileSocketRegistered =
    true;
}

export function mayCurrentUserRequestDemonHunterInitiationReconcile(
  actor,
  {
    user =
      globalThis.game?.user,
    ownerLevel =
      globalThis.CONST
        ?.DOCUMENT_OWNERSHIP_LEVELS
        ?.OWNER ??
      3,
  } = {},
) {
  if (!actor) {
    return false;
  }

  if (!user) {
    return true;
  }

  if (user.isGM === true) {
    return true;
  }

  return (
    actor.testUserPermission?.(
      user,
      ownerLevel,
    ) === true
  );
}

export function requestDemonHunterInitiationReconcile(
  actor,
) {
  if (!actor) {
    return Promise.resolve(
      false,
    );
  }

  const currentUser =
    globalThis.game?.user;

  if (!currentUser) {
    return reconcileDemonHunterInitiationActor(
      actor,
    );
  }

  if (
    isPrimaryActiveGM()
  ) {
    return reconcileDemonHunterInitiationActor(
      actor,
    );
  }

  const ownerLevel =
    globalThis.CONST
      ?.DOCUMENT_OWNERSHIP_LEVELS
      ?.OWNER ??
    3;

  const mayManageActor =
    currentUser.isGM === true ||
    actor.testUserPermission?.(
      currentUser,
      ownerLevel,
    ) === true;

  if (!mayManageActor) {
    return Promise.reject(
      new Error(
        "You do not own this Demon Hunter Initiation Actor.",
      ),
    );
  }

  const activeGM =
    getPrimaryActiveGMUser();

  if (!activeGM) {
    return Promise.reject(
      new Error(
        "An active GM is required for Demon Hunter Initiation vision automation.",
      ),
    );
  }

  const requestId =
    globalThis.foundry?.utils
      ?.randomID?.() ??
    `${Date.now()}-${Math.random()}`;

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const timeoutId =
        setTimeout(
          () => {
            pendingReconcileRequests.delete(
              requestId,
            );

            reject(
              new Error(
                "The Demon Hunter Initiation reconciliation request timed out.",
              ),
            );
          },
          RECONCILE_TIMEOUT_MS,
        );

      pendingReconcileRequests.set(
        requestId,
        {
          resolve,
          reject,
          timeoutId,
        },
      );

      globalThis.game.socket.emit(
        SOCKET_NAME,
        {
          type:
            RECONCILE_REQUEST_TYPE,
          requestId,
          requesterUserId:
            currentUser.id,
          gmUserId:
            activeGM.id,
          actorId:
            actor.id,
        },
      );
    },
  );
}

async function reconcileDemonHunterInitiationWithAuthority(
  actor,
  context,
) {
  if (
    !mayCurrentUserRequestDemonHunterInitiationReconcile(
      actor,
    )
  ) {
    return false;
  }

  try {
    return await requestDemonHunterInitiationReconcile(
      actor,
    );
  } catch (error) {
    console.error(
      `${MODULE_ID} | Failed to reconcile Demon Hunter Initiation `
      + `${context}.`,
      error,
    );

    return false;
  }
}

export async function onCreateDemonHunterInitiationItem(
  item,
) {
  if (
    isDemonHunterInitiationAbility(
      item,
    )
  ) {
    await reconcileDemonHunterInitiationWithAuthority(
      item.parent,
      "after Item creation",
    );
  }
}

export function onDeleteDemonHunterInitiationItem(
  item,
) {
  if (
    !isDemonHunterInitiationAbility(
      item,
    )
  ) {
    return;
  }

  const actor =
    item.parent;

  queueMicrotask(
    () => {
      void reconcileDemonHunterInitiationWithAuthority(
        actor,
        "after Item deletion",
      );
    },
  );
}

export async function onCreateDemonHunterInitiationToken(
  token,
) {
  if (
    !needsAutomaticDemonHunterInitiationReconcile(
      token?.actor,
    )
  ) {
    return false;
  }

  return reconcileDemonHunterInitiationWithAuthority(
    token.actor,
    "after Token creation",
  );
}

export function onRenderDemonHunterInitiationActorSheet(
  app,
) {
  if (
    !needsAutomaticDemonHunterInitiationReconcile(
      app?.actor,
    )
  ) {
    return false;
  }

  void reconcileDemonHunterInitiationWithAuthority(
    app.actor,
    "while rendering the Actor sheet",
  );
  return true;
}
