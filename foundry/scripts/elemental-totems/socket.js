import { MODULE_ID } from "../core/constants.js";
import {
  getPrimaryActiveGMUser,
  isPrimaryActiveGM,
} from "../core/users.js";
import {
  executeElementalTotemCreation,
} from "./creation.js";

const ELEMENTAL_TOTEM_SOCKET = `module.${MODULE_ID}`;
const ELEMENTAL_TOTEM_SOCKET_TIMEOUT_MS = 30000;
const pendingElementalTotemSocketRequests = new Map();
let elementalTotemSocketRegistered = false;

function handleElementalTotemSocketResult(payload) {
  if (payload.requesterUserId !== game.user.id) return;

  const pending = pendingElementalTotemSocketRequests.get(
    payload.requestId
  );
  if (!pending) return;

  clearTimeout(pending.timeoutId);
  pendingElementalTotemSocketRequests.delete(payload.requestId);

  if (payload.success) {
    pending.resolve(payload.result);
  } else {
    pending.reject(
      new Error(
        payload.error || "The GM could not create the totems."
      )
    );
  }
}

async function handleElementalTotemSocketRequest(payload) {
  if (!isPrimaryActiveGM()) return;

  try {
    const result = await executeElementalTotemCreation(
      payload.plan,
      payload.positions,
      payload.requesterUserId
    );

    game.socket.emit(ELEMENTAL_TOTEM_SOCKET, {
      type: "elementalTotemResult",
      requestId: payload.requestId,
      requesterUserId: payload.requesterUserId,
      success: true,
      result,
    });
  } catch (error) {
    console.error(
      `${MODULE_ID} | Elemental Totem creation request failed.`,
      error
    );

    game.socket.emit(ELEMENTAL_TOTEM_SOCKET, {
      type: "elementalTotemResult",
      requestId: payload.requestId,
      requesterUserId: payload.requesterUserId,
      success: false,
      error: error.message,
    });
  }
}

function onElementalTotemSocketMessage(payload) {
  if (!payload || typeof payload !== "object") return;

  if (payload.type === "elementalTotemRequest") {
    void handleElementalTotemSocketRequest(payload);
  } else if (payload.type === "elementalTotemResult") {
    handleElementalTotemSocketResult(payload);
  }
}

export function registerElementalTotemSocket() {
  if (elementalTotemSocketRegistered) return;

  game.socket.on(
    ELEMENTAL_TOTEM_SOCKET,
    onElementalTotemSocketMessage
  );
  elementalTotemSocketRegistered = true;
}

export function requestElementalTotemCreation(plan, positions) {
  if (game.user.isGM) {
    return executeElementalTotemCreation(
      plan,
      positions,
      game.user.id
    );
  }

  const activeGM = getPrimaryActiveGMUser();
  if (!activeGM) {
    throw new Error(
      "An active GM is required to create Elemental Totem tokens."
    );
  }

  const requestId = foundry.utils.randomID();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingElementalTotemSocketRequests.delete(requestId);
      reject(new Error("The Elemental Totem request timed out."));
    }, ELEMENTAL_TOTEM_SOCKET_TIMEOUT_MS);

    pendingElementalTotemSocketRequests.set(requestId, {
      resolve,
      reject,
      timeoutId,
    });

    game.socket.emit(ELEMENTAL_TOTEM_SOCKET, {
      type: "elementalTotemRequest",
      requestId,
      requesterUserId: game.user.id,
      gmUserId: activeGM.id,
      plan,
      positions,
    });
  });
}
