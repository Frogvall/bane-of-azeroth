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

const WAR_STOMP_DIALOG_PATCH =
  Symbol.for(
    "bane-of-azeroth.war-stomp.dialog",
  );

const PENDING_WAR_STOMP_FLAG =
  "pendingWarStompDamage";
const TARGET_RESOLUTION_FLAG =
  "abilityActionTargetResolution";

const reconcileQueues =
  new WeakMap();

const ABILITY_ACTION_WEAPON_SLOT_PATCH =
  Symbol.for(
    "bane-of-azeroth.ability-actions.weapon-slots",
  );

const ABILITY_ACTION_SHEET_SLOT_PATCH =
  Symbol.for(
    "bane-of-azeroth.ability-actions.sheet-weapon-slots",
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
        manualDamageRoll:
          true,
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
        manualDamageRoll:
          true,
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
    manualDamageRoll:
      definition.manualDamageRoll,
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
      "modules/bane-of-azeroth/assets/icons/weapons/war_stomp.webp",
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

export function buildManagedEyeBeamData(
  sourceAbility,
) {
  return {
    name:
      sourceAbility?.name ??
      "Eye Beam",
    type:
      "weapon",
    img:
      "modules/bane-of-azeroth/assets/icons/weapons/eye_beam.webp",
    system: {
      itemDescription:
        "<p>Managed Eye Beam attack action. " +
        "Automatically hits one target within 20 m for 2D8 magical damage.</p>",
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
        "20",
      damage:
        "2D8",
      durability:
        0,
      skill: {
        name:
          "",
      },
      features: [
        "noDamageBonus",
        "noparry",
      ],
    },
    flags: {
      [MODULE_ID]: {
        [MANAGED_FLAG]:
          true,
        [ACTION_KEY_FLAG]:
          EYE_BEAM_KEY,
        [SOURCE_KEY_FLAG]:
          EYE_BEAM_SOURCE_CONTENT_KEY,
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

  const ids =
    items
      .map(
        item =>
          item.id,
      )
      .filter(
        id =>
          actor.items?.get
            ? Boolean(
                actor.items.get(
                  id,
                ),
              )
            : actor.items?.some?.(
                item =>
                  item.id === id,
              ),
      );

  if (
    ids.length === 0
  ) {
    return;
  }

  await actor.deleteEmbeddedDocuments(
    "Item",
    ids,
  );
}

function arraysEqual(
  left,
  right,
) {
  const a =
    Array.from(
      left ?? [],
    );
  const b =
    Array.from(
      right ?? [],
    );

  return (
    a.length ===
      b.length &&
    a.every(
      (value, index) =>
        value ===
          b[index],
    )
  );
}

function managedAbilityActionMatches(
  item,
  desired,
) {
  const system =
    item?.system ??
    {};
  const desiredSystem =
    desired?.system ??
    {};

  return (
    item?.name ===
      desired?.name &&
    item?.img ===
      desired?.img &&
    item?.type ===
      desired?.type &&
    Boolean(
      system?.worn,
    ) ===
      Boolean(
        desiredSystem?.worn,
      ) &&
    String(
      system?.range ??
      "",
    ) ===
      String(
        desiredSystem?.range ??
        "",
      ) &&
    String(
      system?.damage ??
      "",
    ) ===
      String(
        desiredSystem?.damage ??
        "",
      ) &&
    String(
      system?.skill?.name ??
      "",
    ) ===
      String(
        desiredSystem?.skill?.name ??
        "",
      ) &&
    arraysEqual(
      system?.features,
      desiredSystem?.features,
    ) &&
    getFlag(
      item,
      MANAGED_FLAG,
    ) === true &&
    getFlag(
      item,
      ACTION_KEY_FLAG,
    ) ===
      desired?.flags?.[
        MODULE_ID
      ]?.[
        ACTION_KEY_FLAG
      ] &&
    getFlag(
      item,
      SOURCE_KEY_FLAG,
    ) ===
      desired?.flags?.[
        MODULE_ID
      ]?.[
        SOURCE_KEY_FLAG
      ]
  );
}

async function syncManagedAbilityAction(
  actor,
  item,
  desired,
) {
  if (
    !item ||
    managedAbilityActionMatches(
      item,
      desired,
    )
  ) {
    return false;
  }

  const update = {
    _id:
      item.id,
    name:
      desired.name,
    img:
      desired.img,
    system:
      desired.system,
    flags:
      desired.flags,
  };

  if (
    typeof actor
      ?.updateEmbeddedDocuments ===
      "function"
  ) {
    await actor.updateEmbeddedDocuments(
      "Item",
      [
        update,
      ],
    );

    return true;
  }

  if (
    typeof item?.update ===
      "function"
  ) {
    const {
      _id,
      ...itemUpdate
    } = update;

    void _id;

    await item.update(
      itemUpdate,
    );

    return true;
  }

  return false;
}
async function reconcileActorAbilityActionsNow(
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

  const sourceEyeBeam =
    findSourceAbility(
      actor,
      EYE_BEAM_SOURCE_CONTENT_KEY,
    );

  const managedWarStomps =
    managedItemsFor(
      actor,
      WAR_STOMP_KEY,
    );

  const managedEyeBeams =
    managedItemsFor(
      actor,
      EYE_BEAM_KEY,
    );

  const wantsWarStomp =
    Boolean(sourceWarStomp) &&
    isWarStompAutomationEnabled(
      settings,
    );

  const wantsEyeBeam =
    Boolean(sourceEyeBeam) &&
    isEyeBeamAutomationEnabled(
      settings,
    );

  if (!wantsWarStomp) {
    await removeManagedItems(
      actor,
      managedWarStomps,
    );
  } else {
    if (
      managedWarStomps.length > 1
    ) {
      await removeManagedItems(
        actor,
        managedWarStomps.slice(1),
      );
    }

    const desiredWarStomp =
      buildManagedWarStompData(
        sourceWarStomp,
      );

    if (
      managedWarStomps.length === 0
    ) {
      await actor.createEmbeddedDocuments(
        "Item",
        [
          desiredWarStomp,
        ],
      );
    } else {
      await syncManagedAbilityAction(
        actor,
        managedWarStomps[0],
        desiredWarStomp,
      );
    }
  }

  if (!wantsEyeBeam) {
    await removeManagedItems(
      actor,
      managedEyeBeams,
    );
  } else {
    if (
      managedEyeBeams.length > 1
    ) {
      await removeManagedItems(
        actor,
        managedEyeBeams.slice(1),
      );
    }

    const desiredEyeBeam =
      buildManagedEyeBeamData(
        sourceEyeBeam,
      );

    if (
      managedEyeBeams.length === 0
    ) {
      await actor.createEmbeddedDocuments(
        "Item",
        [
          desiredEyeBeam,
        ],
      );
    } else {
      await syncManagedAbilityAction(
        actor,
        managedEyeBeams[0],
        desiredEyeBeam,
      );
    }
  }

  return true;
}

export function reconcileActorAbilityActions(
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
          reconcileActorAbilityActionsNow(
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

function getWarStompTargetActors(
  actor,
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
    measureDistance =
      undefined,
  } = {},
) {
  if (!sourceToken) {
    return [];
  }

  return collectWarStompTargets(
    sourceToken,
    tokens,
    measureDistance
      ? {
          measureDistance,
        }
      : {},
  ).map(
    target =>
      target.actor,
  );
}

function abilityActionResolutionContent(
  weapon,
  target,
  {
    automaticHit = false,
    damage,
    magical = false,
  } = {},
) {
  const attackName =
    weapon?.name ??
    "Attack";
  const targetName =
    target?.isToken
      ? target.token?.name
      : target?.name ??
        "Target";

  const hitText =
    automaticHit
      ? `${attackName} targeting <strong>${targetName}</strong> hits automatically.`
      : `${attackName} targeting <strong>${targetName}</strong> succeeded.`;

  const damageText =
    magical
      ? `${damage} magical damage`
      : `${damage} damage`;

  return (
    `<p>${hitText}</p>` +
    `<p>${damageText}</p>` +
    `<button class="chat-button weapon-roll" ` +
    `data-action="boaRollAbilityActionDamage">` +
    `<i class="fas fa-dice"></i>` +
    `${globalThis.game?.i18n?.localize?.(
      "DoD.ui.chat.rollDamage",
    ) ?? "Roll Damage"}` +
    `</button>`
  );
}

export async function createAbilityActionResolutionMessages(
  actor,
  weapon,
  {
    actionKey,
    automaticHit = false,
    damage,
    targetActors = [],
    magical = false,
    doubleWeaponDamage = false,
    createMessage =
      data =>
        globalThis.ChatMessage?.create?.(
          data,
        ),
    // Injectable only for regression tests. Creating the hit/result card
    // must never roll damage.
    inflictDamageMessage =
      null,
  } = {},
) {
  void inflictDamageMessage;

  const messages = [];

  for (const target of targetActors) {
    const message =
      await createMessage({
        user:
          globalThis.game?.user?.id,
        speaker:
          globalThis.ChatMessage
            ?.getSpeaker?.({
              actor,
            }),
        content:
          abilityActionResolutionContent(
            weapon,
            target,
            {
              automaticHit,
              damage,
              magical,
            },
          ),
        flags: {
          [MODULE_ID]: {
            [TARGET_RESOLUTION_FLAG]: {
              actorUuid:
                actor?.uuid,
              weaponUuid:
                weapon?.uuid,
              targetActorUuid:
                target?.uuid,
              actionKey,
              damage,
              magical,
              doubleWeaponDamage,
            },
          },
        },
      });

    messages.push(
      message,
    );
  }

  return messages;
}

export async function createWarStompDamageMessages(
  actor,
  weapon,
  {
    targetActors =
      null,
    tokens =
      globalThis.canvas
        ?.tokens
        ?.placeables ??
      [],
    sourceToken =
      findActorToken(
        actor,
      ),
    createResolutionMessages =
      createAbilityActionResolutionMessages,
    doubleWeaponDamage =
      false,
  } = {},
) {
  const targets =
    targetActors ??
    getWarStompTargetActors(
      actor,
      {
        tokens,
        sourceToken,
      },
    );

  if (
    targets.length === 0
  ) {
    warning(
      sourceToken
        ? "BOA.notifications.warStompNoTargets"
        : "BOA.notifications.abilityActionNoSourceToken",
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

  await createResolutionMessages(
    actor,
    weapon,
    {
      actionKey:
        WAR_STOMP_KEY,
      damage:
        "D6",
      targetActors:
        targets,
      doubleWeaponDamage,
    },
  );

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

function isEyeBeamWeapon(
  weapon,
) {
  return isManagedAbilityAction(
    weapon,
    EYE_BEAM_KEY,
  );
}

function countsAgainstPhysicalWeaponLimit(
  weapon,
) {
  return (
    !weapon?.hasWeaponFeature?.(
      "unarmed",
    ) &&
    !isEyeBeamWeapon(
      weapon,
    )
  );
}

async function loadActorBaseSheetClass() {
  const module =
    await loadDragonbaneModule(
      "systems/dragonbane/modules/sheets/actor-base-sheet.js",
    );

  return (
    module?.default ??
    null
  );
}

export async function patchAbilityActionWeaponSlots({
  ActorClass =
    globalThis.CONFIG
      ?.Actor
      ?.documentClass,
  ActorSheetClass =
    null,
} = {}) {
  const actorPrototype =
    ActorClass?.prototype;

  if (
    typeof actorPrototype
      ?.canEquipWeapon !==
      "function" ||
    typeof actorPrototype
      ?.getEquippedWeapons !==
      "function"
  ) {
    console.error(
      `${MODULE_ID} | Dragonbane Actor weapon-slot API was not available for ability actions.`,
    );
    return false;
  }

  const sheetClass =
    ActorSheetClass ??
    await loadActorBaseSheetClass();

  const sheetPrototype =
    sheetClass?.prototype;

  if (
    typeof sheetPrototype
      ?._prepareItems !==
      "function"
  ) {
    console.error(
      `${MODULE_ID} | Dragonbane Actor-sheet weapon preparation was not available for ability actions.`,
    );
    return false;
  }

  if (
    actorPrototype.canEquipWeapon[
      ABILITY_ACTION_WEAPON_SLOT_PATCH
    ] !== true
  ) {
    const nativeCanEquipWeapon =
      actorPrototype
        .canEquipWeapon;

    function boaCanEquipWeapon(
      ...args
    ) {
      const equipped =
        this.getEquippedWeapons?.() ??
        [];

      if (
        !equipped.some(
          isEyeBeamWeapon,
        )
      ) {
        return nativeCanEquipWeapon.apply(
          this,
          args,
        );
      }

      return (
        equipped.filter(
          countsAgainstPhysicalWeaponLimit,
        ).length < 3
      );
    }

    Object.defineProperty(
      boaCanEquipWeapon,
      ABILITY_ACTION_WEAPON_SLOT_PATCH,
      {
        value:
          true,
      },
    );

    Object.defineProperty(
      boaCanEquipWeapon,
      "boaNativeCanEquipWeapon",
      {
        value:
          nativeCanEquipWeapon,
      },
    );

    actorPrototype.canEquipWeapon =
      boaCanEquipWeapon;
  }

  if (
    sheetPrototype._prepareItems[
      ABILITY_ACTION_SHEET_SLOT_PATCH
    ] !== true
  ) {
    const nativePrepareItems =
      sheetPrototype
        ._prepareItems;

    function boaPrepareItems(
      context,
      ...args
    ) {
      const result =
        nativePrepareItems.call(
          this,
          context,
          ...args,
        );

      if (
        Array.isArray(
          context?.equippedWeapons,
        ) &&
        context.equippedWeapons.some(
          isEyeBeamWeapon,
        )
      ) {
        context.canEquipWeapon =
          context.equippedWeapons.filter(
            countsAgainstPhysicalWeaponLimit,
          ).length < 3;
      }

      return result;
    }

    Object.defineProperty(
      boaPrepareItems,
      ABILITY_ACTION_SHEET_SLOT_PATCH,
      {
        value:
          true,
      },
    );

    sheetPrototype._prepareItems =
      boaPrepareItems;
  }

  return true;
}

export function normalizeWarStompDialogData(
  test,
) {
  if (
    !isWarStompWeapon(
      test?.weapon,
    )
  ) {
    return false;
  }

  test.options = {
    ...(test.options ?? {}),
    action:
      "normal",
    extraDamage:
      "",
    enchantedWeapon:
      0,
  };

  test.dialogData ??= {};
  test.dialogData.actions = [];
  test.dialogData.extraDamage = "";

  if (
    !test.noBanesBoons
  ) {
    test.dialogData.banes ??= [];

    if (
      !test.dialogData.banes.some(
        bane =>
          bane.source ===
            "War Stomp",
      )
    ) {
      test.dialogData.banes.push({
        source:
          "War Stomp",
        value:
          true,
      });
    }

    const boons =
      test.dialogData.boons?.length ??
      0;
    const banes =
      test.dialogData.banes.length;

    test.dialogData.fillerBanes =
      Math.max(
        0,
        boons - banes,
      );
    test.dialogData.fillerBoons =
      Math.max(
        0,
        banes - boons,
      );
  }

  return true;
}

export function normalizeWarStompRollOptions(
  options,
) {
  if (
    options?.cancelled
  ) {
    return options;
  }

  const banes =
    Array.isArray(
      options?.banes,
    )
      ? [
          ...options.banes,
        ]
      : [];

  if (
    !banes.includes(
      "War Stomp",
    )
  ) {
    banes.push(
      "War Stomp",
    );
  }

  return {
    ...options,
    action:
      "normal",
    extraDamage:
      "",
    enchantedWeapon:
      0,
    banes,
  };
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

async function setPendingWarStompDamage(
  test,
  targetActors,
) {
  if (
    !test?.rollMessage?.setFlag
  ) {
    return false;
  }

  await test.rollMessage.setFlag(
    MODULE_ID,
    PENDING_WAR_STOMP_FLAG,
    {
      actorUuid:
        test.actor?.uuid,
      weaponUuid:
        test.weapon?.uuid,
      targetActorUuids:
        targetActors.map(
          actor =>
            actor.uuid,
        ),
    },
  );

  return true;
}

export async function confirmWarStompUse(
  options,
  DialogV2 =
    globalThis.foundry
      ?.applications
      ?.api
      ?.DialogV2,
) {
  if (
    typeof DialogV2?.confirm !==
      "function"
  ) {
    return false;
  }

  return DialogV2.confirm(
    options,
  );
}
export async function patchWarStompWeaponTest({
  WeaponTestClass =
    null,
  resolveDamage =
    createWarStompDamageMessages,
  confirm =
    confirmWarStompUse,
} = {}) {
  const TestClass =
    WeaponTestClass ??
    await loadWeaponTestClass();

  const prototype =
    TestClass?.prototype;

  if (
    typeof prototype?.roll !==
      "function" ||
    typeof prototype
      ?.updateDialogData !==
      "function"
  ) {
    console.error(
      `${MODULE_ID} | Dragonbane DoDWeaponTest was not available for War Stomp automation.`,
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

  const nativeUpdateDialogData =
    prototype.updateDialogData;

  function boaWarStompUpdateDialogData(
    ...args
  ) {
    const result =
      nativeUpdateDialogData.apply(
        this,
        args,
      );

    if (
      isWarStompWeapon(
        this.weapon,
      ) &&
      isWarStompAutomationEnabled()
    ) {
      normalizeWarStompDialogData(
        this,
      );
    }

    return result;
  }

  Object.defineProperty(
    boaWarStompUpdateDialogData,
    WAR_STOMP_DIALOG_PATCH,
    {
      value:
        true,
    },
  );

  prototype.updateDialogData =
    boaWarStompUpdateDialogData;

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

    if (!this.isReroll) {
      const accepted =
        await confirm({
          window: {
            title:
              "War Stomp",
          },
          content:
            format(
              "BOA.dialog.abilityActions.warStompConfirm",
              {},
            ),
        });

      if (!accepted) {
        return undefined;
      }
    }

    const nativeGetOptions =
      this.getRollOptions;

    this.getRollOptions =
      async (...optionArgs) => {
        const options =
          await nativeGetOptions.apply(
            this,
            optionArgs,
          );

        return normalizeWarStompRollOptions(
          options,
        );
      };

    let result;

    try {
      result =
        await nativeRoll.apply(
          this,
          args,
        );
    } finally {
      this.getRollOptions =
        nativeGetOptions;
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
      !this.postRollData
        ?.success
    ) {
      return result;
    }

    const targetActors =
      getWarStompTargetActors(
        actor,
      );

    if (
      targetActors.length === 0
    ) {
      warning(
        "BOA.notifications.warStompNoTargets",
      );
      return result;
    }

    if (
      this.postRollData
        ?.isDragon
    ) {
      await setPendingWarStompDamage(
        this,
        targetActors,
      );
      return result;
    }

    await resolveDamage(
      actor,
      this.weapon,
      {
        targetActors,
      },
    );

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

function resolveUuid(
  uuid,
) {
  if (!uuid) {
    return null;
  }

  try {
    return (
      globalThis.fromUuidSync?.(
        uuid,
      ) ??
      null
    );
  } catch (_error) {
    return null;
  }
}

export async function resolvePendingWarStompCritical(
  message,
  {
    resolveDamage =
      createWarStompDamageMessages,
    resolveDocument =
      resolveUuid,
  } = {},
) {
  const pending =
    message?.getFlag?.(
      MODULE_ID,
      PENDING_WAR_STOMP_FLAG,
    );

  if (!pending) {
    return false;
  }

  const context =
    messageContext(
      message,
    );

  const criticalEffect =
    context
      ?.criticalEffect;

  if (!criticalEffect) {
    return false;
  }

  await message.unsetFlag?.(
    MODULE_ID,
    PENDING_WAR_STOMP_FLAG,
  );

  const actor =
    context?.actor ??
    resolveDocument(
      pending.actorUuid,
    );

  const weapon =
    context?.weapon ??
    resolveDocument(
      pending.weaponUuid,
    );

  if (
    !actor ||
    !isWarStompWeapon(
      weapon,
    )
  ) {
    return false;
  }

  const targetActors =
    (
      pending
        .targetActorUuids ??
      []
    )
      .map(
        resolveDocument,
      )
      .filter(
        Boolean,
      );

  await resolveDamage(
    actor,
    weapon,
    {
      targetActors,
      doubleWeaponDamage:
        criticalEffect ===
          "doubleWeaponDamage",
    },
  );

  return true;
}

export async function onUpdateAbilityActionChatMessage(
  message,
) {
  await resolvePendingWarStompCritical(
    message,
  );
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

export async function rollAbilityActionResolutionDamage(
  message,
  {
    resolveDocument =
      resolveUuid,
    inflictDamageMessage =
      null,
  } = {},
) {
  const pending =
    message?.getFlag?.(
      MODULE_ID,
      TARGET_RESOLUTION_FLAG,
    );

  if (!pending) {
    return false;
  }

  const actor =
    resolveDocument(
      pending.actorUuid,
    );
  const weapon =
    resolveDocument(
      pending.weaponUuid,
    );
  const target =
    resolveDocument(
      pending.targetActorUuid,
    );

  if (
    !actor ||
    !weapon ||
    !target
  ) {
    return false;
  }

  const inflict =
    inflictDamageMessage ??
    await loadDamageHelper();

  await inflict({
    actor,
    weapon,
    damage:
      pending.damage,
    damageType:
      globalThis.CONFIG
        ?.DoD
        ?.damageTypes
        ?.none ??
      "none",
    doubleWeaponDamage:
      Boolean(
        pending.doubleWeaponDamage,
      ),
    target,
  });

  return true;
}

export function onAbilityActionDamageClick(
  event,
) {
  const resolutionButton =
    event?.target?.closest?.(
      "[data-action='boaRollAbilityActionDamage']",
    );

  if (resolutionButton) {
    event.preventDefault?.();
    event.stopImmediatePropagation?.();

    const element =
      resolutionButton.closest(
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

    if (message) {
      void rollAbilityActionResolutionDamage(
        message,
      );
    }

    return;
  }

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

export async function confirmEyeBeamUse(
  options,
  DialogV2 =
    globalThis.foundry
      ?.applications
      ?.api
      ?.DialogV2,
) {
  if (
    typeof DialogV2?.confirm !==
      "function"
  ) {
    return false;
  }

  return DialogV2.confirm(
    options,
  );
}

export async function useEyeBeamAction(
  actor,
  actionItem,
  {
    target =
      selectedTarget(),
    sourceToken =
      findActorToken(
        actor,
      ),
    confirm =
      confirmEyeBeamUse,
    createResolutionMessages =
      createAbilityActionResolutionMessages,
    // Injectable only for regression tests. Activation must not roll damage.
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
    await confirm({
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
      actionItem?.name ??
        "Eye Beam",
    );

  if (!paid) {
    return true;
  }

  void inflictDamageMessage;

  const damageItem =
    isEyeBeamWeapon(
      actionItem,
    )
      ? actionItem
      : managedItemsFor(
          actor,
          EYE_BEAM_KEY,
        )[0] ??
        actionItem;

  await createResolutionMessages(
    actor,
    damageItem,
    {
      actionKey:
        EYE_BEAM_KEY,
      automaticHit:
        true,
      damage:
        "2D8",
      magical:
        true,
      targetActors: [
        target.actor,
      ],
    },
  );

  return true;
}

function isEyeBeamSourceAbility(
  item,
) {
  return (
    item?.type === "ability" &&
    getContentKey(
      item,
    ) ===
      EYE_BEAM_SOURCE_CONTENT_KEY
  );
}

export function isEyeBeamActionItem(
  item,
) {
  return (
    isEyeBeamSourceAbility(
      item,
    ) ||
    isEyeBeamWeapon(
      item,
    )
  );
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
          [
            "[data-action='useAbility']",
            "[data-action='skillRoll']",
            "[data-action='rollDamage']",
          ].join(","),
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
        !isEyeBeamActionItem(
          item,
        ) ||
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
