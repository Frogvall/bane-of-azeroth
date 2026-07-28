import { MODULE_ID } from "./constants.js";
import {
  getPrimaryActiveGMUser,
  isPrimaryActiveGM,
} from "./users.js";

export const SUMMON_DURATION_STRETCH =
  "stretch";
export const SUMMON_DURATION_SHIFT =
  "shift";

const EXPECTED_DURATION_BY_SUMMON_TYPE =
  Object.freeze({
    elementalTotem:
      SUMMON_DURATION_STRETCH,
    "warlock-demon":
      SUMMON_DURATION_SHIFT,
  });

const SOCKET_NAME = `module.${MODULE_ID}`;
const REQUEST_TYPE =
  "summonDurationCleanupRequest";
const RESULT_TYPE =
  "summonDurationCleanupResult";
const SOCKET_TIMEOUT_MS = 30000;
const PATCH_MARKER = Symbol.for(
  `${MODULE_ID}.summonDurationLifecycle`,
);

const pendingRequests = new Map();
let socketRegistered = false;

function assertRestType(restType) {
  if (
    restType !== SUMMON_DURATION_STRETCH
    && restType !== SUMMON_DURATION_SHIFT
  ) {
    throw new Error(
      `Unknown summon rest type: ${String(restType)}`,
    );
  }
}

function getManagedSummonFlags(token) {
  const flags =
    token?.flags?.[MODULE_ID];
  const expectedDuration =
    EXPECTED_DURATION_BY_SUMMON_TYPE[
      flags?.summonType
    ];

  if (
    !expectedDuration
    || flags?.duration !== expectedDuration
  ) {
    return null;
  }

  return flags;
}

export function isSummonExpiredByRest(
  duration,
  restType,
) {
  if (
    duration === SUMMON_DURATION_STRETCH
  ) {
    return (
      restType === SUMMON_DURATION_STRETCH
      || restType === SUMMON_DURATION_SHIFT
    );
  }

  return (
    duration === SUMMON_DURATION_SHIFT
    && restType === SUMMON_DURATION_SHIFT
  );
}

export async function deleteSummonsExpiredByRest(
  casterActorUuid,
  restType,
  {
    scenes = globalThis.game?.scenes,
  } = {},
) {
  if (
    typeof casterActorUuid !== "string"
    || !casterActorUuid
  ) {
    throw new Error(
      "A caster Actor UUID is required for summon cleanup.",
    );
  }
  assertRestType(restType);

  let deletedCount = 0;
  const failedScenes = [];

  for (const scene of Array.from(scenes ?? [])) {
    const tokenIds = Array.from(
      scene?.tokens ?? [],
    )
      .filter(token => {
        const flags =
          getManagedSummonFlags(token);
        return (
          flags?.casterActorUuid
            === casterActorUuid
          && isSummonExpiredByRest(
            flags.duration,
            restType,
          )
        );
      })
      .map(token => token.id)
      .filter(Boolean);

    if (tokenIds.length === 0) continue;

    try {
      await scene.deleteEmbeddedDocuments(
        "Token",
        tokenIds,
      );
      deletedCount += tokenIds.length;
    } catch (error) {
      const sceneName =
        scene?.name
        ?? scene?.id
        ?? "Unknown Scene";
      failedScenes.push(sceneName);
      console.error(
        `${MODULE_ID} | Could not remove `
        + `expired summons from ${sceneName}.`,
        error,
      );
    }
  }

  return {
    deletedCount,
    failedScenes,
  };
}

export async function executeSummonDurationCleanupRequest(
  request,
  requesterUserId,
  {
    fromUuidFn = globalThis.fromUuid,
    scenes = globalThis.game?.scenes,
    users = globalThis.game?.users,
  } = {},
) {
  if (
    !request
    || typeof request !== "object"
  ) {
    throw new Error(
      "The summon cleanup request is invalid.",
    );
  }
  assertRestType(request.restType);

  const requester =
    users?.get?.(requesterUserId);
  if (!requester) {
    throw new Error(
      "The requesting user could not be found.",
    );
  }
  if (typeof fromUuidFn !== "function") {
    throw new Error(
      "Foundry UUID resolution is unavailable.",
    );
  }

  const resolved = await fromUuidFn(
    request.actorUuid,
  );
  const actor = resolved?.actor ?? resolved;

  if (actor?.documentName !== "Actor") {
    throw new Error(
      "The resting Actor could not be found.",
    );
  }

  const ownerLevel =
    globalThis.CONST
      ?.DOCUMENT_OWNERSHIP_LEVELS
      ?.OWNER
    ?? 3;

  if (
    !requester.isGM
    && !actor.testUserPermission?.(
      requester,
      ownerLevel,
    )
  ) {
    throw new Error(
      "The requesting user does not own "
      + "the resting Actor.",
    );
  }

  return deleteSummonsExpiredByRest(
    actor.uuid,
    request.restType,
    { scenes },
  );
}

function handleCleanupResult(payload) {
  if (
    payload?.requesterUserId
      !== globalThis.game?.user?.id
  ) {
    return;
  }

  const pending = pendingRequests.get(
    payload.requestId,
  );
  if (!pending) return;

  clearTimeout(pending.timeoutId);
  pendingRequests.delete(
    payload.requestId,
  );

  if (payload.success) {
    pending.resolve(payload.result);
  } else {
    pending.reject(
      new Error(
        payload.error
        || "The GM could not clean up summons.",
      ),
    );
  }
}

async function handleCleanupRequest(payload) {
  if (
    !isPrimaryActiveGM()
    || payload?.gmUserId
      !== globalThis.game?.user?.id
  ) {
    return;
  }

  try {
    const result =
      await executeSummonDurationCleanupRequest(
        {
          actorUuid: payload.actorUuid,
          restType: payload.restType,
        },
        payload.requesterUserId,
      );

    globalThis.game.socket.emit(
      SOCKET_NAME,
      {
        type: RESULT_TYPE,
        requestId: payload.requestId,
        requesterUserId:
          payload.requesterUserId,
        success: true,
        result,
      },
    );
  } catch (error) {
    console.error(
      `${MODULE_ID} | Summon duration `
      + "cleanup request failed.",
      error,
    );
    globalThis.game.socket.emit(
      SOCKET_NAME,
      {
        type: RESULT_TYPE,
        requestId: payload.requestId,
        requesterUserId:
          payload.requesterUserId,
        success: false,
        error: error.message,
      },
    );
  }
}

function onSocketMessage(payload) {
  if (
    !payload
    || typeof payload !== "object"
  ) {
    return;
  }

  if (payload.type === REQUEST_TYPE) {
    void handleCleanupRequest(payload);
  } else if (
    payload.type === RESULT_TYPE
  ) {
    handleCleanupResult(payload);
  }
}

export function registerSummonDurationLifecycleSocket() {
  if (socketRegistered) return false;

  const socket = globalThis.game?.socket;
  if (typeof socket?.on !== "function") {
    console.error(
      `${MODULE_ID} | Could not register `
      + "the summon duration socket.",
    );
    return false;
  }

  socket.on(
    SOCKET_NAME,
    onSocketMessage,
  );
  socketRegistered = true;
  return true;
}

export function requestSummonDurationCleanup(
  actor,
  restType,
  {
    activeGM =
      getPrimaryActiveGMUser(),
    isPrimaryGM =
      isPrimaryActiveGM(),
    randomID =
      globalThis.foundry?.utils?.randomID,
    socket = globalThis.game?.socket,
    user = globalThis.game?.user,
  } = {},
) {
  const actorUuid = actor?.uuid;
  if (
    typeof actorUuid !== "string"
    || !actorUuid
  ) {
    return Promise.reject(
      new Error(
        "The resting Actor has no UUID.",
      ),
    );
  }
  assertRestType(restType);

  if (isPrimaryGM) {
    return executeSummonDurationCleanupRequest(
      {
        actorUuid,
        restType,
      },
      user?.id,
    );
  }

  if (!activeGM) {
    return Promise.reject(
      new Error(
        "An active GM is required to remove "
        + "expired summons.",
      ),
    );
  }
  if (
    typeof socket?.emit !== "function"
    || typeof randomID !== "function"
  ) {
    return Promise.reject(
      new Error(
        "The summon cleanup socket is unavailable.",
      ),
    );
  }

  const requestId = randomID();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(
        new Error(
          "The summon cleanup request timed out.",
        ),
      );
    }, SOCKET_TIMEOUT_MS);

    pendingRequests.set(requestId, {
      resolve,
      reject,
      timeoutId,
    });

    socket.emit(
      SOCKET_NAME,
      {
        type: REQUEST_TYPE,
        requestId,
        requesterUserId: user?.id,
        gmUserId: activeGM.id,
        actorUuid,
        restType,
      },
    );
  });
}

export function reportSummonDurationCleanupFailure(
  error,
  actor,
  restType,
  {
    notifications =
      globalThis.ui?.notifications,
  } = {},
) {
  console.error(
    `${MODULE_ID} | ${restType} rest `
    + "completed, but summon cleanup failed "
    + `for ${actor?.uuid ?? "an unknown Actor"}.`,
    error,
  );

  notifications?.error?.(
    globalThis.game?.i18n?.localize?.(
      "BOA.notifications.summonCleanupFailed",
    )
    ?? (
      "The rest completed, but one or more "
      + "summoned tokens could not be removed."
    ),
  );
}

async function cleanUpAfterRest(
  actor,
  restType,
  requestCleanupFn,
  reportFailureFn,
) {
  try {
    const result = await requestCleanupFn(
      actor,
      restType,
    );

    if (
      Array.isArray(result?.failedScenes)
      && result.failedScenes.length > 0
    ) {
      const error = new Error(
        "Summon cleanup was incomplete in: "
        + result.failedScenes.join(", "),
      );
      error.failedScenes = [
        ...result.failedScenes,
      ];
      reportFailureFn(
        error,
        actor,
        restType,
      );
    }

    return result;
  } catch (error) {
    reportFailureFn(
      error,
      actor,
      restType,
    );
    return null;
  }
}

function patchRestMethod(
  actorClass,
  methodName,
  restType,
  requestCleanupFn,
  reportFailureFn,
) {
  const prototype = actorClass?.prototype;
  const original = prototype?.[methodName];

  if (typeof original !== "function") {
    return "missing";
  }
  if (original[PATCH_MARKER]) {
    return "already-patched";
  }

  const wrapped = async function (...args) {
    const result = await original.apply(
      this,
      args,
    );

    await cleanUpAfterRest(
      this,
      restType,
      requestCleanupFn,
      reportFailureFn,
    );

    return result;
  };

  Object.defineProperty(
    wrapped,
    PATCH_MARKER,
    {
      configurable: false,
      enumerable: false,
      value: {
        original,
        restType,
      },
      writable: false,
    },
  );

  prototype[methodName] = wrapped;
  return "patched";
}

export function patchSummonRestLifecycle({
  actorClass =
    globalThis.CONFIG?.Actor?.documentClass,
  requestCleanupFn =
    requestSummonDurationCleanup,
  reportFailureFn =
    reportSummonDurationCleanupFailure,
} = {}) {
  const result = {
    restStretch: patchRestMethod(
      actorClass,
      "restStretch",
      SUMMON_DURATION_STRETCH,
      requestCleanupFn,
      reportFailureFn,
    ),
    restShift: patchRestMethod(
      actorClass,
      "restShift",
      SUMMON_DURATION_SHIFT,
      requestCleanupFn,
      reportFailureFn,
    ),
  };

  for (
    const [methodName, status]
    of Object.entries(result)
  ) {
    if (status === "missing") {
      console.error(
        `${MODULE_ID} | Dragonbane Actor.`
        + `${methodName} is unavailable; `
        + "summon cleanup was not patched.",
      );
    }
  }

  return result;
}

export function isSummonRestLifecyclePatched(
  actorClass =
    globalThis.CONFIG?.Actor?.documentClass,
) {
  const prototype = actorClass?.prototype;

  return (
    Boolean(
      prototype?.restStretch?.[PATCH_MARKER],
    )
    && Boolean(
      prototype?.restShift?.[PATCH_MARKER],
    )
  );
}
