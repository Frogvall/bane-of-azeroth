import {
  MODULE_ID,
} from "./core/constants.js";
import {
  getContentKey,
} from "./core/documents.js";
import {
  isSerenityAutomationEnabled,
} from "./automation-settings.js";

export const SERENITY_CONTENT_KEY =
  "heroic-class-ability.monk.monks-serenity";

export const SERENITY_DAMAGE =
  "D10";

const UNARMED_NAME =
  "Unarmed";
const IRON_FIST_NAME =
  "Iron Fist";

const UNARMED_MANAGED_FLAG =
  "serenityManagedUnarmed";
const UNARMED_ORIGINAL_DAMAGE_FLAG =
  "serenityOriginalUnarmedDamage";
const IRON_FIST_MANAGED_FLAG =
  "serenityManagedIronFist";
const IRON_FIST_ORIGINAL_DESCRIPTION_FLAG =
  "serenityOriginalIronFistDescription";

const reconcileQueues =
  new WeakMap();

function flag(
  item,
  key,
) {
  return (
    item?.getFlag?.(
      MODULE_ID,
      key,
    ) ??
    item?.flags?.[
      MODULE_ID
    ]?.[key]
  );
}

export function isSerenityAbility(
  item,
) {
  return (
    item?.type === "ability" &&
    getContentKey(
      item,
    ) ===
      SERENITY_CONTENT_KEY
  );
}

export function isUnarmedWeapon(
  item,
) {
  const features =
    Array.from(
      item?.system?.features ??
      [],
    );

  return (
    item?.type === "weapon" &&
    String(
      item?.name ??
      "",
    ).trim().toLowerCase() ===
      UNARMED_NAME.toLowerCase() &&
    String(
      item?.system?.skill?.name ??
      "",
    ).trim().toLowerCase() ===
      "brawling" &&
    features.includes(
      "unarmed",
    )
  );
}

export function isIronFistAbility(
  item,
) {
  return (
    item?.type === "ability" &&
    String(
      item?.name ??
      "",
    ).trim().toLowerCase() ===
      IRON_FIST_NAME.toLowerCase()
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

function hasSerenity(
  actor,
) {
  return actorItems(
    actor,
  ).some(
    isSerenityAbility,
  );
}

function transformIronFistDescription(
  description,
) {
  if (
    typeof description !==
      "string" ||
    !/\b2D6\b/i.test(
      description,
    )
  ) {
    return null;
  }

  return description.replace(
    /\b2D6\b/gi,
    "2D10",
  );
}

async function setFlagSafe(
  item,
  key,
  value,
) {
  if (
    typeof item?.setFlag ===
      "function"
  ) {
    await item.setFlag(
      MODULE_ID,
      key,
      value,
    );
    return;
  }

  item.flags ??= {};
  item.flags[
    MODULE_ID
  ] ??= {};
  item.flags[
    MODULE_ID
  ][key] = value;
}

async function unsetFlagSafe(
  item,
  key,
) {
  if (
    typeof item?.unsetFlag ===
      "function"
  ) {
    await item.unsetFlag(
      MODULE_ID,
      key,
    );
    return;
  }

  if (
    item?.flags?.[
      MODULE_ID
    ]
  ) {
    delete item.flags[
      MODULE_ID
    ][key];
  }
}

async function updateItemSafe(
  item,
  update,
) {
  if (
    typeof item?.update ===
      "function"
  ) {
    await item.update(
      update,
    );
    return;
  }

  if (
    Object.hasOwn(
      update,
      "system.damage",
    )
  ) {
    item.system ??= {};
    item.system.damage =
      update[
        "system.damage"
      ];
  }

  if (
    Object.hasOwn(
      update,
      "system.itemDescription",
    )
  ) {
    item.system ??= {};
    item.system.itemDescription =
      update[
        "system.itemDescription"
      ];
  }
}

async function applySerenityToUnarmed(
  item,
) {
  const managed =
    flag(
      item,
      UNARMED_MANAGED_FLAG,
    ) === true;

  if (!managed) {
    await setFlagSafe(
      item,
      UNARMED_ORIGINAL_DAMAGE_FLAG,
      item?.system?.damage ??
        null,
    );

    await setFlagSafe(
      item,
      UNARMED_MANAGED_FLAG,
      true,
    );
  }

  if (
    String(
      item?.system?.damage ??
      "",
    ).toUpperCase() !==
      SERENITY_DAMAGE
  ) {
    await updateItemSafe(
      item,
      {
        "system.damage":
          SERENITY_DAMAGE,
      },
    );
  }
}

async function restoreUnarmed(
  item,
) {
  if (
    flag(
      item,
      UNARMED_MANAGED_FLAG,
    ) !== true
  ) {
    return;
  }

  const originalDamage =
    flag(
      item,
      UNARMED_ORIGINAL_DAMAGE_FLAG,
    );

  if (
    String(
      item?.system?.damage ??
      "",
    ).toUpperCase() ===
      SERENITY_DAMAGE &&
    originalDamage !==
      undefined
  ) {
    await updateItemSafe(
      item,
      {
        "system.damage":
          originalDamage,
      },
    );
  }

  await unsetFlagSafe(
    item,
    UNARMED_MANAGED_FLAG,
  );

  await unsetFlagSafe(
    item,
    UNARMED_ORIGINAL_DAMAGE_FLAG,
  );
}

async function applySerenityToIronFist(
  item,
) {
  const managed =
    flag(
      item,
      IRON_FIST_MANAGED_FLAG,
    ) === true;

  if (!managed) {
    const original =
      item?.system
        ?.itemDescription ??
      "";

    const transformed =
      transformIronFistDescription(
        original,
      );

    if (
      transformed ===
      null
    ) {
      return;
    }

    await setFlagSafe(
      item,
      IRON_FIST_ORIGINAL_DESCRIPTION_FLAG,
      original,
    );

    await setFlagSafe(
      item,
      IRON_FIST_MANAGED_FLAG,
      true,
    );

    await updateItemSafe(
      item,
      {
        "system.itemDescription":
          transformed,
      },
    );

    return;
  }

  const original =
    flag(
      item,
      IRON_FIST_ORIGINAL_DESCRIPTION_FLAG,
    );

  const expected =
    transformIronFistDescription(
      original,
    );

  if (
    expected !== null &&
    item?.system
      ?.itemDescription !==
      expected
  ) {
    await updateItemSafe(
      item,
      {
        "system.itemDescription":
          expected,
      },
    );
  }
}

async function restoreIronFist(
  item,
) {
  if (
    flag(
      item,
      IRON_FIST_MANAGED_FLAG,
    ) !== true
  ) {
    return;
  }

  const original =
    flag(
      item,
      IRON_FIST_ORIGINAL_DESCRIPTION_FLAG,
    );

  const expected =
    transformIronFistDescription(
      original,
    );

  if (
    typeof original ===
      "string" &&
    (
      expected === null ||
      item?.system
        ?.itemDescription ===
        expected
    )
  ) {
    await updateItemSafe(
      item,
      {
        "system.itemDescription":
          original,
      },
    );
  }

  await unsetFlagSafe(
    item,
    IRON_FIST_MANAGED_FLAG,
  );

  await unsetFlagSafe(
    item,
    IRON_FIST_ORIGINAL_DESCRIPTION_FLAG,
  );
}

async function reconcileSerenityActorNow(
  actor,
  {
    settings =
      globalThis.game
        ?.settings,
  } = {},
) {
  if (
    !actor ||
    actor.type !==
      "character"
  ) {
    return false;
  }

  const enabled =
    isSerenityAutomationEnabled(
      settings,
    );

  const active =
    enabled &&
    hasSerenity(
      actor,
    );

  const items =
    actorItems(
      actor,
    );

  for (const item of items) {
    if (
      isUnarmedWeapon(
        item,
      )
    ) {
      if (active) {
        await applySerenityToUnarmed(
          item,
        );
      } else {
        await restoreUnarmed(
          item,
        );
      }
    }

    if (
      isIronFistAbility(
        item,
      )
    ) {
      if (active) {
        await applySerenityToIronFist(
          item,
        );
      } else {
        await restoreIronFist(
          item,
        );
      }
    }
  }

  return true;
}

export function reconcileSerenityActor(
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
          reconcileSerenityActorNow(
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

export async function reconcileSerenity(
  actor = null,
) {
  if (actor) {
    return reconcileSerenityActor(
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
    await reconcileSerenityActor(
      candidate,
    );
  }

  return true;
}

function isRelevantItem(
  item,
) {
  return (
    isSerenityAbility(
      item,
    ) ||
    isUnarmedWeapon(
      item,
    ) ||
    isIronFistAbility(
      item,
    ) ||
    flag(
      item,
      UNARMED_MANAGED_FLAG,
    ) === true ||
    flag(
      item,
      IRON_FIST_MANAGED_FLAG,
    ) === true
  );
}

export async function onCreateSerenityItem(
  item,
) {
  if (
    !isRelevantItem(
      item,
    )
  ) {
    return;
  }

  await reconcileSerenityActor(
    item.parent,
  );
}

export function onDeleteSerenityItem(
  item,
) {
  if (
    !isRelevantItem(
      item,
    )
  ) {
    return;
  }

  const actor =
    item.parent;

  queueMicrotask(
    () => {
      void reconcileSerenityActor(
        actor,
      );
    },
  );
}

export function onRenderSerenityActorSheet(
  app,
) {
  if (
    app?.actor
  ) {
    void reconcileSerenityActor(
      app.actor,
    );
  }
}
