import {
  MODULE_ID,
} from "./core/constants.js";

const ARTWORK_FLAG =
  "druidFormArtwork";
const STATE_FLAG =
  "druidFormState";

const FALLBACK_ARTWORK =
  "modules/bane-of-azeroth/assets/icons/classes/druid.webp";

const PROFILE_DEFINITIONS =
  Object.freeze([
    Object.freeze({
      key: "travelPl1",
      spellContentKey:
        "spells.savage-incarnation",
      powerLevel: 1,
      form: "travel",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "travelPl2",
      spellContentKey:
        "spells.savage-incarnation",
      powerLevel: 2,
      form: "travel",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "travelPl3",
      spellContentKey:
        "spells.savage-incarnation",
      powerLevel: 3,
      form: "travel",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "bear",
      spellContentKey:
        "spells.feral-incarnation",
      powerLevel: null,
      form: "bear",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "cat",
      spellContentKey:
        "spells.feral-incarnation",
      powerLevel: null,
      form: "cat",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "tree",
      spellContentKey:
        "spells.incarnation-of-harmony",
      powerLevel: null,
      form: "tree",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
    Object.freeze({
      key: "moonkin",
      spellContentKey:
        "spells.incarnation-of-the-stars",
      powerLevel: null,
      form: "moonkin",
      defaultPortrait:
        FALLBACK_ARTWORK,
      defaultToken:
        FALLBACK_ARTWORK,
    }),
  ]);

function cloneProfile(
  profile,
) {
  return {
    ...profile,
  };
}

function profileDefinition(
  key,
) {
  return PROFILE_DEFINITIONS.find(
    profile =>
      profile.key === key,
  ) ?? null;
}

function itemContentKey(
  item,
) {
  if (!item) {
    return null;
  }

  if (
    typeof item.getFlag ===
      "function"
  ) {
    const value =
      item.getFlag(
        MODULE_ID,
        "contentKey",
      );

    if (
      typeof value ===
        "string" &&
      value.length > 0
    ) {
      return value;
    }
  }

  const value =
    item.flags?.[
      MODULE_ID
    ]?.contentKey;

  return (
    typeof value ===
      "string" &&
    value.length > 0
  )
    ? value
    : null;
}

function actorOwnsSpell(
  actor,
  spellContentKey,
) {
  return [
    ...(
      actor?.items ??
      []
    ),
  ].some(
    item =>
      itemContentKey(
        item,
      ) ===
        spellContentKey,
  );
}

function nonEmptyString(
  value,
) {
  return (
    typeof value ===
      "string" &&
    value.trim().length >
      0
  )
    ? value.trim()
    : null;
}

function artworkOverrides(
  actor,
) {
  const value =
    actor?.getFlag?.(
      MODULE_ID,
      ARTWORK_FLAG,
    ) ??
    actor?.flags?.[
      MODULE_ID
    ]?.[
      ARTWORK_FLAG
    ];

  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    return {};
  }

  return value;
}

async function persistArtwork(
  actor,
  overrides,
) {
  if (!actor) {
    return false;
  }

  if (
    Object.keys(
      overrides,
    ).length ===
      0 &&
    typeof actor.unsetFlag ===
      "function"
  ) {
    await actor.unsetFlag(
      MODULE_ID,
      ARTWORK_FLAG,
    );
    return true;
  }

  if (
    typeof actor.setFlag !==
      "function"
  ) {
    return false;
  }

  await actor.setFlag(
    MODULE_ID,
    ARTWORK_FLAG,
    overrides,
  );

  return true;
}

export function getDruidFormProfileDefinitions() {
  return PROFILE_DEFINITIONS.map(
    cloneProfile,
  );
}

export function getAvailableDruidFormProfiles(
  actor,
) {
  return PROFILE_DEFINITIONS
    .filter(
      profile =>
        actorOwnsSpell(
          actor,
          profile.spellContentKey,
        ),
    )
    .map(
      cloneProfile,
    );
}

export function getDruidFormArtwork(
  actor,
  profileKey,
) {
  const profile =
    profileDefinition(
      profileKey,
    );

  if (!profile) {
    return null;
  }

  const stored =
    artworkOverrides(
      actor,
    )?.[
      profileKey
    ] ?? {};

  const customPortrait =
    nonEmptyString(
      stored.portrait,
    );
  const customToken =
    nonEmptyString(
      stored.token,
    );

  const portrait =
    customPortrait ??
    profile.defaultPortrait;

  const token =
    customToken ??
    customPortrait ??
    profile.defaultToken ??
    portrait;

  return {
    key:
      profile.key,
    portrait,
    token,
    portraitIsCustom:
      Boolean(
        customPortrait,
      ),
    tokenIsCustom:
      Boolean(
        customToken,
      ),
  };
}

export async function setDruidFormArtwork(
  actor,
  profileKey,
  artwork = {},
) {
  const available =
    getAvailableDruidFormProfiles(
      actor,
    ).some(
      profile =>
        profile.key ===
          profileKey,
    );

  if (!available) {
    return false;
  }

  const overrides = {
    ...artworkOverrides(
      actor,
    ),
  };

  const current = {
    ...(
      overrides[
        profileKey
      ] ??
      {}
    ),
  };

  if (
    Object.hasOwn(
      artwork,
      "portrait",
    )
  ) {
    const portrait =
      nonEmptyString(
        artwork.portrait,
      );

    if (portrait) {
      current.portrait =
        portrait;
    } else {
      delete current.portrait;
    }
  }

  if (
    Object.hasOwn(
      artwork,
      "token",
    )
  ) {
    const token =
      nonEmptyString(
        artwork.token,
      );

    if (token) {
      current.token =
        token;
    } else {
      delete current.token;
    }
  }

  if (
    Object.keys(
      current,
    ).length ===
      0
  ) {
    delete overrides[
      profileKey
    ];
  } else {
    overrides[
      profileKey
    ] =
      current;
  }

  return persistArtwork(
    actor,
    overrides,
  );
}

export async function resetDruidFormArtwork(
  actor,
  profileKey,
) {
  if (
    !profileDefinition(
      profileKey,
    )
  ) {
    return false;
  }

  const overrides = {
    ...artworkOverrides(
      actor,
    ),
  };

  delete overrides[
    profileKey
  ];

  return persistArtwork(
    actor,
    overrides,
  );
}

export function getDruidFormState(
  actor,
) {
  const state =
    actor?.getFlag?.(
      MODULE_ID,
      STATE_FLAG,
    ) ??
    actor?.flags?.[
      MODULE_ID
    ]?.[
      STATE_FLAG
    ];

  return {
    currentForm:
      (
        typeof state
          ?.currentForm ===
          "string" &&
        state.currentForm
          .length >
          0
      )
        ? state.currentForm
        : "humanoid",
    activations:
      (
        state
          ?.activations &&
        typeof state
          .activations ===
          "object" &&
        !Array.isArray(
          state.activations,
        )
      )
        ? {
            ...state
              .activations,
          }
        : {},
  };
}
const ARTWORK_BASELINE_FLAG =
  "druidFormArtworkBaseline";
const ARTWORK_SETTING_KEY =
  "druidFormArtworkAutomation";
const ARTWORK_SOCKET_NAME =
  `module.${MODULE_ID}`;
const ARTWORK_REQUEST_TYPE =
  "druid-form-artwork-request";
const ARTWORK_RESULT_TYPE =
  "druid-form-artwork-result";
const ARTWORK_REQUEST_TIMEOUT_MS =
  10000;

const pendingArtworkRequests =
  new Map();
let artworkSocketRegistered =
  false;

function documentFlag(document, key) {
  return (
    document?.getFlag?.(
      MODULE_ID,
      key,
    ) ??
    document?.flags?.[MODULE_ID]?.[key]
  );
}

async function setDocumentFlag(document, key, value) {
  if (typeof document?.setFlag === "function") {
    await document.setFlag(MODULE_ID, key, value);
    return;
  }
  document.flags ??= {};
  document.flags[MODULE_ID] ??= {};
  document.flags[MODULE_ID][key] = value;
}

async function unsetDocumentFlag(document, key) {
  if (typeof document?.unsetFlag === "function") {
    await document.unsetFlag(MODULE_ID, key);
    return;
  }
  if (document?.flags?.[MODULE_ID]) {
    delete document.flags[MODULE_ID][key];
  }
}

function artworkAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  if (!settings?.get) return true;
  try {
    return settings.get(
      MODULE_ID,
      ARTWORK_SETTING_KEY,
    ) !== false;
  } catch (_error) {
    return true;
  }
}

export function isDruidFormArtworkAutomationEnabled(
  settings = globalThis.game?.settings,
) {
  return artworkAutomationEnabled(settings);
}

function canManageDruidActor(
  actor,
  user = globalThis.game?.user,
) {
  if (!actor) return false;
  if (!user) return true;
  if (user.isGM === true || actor.isOwner === true) {
    return true;
  }
  const ownerLevel =
    globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  return actor.testUserPermission?.(
    user,
    ownerLevel,
  ) === true;
}

function sceneDocuments(
  scenes = globalThis.game?.scenes,
) {
  if (!scenes) return [];
  if (typeof scenes.values === "function") {
    return Array.from(scenes.values());
  }
  return Array.from(scenes);
}

function sceneTokens(scene) {
  const tokens = scene?.tokens;
  if (!tokens) return [];
  if (typeof tokens.values === "function") {
    return Array.from(tokens.values());
  }
  return Array.from(tokens);
}

function actorSceneTokens(
  actor,
  scenes = globalThis.game?.scenes,
) {
  const matches = [];
  for (const scene of sceneDocuments(scenes)) {
    for (const token of sceneTokens(scene)) {
      if (
        token?.actorId === actor?.id ||
        token?.actor?.id === actor?.id
      ) {
        matches.push(token);
      }
    }
  }
  return matches;
}

function tokenIdentity(token) {
  const sceneId =
    token?.parent?.id ?? token?.scene?.id ?? null;
  const tokenId = token?.id ?? null;
  if (!sceneId || !tokenId) return null;
  return {
    key: `${sceneId}.${tokenId}`,
    sceneId,
    tokenId,
  };
}

function findSceneToken(
  tokenState,
  scenes = globalThis.game?.scenes,
) {
  for (const scene of sceneDocuments(scenes)) {
    if (scene?.id !== tokenState.sceneId) continue;
    const direct = scene.tokens?.get?.(tokenState.tokenId);
    if (direct) return direct;
    return sceneTokens(scene).find(
      token => token?.id === tokenState.tokenId,
    ) ?? null;
  }
  return null;
}

function baselineState(actor) {
  const value = documentFlag(
    actor,
    ARTWORK_BASELINE_FLAG,
  );
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    ? structuredClone(value)
    : null;
}

function initialArtworkBaseline(actor) {
  return {
    profileKey: null,
    actor: {
      original: actor?.img ?? null,
      applied: null,
    },
    prototypeToken: {
      original: actor?.prototypeToken?.texture?.src ?? null,
      applied: null,
    },
    tokens: {},
  };
}

function captureTokenBaseline(baseline, token) {
  const identity = tokenIdentity(token);
  if (!identity) return;
  baseline.tokens ??= {};
  if (!baseline.tokens[identity.key]) {
    baseline.tokens[identity.key] = {
      sceneId: identity.sceneId,
      tokenId: identity.tokenId,
      original: token?.texture?.src ?? null,
      applied: null,
    };
  }
}

async function updateActorArtwork(actor, artwork) {
  const changes = {
    img: artwork.portrait,
    "prototypeToken.texture.src": artwork.token,
  };
  if (typeof actor?.update === "function") {
    await actor.update(changes);
    return;
  }
  actor.img = artwork.portrait;
  actor.prototypeToken ??= {};
  actor.prototypeToken.texture ??= {};
  actor.prototypeToken.texture.src = artwork.token;
}

async function updateTokenArtwork(token, src) {
  if (typeof token?.update === "function") {
    await token.update({
      "texture.src": src,
    });
    return;
  }
  token.texture ??= {};
  token.texture.src = src;
}

async function applyDruidFormArtworkNow(
  actor,
  profileKey,
  {
    scenes = globalThis.game?.scenes,
    settings = globalThis.game?.settings,
    bypassSetting = false,
  } = {},
) {
  if (
    !actor ||
    (!bypassSetting && !artworkAutomationEnabled(settings))
  ) {
    return false;
  }

  const available = getAvailableDruidFormProfiles(actor).some(
    profile => profile.key === profileKey,
  );
  if (!available) return false;

  const artwork = getDruidFormArtwork(actor, profileKey);
  if (!artwork) return false;

  const baseline =
    baselineState(actor) ?? initialArtworkBaseline(actor);

  for (const token of actorSceneTokens(actor, scenes)) {
    captureTokenBaseline(baseline, token);
  }

  baseline.profileKey = profileKey;
  baseline.actor.applied = artwork.portrait;
  baseline.prototypeToken.applied = artwork.token;
  for (const tokenState of Object.values(baseline.tokens ?? {})) {
    tokenState.applied = artwork.token;
  }

  await setDocumentFlag(
    actor,
    ARTWORK_BASELINE_FLAG,
    baseline,
  );
  await updateActorArtwork(actor, artwork);
  for (const token of actorSceneTokens(actor, scenes)) {
    await updateTokenArtwork(token, artwork.token);
  }
  return true;
}

async function restoreDruidHumanoidArtworkNow(
  actor,
  {
    scenes = globalThis.game?.scenes,
  } = {},
) {
  const baseline = baselineState(actor);
  if (!actor || !baseline) return false;

  const changes = {};
  if (actor.img === baseline.actor?.applied) {
    changes.img = baseline.actor?.original ?? null;
  }
  if (
    actor.prototypeToken?.texture?.src ===
      baseline.prototypeToken?.applied
  ) {
    changes["prototypeToken.texture.src"] =
      baseline.prototypeToken?.original ?? null;
  }

  if (Object.keys(changes).length > 0) {
    if (typeof actor.update === "function") {
      await actor.update(changes);
    } else {
      if (Object.hasOwn(changes, "img")) {
        actor.img = changes.img;
      }
      if (Object.hasOwn(changes, "prototypeToken.texture.src")) {
        actor.prototypeToken.texture.src =
          changes["prototypeToken.texture.src"];
      }
    }
  }

  for (const tokenState of Object.values(baseline.tokens ?? {})) {
    const token = findSceneToken(tokenState, scenes);
    if (
      !token ||
      token?.texture?.src !== tokenState.applied
    ) {
      continue;
    }
    await updateTokenArtwork(token, tokenState.original);
  }

  await unsetDocumentFlag(actor, ARTWORK_BASELINE_FLAG);
  return true;
}

function primaryActiveGM() {
  const users = globalThis.game?.users;
  if (!users) return null;
  return Array.from(users).find(
    user => user?.active && user?.isGM,
  ) ?? null;
}

function currentUserNeedsArtworkGM(actor) {
  const user = globalThis.game?.user;
  if (!user) return false;
  if (user.isGM === true) {
    const gm = primaryActiveGM();
    return Boolean(gm && gm.id !== user.id);
  }
  return true;
}

function requestArtworkAction(
  actor,
  action,
  profileKey = null,
) {
  const user = globalThis.game?.user;
  if (!user) {
    return Promise.reject(
      new Error("A User is required for Druid form artwork authority."),
    );
  }
  if (!canManageDruidActor(actor, user)) {
    return Promise.reject(
      new Error("You do not own this Druid Actor."),
    );
  }

  const gm = primaryActiveGM();
  if (!gm) {
    return Promise.reject(
      new Error(
        "An active GM is required for Druid form artwork automation.",
      ),
    );
  }

  const requestId =
    globalThis.foundry?.utils?.randomID?.() ??
    `${Date.now()}-${Math.random()}`;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingArtworkRequests.delete(requestId);
      reject(
        new Error("The Druid form artwork request timed out."),
      );
    }, ARTWORK_REQUEST_TIMEOUT_MS);

    pendingArtworkRequests.set(requestId, {
      resolve,
      reject,
      timeoutId,
    });

    globalThis.game?.socket?.emit?.(
      ARTWORK_SOCKET_NAME,
      {
        type: ARTWORK_REQUEST_TYPE,
        requestId,
        requesterUserId: user.id,
        gmUserId: gm.id,
        actorId: actor.id,
        action,
        profileKey,
      },
    );
  });
}

export function applyDruidFormArtwork(
  actor,
  profileKey,
  options = {},
) {
  if (
    options.bypassAuthority === true ||
    !currentUserNeedsArtworkGM(actor)
  ) {
    return applyDruidFormArtworkNow(
      actor,
      profileKey,
      options,
    );
  }
  return requestArtworkAction(
    actor,
    "apply",
    profileKey,
  ).then(result => result?.result === true);
}

export function restoreDruidHumanoidArtwork(
  actor,
  options = {},
) {
  if (
    options.bypassAuthority === true ||
    !currentUserNeedsArtworkGM(actor)
  ) {
    return restoreDruidHumanoidArtworkNow(actor, options);
  }
  return requestArtworkAction(
    actor,
    "restore",
  ).then(result => result?.result === true);
}

export async function executeDruidFormArtworkRequest(
  payload,
  {
    users = globalThis.game?.users,
    actors = globalThis.game?.actors,
    applyArtwork = applyDruidFormArtwork,
    restoreArtwork = restoreDruidHumanoidArtwork,
    ownerLevel =
      globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3,
  } = {},
) {
  const requesterUserId = payload?.requesterUserId;
  const actorId = payload?.actorId;
  const action = payload?.action;
  if (!requesterUserId || !actorId || !action) {
    throw new Error("The Druid form artwork request is incomplete.");
  }

  const requester =
    users?.get?.(requesterUserId) ??
    Array.from(users ?? []).find(
      user => user?.id === requesterUserId,
    ) ??
    null;
  if (!requester || requester.active !== true) {
    throw new Error("The requesting User is not active.");
  }

  const actor =
    actors?.get?.(actorId) ??
    Array.from(actors ?? []).find(
      candidate => candidate?.id === actorId,
    ) ??
    null;
  if (!actor) {
    throw new Error("The requested Druid Actor does not exist.");
  }

  const mayManage =
    requester.isGM === true ||
    actor.testUserPermission?.(
      requester,
      ownerLevel,
    ) === true;
  if (!mayManage) {
    throw new Error(
      "The requesting User does not own the Druid Actor.",
    );
  }

  let result;
  if (action === "apply") {
    if (!payload.profileKey) {
      throw new Error(
        "The Druid form artwork apply request is missing a profile.",
      );
    }
    result = await applyArtwork(
      actor,
      payload.profileKey,
      {
        bypassAuthority: true,
      },
    );
  } else if (action === "restore") {
    result = await restoreArtwork(
      actor,
      {
        bypassAuthority: true,
      },
    );
  } else {
    throw new Error(
      `Unsupported Druid form artwork action: ${action}`,
    );
  }

  return {
    actorId: actor.id,
    action,
    result,
  };
}

function handleArtworkResult(payload) {
  if (
    payload?.requesterUserId !== globalThis.game?.user?.id
  ) {
    return;
  }
  const pending = pendingArtworkRequests.get(payload.requestId);
  if (!pending) return;
  clearTimeout(pending.timeoutId);
  pendingArtworkRequests.delete(payload.requestId);
  if (payload.success === true) {
    pending.resolve(payload.result);
  } else {
    pending.reject(
      new Error(
        payload.error ||
        "The GM could not update Druid form artwork.",
      ),
    );
  }
}

async function handleArtworkRequest(payload) {
  const user = globalThis.game?.user;
  if (!user?.isGM) return;
  const gm = primaryActiveGM();
  if (!gm || gm.id !== user.id) return;
  if (payload?.gmUserId && payload.gmUserId !== user.id) {
    return;
  }

  try {
    const result = await executeDruidFormArtworkRequest(payload);
    globalThis.game?.socket?.emit?.(
      ARTWORK_SOCKET_NAME,
      {
        type: ARTWORK_RESULT_TYPE,
        requestId: payload.requestId,
        requesterUserId: payload.requesterUserId,
        success: true,
        result,
      },
    );
  } catch (error) {
    globalThis.game?.socket?.emit?.(
      ARTWORK_SOCKET_NAME,
      {
        type: ARTWORK_RESULT_TYPE,
        requestId: payload?.requestId,
        requesterUserId: payload?.requesterUserId,
        success: false,
        error: error.message,
      },
    );
  }
}

function onArtworkSocketMessage(payload) {
  if (!payload || typeof payload !== "object") return;
  if (payload.type === ARTWORK_REQUEST_TYPE) {
    void handleArtworkRequest(payload);
  } else if (payload.type === ARTWORK_RESULT_TYPE) {
    handleArtworkResult(payload);
  }
}

export function registerDruidFormArtworkSocket() {
  if (artworkSocketRegistered) return;
  globalThis.game?.socket?.on?.(
    ARTWORK_SOCKET_NAME,
    onArtworkSocketMessage,
  );
  artworkSocketRegistered = true;
}

export async function restoreAllDruidFormArtwork() {
  const user = globalThis.game?.user;
  if (user) {
    const gm = primaryActiveGM();
    if (!user.isGM || (gm && gm.id !== user.id)) {
      return false;
    }
  }

  const actors = globalThis.game?.actors
    ? Array.from(globalThis.game.actors)
    : [];
  for (const actor of actors) {
    if (documentFlag(actor, ARTWORK_BASELINE_FLAG)) {
      await restoreDruidHumanoidArtworkNow(actor);
    }
  }
  return true;
}

export async function onCreateDruidFormArtworkToken(token) {
  const actor = token?.actor;
  if (!actor) return false;
  const user = globalThis.game?.user;
  if (user?.isGM) {
    const gm = primaryActiveGM();
    if (gm && gm.id !== user.id) return false;
  } else if (user) {
    return false;
  }

  const baseline = baselineState(actor);
  if (!baseline?.profileKey || !artworkAutomationEnabled()) {
    return false;
  }

  const artwork = getDruidFormArtwork(
    actor,
    baseline.profileKey,
  );
  if (!artwork) return false;

  captureTokenBaseline(baseline, token);
  const identity = tokenIdentity(token);
  if (identity) {
    baseline.tokens[identity.key].applied = artwork.token;
  }
  await setDocumentFlag(
    actor,
    ARTWORK_BASELINE_FLAG,
    baseline,
  );
  await updateTokenArtwork(token, artwork.token);
  return true;
}

function escapeArtworkHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localizeArtwork(key, fallback) {
  const value = globalThis.game?.i18n?.localize?.(key);
  return value && value !== key ? value : fallback;
}

function profileLabel(profile) {
  const labels = {
    travelPl1: "Travel Form — PL 1",
    travelPl2: "Travel Form — PL 2",
    travelPl3: "Travel Form — PL 3",
    bear: "Bear Form",
    cat: "Cat Form",
    tree: "Tree Form",
    moonkin: "Moonkin Form",
  };
  return labels[profile.key] ?? profile.key;
}

function artworkDialogMarkup(actor) {
  return (
    '<form class="boa-druid-form-artwork-dialog">' +
    getAvailableDruidFormProfiles(actor)
      .map(profile => {
        const artwork = getDruidFormArtwork(actor, profile.key);
        return (
          `<fieldset data-profile-key="${escapeArtworkHtml(profile.key)}">` +
          `<legend>${escapeArtworkHtml(profileLabel(profile))}</legend>` +
          `<label>${escapeArtworkHtml(localizeArtwork("BOA.druidForms.portrait", "Portrait"))}` +
          `<file-picker type="image" name="portrait.${escapeArtworkHtml(profile.key)}" value="${escapeArtworkHtml(artwork?.portrait ?? "")}"></file-picker>` +
          `</label>` +
          `<label>${escapeArtworkHtml(localizeArtwork("BOA.druidForms.token", "Token"))}` +
          `<file-picker type="image" name="token.${escapeArtworkHtml(profile.key)}" value="${escapeArtworkHtml(artwork?.token ?? "")}"></file-picker>` +
          `</label>` +
          `<label><input type="checkbox" name="reset.${escapeArtworkHtml(profile.key)}"> ` +
          `${escapeArtworkHtml(localizeArtwork("BOA.druidForms.reset", "Reset to Default"))}</label>` +
          `</fieldset>`
        );
      })
      .join("") +
    "</form>"
  );
}

function formValue(form, name) {
  return form?.elements?.namedItem?.(name)?.value ?? "";
}

function formChecked(form, name) {
  return form?.elements?.namedItem?.(name)?.checked === true;
}

export async function openDruidFormArtworkDialog(actor) {
  if (
    !canManageDruidActor(actor) ||
    !artworkAutomationEnabled()
  ) {
    return false;
  }

  const profiles = getAvailableDruidFormProfiles(actor);
  if (profiles.length === 0) return false;

  const DialogV2 =
    globalThis.foundry?.applications?.api?.DialogV2;
  if (typeof DialogV2?.wait !== "function") {
    return false;
  }

  const form = await DialogV2.wait({
    window: {
      title: localizeArtwork(
        "BOA.druidForms.artworkTitle",
        "Druid Form Artwork",
      ),
    },
    content: artworkDialogMarkup(actor),
    buttons: [
      {
        action: "save",
        label: localizeArtwork(
          "BOA.druidForms.save",
          "Save",
        ),
        default: true,
        callback: (_event, button) => button?.form ?? null,
      },
      {
        action: "cancel",
        label: localizeArtwork(
          "BOA.druidForms.cancel",
          "Cancel",
        ),
      },
    ],
    close: () => null,
  });

  if (!form) return false;

  for (const profile of profiles) {
    if (formChecked(form, `reset.${profile.key}`)) {
      await resetDruidFormArtwork(actor, profile.key);
      continue;
    }
    await setDruidFormArtwork(
      actor,
      profile.key,
      {
        portrait: formValue(
          form,
          `portrait.${profile.key}`,
        ),
        token: formValue(
          form,
          `token.${profile.key}`,
        ),
      },
    );
  }
  return true;
}

function artworkRoot(html) {
  const HTMLElementClass = globalThis.HTMLElement;
  if (HTMLElementClass && html instanceof HTMLElementClass) {
    return html;
  }
  if (
    HTMLElementClass &&
    html?.[0] instanceof HTMLElementClass
  ) {
    return html[0];
  }
  return html?.element ?? html ?? null;
}

export function onRenderDruidFormArtworkActorSheet(
  app,
  html,
) {
  const actor = app?.actor ?? app?.document ?? null;
  const root = artworkRoot(html);
  if (
    !actor ||
    actor.type !== "character" ||
    !root?.querySelector ||
    !artworkAutomationEnabled() ||
    !canManageDruidActor(actor) ||
    getAvailableDruidFormProfiles(actor).length === 0
  ) {
    return false;
  }

  root
    .querySelector(".boa-druid-form-artwork-button")
    ?.remove?.();

  const button = globalThis.document?.createElement?.("button");
  if (!button) return false;
  button.type = "button";
  button.classList.add("boa-druid-form-artwork-button");
  button.innerHTML =
    '<i class="fa-solid fa-images"></i> ' +
    escapeArtworkHtml(
      localizeArtwork(
        "BOA.druidForms.artworkButton",
        "Druid Forms",
      ),
    );
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    void openDruidFormArtworkDialog(actor);
  });

  const portrait = root.querySelector(
    '[data-edit="img"], .profile-img, img.profile',
  );
  const target =
    portrait?.parentElement ??
    root.querySelector(".sheet-header, header");
  if (!target?.append) return false;
  target.append(button);
  return true;
}
