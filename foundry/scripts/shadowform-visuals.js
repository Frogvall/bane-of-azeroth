import {
  MODULE_ID,
} from "./core/constants.js";
import {
  isShadowformVisualAutomationEnabled,
} from "./automation-settings.js";

export const SHADOWFORM_CONTENT_KEY =
  "spells.shadowform";
export const SHADOWFORM_STATE_FLAG =
  "shadowformState";
export const SHADOWFORM_DURATION =
  "stretch";

const FILTER_MARKER =
  Symbol.for(
    `${MODULE_ID}.shadowformVisual.filter`,
  );
const REST_PATCH_MARKER =
  Symbol.for(
    `${MODULE_ID}.shadowformVisual.rest`,
  );
const PRESERVED_REST_MARKERS =
  Object.freeze([
    Symbol.for(
      `${MODULE_ID}.summonDurationLifecycle`,
    ),
    Symbol.for(
      `${MODULE_ID}.druidFormLifecycle.rest`,
    ),
  ]);

export const SHADOWFORM_COLOR_MATRIX =
  Object.freeze([
    0.34, 0.06, 0.12, 0, 0,
    0.07, 0.19, 0.10, 0, 0,
    0.13, 0.09, 0.42, 0, 0,
    0, 0, 0, 0.92, 0,
  ]);

function values(collection) {
  if (!collection) return [];
  if (
    typeof collection.values ===
      "function"
  ) {
    return Array.from(
      collection.values(),
    );
  }
  return Array.from(
    collection,
  );
}

function contentKey(item) {
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

function messageAuthorId(message) {
  return (
    message?.author?.id ??
    message?.user?.id ??
    message?.user ??
    null
  );
}

async function resolveSpellAndActor(
  message,
  {
    fromUuidFn =
      globalThis.fromUuid,
    actors =
      globalThis.game?.actors,
  } = {},
) {
  const spell =
    (
      message?.system?.spellUuid &&
      typeof fromUuidFn ===
        "function"
    )
      ? await fromUuidFn(
          message.system.spellUuid,
        )
      : null;

  let actor =
    (
      message?.system?.actorUuid &&
      typeof fromUuidFn ===
        "function"
    )
      ? await fromUuidFn(
          message.system.actorUuid,
        )
      : null;

  actor =
    actor?.actor ??
    actor;

  if (!actor) {
    const actorId =
      message?.speaker?.actor;
    actor =
      actors?.get?.(
        actorId,
      ) ??
      values(
        actors,
      ).find(
        candidate =>
          candidate?.id ===
            actorId,
      ) ??
      null;
  }

  return {
    spell,
    actor,
  };
}

export function getShadowformState(
  actor,
) {
  const state =
    actor?.getFlag?.(
      MODULE_ID,
      SHADOWFORM_STATE_FLAG,
    ) ??
    actor?.flags?.[
      MODULE_ID
    ]?.[
      SHADOWFORM_STATE_FLAG
    ] ??
    null;

  if (
    state?.active !==
      true
  ) {
    return {
      active:
        false,
      duration:
        SHADOWFORM_DURATION,
      powerLevel:
        null,
    };
  }

  return {
    active:
      true,
    duration:
      SHADOWFORM_DURATION,
    powerLevel:
      Number(
        state.powerLevel,
      ) || 1,
  };
}

export function isShadowformActive(
  actor,
) {
  return (
    getShadowformState(
      actor,
    ).active ===
      true
  );
}

export function isShadowformFilter(
  filter,
) {
  return (
    filter?.[
      FILTER_MARKER
    ] === true
  );
}

function colorMatrixFilterClass() {
  return (
    globalThis.PIXI
      ?.ColorMatrixFilter ??
    globalThis.PIXI
      ?.filters
      ?.ColorMatrixFilter ??
    null
  );
}

export function createShadowformFilter() {
  const FilterClass =
    colorMatrixFilterClass();

  if (
    typeof FilterClass !==
      "function"
  ) {
    return null;
  }

  const filter =
    new FilterClass();

  filter.matrix = [
    ...SHADOWFORM_COLOR_MATRIX,
  ];

  Object.defineProperty(
    filter,
    FILTER_MARKER,
    {
      value:
        true,
    },
  );

  return filter;
}

function removeShadowformFilter(
  mesh,
) {
  const filters =
    Array.isArray(
      mesh?.filters,
    )
      ? mesh.filters
      : [];
  let removed =
    false;

  const retained =
    filters.filter(
      filter => {
        if (
          !isShadowformFilter(
            filter,
          )
        ) {
          return true;
        }

        removed =
          true;
        filter?.destroy?.();
        return false;
      },
    );

  if (removed) {
    mesh.filters =
      retained.length
        ? retained
        : null;
  }

  return removed;
}

export function applyShadowformTokenVisual(
  token,
  {
    settings =
      globalThis.game?.settings,
  } = {},
) {
  const mesh =
    token?.mesh;
  if (!mesh) {
    return false;
  }

  const actor =
    token?.actor ??
    token?.document?.actor ??
    null;
  const active =
    isShadowformVisualAutomationEnabled(
      settings,
    ) &&
    isShadowformActive(
      actor,
    );

  const filters =
    Array.isArray(
      mesh.filters,
    )
      ? mesh.filters
      : [];

  if (!active) {
    removeShadowformFilter(
      mesh,
    );
    return false;
  }

  if (
    filters.some(
      isShadowformFilter,
    )
  ) {
    return true;
  }

  const filter =
    createShadowformFilter();
  if (!filter) {
    return false;
  }

  mesh.filters = [
    ...filters,
    filter,
  ];

  return true;
}

export function reconcileShadowformCanvas(
  {
    tokens =
      globalThis.canvas
        ?.tokens
        ?.placeables ??
      [],
    settings =
      globalThis.game?.settings,
  } = {},
) {
  const tokenValues =
    values(
      tokens,
    );
  let active =
    0;

  for (
    const token
    of tokenValues
  ) {
    if (
      applyShadowformTokenVisual(
        token,
        {
          settings,
        },
      )
    ) {
      active +=
        1;
    }
  }

  return {
    checked:
      tokenValues.length,
    active,
  };
}

function sameActor(
  token,
  actor,
) {
  const tokenActor =
    token?.actor ??
    token?.document?.actor ??
    null;

  return Boolean(
    actor &&
    tokenActor &&
    (
      tokenActor ===
        actor ||
      (
        tokenActor.uuid &&
        actor.uuid &&
        tokenActor.uuid ===
          actor.uuid
      ) ||
      (
        tokenActor.id &&
        actor.id &&
        tokenActor.id ===
          actor.id
      )
    )
  );
}

function sheetRoot(html) {
  const HTMLElementClass =
    globalThis.HTMLElement;

  if (
    HTMLElementClass &&
    html instanceof
      HTMLElementClass
  ) {
    return html;
  }

  if (
    HTMLElementClass &&
    html?.[0] instanceof
      HTMLElementClass
  ) {
    return html[0];
  }

  return (
    html?.element ??
    html ??
    null
  );
}

export function onRenderShadowformActorSheet(
  app,
  html,
  {
    settings =
      globalThis.game?.settings,
  } = {},
) {
  const actor =
    app?.actor ??
    app?.document ??
    app?.object ??
    null;
  const root =
    sheetRoot(
      html,
    );

  if (
    actor?.type !==
      "character" ||
    !root?.classList
  ) {
    return false;
  }

  const active =
    isShadowformVisualAutomationEnabled(
      settings,
    ) &&
    isShadowformActive(
      actor,
    );

  root.classList.toggle(
    "boa-shadowform-active",
    active,
  );

  return active;
}

export function reconcileShadowformActorVisuals(
  actor,
  {
    tokens =
      globalThis.canvas
        ?.tokens
        ?.placeables ??
      [],
    settings =
      globalThis.game?.settings,
  } = {},
) {
  let tokenCount =
    0;

  for (
    const token
    of values(
      tokens,
    )
  ) {
    if (
      !sameActor(
        token,
        actor,
      )
    ) {
      continue;
    }

    applyShadowformTokenVisual(
      token,
      {
        settings,
      },
    );
    tokenCount +=
      1;
  }

  if (
    actor?.sheet?.rendered &&
    typeof actor.sheet.render ===
      "function"
  ) {
    actor.sheet.render(
      false,
    );
  }

  return {
    tokenCount,
    active:
      isShadowformActive(
        actor,
      ),
  };
}

export function reconcileShadowformVisuals(
  {
    actors =
      globalThis.game?.actors,
    tokens =
      globalThis.canvas
        ?.tokens
        ?.placeables ??
      [],
    settings =
      globalThis.game?.settings,
  } = {},
) {
  const result =
    reconcileShadowformCanvas({
      tokens,
      settings,
    });

  let renderedSheets =
    0;
  for (
    const actor
    of values(
      actors,
    )
  ) {
    if (
      actor?.sheet?.rendered &&
      typeof actor.sheet.render ===
        "function"
    ) {
      actor.sheet.render(
        false,
      );
      renderedSheets +=
        1;
    }
  }

  return {
    ...result,
    renderedSheets,
  };
}

export async function activateShadowform(
  actor,
  powerLevel = 1,
) {
  if (
    typeof actor?.setFlag !==
      "function"
  ) {
    return false;
  }

  const state = {
    active:
      true,
    duration:
      SHADOWFORM_DURATION,
    powerLevel:
      Number(
        powerLevel,
      ) || 1,
  };

  await actor.setFlag(
    MODULE_ID,
    SHADOWFORM_STATE_FLAG,
    state,
  );

  reconcileShadowformActorVisuals(
    actor,
  );

  return state;
}

export async function endShadowform(
  actor,
) {
  if (
    !isShadowformActive(
      actor,
    )
  ) {
    return false;
  }

  if (
    typeof actor?.unsetFlag ===
      "function"
  ) {
    await actor.unsetFlag(
      MODULE_ID,
      SHADOWFORM_STATE_FLAG,
    );
  } else if (
    typeof actor?.setFlag ===
      "function"
  ) {
    await actor.setFlag(
      MODULE_ID,
      SHADOWFORM_STATE_FLAG,
      {
        active:
          false,
      },
    );
  } else {
    return false;
  }

  reconcileShadowformActorVisuals(
    actor,
  );

  return true;
}

export async function onCreateShadowformSpellMessage(
  message,
  {
    currentUserId =
      globalThis.game?.user?.id,
    fromUuidFn =
      globalThis.fromUuid,
    actors =
      globalThis.game?.actors,
  } = {},
) {
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
    currentUserId &&
    authorId !==
      currentUserId
  ) {
    return false;
  }

  const {
    spell,
    actor,
  } =
    await resolveSpellAndActor(
      message,
      {
        fromUuidFn,
        actors,
      },
    );

  if (
    !actor ||
    contentKey(
      spell,
    ) !==
      SHADOWFORM_CONTENT_KEY
  ) {
    return false;
  }

  return activateShadowform(
    actor,
    message?.system
      ?.powerLevel ??
      1,
  );
}

export function onDrawShadowformToken(
  token,
) {
  return applyShadowformTokenVisual(
    token,
  );
}

function shadowformFlagChanged(
  changes,
) {
  const moduleFlags =
    changes?.flags?.[
      MODULE_ID
    ];

  if (
    moduleFlags &&
    typeof moduleFlags ===
      "object"
  ) {
    return Object.keys(
      moduleFlags,
    ).some(
      key =>
        key ===
          SHADOWFORM_STATE_FLAG ||
        key ===
          `-=${SHADOWFORM_STATE_FLAG}`,
    );
  }

  return Object.keys(
    changes ??
      {},
  ).some(
    key =>
      key.includes(
        MODULE_ID,
      ) &&
      key.includes(
        SHADOWFORM_STATE_FLAG,
      ),
  );
}

export function onUpdateShadowformActor(
  actor,
  changes,
) {
  if (
    !shadowformFlagChanged(
      changes,
    )
  ) {
    return false;
  }

  reconcileShadowformActorVisuals(
    actor,
  );
  return true;
}

export async function expireShadowformForRest(
  actor,
  restType,
) {
  if (
    ![
      "stretch",
      "shift",
    ].includes(
      restType,
    )
  ) {
    return false;
  }

  return endShadowform(
    actor,
  );
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

      try {
        await expireShadowformForRest(
          this,
          restType,
        );
      } catch (error) {
        console.error(
          `${MODULE_ID} | Failed to expire Shadowform after ${restType} rest.`,
          error,
        );
      }

      return result;
    };

  for (
    const marker
    of PRESERVED_REST_MARKERS
  ) {
    if (
      original?.[
        marker
      ] ===
        undefined
    ) {
      continue;
    }

    Object.defineProperty(
      wrapped,
      marker,
      {
        value:
          original[
            marker
          ],
      },
    );
  }

  Object.defineProperty(
    wrapped,
    REST_PATCH_MARKER,
    {
      value: {
        original,
        restType,
      },
    },
  );

  prototype[
    methodName
  ] =
    wrapped;

  return "patched";
}

export function patchShadowformRestLifecycle({
  actorClass =
    globalThis.CONFIG
      ?.Actor
      ?.documentClass,
} = {}) {
  return {
    restReset:
      patchRestMethod(
        actorClass,
        "restReset",
        "shift",
      ),
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
