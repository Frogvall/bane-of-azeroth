import { MODULE_ID } from "../core/constants.js";
import {
  calculateTokenDistance,
} from "../core/token-placement.js";
import {
  getPrimaryActiveGMUser,
  isPrimaryActiveGM,
} from "../core/users.js";

export const SUFFERING_MAX_DISTANCE = 10;

const SOCKET_NAME = `module.${MODULE_ID}`;
const REQUEST_TYPE = "voidwalkerSufferingRequest";
const RESULT_TYPE = "voidwalkerSufferingResult";
const SOCKET_TIMEOUT_MS = 30000;
const PATCH_MARKER = Symbol.for(
  `${MODULE_ID}.voidwalkerSuffering`,
);

const pendingRequests = new Map();
let socketRegistered = false;

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) {
    return collection.contents;
  }

  try {
    return Array.from(
      collection.values?.() ?? collection,
    );
  } catch {
    return [];
  }
}

function tokenScene(token) {
  return (
    token?.parent?.documentName === "Scene"
      ? token.parent
      : token?.scene ?? token?.parent ?? null
  );
}

function tokenForDistance(token) {
  return token?.object ?? token;
}

function actorMatchesToken(actor, token) {
  if (!actor || !token) return false;

  return (
    token.actor?.uuid === actor.uuid
    || (
      actor.id
      && token.actorId === actor.id
      && token.actorLink !== false
    )
  );
}

function findCasterTokens(
  actor,
  {
    scenes = globalThis.game?.scenes,
  } = {},
) {
  const tokens = [];
  const seen = new Set();

  const add = token => {
    if (!token || !actorMatchesToken(actor, token)) {
      return;
    }

    const key =
      token.uuid
      ?? `${tokenScene(token)?.id ?? ""}:${token.id ?? ""}`;

    if (seen.has(key)) return;
    seen.add(key);
    tokens.push(token);
  };

  add(actor?.token?.document ?? actor?.token);

  for (const scene of collectionValues(scenes)) {
    for (const token of collectionValues(scene?.tokens)) {
      add(token);
    }
  }

  return tokens;
}

function defaultDistance(casterToken, candidate) {
  const casterScene = tokenScene(casterToken);
  const candidateScene = tokenScene(candidate);
  const scene = casterScene ?? candidateScene;

  if (!scene) return Number.POSITIVE_INFINITY;
  if (
    casterScene
    && candidateScene
    && casterScene.id !== candidateScene.id
  ) {
    return Number.POSITIVE_INFINITY;
  }

  try {
    return calculateTokenDistance(
      scene,
      tokenForDistance(casterToken),
      tokenForDistance(candidate),
    );
  } catch (error) {
    console.error(
      `${MODULE_ID} | Could not measure `
      + "Voidwalker Suffering distance.",
      error,
    );
    return Number.POSITIVE_INFINITY;
  }
}

export function splitVoidwalkerSufferingDamage(damage) {
  const numericDamage = Number(damage);

  if (
    !Number.isFinite(numericDamage)
    || numericDamage <= 0
  ) {
    return null;
  }

  const sharedDamage = Math.ceil(
    numericDamage / 2,
  );

  return {
    warlockDamage: sharedDamage,
    voidwalkerDamage: sharedDamage,
  };
}

export function findEligibleVoidwalkerForSuffering({
  casterActorUuid,
  casterToken,
  tokens,
  calculateDistanceFn = defaultDistance,
  maxDistance = SUFFERING_MAX_DISTANCE,
} = {}) {
  if (
    typeof casterActorUuid !== "string"
    || !casterActorUuid
    || !casterToken
    || typeof calculateDistanceFn !== "function"
  ) {
    return null;
  }

  const casterScene = tokenScene(casterToken);

  for (const candidate of collectionValues(tokens)) {
    if (
      !candidate
      || candidate === casterToken
      || !candidate.actor
    ) {
      continue;
    }

    const candidateScene = tokenScene(candidate);
    if (
      casterScene
      && candidateScene
      && casterScene.id !== candidateScene.id
    ) {
      continue;
    }

    const flags = candidate.flags?.[MODULE_ID];
    if (
      flags?.casterActorUuid !== casterActorUuid
      || flags?.summonType !== "warlock-demon"
      || flags?.demonKey !== "voidwalker"
      || flags?.duration !== "shift"
    ) {
      continue;
    }

    const distance = Number(
      calculateDistanceFn(
        casterToken,
        candidate,
      ),
    );
    if (
      Number.isFinite(distance)
      && distance <= maxDistance
    ) {
      return candidate;
    }
  }

  return null;
}

function resolveFromExplicitOptions({
  actor,
  damage,
  casterToken,
  tokens,
  calculateDistanceFn = defaultDistance,
  maxDistance = SUFFERING_MAX_DISTANCE,
} = {}) {
  const split =
    splitVoidwalkerSufferingDamage(damage);
  if (!split || !actor?.uuid || !casterToken) {
    return null;
  }

  const voidwalkerToken =
    findEligibleVoidwalkerForSuffering({
      casterActorUuid: actor.uuid,
      casterToken,
      tokens,
      calculateDistanceFn,
      maxDistance,
    });
  if (!voidwalkerToken) return null;

  return {
    ...split,
    voidwalkerToken,
  };
}

function resolveFromRuntimeActor(
  actor,
  damage,
  {
    scenes = globalThis.game?.scenes,
    calculateDistanceFn = defaultDistance,
    maxDistance = SUFFERING_MAX_DISTANCE,
  } = {},
) {
  const split =
    splitVoidwalkerSufferingDamage(damage);
  if (!split || !actor?.uuid) return null;

  for (
    const casterToken
    of findCasterTokens(actor, { scenes })
  ) {
    const scene = tokenScene(casterToken);
    if (!scene) continue;

    const voidwalkerToken =
      findEligibleVoidwalkerForSuffering({
        casterActorUuid: actor.uuid,
        casterToken,
        tokens: scene.tokens,
        calculateDistanceFn,
        maxDistance,
      });

    if (voidwalkerToken) {
      return {
        ...split,
        voidwalkerToken,
      };
    }
  }

  return null;
}

export function resolveVoidwalkerSuffering(
  optionsOrActor,
  damage,
) {
  if (arguments.length >= 2) {
    return resolveFromRuntimeActor(
      optionsOrActor,
      damage,
    );
  }

  return resolveFromExplicitOptions(
    optionsOrActor,
  );
}

function findCasterTokenInScene(
  actor,
  voidwalkerToken,
) {
  const scene = tokenScene(voidwalkerToken);
  if (!scene) return null;

  return (
    collectionValues(scene.tokens)
      .find(token => actorMatchesToken(actor, token))
    ?? null
  );
}

async function applyTransferredDamageDirectly({
  voidwalkerToken,
  damage,
  originalApplyDamage,
}) {
  const voidwalkerActor = voidwalkerToken?.actor;

  if (
    !voidwalkerActor
    || typeof originalApplyDamage !== "function"
  ) {
    throw new Error(
      "The linked Voidwalker Actor "
      + "could not receive Suffering damage.",
    );
  }

  return originalApplyDamage.apply(
    voidwalkerActor,
    [damage],
  );
}

function getOriginalApplyDamage(
  actorClass =
    globalThis.CONFIG?.Actor?.documentClass,
) {
  const current =
    actorClass?.prototype?.applyDamage;

  return current?.[PATCH_MARKER]?.original ?? null;
}

function validateSufferingTokenLink(
  casterActor,
  casterToken,
  voidwalkerToken,
  {
    calculateDistanceFn = defaultDistance,
  } = {},
) {
  if (
    !casterActor
    || !casterToken
    || !voidwalkerToken
  ) {
    throw new Error(
      "The Suffering token context is incomplete.",
    );
  }

  if (!actorMatchesToken(casterActor, casterToken)) {
    throw new Error(
      "The caster Token does not represent "
      + "the requested Actor.",
    );
  }

  const casterScene = tokenScene(casterToken);
  const voidwalkerScene = tokenScene(voidwalkerToken);

  if (
    !casterScene
    || !voidwalkerScene
    || casterScene.id !== voidwalkerScene.id
  ) {
    throw new Error(
      "Suffering requires the caster and "
      + "Voidwalker to be in the same Scene.",
    );
  }

  const eligible =
    findEligibleVoidwalkerForSuffering({
      casterActorUuid: casterActor.uuid,
      casterToken,
      tokens: [voidwalkerToken],
      calculateDistanceFn,
    });

  if (eligible !== voidwalkerToken) {
    throw new Error(
      "The requested Voidwalker is not "
      + "eligible for Suffering.",
    );
  }
}

export async function executeVoidwalkerSufferingTransfer(
  request,
  requesterUserId,
  {
    fromUuidFn = globalThis.fromUuid,
    users = globalThis.game?.users,
    calculateDistanceFn = defaultDistance,
    originalApplyDamage =
      getOriginalApplyDamage(),
  } = {},
) {
  if (
    !request
    || typeof request !== "object"
  ) {
    throw new Error(
      "The Suffering transfer request is invalid.",
    );
  }
  if (typeof fromUuidFn !== "function") {
    throw new Error(
      "Foundry UUID resolution is unavailable.",
    );
  }
  if (typeof originalApplyDamage !== "function") {
    throw new Error(
      "Dragonbane applyDamage() is not patched "
      + "for Voidwalker Suffering.",
    );
  }

  const requester =
    users?.get?.(requesterUserId);
  if (!requester) {
    throw new Error(
      "The requesting User could not be found.",
    );
  }

  const [
    casterResolved,
    casterTokenResolved,
    voidwalkerTokenResolved,
  ] = await Promise.all([
    fromUuidFn(request.casterActorUuid),
    fromUuidFn(request.casterTokenUuid),
    fromUuidFn(request.voidwalkerTokenUuid),
  ]);

  const casterActor =
    casterResolved?.actor ?? casterResolved;
  const casterToken =
    casterTokenResolved?.document
    ?? casterTokenResolved;
  const voidwalkerToken =
    voidwalkerTokenResolved?.document
    ?? voidwalkerTokenResolved;

  if (casterActor?.documentName !== "Actor") {
    throw new Error(
      "The Suffering caster Actor could not be found.",
    );
  }

  const ownerLevel =
    globalThis.CONST
      ?.DOCUMENT_OWNERSHIP_LEVELS
      ?.OWNER
    ?? 3;

  if (
    !requester.isGM
    && !casterActor.testUserPermission?.(
      requester,
      ownerLevel,
    )
  ) {
    throw new Error(
      "The requesting User does not own "
      + "the Suffering caster.",
    );
  }

  validateSufferingTokenLink(
    casterActor,
    casterToken,
    voidwalkerToken,
    { calculateDistanceFn },
  );

  const split =
    splitVoidwalkerSufferingDamage(
      request.originalDamage,
    );
  const casterHpBefore =
    Number(request.casterHpBefore);
  const casterHpAfter =
    Number(request.casterHpAfter);
  const transferredDamage =
    Number(request.damage);

  if (
    !split
    || !Number.isFinite(casterHpBefore)
    || !Number.isFinite(casterHpAfter)
    || !Number.isFinite(transferredDamage)
  ) {
    throw new Error(
      "The Suffering damage values are invalid.",
    );
  }

  const expectedAfter = Math.max(
    0,
    casterHpBefore - split.warlockDamage,
  );
  const expectedTransferredDamage =
    casterHpBefore - expectedAfter;

  if (
    casterHpAfter !== expectedAfter
    || transferredDamage
      !== expectedTransferredDamage
    || transferredDamage <= 0
  ) {
    throw new Error(
      "The Suffering transfer does not match "
      + "the caster's actual HP loss.",
    );
  }

  const result =
    await originalApplyDamage.apply(
      voidwalkerToken.actor,
      [transferredDamage],
    );

  return {
    voidwalkerActorUuid:
      voidwalkerToken.actor.uuid,
    voidwalkerHp: result,
  };
}

function handleTransferResult(payload) {
  if (
    payload?.requesterUserId
      !== globalThis.game?.user?.id
  ) {
    return;
  }

  const pending =
    pendingRequests.get(payload.requestId);
  if (!pending) return;

  clearTimeout(pending.timeoutId);
  pendingRequests.delete(payload.requestId);

  if (payload.success) {
    pending.resolve(payload.result);
  } else {
    pending.reject(
      new Error(
        payload.error
        || "The GM could not apply "
        + "Voidwalker Suffering damage.",
      ),
    );
  }
}

async function handleTransferRequest(payload) {
  if (
    !isPrimaryActiveGM()
    || payload?.gmUserId
      !== globalThis.game?.user?.id
  ) {
    return;
  }

  try {
    const result =
      await executeVoidwalkerSufferingTransfer(
        payload.request,
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
      `${MODULE_ID} | Voidwalker Suffering `
      + "transfer request failed.",
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
    void handleTransferRequest(payload);
  } else if (payload.type === RESULT_TYPE) {
    handleTransferResult(payload);
  }
}

export function registerVoidwalkerSufferingSocket() {
  if (socketRegistered) return false;

  const socket = globalThis.game?.socket;
  if (typeof socket?.on !== "function") {
    return false;
  }

  socket.on(SOCKET_NAME, onSocketMessage);
  socketRegistered = true;
  return true;
}

export function requestVoidwalkerSufferingTransfer(
  request,
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
  if (isPrimaryGM) {
    return executeVoidwalkerSufferingTransfer(
      request,
      user?.id,
    );
  }

  if (!activeGM) {
    return Promise.reject(
      new Error(
        "An active GM is required for "
        + "Voidwalker Suffering.",
      ),
    );
  }
  if (
    typeof socket?.emit !== "function"
    || typeof randomID !== "function"
  ) {
    return Promise.reject(
      new Error(
        "The Voidwalker Suffering socket "
        + "is unavailable.",
      ),
    );
  }

  const requestId = randomID();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(
        new Error(
          "The Voidwalker Suffering "
          + "request timed out.",
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
        request,
      },
    );
  });
}

async function transferDamageThroughAuthority({
  casterActor,
  casterToken,
  voidwalkerToken,
  damage,
  originalDamage,
  casterHpBefore,
  casterHpAfter,
  originalApplyDamage,
}) {
  const game = globalThis.game;

  if (
    !game?.user
    || typeof game?.socket?.emit !== "function"
    || game.user.isGM
  ) {
    return applyTransferredDamageDirectly({
      voidwalkerToken,
      damage,
      originalApplyDamage,
    });
  }

  return requestVoidwalkerSufferingTransfer({
    casterActorUuid: casterActor.uuid,
    casterTokenUuid: casterToken.uuid,
    voidwalkerTokenUuid: voidwalkerToken.uuid,
    originalDamage,
    damage,
    casterHpBefore,
    casterHpAfter,
  });
}

export async function createVoidwalkerSufferingMessage({
  casterActor,
  originalDamage,
  warlockDamage,
  voidwalkerDamage,
  voidwalkerToken,
  chatMessageClass =
    globalThis.ChatMessage,
  i18n = globalThis.game?.i18n,
  user = globalThis.game?.user,
} = {}) {
  if (
    typeof chatMessageClass?.create !== "function"
    || !casterActor
    || !voidwalkerToken?.actor
  ) {
    return null;
  }

  const content = i18n?.format?.(
    "BOA.chat.voidwalkerSuffering",
    {
      caster:
        casterActor.name ?? casterActor.uuid,
      voidwalker:
        voidwalkerToken.actor.name
        ?? voidwalkerToken.actor.uuid,
      originalDamage,
      damage: warlockDamage,
    },
  ) ?? (
    `${casterActor.name ?? "The caster"} `
    + `shares ${originalDamage} damage through `
    + `Suffering: both creatures lose `
    + `${warlockDamage} HP.`
  );

  return chatMessageClass.create({
    user: user?.id,
    speaker:
      chatMessageClass.getSpeaker?.({
        actor: casterActor,
      }),
    content,
    flags: {
      [MODULE_ID]: {
        voidwalkerSuffering: {
          schemaVersion: 1,
          casterActorUuid: casterActor.uuid,
          voidwalkerTokenUuid:
            voidwalkerToken.uuid,
          originalDamage,
          warlockDamage,
          voidwalkerDamage,
        },
      },
    },
  });
}

export function patchVoidwalkerSuffering({
  actorClass =
    globalThis.CONFIG?.Actor?.documentClass,
  resolveSufferingFn =
    resolveVoidwalkerSuffering,
  createMessageFn =
    createVoidwalkerSufferingMessage,
  transferDamageFn,
  useAuthority = false,
} = {}) {
  const prototype = actorClass?.prototype;
  const original =
    prototype?.applyDamage;

  if (typeof original !== "function") {
    return {
      applyDamage: "missing",
    };
  }
  if (original[PATCH_MARKER]) {
    return {
      applyDamage: "already-patched",
    };
  }

  const applyTransfer =
    transferDamageFn
    ?? (
      useAuthority
        ? transferDamageThroughAuthority
        : applyTransferredDamageDirectly
    );

  const wrapped = async function (
    damage,
    ...args
  ) {
    let plan;

    try {
      plan = await resolveSufferingFn(
        this,
        damage,
      );
    } catch (error) {
      console.error(
        `${MODULE_ID} | Could not resolve `
        + "Voidwalker Suffering.",
        error,
      );
      return original.apply(
        this,
        [damage, ...args],
      );
    }

    if (!plan) {
      return original.apply(
        this,
        [damage, ...args],
      );
    }

    const casterHpBefore = Number(
      this.system?.hitPoints?.value,
    );

    const result = await original.apply(
      this,
      [
        plan.warlockDamage,
        ...args,
      ],
    );

    const casterHpAfter = Number(
      this.system?.hitPoints?.value,
    );
    const actualHpLoss =
      Number.isFinite(casterHpBefore)
      && Number.isFinite(casterHpAfter)
        ? Math.max(
            0,
            casterHpBefore - casterHpAfter,
          )
        : plan.warlockDamage;

    if (actualHpLoss <= 0) {
      return result;
    }

    const casterToken =
      findCasterTokenInScene(
        this,
        plan.voidwalkerToken,
      );

    if (useAuthority && !casterToken) {
      throw new Error(
        "The Suffering caster Token "
        + "could not be resolved.",
      );
    }

    await applyTransfer({
      casterActor: this,
      casterToken,
      voidwalkerToken:
        plan.voidwalkerToken,
      damage: actualHpLoss,
      originalDamage: Number(damage),
      casterHpBefore,
      casterHpAfter,
      originalApplyDamage: original,
    });

    try {
      await createMessageFn({
        casterActor: this,
        originalDamage: Number(damage),
        warlockDamage: actualHpLoss,
        voidwalkerDamage: actualHpLoss,
        voidwalkerToken:
          plan.voidwalkerToken,
      });
    } catch (error) {
      console.error(
        `${MODULE_ID} | Voidwalker Suffering `
        + "damage was applied, but its chat "
        + "message could not be created.",
        error,
      );
    }

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
      },
      writable: false,
    },
  );

  prototype.applyDamage = wrapped;

  return {
    applyDamage: "patched",
  };
}
