import {
  MODULE_ID,
} from "./core/constants.js";
import {
  isDruidFormAttackAutomationEnabled,
  isDruidFormMovementAutomationEnabled,
} from "./automation-settings.js";

export const DRUID_FORM_MOVEMENT_CONTENT_KEY =
  "druid-form-mechanics.travel-movement";
export const MAUL_CONTENT_KEY =
  "druid-form-attacks.maul";
export const SHRED_CONTENT_KEY =
  "druid-form-attacks.shred";
export const DRUID_FORM_ATTACK_ICON =
  "modules/bane-of-azeroth/assets/icons/classes/druid.webp";

const STATE_FLAG =
  "druidFormState";
const WEAPON_TEST_PATCH =
  Symbol.for(
    `${MODULE_ID}.druidFormAttack.weaponTest`,
  );
const DAMAGE_ROLL_PATCH =
  Symbol.for(
    `${MODULE_ID}.druidFormAttack.damageRoll`,
  );
const reconcileQueues =
  new WeakMap();

function values(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) {
    return collection.contents;
  }
  if (typeof collection.values === "function") {
    return Array.from(collection.values());
  }
  return Array.from(collection);
}

function contentKey(document) {
  return (
    document?.getFlag?.(
      MODULE_ID,
      "contentKey",
    ) ??
    document?.flags?.[
      MODULE_ID
    ]?.contentKey ??
    null
  );
}

function mechanicFlag(document) {
  return (
    document?.getFlag?.(
      MODULE_ID,
      "druidFormMechanic",
    ) ??
    document?.flags?.[
      MODULE_ID
    ]?.druidFormMechanic ??
    null
  );
}

function currentState(actor) {
  return (
    actor?.getFlag?.(
      MODULE_ID,
      STATE_FLAG,
    ) ??
    actor?.flags?.[
      MODULE_ID
    ]?.[
      STATE_FLAG
    ] ??
    {
      currentForm:
        "humanoid",
      activations: {},
    }
  );
}

function numericSkillValue(skill) {
  const value =
    Number(
      skill?.system?.value,
    );

  return Number.isFinite(value)
    ? value
    : 0;
}

function isBrawling(skill) {
  return (
    skill?.type === "skill" &&
    String(
      skill?.name ?? "",
    )
      .trim()
      .toLowerCase() ===
      "brawling"
  );
}

function isMagicSchool(skill) {
  return (
    skill?.type === "skill" &&
    skill?.system?.skillType ===
      "magic"
  );
}

export function getBestDruidNaturalAttackSkill(
  actor,
) {
  const candidates =
    values(actor?.items)
      .filter(
        skill =>
          isBrawling(skill) ||
          isMagicSchool(skill),
      )
      .map(
        skill => ({
          name:
            String(skill.name),
          value:
            numericSkillValue(skill),
          brawling:
            isBrawling(skill),
        }),
      );

  if (candidates.length === 0) {
    return {
      name:
        "Brawling",
      value:
        0,
    };
  }

  candidates.sort(
    (left, right) => {
      const byValue =
        right.value -
        left.value;

      if (byValue !== 0) {
        return byValue;
      }

      if (
        left.brawling !==
          right.brawling
      ) {
        return left.brawling
          ? -1
          : 1;
      }

      return left.name.localeCompare(
        right.name,
        "en",
        {
          sensitivity:
            "base",
        },
      );
    },
  );

  return {
    name:
      candidates[0].name,
    value:
      candidates[0].value,
  };
}

function normalizePowerLevel(powerLevel) {
  const value =
    Number(powerLevel);

  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(
    1,
    Math.min(
      3,
      Math.trunc(value),
    ),
  );
}

export function buildDruidFormAttackData(
  actor,
  form,
  powerLevel = 1,
) {
  if (
    form !== "bear" &&
    form !== "cat"
  ) {
    return null;
  }

  const skill =
    getBestDruidNaturalAttackSkill(
      actor,
    );
  const normalizedPowerLevel =
    normalizePowerLevel(
      powerLevel,
    );
  const isBear =
    form === "bear";

  return {
    name:
      isBear
        ? "Maul"
        : "Shred",
    type:
      "weapon",
    img:
      DRUID_FORM_ATTACK_ICON,
    system: {
      weight:
        null,
      quantity:
        1,
      cost:
        "–",
      supply:
        "common",
      worn:
        true,
      grip: {
        value:
          "none",
      },
      str:
        null,
      range:
        "2",
      damage:
        isBear
          ? "D6"
          : `${normalizedPowerLevel + 1}D6`,
      skill: {
        name:
          skill.name,
        value:
          skill.value,
      },
      features: [
        "unarmed",
      ],
      broken:
        false,
      mainHand:
        false,
      offHand:
        false,
      storage:
        false,
      itemDescription:
        isBear
          ? "Temporary natural attack available only in Bear Form."
          : "Temporary natural attack available only in Cat Form.",
      gmDescription:
        "",
    },
    flags: {
      [MODULE_ID]: {
        contentKey:
          isBear
            ? MAUL_CONTENT_KEY
            : SHRED_CONTENT_KEY,
        druidFormMechanic: {
          kind:
            "naturalAttack",
          form,
          powerLevel:
            normalizedPowerLevel,
        },
      },
    },
  };
}

export function buildDruidTravelMovementEffectData(
  actor,
) {
  return {
    name:
      "Travel Form Movement",
    img:
      DRUID_FORM_ATTACK_ICON,
    origin:
      actor?.uuid ?? null,
    disabled:
      false,
    transfer:
      false,
    system: {
      changes: [{
        key:
          "system.movement.value",
        type:
          "multiply",
        value:
          "2",
        phase:
          "final",
        priority:
          20,
      }],
    },
    flags: {
      [MODULE_ID]: {
        contentKey:
          DRUID_FORM_MOVEMENT_CONTENT_KEY,
        druidFormMechanic: {
          kind:
            "movement",
          form:
            "travel",
        },
      },
    },
  };
}

function activeActivation(
  state,
  key,
) {
  const activation =
    state?.activations?.[key];

  return activation?.active === true
    ? activation
    : null;
}

function wantedAttack(
  actor,
  state,
  settings,
) {
  if (
    !isDruidFormAttackAutomationEnabled(
      settings,
    )
  ) {
    return null;
  }

  const feral =
    activeActivation(
      state,
      "feral",
    );

  if (
    !feral ||
    (
      state?.currentForm !== "bear" &&
      state?.currentForm !== "cat"
    )
  ) {
    return null;
  }

  return buildDruidFormAttackData(
    actor,
    state.currentForm,
    feral.powerLevel,
  );
}

function wantsTravelMovement(
  state,
  settings,
) {
  return (
    isDruidFormMovementAutomationEnabled(
      settings,
    ) &&
    state?.currentForm ===
      "travel" &&
    Boolean(
      activeActivation(
        state,
        "savage",
      ),
    )
  );
}

async function deleteEmbedded(
  actor,
  documentType,
  ids,
) {
  const unique =
    [
      ...new Set(
        ids.filter(Boolean),
      ),
    ];

  if (unique.length === 0) {
    return [];
  }

  return actor.deleteEmbeddedDocuments(
    documentType,
    unique,
  );
}

async function reconcileTravelMovement(
  actor,
  state,
  settings,
) {
  const managed =
    values(actor?.effects)
      .filter(
        effect =>
          contentKey(effect) ===
            DRUID_FORM_MOVEMENT_CONTENT_KEY,
      );

  if (
    !wantsTravelMovement(
      state,
      settings,
    )
  ) {
    await deleteEmbedded(
      actor,
      "ActiveEffect",
      managed.map(
        effect => effect.id,
      ),
    );

    return {
      active:
        false,
      deleted:
        managed.length,
    };
  }

  const [
    keep,
    ...duplicates
  ] = managed;

  await deleteEmbedded(
    actor,
    "ActiveEffect",
    duplicates.map(
      effect => effect.id,
    ),
  );

  if (keep) {
    return {
      active:
        true,
      created:
        false,
      effect:
        keep,
    };
  }

  const created =
    await actor.createEmbeddedDocuments(
      "ActiveEffect",
      [
        buildDruidTravelMovementEffectData(
          actor,
        ),
      ],
    );

  return {
    active:
      true,
    created:
      true,
    effect:
      created?.[0] ?? null,
  };
}

function isManagedFormAttack(item) {
  const key =
    contentKey(item);

  return (
    key === MAUL_CONTENT_KEY ||
    key === SHRED_CONTENT_KEY
  );
}

function matchesWantedAttack(
  item,
  wanted,
) {
  if (!item || !wanted) {
    return false;
  }

  if (
    contentKey(item) !==
      contentKey(wanted)
  ) {
    return false;
  }

  const current =
    mechanicFlag(item);
  const target =
    mechanicFlag(wanted);

  return (
    current?.form ===
      target?.form &&
    Number(
      current?.powerLevel,
    ) ===
      Number(
        target?.powerLevel,
      )
  );
}

async function reconcileNaturalAttack(
  actor,
  state,
  settings,
) {
  const managed =
    values(actor?.items)
      .filter(
        isManagedFormAttack,
      );
  const wanted =
    wantedAttack(
      actor,
      state,
      settings,
    );

  if (!wanted) {
    await deleteEmbedded(
      actor,
      "Item",
      managed.map(
        item => item.id,
      ),
    );

    return {
      active:
        false,
      deleted:
        managed.length,
    };
  }

  const keep =
    managed.find(
      item =>
        matchesWantedAttack(
          item,
          wanted,
        ),
    ) ?? null;

  await deleteEmbedded(
    actor,
    "Item",
    managed
      .filter(
        item => item !== keep,
      )
      .map(
        item => item.id,
      ),
  );

  if (keep) {
    return {
      active:
        true,
      created:
        false,
      item:
        keep,
    };
  }

  const created =
    await actor.createEmbeddedDocuments(
      "Item",
      [wanted],
    );

  return {
    active:
      true,
    created:
      true,
    item:
      created?.[0] ?? null,
  };
}

export async function reconcileDruidFormMechanics(
  actor,
  {
    settings =
      globalThis.game?.settings,
  } = {},
) {
  if (
    !actor ||
    actor.type !==
      "character"
  ) {
    return {
      skipped:
        true,
    };
  }

  const state =
    currentState(actor);

  const movement =
    await reconcileTravelMovement(
      actor,
      state,
      settings,
    );
  const attack =
    await reconcileNaturalAttack(
      actor,
      state,
      settings,
    );

  return {
    skipped:
      false,
    currentForm:
      state?.currentForm ??
      "humanoid",
    movement,
    attack,
  };
}

function primaryActiveGM(
  users =
    globalThis.game?.users,
) {
  return values(users).find(
    user =>
      user?.active === true &&
      user?.isGM === true,
  ) ?? null;
}

function isMechanicsAuthority(
  user =
    globalThis.game?.user,
) {
  if (!user) return true;
  if (user.isGM !== true) {
    return false;
  }

  const primary =
    primaryActiveGM();

  return (
    !primary ||
    primary.id === user.id
  );
}

export async function reconcileAllDruidFormMechanics({
  actors =
    globalThis.game?.actors,
  settings =
    globalThis.game?.settings,
} = {}) {
  if (!isMechanicsAuthority()) {
    return [];
  }

  const results = [];

  for (
    const actor
    of values(actors)
  ) {
    if (
      actor?.type !==
        "character"
    ) {
      continue;
    }

    results.push(
      await reconcileDruidFormMechanics(
        actor,
        {
          settings,
        },
      ),
    );
  }

  return results;
}

function stateWasUpdated(changes) {
  if (!changes) return false;

  const prefix =
    `flags.${MODULE_ID}.${STATE_FLAG}`;

  if (
    Object.keys(changes).some(
      key =>
        key === prefix ||
        key.startsWith(
          `${prefix}.`,
        ),
    )
  ) {
    return true;
  }

  return Object.prototype
    .hasOwnProperty.call(
      changes?.flags?.[
        MODULE_ID
      ] ?? {},
      STATE_FLAG,
    );
}

function queueReconcile(actor) {
  if (
    !actor ||
    !isMechanicsAuthority()
  ) {
    return Promise.resolve(null);
  }

  const previous =
    reconcileQueues.get(actor) ??
    Promise.resolve();

  const next =
    previous
      .catch(
        () => undefined,
      )
      .then(
        () =>
          reconcileDruidFormMechanics(
            actor,
          ),
      )
      .catch(
        error => {
          console.error(
            `${MODULE_ID} | Failed to reconcile Druid form mechanics.`,
            error,
          );
          return null;
        },
      )
      .finally(
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

  reconcileQueues.set(
    actor,
    next,
  );

  return next;
}

export function onUpdateDruidFormMechanicsActor(
  actor,
  changes,
) {
  if (
    !stateWasUpdated(changes)
  ) {
    return false;
  }

  void queueReconcile(actor);
  return true;
}

function requiredNaturalAttack(actor) {
  const state =
    currentState(actor);
  const feral =
    activeActivation(
      state,
      "feral",
    );

  if (
    !feral ||
    (
      state?.currentForm !== "bear" &&
      state?.currentForm !== "cat"
    )
  ) {
    return null;
  }

  return state.currentForm ===
    "bear"
    ? {
        name:
          "Maul",
        contentKey:
          MAUL_CONTENT_KEY,
      }
    : {
        name:
          "Shred",
        contentKey:
          SHRED_CONTENT_KEY,
      };
}

export function isDruidFormWeaponUseAllowed(
  actor,
  weapon,
  {
    settings =
      globalThis.game?.settings,
  } = {},
) {
  if (
    !isDruidFormAttackAutomationEnabled(
      settings,
    )
  ) {
    return true;
  }

  const required =
    requiredNaturalAttack(actor);

  if (!required) return true;

  return (
    contentKey(weapon) ===
      required.contentKey
  );
}

function warnNaturalAttackOnly(actor) {
  const required =
    requiredNaturalAttack(actor);

  if (!required) return;

  const fallback =
    `Only ${required.name} can be used in this Druid form.`;
  const i18n =
    globalThis.game?.i18n;
  const localized =
    typeof i18n?.format ===
      "function"
      ? i18n.format(
          "BOA.notifications.druidFormNaturalAttackOnly",
          {
            attack:
              required.name,
          },
        )
      : fallback;

  globalThis.ui?.notifications
    ?.warn?.(
      localized ===
        "BOA.notifications.druidFormNaturalAttackOnly"
        ? fallback
        : localized,
    );
}

function patchWeaponTestClass(
  WeaponTestClass,
) {
  const prototype =
    WeaponTestClass?.prototype;

  if (!prototype) return "missing";

  const original =
    prototype.roll ??
    Object.getPrototypeOf(
      prototype,
    )?.roll;

  if (
    typeof original !==
      "function"
  ) {
    return "missing";
  }

  if (
    prototype.roll?.[
      WEAPON_TEST_PATCH
    ]
  ) {
    return "already";
  }

  async function boaDruidFormWeaponRoll(
    ...args
  ) {
    if (
      !isDruidFormWeaponUseAllowed(
        this.actor,
        this.weapon,
      )
    ) {
      warnNaturalAttackOnly(
        this.actor,
      );
      return false;
    }

    return original.apply(
      this,
      args,
    );
  }

  Object.defineProperty(
    boaDruidFormWeaponRoll,
    WEAPON_TEST_PATCH,
    {
      value:
        true,
    },
  );

  prototype.roll =
    boaDruidFormWeaponRoll;

  return "patched";
}

function weaponFromDamageEvent(
  sheet,
  event,
) {
  const itemId =
    event?.currentTarget
      ?.closest?.(
        ".sheet-table-data",
      )
      ?.dataset
      ?.itemId;

  return (
    sheet?.actor?.items?.get?.(
      itemId,
    ) ??
    values(
      sheet?.actor?.items,
    ).find(
      item =>
        item?.id === itemId,
    ) ??
    null
  );
}

function patchActorSheetDamageClass(
  ActorSheetClass,
) {
  const prototype =
    ActorSheetClass?.prototype;
  const original =
    prototype?._onDamageRoll;

  if (
    typeof original !==
      "function"
  ) {
    return "missing";
  }

  if (
    original[
      DAMAGE_ROLL_PATCH
    ]
  ) {
    return "already";
  }

  async function boaDruidFormDamageRoll(
    event,
    ...args
  ) {
    if (
      event?.type === "click"
    ) {
      const weapon =
        weaponFromDamageEvent(
          this,
          event,
        );

      if (
        weapon?.type === "weapon" &&
        !isDruidFormWeaponUseAllowed(
          this.actor,
          weapon,
        )
      ) {
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        warnNaturalAttackOnly(
          this.actor,
        );
        return false;
      }
    }

    return original.call(
      this,
      event,
      ...args,
    );
  }

  Object.defineProperty(
    boaDruidFormDamageRoll,
    DAMAGE_ROLL_PATCH,
    {
      value:
        true,
    },
  );

  prototype._onDamageRoll =
    boaDruidFormDamageRoll;

  return "patched";
}

export async function patchDruidFormWeaponUsage({
  WeaponTestClass =
    null,
  ActorSheetClass =
    null,
} = {}) {
  let weaponTestClass =
    WeaponTestClass;
  let actorSheetClass =
    ActorSheetClass;

  if (!weaponTestClass) {
    const module =
      await import(
        "/systems/dragonbane/modules/tests/weapon-test.js"
      );
    weaponTestClass =
      module.default;
  }

  if (!actorSheetClass) {
    const module =
      await import(
        "/systems/dragonbane/modules/sheets/actor-base-sheet.js"
      );
    actorSheetClass =
      module.default;
  }

  return {
    weaponTest:
      patchWeaponTestClass(
        weaponTestClass,
      ),
    damageRoll:
      patchActorSheetDamageClass(
        actorSheetClass,
      ),
  };
}
