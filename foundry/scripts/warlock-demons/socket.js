import { MODULE_ID } from "../core/constants.js";
import {
  getPrimaryActiveGMUser,
  isPrimaryActiveGM,
} from "../core/users.js";
import {
  executeWarlockDemonCreation,
  WarlockDemonPlacementRejection,
} from "./creation.js";

const SOCKET_NAME = `module.${MODULE_ID}`;
const TIMEOUT_MS = 30000;
const pendingRequests = new Map();
let registered = false;

export function shouldLogWarlockDemonCreationRequestError(
  error,
) {
  return !(
    error instanceof
      WarlockDemonPlacementRejection
  );
}

function handleResult(payload) {
  if (
    payload.requesterUserId
    !== game.user.id
  ) {
    return;
  }

  const pending =
    pendingRequests.get(payload.requestId);
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
        || "The GM could not create the demon.",
      ),
    );
  }
}

async function handleRequest(payload) {
  if (!isPrimaryActiveGM()) return;

  try {
    const result =
      await executeWarlockDemonCreation(
        payload.plan,
        payload.position,
        payload.requesterUserId,
      );

    game.socket.emit(SOCKET_NAME, {
      type: "warlockDemonResult",
      requestId: payload.requestId,
      requesterUserId:
        payload.requesterUserId,
      success: true,
      result,
    });
  } catch (error) {
    if (
      shouldLogWarlockDemonCreationRequestError(
        error,
      )
    ) {
      console.error(
        `${MODULE_ID} | Warlock demon creation `
        + "request failed.",
        error,
      );
    }

    game.socket.emit(SOCKET_NAME, {
      type: "warlockDemonResult",
      requestId: payload.requestId,
      requesterUserId:
        payload.requesterUserId,
      success: false,
      error: error.message,
    });
  }
}

function onSocketMessage(payload) {
  if (
    !payload
    || typeof payload !== "object"
  ) {
    return;
  }

  if (
    payload.type === "warlockDemonRequest"
  ) {
    void handleRequest(payload);
  } else if (
    payload.type === "warlockDemonResult"
  ) {
    handleResult(payload);
  }
}

export function registerWarlockDemonSocket() {
  if (registered) return;

  game.socket.on(
    SOCKET_NAME,
    onSocketMessage,
  );
  registered = true;
}

export function requestWarlockDemonCreation(
  plan,
  position,
) {
  if (game.user.isGM) {
    return executeWarlockDemonCreation(
      plan,
      position,
      game.user.id,
    );
  }

  const activeGM =
    getPrimaryActiveGMUser();
  if (!activeGM) {
    throw new Error(
      "An active GM is required to create "
      + "Warlock demon tokens.",
    );
  }

  const requestId =
    foundry.utils.randomID();

  return new Promise(
    (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(
          new Error(
            "The Warlock demon request "
            + "timed out.",
          ),
        );
      }, TIMEOUT_MS);

      pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId,
      });

      game.socket.emit(SOCKET_NAME, {
        type: "warlockDemonRequest",
        requestId,
        requesterUserId: game.user.id,
        gmUserId: activeGM.id,
        plan,
        position,
      });
    },
  );
}
