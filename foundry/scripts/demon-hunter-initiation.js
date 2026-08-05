import {
  MODULE_ID,
} from "./core/constants.js";
import {
  getContentKey,
} from "./core/documents.js";
import {
  isDemonHunterInitiationAutomationEnabled,
} from "./automation-settings.js";

export const DEMON_HUNTER_INITIATION_CONTENT_KEY =
  "heroic-class-ability.demon-hunter.demon-hunter-initiation";

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

  if (
    original &&
    hasManagedVision(
      sight,
    )
  ) {
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

  if (
    original &&
    hasManagedVision(
      token?.sight,
    )
  ) {
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

export async function onCreateDemonHunterInitiationItem(
  item,
) {
  if (
    isDemonHunterInitiationAbility(
      item,
    )
  ) {
    await reconcileDemonHunterInitiationActor(
      item.parent,
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
      void reconcileDemonHunterInitiationActor(
        actor,
      );
    },
  );
}

export async function onCreateDemonHunterInitiationToken(
  token,
) {
  if (
    token?.actor
  ) {
    await reconcileDemonHunterInitiationActor(
      token.actor,
    );
  }
}

export function onRenderDemonHunterInitiationActorSheet(
  app,
) {
  if (
    app?.actor
  ) {
    void reconcileDemonHunterInitiationActor(
      app.actor,
    );
  }
}
