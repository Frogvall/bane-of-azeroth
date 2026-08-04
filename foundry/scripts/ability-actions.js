import {
  MODULE_ID,
} from "./core/constants.js";
import {
  getContentKey,
} from "./core/documents.js";
import {
  isEyeBeamAutomationEnabled,
  isWarStompAutomationEnabled,
} from "./automation-settings.js";

export const WAR_STOMP_SOURCE_CONTENT_KEY =
  "ability.war-stomp";

export const EYE_BEAM_SOURCE_CONTENT_KEY =
  "heroic-class-ability.demon-hunter.eye-beam";

const MANAGED_FLAG =
  "managedAbilityAction";
const ACTION_KEY_FLAG =
  "abilityActionKey";
const SOURCE_KEY_FLAG =
  "sourceAbilityContentKey";

const WAR_STOMP_KEY =
  "war-stomp";
const EYE_BEAM_KEY =
  "eye-beam";

const WAR_STOMP_PATCH =
  Symbol.for(
    "bane-of-azeroth.war-stomp.weapon-test",
  );

export const ABILITY_ACTION_DEFINITIONS =
  Object.freeze({
    [WAR_STOMP_KEY]:
      Object.freeze({
        key:
          WAR_STOMP_KEY,
        kind:
          "weapon",
        sourceContentKey:
          WAR_STOMP_SOURCE_CONTENT_KEY,
        wpCost:
          3,
        skill:
          "Brawling",
        damage:
          "D6",
        range:
          2,
        mandatoryBanes:
          1,
        damageBonus:
          false,
        canParry:
          false,
      }),
    [EYE_BEAM_KEY]:
      Object.freeze({
        key:
          EYE_BEAM_KEY,
        kind:
          "ability",
        sourceContentKey:
          EYE_BEAM_SOURCE_CONTENT_KEY,
        wpCost:
          3,
        maxRange:
          20,
        damage:
          "2D8",
        automaticHit:
          true,
        canParry:
          false,
        magical:
          true,
        usesWeaponTest:
          false,
      }),
  });

export function getAbilityActionDefinition(
  key,
) {
  const definition =
    ABILITY_ACTION_DEFINITIONS[
      key
    ];

  return definition
    ? {
        ...definition,
      }
    : null;
}

export function planEyeBeamAction() {
  const definition =
    ABILITY_ACTION_DEFINITIONS[
      EYE_BEAM_KEY
    ];

  return {
    kind:
      definition.kind,
    sourceContentKey:
      definition.sourceContentKey,
    wpCost:
      definition.wpCost,
    maxRange:
      definition.maxRange,
    damage:
      definition.damage,
    automaticHit:
      definition.automaticHit,
    canParry:
      definition.canParry,
    magical:
      definition.magical,
    usesWeaponTest:
      definition.usesWeaponTest,
  };
}

function getFlag(
  item,
  key,
) {
  return item?.getFlag?.(
    MODULE_ID,
    key,
  ) ??
    item?.flags?.[
      MODULE_ID
    ]?.[key];
}

export function isManagedAbilityAction(
  item,
  key = null,
) {
  if (
    getFlag(
      item,
      MANAGED_FLAG,
    ) !== true
  ) {
    return false;
  }

  if (key === null) {
    return true;
  }

  return (
    getFlag(
      item,
      ACTION_KEY_FLAG,
    ) === key
  );
}

function findSourceAbility(
  actor,
  sourceContentKey,
) {
  return (
    actor?.items?.find?.(
      item =>
        item?.type ===
          "ability" &&
        getContentKey(
          item,
        ) ===
          sourceContentKey,
    ) ??
    null
  );
}

export function buildManagedWarStompData(
  sourceAbility,
) {
  return {
    name:
      sourceAbility?.name ??
      "War Stomp",
    type:
      "weapon",
    img:
      sourceAbility?.img ??
      "icons/svg/explosion.svg",
    system: {
      itemDescription:
        "<p>Managed War Stomp attack. " +
        "Uses the War Stomp kin ability rules.</p>",
      worn:
        true,
      quantity:
        1,
      weight:
        0,
      cost:
        "",
      supply:
        "",
      grip: {
        value:
          "",
      },
      str:
        0,
      range:
        "2",
      damage:
        "D6",
      durability:
        0,
      skill: {
        name:
          "Brawling",
      },
      features: [
        "unarmed",
        "noDamageBonus",
        "noparry",
      ],
    },
    flags: {
      [MODULE_ID]: {
        [MANAGED_FLAG]:
          true,
        [ACTION_KEY_FLAG]:
          WAR_STOMP_KEY,
        [SOURCE_KEY_FLAG]:
          WAR_STOMP_SOURCE_CONTENT_KEY,
      },
    },
  };
}

function managedItemsFor(
  actor,
  key,
) {
  return (
    actor?.items?.filter?.(
      item =>
        isManagedAbilityAction(
          item,
          key,
        ),
    ) ??
    []
  );
}

async function removeManagedItems(
  actor,
  items,
) {
  if (
    !items.length ||
    !actor?.deleteEmbeddedDocuments
  ) {
    return;
  }

  await actor.deleteEmbeddedDocuments(
    "Item",
    items.map(
      item =>
        item.id,
    ),
  );
}

export async function reconcileActorAbilityActions(
  actor,
  {
    settings =
      globalThis.game?.settings,
  } = {},
) {
  if (
    !actor ||
    actor.documentName !== "Actor" &&
      !actor.createEmbeddedDocuments
  ) {
    return false;
  }

  if (
    actor.type !== "character"
  ) {
    return false;
  }

  const sourceWarStomp =
    findSourceAbility(
      actor,
      WAR_STOMP_SOURCE_CONTENT_KEY,
    );

  const managedWarStomps =
    managedItemsFor(
      actor,
      WAR_STOMP_KEY,
    );

  const wantsWarStomp =
    Boolean(sourceWarStomp) &&
    isWarStompAutomationEnabled(
      settings,
    );

  if (!wantsWarStomp) {
    await removeManagedItems(
      actor,
      managedWarStomps,
    );
    return true;
  }

  if (
    managedWarStomps.length > 1
  ) {
    await removeManagedItems(
      actor,
      managedWarStomps.slice(1),
    );
  }

  if (
    managedWarStomps.length === 0
  ) {
    await actor.createEmbeddedDocuments(
      "Item",
      [
        buildManagedWarStompData(
          sourceWarStomp,
        ),
      ],
    );
  }

  return true;
}

export async function reconcileAbilityActions(
  actor = null,
) {
  if (actor) {
    return reconcileActorAbilityActions(
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
    await reconcileActorAbilityActions(
      candidate,
    );
  }

  return true;
}

function sourceKeyForItem(
  item,
) {
  if (
    item?.type !== "ability"
  ) {
    return null;
  }

  return getContentKey(
    item,
  );
}

export async function onCreateAbilityActionItem(
  item,
) {
  const key =
    sourceKeyForItem(
      item,
    );

  if (
    key !==
      WAR_STOMP_SOURCE_CONTENT_KEY &&
    key !==
      EYE_BEAM_SOURCE_CONTENT_KEY
  ) {
    return;
  }

  await reconcileActorAbilityActions(
    item.parent,
  );
}

export async function onDeleteAbilityActionItem(
  item,
) {
  const key =
    sourceKeyForItem(
      item,
    );

  if (
    key !==
      WAR_STOMP_SOURCE_CONTENT_KEY &&
    key !==
      EYE_BEAM_SOURCE_CONTENT_KEY &&
    !isManagedAbilityAction(
      item,
    )
  ) {
    return;
  }

  await reconcileActorAbilityActions(
    item.parent,
  );
}

function warning(
  key,
) {
  const localized =
    globalThis.game?.i18n?.localize?.(
      key,
    );

  const message =
    localized &&
    localized !== key
      ? localized
      : key;

  globalThis.ui?.notifications?.warn?.(
    message,
  );
}

function format(
  key,
  data,
) {
  const localized =
    globalThis.game?.i18n?.format?.(
      key,
      data,
    );

  if (
    localized &&
    localized !== key
  ) {
    return localized;
  }

  return key;
}

function actorWillpower(
  actor,
) {
  return Number(
    actor?.system
      ?.willPoints
      ?.value ??
      0,
  );
}

async function spendWillpower(
  actor,
  amount,
  label,
) {
  const current =
    actorWillpower(
      actor,
    );

  if (
    current < amount
  ) {
    warning(
      "BOA.notifications.abilityActionNotEnoughWp",
    );
    return false;
  }

  const next =
    current - amount;

  await actor.update({
    "system.willPoints.value":
      next,
  });

  await globalThis.ChatMessage?.create?.({
    user:
      globalThis.game?.user?.id,
    speaker:
      globalThis.ChatMessage
        ?.getSpeaker?.({
          actor,
        }),
    content:
      `<p>${actor.name} spends ${amount} WP to use <strong>${label}</strong>.</p>` +
      `<p>WP: ${current} → ${next}</p>`,
  });

  return true;
}

function tokenDocument(
  token,
) {
  return (
    token?.document ??
    token
  );
}

export function collectWarStompTargets(
  sourceToken,
  tokens,
  {
    measureDistance =
      (from, to) =>
        globalThis.canvas
          ?.grid
          ?.measurePath?.(
            [
              from,
              to,
            ],
          )
          ?.distance ??
        Infinity,
  } = {},
) {
  if (!sourceToken) {
    return [];
  }

  const sourceDocument =
    tokenDocument(
      sourceToken,
    );

  return (
    Array.from(
      tokens ?? [],
    )
      .filter(
        token => {
          if (
            !token?.actor
          ) {
            return false;
          }

          if (
            token === sourceToken ||
            token.id ===
              sourceToken.id
          ) {
            return false;
          }

          const document =
            tokenDocument(
              token,
            );

          if (
            document?.hidden
          ) {
            return false;
          }

          const distance =
            Number(
              measureDistance(
                sourceDocument,
                document,
              ),
            );

          return (
            Number.isFinite(
              distance,
            ) &&
            distance <= 2
          );
        },
      )
  );
}

function findActorToken(
  actor,
) {
  const placeables =
    globalThis.canvas
      ?.tokens
      ?.placeables ??
    [];

  return (
    placeables.find(
      token =>
        token?.actor?.uuid ===
          actor?.uuid &&
        token?.controlled,
    ) ??
    placeables.find(
      token =>
        token?.actor?.uuid ===
          actor?.uuid,
    ) ??
    null
  );
}

async function loadDragonbaneModule(
  relativePath,
) {
  const route =
    globalThis.foundry
      ?.utils
      ?.getRoute?.(
        relativePath,
      ) ??
    `/${relativePath}`;

  return import(route);
}

async function loadDamageHelper() {
  const module =
    await loadDragonbaneModule(
      "systems/dragonbane/modules/chat.js",
    );

  if (
    typeof module
      ?.inflictDamageMessage !==
      "function"
  ) {
    throw new Error(
      "Dragonbane inflictDamageMessage was not available.",
    );
  }

  return module
    .inflictDamageMessage;
}

export async function createWarStompDamageMessages(
  actor,
  weapon,
  {
    tokens =
      globalThis.canvas
        ?.tokens
        ?.placeables ??
      [],
    sourceToken =
      findActorToken(
        actor,
      ),
    inflictDamageMessage =
      null,
  } = {},
) {
  if (!sourceToken) {
    warning(
      "BOA.notifications.abilityActionNoSourceToken",
    );
    return [];
  }

  const targets =
    collectWarStompTargets(
      sourceToken,
      tokens,
    );

  if (
    targets.length === 0
  ) {
    warning(
      "BOA.notifications.warStompNoTargets",
    );
    return [];
  }

  await globalThis.ChatMessage?.create?.({
    user:
      globalThis.game?.user?.id,
    speaker:
      globalThis.ChatMessage
        ?.getSpeaker?.({
          actor,
        }),
    content:
      `<p><strong>War Stomp</strong>: ` +
      `${format(
        "BOA.dialog.abilityActions.warStompResolveHint",
        {
          count:
            targets.length,
        },
      )}</p>`,
  });

  const inflict =
    inflictDamageMessage ??
    await loadDamageHelper();

  for (const target of targets) {
    await inflict({
      actor,
      weapon,
      damage:
        "D6",
      damageType:
        globalThis.CONFIG
          ?.DoD
          ?.damageTypes
          ?.none ??
        "none",
      target:
        target.actor,
    });
  }

  return targets;
}

function isWarStompWeapon(
  weapon,
) {
  return isManagedAbilityAction(
    weapon,
    WAR_STOMP_KEY,
  );
}

async function loadWeaponTestClass() {
  const module =
    await loadDragonbaneModule(
      "systems/dragonbane/modules/tests/weapon-test.js",
    );

  return (
    module?.default ??
    null
  );
}

export async function patchWarStompWeaponTest({
  WeaponTestClass =
    null,
  resolveDamage =
    createWarStompDamageMessages,
} = {}) {
  const TestClass =
    WeaponTestClass ??
    await loadWeaponTestClass();

  const prototype =
    TestClass?.prototype;

  if (
    typeof prototype?.roll !==
      "function"
  ) {
    console.error(
      `${MODULE_ID} | Dragonbane DoDWeaponTest#roll was not available for War Stomp automation.`,
    );
    return false;
  }

  if (
    prototype.roll[
      WAR_STOMP_PATCH
    ] === true
  ) {
    return true;
  }

  const nativeRoll =
    prototype.roll;

  async function boaWarStompRoll(
    ...args
  ) {
    if (
      !isWarStompWeapon(
        this.weapon,
      ) ||
      !isWarStompAutomationEnabled()
    ) {
      return nativeRoll.apply(
        this,
        args,
      );
    }

    const actor =
      this.actor;

    if (
      !this.isReroll &&
      actorWillpower(
        actor,
      ) < 3
    ) {
      warning(
        "BOA.notifications.abilityActionNotEnoughWp",
      );
      return undefined;
    }

    let nativeGetOptions =
      null;

    if (!this.isReroll) {
      nativeGetOptions =
        this.getRollOptions;

      this.getRollOptions =
        async (...optionArgs) => {
          const options =
            await nativeGetOptions.apply(
              this,
              optionArgs,
            );

          if (
            options?.cancelled
          ) {
            return options;
          }

          return {
            ...options,
            extraBanes:
              Number(
                options
                  ?.extraBanes ??
                0,
              ) + 1,
          };
        };
    }

    let result;

    try {
      result =
        await nativeRoll.apply(
          this,
          args,
        );
    } finally {
      if (
        nativeGetOptions
      ) {
        this.getRollOptions =
          nativeGetOptions;
      }
    }

    if (!result) {
      return result;
    }

    if (!this.isReroll) {
      const paid =
        await spendWillpower(
          actor,
          3,
          "War Stomp",
        );

      if (!paid) {
        return result;
      }
    }

    if (
      this.postRollData
        ?.success
    ) {
      await resolveDamage(
        actor,
        this.weapon,
      );
    }

    return result;
  }

  Object.defineProperty(
    boaWarStompRoll,
    WAR_STOMP_PATCH,
    {
      value:
        true,
    },
  );

  prototype.roll =
    boaWarStompRoll;

  return true;
}

function messageContext(
  message,
) {
  try {
    return (
      message
        ?.system
        ?.toContext?.() ??
      null
    );
  } catch (_error) {
    return null;
  }
}

export function onAbilityActionDamageClick(
  event,
) {
  const button =
    event?.target?.closest?.(
      [
        "[data-action='dealDamage']",
        "[data-action='dealDoubleDamage']",
        "[data-action='dealHalfDamage']",
        "[data-action='dealDamageIgnoreArmor']",
      ].join(","),
    );

  if (!button) {
    return;
  }

  const element =
    button.closest(
      ".chat-message",
    );

  const messageId =
    element?.dataset
      ?.messageId;

  const message =
    globalThis.game
      ?.messages
      ?.get?.(
        messageId,
      );

  const context =
    messageContext(
      message,
    );

  if (
    !isWarStompWeapon(
      context?.weapon,
    )
  ) {
    return;
  }

  const target =
    context?.targetActor;

  if (
    !target?.isOwner ||
    typeof target
      ?.toggleStatusEffect !==
      "function"
  ) {
    return;
  }

  globalThis.setTimeout(
    async () => {
      try {
        await target.toggleStatusEffect(
          "prone",
          {
            active:
              true,
          },
        );
      } catch (error) {
        console.error(
          `${MODULE_ID} | Failed to knock a War Stomp target prone.`,
          error,
        );
      }
    },
    0,
  );
}

function selectedTarget() {
  const targets =
    Array.from(
      globalThis.game
        ?.user
        ?.targets ??
      [],
    );

  if (
    targets.length !== 1
  ) {
    return null;
  }

  return targets[0];
}

function measureTokenDistance(
  from,
  to,
) {
  return Number(
    globalThis.canvas
      ?.grid
      ?.measurePath?.(
        [
          tokenDocument(
            from,
          ),
          tokenDocument(
            to,
          ),
        ],
      )
      ?.distance ??
    Infinity,
  );
}

export async function useEyeBeamAction(
  actor,
  ability,
  {
    target =
      selectedTarget(),
    sourceToken =
      findActorToken(
        actor,
      ),
    confirm =
      globalThis.foundry
        ?.applications
        ?.api
        ?.DialogV2
        ?.confirm,
    inflictDamageMessage =
      null,
    measureDistance =
      measureTokenDistance,
  } = {},
) {
  if (
    !isEyeBeamAutomationEnabled()
  ) {
    return false;
  }

  if (!target?.actor) {
    warning(
      "BOA.notifications.eyeBeamOneTarget",
    );
    return true;
  }

  if (!sourceToken) {
    warning(
      "BOA.notifications.abilityActionNoSourceToken",
    );
    return true;
  }

  const distance =
    Number(
      measureDistance(
        sourceToken,
        target,
      ),
    );

  if (
    !Number.isFinite(
      distance,
    ) ||
    distance > 20
  ) {
    warning(
      "BOA.notifications.eyeBeamOutOfRange",
    );
    return true;
  }

  if (
    actorWillpower(
      actor,
    ) < 3
  ) {
    warning(
      "BOA.notifications.abilityActionNotEnoughWp",
    );
    return true;
  }

  const accepted =
    await confirm?.({
      window: {
        title:
          "Eye Beam",
      },
      content:
        format(
          "BOA.dialog.abilityActions.eyeBeamConfirm",
          {
            target:
              target.name ??
              target.actor.name,
          },
        ),
    });

  if (!accepted) {
    return true;
  }

  const paid =
    await spendWillpower(
      actor,
      3,
      ability?.name ??
        "Eye Beam",
    );

  if (!paid) {
    return true;
  }

  await globalThis.ChatMessage?.create?.({
    user:
      globalThis.game?.user?.id,
    speaker:
      globalThis.ChatMessage
        ?.getSpeaker?.({
          actor,
        }),
    content:
      `<p>${format(
        "BOA.chat.eyeBeamHit",
        {
          actor:
            actor.name,
          target:
            target.name ??
            target.actor.name,
        },
      )}</p>`,
  });

  const inflict =
    inflictDamageMessage ??
    await loadDamageHelper();

  await inflict({
    actor,
    weapon:
      ability,
    damage:
      "2D8",
    damageType:
      globalThis.CONFIG
        ?.DoD
        ?.damageTypes
        ?.none ??
      "none",
    target:
      target.actor,
  });

  return true;
}

function actorSheetRoot(
  app,
) {
  return (
    app?.element ??
    null
  );
}

const attachedSheets =
  new WeakSet();

export function onRenderAbilityActionActorSheet(
  app,
) {
  const actor =
    app?.actor;

  if (!actor) {
    return;
  }

  void reconcileActorAbilityActions(
    actor,
  );

  const root =
    actorSheetRoot(
      app,
    );

  if (
    !root?.addEventListener ||
    attachedSheets.has(
      root,
    )
  ) {
    return;
  }

  attachedSheets.add(
    root,
  );

  root.addEventListener(
    "click",
    event => {
      if (
        event.button !== 0
      ) {
        return;
      }

      const action =
        event.target?.closest?.(
          "[data-action='useAbility']",
        );

      if (!action) {
        return;
      }

      const row =
        action.closest(
          ".sheet-table-data",
        );

      const item =
        actor.items?.get?.(
          row?.dataset
            ?.itemId,
        );

      if (
        item?.type !== "ability" ||
        getContentKey(
          item,
        ) !==
          EYE_BEAM_SOURCE_CONTENT_KEY ||
        !isEyeBeamAutomationEnabled()
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      void useEyeBeamAction(
        actor,
        item,
      );
    },
    {
      capture:
        true,
    },
  );
}
