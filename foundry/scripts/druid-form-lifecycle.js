import {
  MODULE_ID,
} from "./core/constants.js";
import {
  applyDruidFormArtwork,
  getDruidFormState,
  restoreDruidHumanoidArtwork,
} from "./druid-forms.js";

const STATE_FLAG =
  "druidFormState";
const SETTING_KEY =
  "druidFormsAutomation";
const SOCKET_NAME =
  `module.${MODULE_ID}`;
const REQUEST_TYPE =
  "druid-form-lifecycle-request";
const RESULT_TYPE =
  "druid-form-lifecycle-result";
const REQUEST_TIMEOUT_MS =
  10000;
const SUMMON_REST_PATCH_MARKER =
  Symbol.for(
    `${MODULE_ID}.summonDurationLifecycle`,
  );
const REST_PATCH_MARKER =
  Symbol.for(
    `${MODULE_ID}.druidFormLifecycle.rest`,
  );

const INCARNATIONS =
  Object.freeze({
    "spells.savage-incarnation":
      Object.freeze({
        key: "savage",
        duration: "shift",
        forms: Object.freeze([
          "travel",
        ]),
        initialForm: "travel",
      }),
    "spells.feral-incarnation":
      Object.freeze({
        key: "feral",
        duration: "stretch",
        forms: Object.freeze([
          "bear",
          "cat",
        ]),
        initialForm: null,
      }),
    "spells.incarnation-of-harmony":
      Object.freeze({
        key: "harmony",
        duration: "stretch",
        forms: Object.freeze([
          "tree",
        ]),
        initialForm: "tree",
      }),
    "spells.incarnation-of-the-stars":
      Object.freeze({
        key: "stars",
        duration: "stretch",
        forms: Object.freeze([
          "moonkin",
        ]),
        initialForm: "moonkin",
      }),
  });

const FORM_LABELS =
  Object.freeze({
    humanoid: "Humanoid Form",
    travel: "Travel Form",
    bear: "Bear Form",
    cat: "Cat Form",
    tree: "Tree Form",
    moonkin: "Moonkin Form",
  });

const pendingRequests =
  new Map();
let socketRegistered =
  false;

function cloneDefinition(
  definition,
) {
  return {
    ...definition,
    forms: [
      ...definition.forms,
    ],
  };
}

export function getDruidIncarnationDefinitions() {
  return Object.fromEntries(
    Object.entries(
      INCARNATIONS,
    ).map(
      ([contentKey, definition]) => [
        contentKey,
        cloneDefinition(
          definition,
        ),
      ],
    ),
  );
}

function itemContentKey(
  item,
) {
  return (
    item?.getFlag?.(
      MODULE_ID,
      "contentKey",
    ) ??
    item?.flags?.[
      MODULE_ID
    ]?.contentKey ??
    null
  );
}

function actorOwnsContentKey(
  actor,
  contentKey,
) {
  return Array.from(
    actor?.items ?? [],
  ).some(
    item =>
      itemContentKey(
        item,
      ) === contentKey,
  );
}

function lifecycleEnabled(
  settings =
    globalThis.game?.settings,
) {
  if (!settings?.get) {
    return true;
  }

  try {
    return settings.get(
      MODULE_ID,
      SETTING_KEY,
    ) !== false;
  } catch (_error) {
    return true;
  }
}

export function isDruidFormsAutomationEnabled(
  settings =
    globalThis.game?.settings,
) {
  return lifecycleEnabled(
    settings,
  );
}

function normalizePowerLevel(
  value,
) {
  const level =
    Number(
      value,
    );

  if (
    !Number.isInteger(
      level,
    ) ||
    level < 1 ||
    level > 3
  ) {
    throw new Error(
      "Druid incarnation power level must be 1, 2, or 3.",
    );
  }

  return level;
}

function cloneState(
  actor,
) {
  const state =
    getDruidFormState(
      actor,
    );

  return {
    currentForm:
      state.currentForm,
    activations:
      structuredClone(
        state.activations ?? {},
      ),
  };
}

function travelProfileKey(
  state,
) {
  const level =
    Number(
      state?.activations
        ?.savage
        ?.powerLevel,
    );

  if (
    level >= 1 &&
    level <= 3
  ) {
    return `travelPl${level}`;
  }

  return null;
}

function profileKeyForForm(
  state,
  form,
) {
  if (form === "travel") {
    return travelProfileKey(
      state,
    );
  }

  return {
    bear: "bear",
    cat: "cat",
    tree: "tree",
    moonkin: "moonkin",
  }[form] ?? null;
}

function availableFormsFromState(
  state,
) {
  const forms = [
    "humanoid",
  ];
  const activations =
    state?.activations ?? {};

  if (
    activations.savage
      ?.active === true
  ) {
    forms.push(
      "travel",
    );
  }

  if (
    activations.feral
      ?.active === true
  ) {
    forms.push(
      "bear",
      "cat",
    );
  }

  if (
    activations.harmony
      ?.active === true
  ) {
    forms.push(
      "tree",
    );
  }

  if (
    activations.stars
      ?.active === true
  ) {
    forms.push(
      "moonkin",
    );
  }

  return forms;
}

export function getDruidFormSwitchOptions(
  actor,
) {
  const state =
    cloneState(
      actor,
    );

  return availableFormsFromState(
    state,
  ).map(
    form => ({
      form,
      label:
        FORM_LABELS[
          form
        ] ?? form,
      profileKey:
        profileKeyForForm(
          state,
          form,
        ),
      current:
        state.currentForm ===
          form,
    }),
  );
}

function currentWillpower(
  actor,
) {
  const value =
    Number(
      actor?.system
        ?.willPoints
        ?.value,
    );

  return Number.isFinite(
    value,
  )
    ? value
    : 0;
}

async function persistState(
  actor,
  state,
  {
    willpower = null,
  } = {},
) {
  if (!actor) {
    throw new Error(
      "A Druid Actor is required.",
    );
  }

  const nextState =
    structuredClone(
      state,
    );

  // Foundry recursively merges object-valued updates. Missing activation
  // keys would therefore survive a rest. Replace the whole flag explicitly.
  if (
    typeof actor.unsetFlag === "function" &&
    typeof actor.setFlag === "function"
  ) {
    await actor.unsetFlag(
      MODULE_ID,
      STATE_FLAG,
    );
    await actor.setFlag(
      MODULE_ID,
      STATE_FLAG,
      nextState,
    );
  } else {
    actor.flags ??= {};
    actor.flags[MODULE_ID] ??= {};
    actor.flags[MODULE_ID][STATE_FLAG] =
      nextState;
  }

  if (willpower !== null) {
    if (typeof actor.update === "function") {
      await actor.update({
        "system.willPoints.value":
          willpower,
      });
    } else {
      actor.system ??= {};
      actor.system.willPoints ??= {};
      actor.system.willPoints.value =
        willpower;
    }
  }

  return true;
}

async function syncArtwork(
  actor,
  state,
  {
    applyArtwork =
      applyDruidFormArtwork,
    restoreArtwork =
      restoreDruidHumanoidArtwork,
  } = {},
) {
  try {
    if (
      state.currentForm ===
        "humanoid"
    ) {
      await restoreArtwork(
        actor,
        {
          bypassAuthority:
            true,
        },
      );
      return true;
    }

    const profileKey =
      profileKeyForForm(
        state,
        state.currentForm,
      );

    if (!profileKey) {
      return false;
    }

    await applyArtwork(
      actor,
      profileKey,
      {
        bypassAuthority:
          true,
      },
    );
    return true;
  } catch (error) {
    console.error(
      `${MODULE_ID} | Druid form state changed, but artwork synchronization failed.`,
      error,
    );
    return false;
  }
}

function activationFor(
  definition,
  powerLevel,
) {
  return {
    active: true,
    powerLevel,
    duration:
      definition.duration,
  };
}

async function activateNow(
  actor,
  spellContentKey,
  powerLevel,
  {
    initialForm = null,
    settings =
      globalThis.game?.settings,
    applyArtwork =
      applyDruidFormArtwork,
    restoreArtwork =
      restoreDruidHumanoidArtwork,
  } = {},
) {
  if (
    !lifecycleEnabled(
      settings,
    )
  ) {
    return false;
  }

  const definition =
    INCARNATIONS[
      spellContentKey
    ];

  if (!definition) {
    throw new Error(
      `Unknown Druid incarnation spell: ${String(spellContentKey)}`,
    );
  }

  if (
    !actorOwnsContentKey(
      actor,
      spellContentKey,
    )
  ) {
    throw new Error(
      "The Druid Actor does not own the incarnation spell.",
    );
  }

  const level =
    normalizePowerLevel(
      powerLevel,
    );

  let targetForm =
    initialForm ??
    definition.initialForm;

  if (
    definition.key ===
      "feral"
  ) {
    if (
      !definition.forms.includes(
        targetForm,
      )
    ) {
      throw new Error(
        "Feral Incarnation activation requires Bear or Cat as the initial form.",
      );
    }
  } else {
    targetForm =
      definition.initialForm;
  }

  const state =
    cloneState(
      actor,
    );

  state.activations[
    definition.key
  ] = activationFor(
    definition,
    level,
  );
  state.currentForm =
    targetForm;

  await persistState(
    actor,
    state,
  );
  await syncArtwork(
    actor,
    state,
    {
      applyArtwork,
      restoreArtwork,
    },
  );

  return {
    ok: true,
    action: "activate",
    actorId:
      actor.id ?? null,
    contentKey:
      spellContentKey,
    currentForm:
      state.currentForm,
    state,
    wpCost: 0,
  };
}

async function switchNow(
  actor,
  targetForm,
  {
    mode = "action",
    settings =
      globalThis.game?.settings,
    applyArtwork =
      applyDruidFormArtwork,
    restoreArtwork =
      restoreDruidHumanoidArtwork,
  } = {},
) {
  if (
    !lifecycleEnabled(
      settings,
    )
  ) {
    return false;
  }

  if (
    mode !== "action" &&
    mode !== "free"
  ) {
    throw new Error(
      `Unknown Druid form-switch mode: ${String(mode)}`,
    );
  }

  const state =
    cloneState(
      actor,
    );
  const available =
    availableFormsFromState(
      state,
    );

  if (
    !available.includes(
      targetForm,
    )
  ) {
    throw new Error(
      `Druid form ${String(targetForm)} is not currently available.`,
    );
  }

  if (
    state.currentForm ===
      targetForm
  ) {
    return {
      ok: true,
      action: "switch",
      actorId:
        actor.id ?? null,
      currentForm:
        targetForm,
      state,
      wpCost: 0,
      changed: false,
    };
  }

  const wpCost =
    mode === "free"
      ? 1
      : 0;
  const beforeWp =
    currentWillpower(
      actor,
    );

  if (
    beforeWp < wpCost
  ) {
    throw new Error(
      "The Druid does not have enough Willpower Points for a free-action form change.",
    );
  }

  state.currentForm =
    targetForm;

  await persistState(
    actor,
    state,
    {
      willpower:
        wpCost > 0
          ? beforeWp - wpCost
          : null,
    },
  );
  await syncArtwork(
    actor,
    state,
    {
      applyArtwork,
      restoreArtwork,
    },
  );

  return {
    ok: true,
    action: "switch",
    actorId:
      actor.id ?? null,
    currentForm:
      targetForm,
    state,
    wpCost,
    changed: true,
  };
}

function expiresOnRest(
  duration,
  restType,
) {
  if (
    restType !== "stretch" &&
    restType !== "shift"
  ) {
    throw new Error(
      `Unknown Druid rest type: ${String(restType)}`,
    );
  }

  if (
    duration === "stretch"
  ) {
    return true;
  }

  return (
    duration === "shift" &&
    restType === "shift"
  );
}

async function expireNow(
  actor,
  restType,
  {
    settings =
      globalThis.game?.settings,
    applyArtwork =
      applyDruidFormArtwork,
    restoreArtwork =
      restoreDruidHumanoidArtwork,
  } = {},
) {
  if (
    !lifecycleEnabled(
      settings,
    )
  ) {
    return false;
  }

  const state =
    cloneState(
      actor,
    );
  const before =
    JSON.stringify(
      state.activations,
    );

  for (
    const [key, activation]
    of Object.entries(
      state.activations,
    )
  ) {
    if (
      expiresOnRest(
        activation?.duration,
        restType,
      )
    ) {
      delete state.activations[
        key
      ];
    }
  }

  const available =
    availableFormsFromState(
      state,
    );

  if (
    !available.includes(
      state.currentForm,
    )
  ) {
    state.currentForm =
      "humanoid";
  }

  const changed =
    before !==
      JSON.stringify(
        state.activations,
      ) ||
    state.currentForm !==
      getDruidFormState(
        actor,
      ).currentForm;

  if (!changed) {
    return {
      ok: true,
      action: "expire",
      actorId:
        actor.id ?? null,
      currentForm:
        state.currentForm,
      state,
      changed: false,
    };
  }

  await persistState(
    actor,
    state,
  );
  await syncArtwork(
    actor,
    state,
    {
      applyArtwork,
      restoreArtwork,
    },
  );

  return {
    ok: true,
    action: "expire",
    actorId:
      actor.id ?? null,
    currentForm:
      state.currentForm,
    state,
    changed: true,
  };
}

function primaryActiveGM(
  users =
    globalThis.game?.users,
) {
  return Array.from(
    users ?? [],
  ).find(
    user =>
      user?.active === true &&
      user?.isGM === true,
  ) ?? null;
}

function canManageActor(
  actor,
  user,
  ownerLevel =
    globalThis.CONST
      ?.DOCUMENT_OWNERSHIP_LEVELS
      ?.OWNER ?? 3,
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

  if (
    user.id ===
      globalThis.game?.user?.id &&
    actor.isOwner === true
  ) {
    return true;
  }

  return actor.testUserPermission?.(
    user,
    ownerLevel,
  ) === true;
}

function currentUserNeedsGM(
  actor,
) {
  const user =
    globalThis.game?.user;

  if (!user) {
    return false;
  }

  if (
    user.isGM === true
  ) {
    const gm =
      primaryActiveGM();
    return Boolean(
      gm &&
      gm.id !== user.id,
    );
  }

  return true;
}

function requestLifecycleAction(
  actor,
  action,
  data = {},
) {
  const user =
    globalThis.game?.user;

  if (!user) {
    return Promise.reject(
      new Error(
        "A User is required for Druid form lifecycle authority.",
      ),
    );
  }

  if (
    !canManageActor(
      actor,
      user,
    )
  ) {
    return Promise.reject(
      new Error(
        "You do not own this Druid Actor.",
      ),
    );
  }

  const gm =
    primaryActiveGM();

  if (!gm) {
    return Promise.reject(
      new Error(
        "An active GM is required for Druid form lifecycle automation.",
      ),
    );
  }

  const socket =
    globalThis.game?.socket;
  const randomID =
    globalThis.foundry?.utils
      ?.randomID;

  if (
    typeof socket?.emit !==
      "function"
  ) {
    return Promise.reject(
      new Error(
        "The Druid form lifecycle socket is unavailable.",
      ),
    );
  }

  const requestId =
    typeof randomID ===
      "function"
      ? randomID()
      : `${Date.now()}-${Math.random()}`;

  return new Promise(
    (resolve, reject) => {
      const timeoutId =
        setTimeout(
          () => {
            pendingRequests.delete(
              requestId,
            );
            reject(
              new Error(
                "The Druid form lifecycle request timed out.",
              ),
            );
          },
          REQUEST_TIMEOUT_MS,
        );

      pendingRequests.set(
        requestId,
        {
          resolve,
          reject,
          timeoutId,
        },
      );

      socket.emit(
        SOCKET_NAME,
        {
          type:
            REQUEST_TYPE,
          requestId,
          requesterUserId:
            user.id,
          gmUserId:
            gm.id,
          actorId:
            actor.id,
          action,
          ...data,
        },
      );
    },
  );
}

export function activateDruidIncarnation(
  actor,
  spellContentKey,
  powerLevel,
  options = {},
) {
  if (
    options.bypassAuthority ===
      true ||
    !currentUserNeedsGM(
      actor,
    )
  ) {
    return activateNow(
      actor,
      spellContentKey,
      powerLevel,
      options,
    );
  }

  return requestLifecycleAction(
    actor,
    "activate",
    {
      spellContentKey,
      powerLevel,
      initialForm:
        options.initialForm ??
        null,
    },
  );
}

export function switchDruidForm(
  actor,
  targetForm,
  options = {},
) {
  if (
    options.bypassAuthority ===
      true ||
    !currentUserNeedsGM(
      actor,
    )
  ) {
    return switchNow(
      actor,
      targetForm,
      options,
    );
  }

  return requestLifecycleAction(
    actor,
    "switch",
    {
      targetForm,
      mode:
        options.mode ??
        "action",
    },
  );
}

export function expireDruidIncarnationsForRest(
  actor,
  restType,
  options = {},
) {
  if (
    options.bypassAuthority ===
      true ||
    !currentUserNeedsGM(
      actor,
    )
  ) {
    return expireNow(
      actor,
      restType,
      options,
    );
  }

  return requestLifecycleAction(
    actor,
    "expire",
    {
      restType,
    },
  );
}

function collectionGet(
  collection,
  id,
) {
  return (
    collection?.get?.(
      id,
    ) ??
    Array.from(
      collection ?? [],
    ).find(
      value =>
        value?.id === id,
    ) ??
    null
  );
}

export async function executeDruidFormLifecycleRequest(
  payload,
  {
    users =
      globalThis.game?.users,
    actors =
      globalThis.game?.actors,
    activate =
      activateDruidIncarnation,
    switchForm =
      switchDruidForm,
    expire =
      expireDruidIncarnationsForRest,
    ownerLevel =
      globalThis.CONST
        ?.DOCUMENT_OWNERSHIP_LEVELS
        ?.OWNER ?? 3,
  } = {},
) {
  const requester =
    collectionGet(
      users,
      payload?.requesterUserId,
    );

  if (
    !requester ||
    requester.active !== true
  ) {
    throw new Error(
      "The requesting User is not active.",
    );
  }

  const actor =
    collectionGet(
      actors,
      payload?.actorId,
    );

  if (!actor) {
    throw new Error(
      "The requested Druid Actor does not exist.",
    );
  }

  if (
    !canManageActor(
      actor,
      requester,
      ownerLevel,
    )
  ) {
    throw new Error(
      "The requesting User does not own the Druid Actor.",
    );
  }

  if (
    payload?.action ===
      "activate"
  ) {
    return activate(
      actor,
      payload.spellContentKey,
      payload.powerLevel,
      {
        initialForm:
          payload.initialForm ??
          null,
        bypassAuthority:
          true,
      },
    );
  }

  if (
    payload?.action ===
      "switch"
  ) {
    return switchForm(
      actor,
      payload.targetForm,
      {
        mode:
          payload.mode ??
          "action",
        bypassAuthority:
          true,
      },
    );
  }

  if (
    payload?.action ===
      "expire"
  ) {
    return expire(
      actor,
      payload.restType,
      {
        bypassAuthority:
          true,
      },
    );
  }

  throw new Error(
    `Unknown Druid lifecycle action: ${String(payload?.action)}`,
  );
}

function handleResult(
  payload,
) {
  if (
    payload?.requesterUserId !==
      globalThis.game?.user?.id
  ) {
    return;
  }

  const pending =
    pendingRequests.get(
      payload.requestId,
    );

  if (!pending) {
    return;
  }

  clearTimeout(
    pending.timeoutId,
  );
  pendingRequests.delete(
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
        payload.error ??
        "The GM could not update Druid form state.",
      ),
    );
  }
}

async function handleRequest(
  payload,
) {
  const user =
    globalThis.game?.user;
  const gm =
    primaryActiveGM();

  if (
    user?.isGM !== true ||
    gm?.id !== user.id ||
    payload?.gmUserId !==
      user.id
  ) {
    return;
  }

  try {
    const result =
      await executeDruidFormLifecycleRequest(
        payload,
      );

    globalThis.game?.socket
      ?.emit?.(
        SOCKET_NAME,
        {
          type:
            RESULT_TYPE,
          requestId:
            payload.requestId,
          requesterUserId:
            payload.requesterUserId,
          success: true,
          result,
        },
      );
  } catch (error) {
    console.error(
      `${MODULE_ID} | Druid form lifecycle request failed.`,
      error,
    );
    globalThis.game?.socket
      ?.emit?.(
        SOCKET_NAME,
        {
          type:
            RESULT_TYPE,
          requestId:
            payload.requestId,
          requesterUserId:
            payload.requesterUserId,
          success: false,
          error:
            error.message,
        },
      );
  }
}

function onSocketMessage(
  payload,
) {
  if (
    payload?.type ===
      REQUEST_TYPE
  ) {
    void handleRequest(
      payload,
    );
  } else if (
    payload?.type ===
      RESULT_TYPE
  ) {
    handleResult(
      payload,
    );
  }
}

export function registerDruidFormLifecycleSocket() {
  if (socketRegistered) {
    return false;
  }

  const socket =
    globalThis.game?.socket;

  if (
    typeof socket?.on !==
      "function"
  ) {
    return false;
  }

  socket.on(
    SOCKET_NAME,
    onSocketMessage,
  );
  socketRegistered =
    true;
  return true;
}

function messageAuthorId(
  message,
) {
  return (
    message?.author?.id ??
    message?.user?.id ??
    message?.user ??
    null
  );
}

async function resolveSpellMessageDocuments(
  message,
  {
    fromUuidFn =
      globalThis.fromUuid,
  } = {},
) {
  const spellUuid =
    message?.system?.spellUuid;
  const actorUuid =
    message?.system?.actorUuid;

  const spell =
    spellUuid &&
    typeof fromUuidFn ===
      "function"
      ? await fromUuidFn(
          spellUuid,
        )
      : null;

  let actor =
    actorUuid &&
    typeof fromUuidFn ===
      "function"
      ? await fromUuidFn(
          actorUuid,
        )
      : null;

  actor =
    actor?.actor ??
    actor;

  if (!actor) {
    const speakerActorId =
      message?.speaker?.actor;
    actor =
      collectionGet(
        globalThis.game?.actors,
        speakerActorId,
      );
  }

  return {
    spell,
    actor,
  };
}

async function chooseFeralInitialForm() {
  const DialogV2 =
    globalThis.foundry
      ?.applications?.api
      ?.DialogV2;

  if (
    typeof DialogV2?.wait !==
      "function"
  ) {
    return null;
  }

  return DialogV2.wait({
    window: {
      title:
        "Feral Incarnation",
    },
    content:
      "<p>Choose the form you assume when Feral Incarnation activates.</p>",
    buttons: [
      {
        action: "bear",
        label: "Bear Form",
        callback: () =>
          "bear",
      },
      {
        action: "cat",
        label: "Cat Form",
        callback: () =>
          "cat",
      },
      {
        action: "cancel",
        label: "Cancel",
        callback: () =>
          null,
      },
    ],
    close: () => null,
  });
}

export async function onCreateDruidFormSpellMessage(
  message,
) {
  if (
    !lifecycleEnabled()
  ) {
    return false;
  }

  const isSpellTest =
    message?.type ===
      "spellTest" ||
    message?.system?.type ===
      "spellTest";

  if (
    !isSpellTest ||
    message?.system?.success !==
      true
  ) {
    return false;
  }

  const authorId =
    messageAuthorId(
      message,
    );

  if (
    authorId &&
    authorId !==
      globalThis.game?.user?.id
  ) {
    return false;
  }

  const {
    spell,
    actor,
  } =
    await resolveSpellMessageDocuments(
      message,
    );
  const contentKey =
    itemContentKey(
      spell,
    );
  const definition =
    INCARNATIONS[
      contentKey
    ];

  if (
    !definition ||
    !actor
  ) {
    return false;
  }

  let initialForm =
    definition.initialForm;

  if (
    definition.key ===
      "feral"
  ) {
    initialForm =
      await chooseFeralInitialForm();

    if (!initialForm) {
      globalThis.ui?.notifications
        ?.warn?.(
          "Feral Incarnation was cast, but no initial form was selected; automatic form activation was skipped.",
        );
      return false;
    }
  }

  return activateDruidIncarnation(
    actor,
    contentKey,
    message?.system
      ?.powerLevel ?? 1,
    {
      initialForm,
    },
  );
}

function formValue(
  form,
  name,
) {
  const value =
    form?.elements
      ?.namedItem?.(
        name,
      )?.value;

  return (
    typeof value ===
      "string"
      ? value
      : ""
  );
}

export async function openDruidFormSwitchDialog(
  actor,
) {
  if (
    !lifecycleEnabled() ||
    !canManageActor(
      actor,
      globalThis.game?.user,
    )
  ) {
    return false;
  }

  const options =
    getDruidFormSwitchOptions(
      actor,
    );
  const targets =
    options.filter(
      option =>
        option.current !== true,
    );

  if (
    targets.length === 0
  ) {
    globalThis.ui?.notifications
      ?.info?.(
        "No alternate Druid form is currently active.",
      );
    return false;
  }

  const DialogV2 =
    globalThis.foundry
      ?.applications?.api
      ?.DialogV2;

  if (
    typeof DialogV2?.wait !==
      "function"
  ) {
    return false;
  }

  const form =
    await DialogV2.wait({
      window: {
        title:
          "Change Druid Form",
      },
      content:
        `<form class="boa-druid-form-switch-dialog">`
        + `<div class="form-group"><label>Form</label>`
        + `<select name="targetForm">`
        + targets.map(
          option =>
            `<option value="${option.form}">${option.label}</option>`,
        ).join("")
        + `</select></div>`
        + `<div class="form-group"><label>Change as</label>`
        + `<select name="mode">`
        + `<option value="action">Action (0 WP)</option>`
        + `<option value="free">Free Action (1 WP)</option>`
        + `</select></div>`
        + `</form>`,
      buttons: [
        {
          action: "change",
          label: "Change Form",
          default: true,
          callback:
            (_event, button) =>
              button?.form ??
              null,
        },
        {
          action: "cancel",
          label: "Cancel",
        },
      ],
      close: () => null,
    });

  if (!form) {
    return false;
  }

  return switchDruidForm(
    actor,
    formValue(
      form,
      "targetForm",
    ),
    {
      mode:
        formValue(
          form,
          "mode",
        ) || "action",
    },
  );
}

function sheetRoot(
  html,
) {
  const HTMLElementClass =
    globalThis.HTMLElement;

  if (
    HTMLElementClass &&
    html instanceof HTMLElementClass
  ) {
    return html;
  }

  if (
    HTMLElementClass &&
    html?.[0] instanceof HTMLElementClass
  ) {
    return html[0];
  }

  return (
    html?.element ??
    html ??
    null
  );
}
function sheetActor(
  app,
) {
  return (
    app?.actor ??
    app?.document ??
    app?.object ??
    null
  );
}

export function onRenderDruidFormLifecycleActorSheet(
  app,
  html,
) {
  const actor =
    app?.actor ??
    app?.document ??
    null;
  const root =
    sheetRoot(
      html,
    );

  if (
    !actor ||
    actor.type !== "character" ||
    !root?.querySelector ||
    !canManageActor(
      actor,
      globalThis.game?.user,
    ) ||
    !lifecycleEnabled()
  ) {
    return false;
  }

  const ownsIncarnation =
    Object.keys(
      INCARNATIONS,
    ).some(
      contentKey =>
        actorOwnsContentKey(
          actor,
          contentKey,
        ),
    );

  if (!ownsIncarnation) {
    return false;
  }

  /*
   * Remove only our own old UI. Never remove the shared Druid control row.
   * This also cleans up the separate lifecycle row from earlier 0.11.7 builds.
   */
  root
    .querySelector(
      ".boa-druid-form-lifecycle-controls",
    )
    ?.remove?.();

  root
    .querySelector(
      ".boa-druid-form-switch-button",
    )
    ?.remove?.();

  const tabs =
    root.querySelector(
      ".sheet-tabs, nav.tabs, "
      + '[data-group="primary"].tabs, '
      + '[data-application-part="tabs"]',
    );

  if (
    !tabs
      ?.parentElement
      ?.insertBefore
  ) {
    return false;
  }

  let controls =
    root.querySelector(
      ".boa-druid-form-artwork-controls",
    );

  if (!controls) {
    controls =
      globalThis.document
        ?.createElement?.(
          "div",
        );

    if (controls) {
      controls.classList.add(
        "boa-druid-form-artwork-controls",
      );

      tabs.parentElement
        .insertBefore(
          controls,
          tabs,
        );
    }
  }

  const button =
    globalThis.document
      ?.createElement?.(
        "button",
      );

  if (
    !controls ||
    !button
  ) {
    return false;
  }

  button.type =
    "button";
  button.classList.add(
    "boa-druid-form-switch-button",
  );
  button.innerHTML =
    '<i class="fa-solid fa-paw"></i> Change Form';
  button.title =
    "Change between currently active Druid forms.";

  button.addEventListener(
    "click",
    event => {
      event.preventDefault?.();
      event.stopPropagation?.();

      void openDruidFormSwitchDialog(
        actor,
      );
    },
  );

  if (
    typeof controls.append === "function"
  ) {
    controls.append(
      button,
    );
  } else {
    controls.appendChild?.(
      button,
    );
  }

  return true;
}
async function expireAfterRest(
  actor,
  restType,
) {
  try {
    await expireDruidIncarnationsForRest(
      actor,
      restType,
    );
  } catch (error) {
    console.error(
      `${MODULE_ID} | ${restType} rest completed, but Druid form expiration failed.`,
      error,
    );
    globalThis.ui?.notifications
      ?.error?.(
        "The rest completed, but Druid form automation could not be updated.",
      );
  }
}

function patchRestMethod(
  actorClass,
  methodName,
  restType,
) {
  const prototype =
    actorClass?.prototype;
  const original =
    prototype?.[
      methodName
    ];

  if (
    typeof original !==
      "function"
  ) {
    return "missing";
  }

  if (
    original[
      REST_PATCH_MARKER
    ]
  ) {
    return "already-patched";
  }

  const wrapped =
    async function (
      ...args
    ) {
      const result =
        await original.apply(
          this,
          args,
        );
      await expireAfterRest(
        this,
        restType,
      );
      return result;
    };

  const summonLifecycleMetadata =
    original[
      SUMMON_REST_PATCH_MARKER
    ];

  if (summonLifecycleMetadata) {
    Object.defineProperty(
      wrapped,
      SUMMON_REST_PATCH_MARKER,
      {
        configurable: false,
        enumerable: false,
        value:
          summonLifecycleMetadata,
        writable: false,
      },
    );
  }

  Object.defineProperty(
    wrapped,
    REST_PATCH_MARKER,
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

  prototype[
    methodName
  ] = wrapped;
  return "patched";
}

export function patchDruidFormRestLifecycle({
  actorClass =
    globalThis.CONFIG?.Actor
      ?.documentClass,
} = {}) {
  return {
    restStretch:
      patchRestMethod(
        actorClass,
        "restStretch",
        "stretch",
      ),
    restShift:
      patchRestMethod(
        actorClass,
        "restShift",
        "shift",
      ),
  };
}
