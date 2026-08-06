import {
  MODULE_ID,
} from "./core/constants.js";
import {
  getContentKey,
} from "./core/documents.js";
import {
  isDeathKnightRunesAutomationEnabled,
} from "./automation-settings.js";

export const DEATH_KNIGHT_REBIRTH_CONTENT_KEY =
  "heroic-class-ability.death-knight.death-knights-rebirth";
export const DEATH_KNIGHT_RUNE_FLAG =
  "deathKnightRune";
export const DEATH_KNIGHT_RUNE_EFFECT_FLAG =
  "deathKnightRuneEffect";

const RUNE_SCHEMA_VERSION = 1;
const UNENDING_THIRST_EFFECT_NAME =
  "Unending Thirst";
const reconcileQueues =
  new WeakMap();

export const DEATH_KNIGHT_RUNE_DEFINITIONS =
  Object.freeze({
    fallenCrusader: Object.freeze({
      key: "fallenCrusader",
      name:
        "BOA.deathKnightRunes.fallenCrusader",
      icon:
        "modules/bane-of-azeroth/assets/icons/runes/fallen_crusader.webp",
      automated: false,
    }),
    razorice: Object.freeze({
      key: "razorice",
      name:
        "BOA.deathKnightRunes.razorice",
      icon:
        "modules/bane-of-azeroth/assets/icons/runes/razorice.webp",
      automated: false,
    }),
    unendingThirst: Object.freeze({
      key: "unendingThirst",
      name:
        "BOA.deathKnightRunes.unendingThirst",
      icon:
        "modules/bane-of-azeroth/assets/icons/runes/unending_thirst.webp",
      automated: true,
    }),
  });

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) {
    return collection;
  }
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

function actorItems(actor) {
  return collectionValues(
    actor?.items,
  );
}

function itemEffects(item) {
  return collectionValues(
    item?.effects,
  );
}

function flag(document, key) {
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

async function setActorFlag(
  actor,
  value,
) {
  if (
    typeof actor?.setFlag ===
    "function"
  ) {
    await actor.setFlag(
      MODULE_ID,
      DEATH_KNIGHT_RUNE_FLAG,
      value,
    );
    return;
  }

  actor.flags ??= {};
  actor.flags[
    MODULE_ID
  ] ??= {};
  actor.flags[
    MODULE_ID
  ][
    DEATH_KNIGHT_RUNE_FLAG
  ] = value;
}

async function unsetActorFlag(
  actor,
) {
  if (
    typeof actor?.unsetFlag ===
    "function"
  ) {
    await actor.unsetFlag(
      MODULE_ID,
      DEATH_KNIGHT_RUNE_FLAG,
    );
    return;
  }

  if (
    actor?.flags?.[
      MODULE_ID
    ]
  ) {
    delete actor.flags[
      MODULE_ID
    ][
      DEATH_KNIGHT_RUNE_FLAG
    ];
  }
}

function effectFlag(effect) {
  return flag(
    effect,
    DEATH_KNIGHT_RUNE_EFFECT_FLAG,
  );
}

function isManagedRuneEffect(
  effect,
) {
  return Boolean(
    effectFlag(
      effect,
    ),
  );
}

function managedRuneEffects(
  actor,
) {
  return actorItems(
    actor,
  ).flatMap(
    item =>
      itemEffects(
        item,
      ).filter(
        isManagedRuneEffect,
      ),
  );
}

function canManageActor(actor) {
  return Boolean(
    globalThis.game?.user?.isGM ||
    actor?.isOwner
  );
}

function isLocalOrigin(
  userId,
) {
  if (
    userId === undefined ||
    userId === null
  ) {
    return true;
  }

  return (
    userId ===
    globalThis.game?.user?.id
  );
}

function localize(
  key,
  fallback,
) {
  const value =
    globalThis.game?.i18n
      ?.localize?.(
        key,
      );

  if (
    !value ||
    value === key
  ) {
    return fallback;
  }

  return value;
}

function escapeHtml(value) {
  const text =
    String(
      value ??
      "",
    );

  return text
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}

function rootElement(html) {
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
    null
  );
}

export function getDeathKnightRuneDefinitions() {
  return Object.values(
    DEATH_KNIGHT_RUNE_DEFINITIONS,
  );
}

export function hasDeathKnightsRebirth(
  actor,
) {
  return actorItems(
    actor,
  ).some(
    item =>
      item?.type ===
        "ability" &&
      getContentKey(
        item,
      ) ===
        DEATH_KNIGHT_REBIRTH_CONTENT_KEY,
  );
}

export function isDeathKnightRuneEligibleWeapon(
  item,
) {
  if (
    item?.type !==
    "weapon"
  ) {
    return false;
  }

  if (
    typeof item.isRangedWeapon ===
    "boolean"
  ) {
    return !item.isRangedWeapon;
  }

  const rawRange =
    item?.system?.calculatedRange ??
    item?.system?.range?.value ??
    item?.system?.range;

  const range =
    Number(
      rawRange,
    );

  if (
    Number.isFinite(
      range,
    )
  ) {
    return range < 10;
  }

  return true;
}

export function getDeathKnightRuneEligibleWeapons(
  actor,
) {
  return actorItems(
    actor,
  ).filter(
    isDeathKnightRuneEligibleWeapon,
  );
}

export function getDeathKnightRuneState(
  actor,
) {
  const state =
    flag(
      actor,
      DEATH_KNIGHT_RUNE_FLAG,
    );

  if (
    !state ||
    state.schemaVersion !==
      RUNE_SCHEMA_VERSION ||
    !DEATH_KNIGHT_RUNE_DEFINITIONS[
      state.rune
    ] ||
    typeof state.weaponId !==
      "string" ||
    !state.weaponId
  ) {
    return null;
  }

  return {
    schemaVersion:
      RUNE_SCHEMA_VERSION,
    rune:
      state.rune,
    weaponId:
      state.weaponId,
  };
}

export function buildUnendingThirstEffectData(
  weapon,
) {
  return {
    name:
      UNENDING_THIRST_EFFECT_NAME,
    img:
      DEATH_KNIGHT_RUNE_DEFINITIONS
        .unendingThirst
        .icon,
    origin:
      weapon?.uuid ??
      null,
    disabled:
      false,
    transfer:
      true,
    system: {
      applyOnlyWhenEquipped:
        true,
      changes: [{
        key:
          "system.movement.value",
        type:
          "add",
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
        [
          DEATH_KNIGHT_RUNE_EFFECT_FLAG
        ]: {
          schemaVersion:
            RUNE_SCHEMA_VERSION,
          rune:
            "unendingThirst",
          weaponId:
            weapon?.id ??
            null,
        },
      },
    },
  };
}

async function deleteEffect(
  effect,
) {
  if (
    typeof effect?.delete ===
    "function"
  ) {
    await effect.delete();
    return;
  }

  const parent =
    effect?.parent;

  if (
    typeof parent
      ?.deleteEmbeddedDocuments ===
    "function" &&
    effect?.id
  ) {
    await parent
      .deleteEmbeddedDocuments(
        "ActiveEffect",
        [
          effect.id,
        ],
      );
    return;
  }

  if (
    Array.isArray(
      parent?.effects,
    )
  ) {
    const index =
      parent.effects
        .indexOf(
          effect,
        );

    if (
      index >= 0
    ) {
      parent.effects.splice(
        index,
        1,
      );
    }
  }
}

async function createEffect(
  weapon,
  data,
) {
  if (
    typeof weapon
      ?.createEmbeddedDocuments ===
    "function"
  ) {
    const created =
      await weapon
        .createEmbeddedDocuments(
          "ActiveEffect",
          [
            data,
          ],
        );

    return (
      created?.[0] ??
      null
    );
  }

  weapon.effects ??= [];
  const fallback = {
    ...data,
    id:
      `boa-rune-effect-${weapon.effects.length + 1}`,
    parent:
      weapon,
    getFlag(
      moduleId,
      key,
    ) {
      return this.flags?.[
        moduleId
      ]?.[key];
    },
    async delete() {
      const index =
        weapon.effects
          .indexOf(
            this,
          );
      if (
        index >= 0
      ) {
        weapon.effects.splice(
          index,
          1,
        );
      }
    },
  };

  weapon.effects.push(
    fallback,
  );

  return fallback;
}

async function removeManagedEffects(
  actor,
  {
    keepEffect = null,
  } = {},
) {
  for (
    const effect
    of managedRuneEffects(
      actor,
    )
  ) {
    if (
      effect ===
      keepEffect
    ) {
      continue;
    }

    await deleteEffect(
      effect,
    );
  }
}

function matchingUnendingEffect(
  weapon,
) {
  return itemEffects(
    weapon,
  ).find(
    effect => {
      const managed =
        effectFlag(
          effect,
        );
      const changes =
        Array.from(
          effect?.system
            ?.changes ??
          [],
        );

      return (
        managed
          ?.rune ===
          "unendingThirst" &&
        managed
          ?.weaponId ===
          weapon?.id &&
        effect?.system
          ?.applyOnlyWhenEquipped ===
          true &&
        changes.length ===
          1 &&
        changes[0]
          ?.key ===
          "system.movement.value" &&
        changes[0]
          ?.type ===
          "add" &&
        changes[0]
          ?.phase ===
          "final" &&
        Number(
          changes[0]
            ?.priority,
        ) ===
          20 &&
        String(
          changes[0]
            ?.value,
        ) ===
          "2"
      );
    },
  ) ??
    null;
}

async function reconcileDeathKnightRuneActorNow(
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

  const state =
    getDeathKnightRuneState(
      actor,
    );

  if (!state) {
    await removeManagedEffects(
      actor,
    );
    return true;
  }

  const hasRebirth =
    hasDeathKnightsRebirth(
      actor,
    );

  const weapon =
    actorItems(
      actor,
    ).find(
      item =>
        item?.id ===
        state.weaponId,
    ) ??
    null;

  if (
    !hasRebirth ||
    !isDeathKnightRuneEligibleWeapon(
      weapon,
    )
  ) {
    await removeManagedEffects(
      actor,
    );
    await unsetActorFlag(
      actor,
    );
    return true;
  }

  const enabled =
    isDeathKnightRunesAutomationEnabled(
      settings,
    );

  if (
    !enabled ||
    state.rune !==
      "unendingThirst"
  ) {
    await removeManagedEffects(
      actor,
    );
    return true;
  }

  const keepEffect =
    matchingUnendingEffect(
      weapon,
    );

  await removeManagedEffects(
    actor,
    {
      keepEffect,
    },
  );

  if (!keepEffect) {
    await createEffect(
      weapon,
      buildUnendingThirstEffectData(
        weapon,
      ),
    );
  }

  return true;
}

export function reconcileDeathKnightRuneActor(
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
          reconcileDeathKnightRuneActorNow(
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
        ) ===
        next
      ) {
        reconcileQueues.delete(
          actor,
        );
      }
    },
  );
}

export async function reconcileDeathKnightRunes(
  actor = null,
) {
  if (actor) {
    return reconcileDeathKnightRuneActor(
      actor,
    );
  }

  if (
    !globalThis.game?.user?.isGM
  ) {
    return false;
  }

  for (
    const candidate
    of collectionValues(
      globalThis.game?.actors,
    )
  ) {
    await reconcileDeathKnightRuneActor(
      candidate,
    );
  }

  return true;
}

export async function setDeathKnightRune(
  actor,
  rune,
  weaponId,
) {
  if (
    !actor ||
    actor.type !==
      "character" ||
    !canManageActor(
      actor,
    ) ||
    !hasDeathKnightsRebirth(
      actor,
    )
  ) {
    return false;
  }

  if (
    !DEATH_KNIGHT_RUNE_DEFINITIONS[
      rune
    ]
  ) {
    return false;
  }

  const weapon =
    getDeathKnightRuneEligibleWeapons(
      actor,
    ).find(
      item =>
        item.id ===
        weaponId,
    );

  if (!weapon) {
    return false;
  }

  await setActorFlag(
    actor,
    {
      schemaVersion:
        RUNE_SCHEMA_VERSION,
      rune,
      weaponId:
        weapon.id,
    },
  );

  await reconcileDeathKnightRuneActor(
    actor,
  );

  return true;
}

export async function clearDeathKnightRune(
  actor,
) {
  if (
    !actor ||
    actor.type !==
      "character" ||
    !canManageActor(
      actor,
    )
  ) {
    return false;
  }

  await removeManagedEffects(
    actor,
  );

  await unsetActorFlag(
    actor,
  );

  return true;
}

function relevantItem(
  item,
) {
  const actor =
    item?.parent;

  if (
    !actor ||
    actor.type !==
      "character"
  ) {
    return false;
  }

  if (
    getContentKey(
      item,
    ) ===
      DEATH_KNIGHT_REBIRTH_CONTENT_KEY
  ) {
    return true;
  }

  const state =
    getDeathKnightRuneState(
      actor,
    );

  return (
    item?.id ===
      state?.weaponId ||
    itemEffects(
      item,
    ).some(
      isManagedRuneEffect,
    )
  );
}

async function reconcileFromItemHook(
  item,
  userId,
) {
  if (
    !isLocalOrigin(
      userId,
    ) ||
    !relevantItem(
      item,
    )
  ) {
    return false;
  }

  return reconcileDeathKnightRuneActor(
    item.parent,
  );
}

export function onCreateDeathKnightRuneItem(
  item,
  _options,
  userId,
) {
  return reconcileFromItemHook(
    item,
    userId,
  );
}

export function onUpdateDeathKnightRuneItem(
  item,
  _changes,
  _options,
  userId,
) {
  return reconcileFromItemHook(
    item,
    userId,
  );
}

export function onDeleteDeathKnightRuneItem(
  item,
  _options,
  userId,
) {
  const actor =
    item?.parent;

  if (
    !isLocalOrigin(
      userId,
    ) ||
    !actor ||
    actor.type !==
      "character"
  ) {
    return false;
  }

  const state =
    getDeathKnightRuneState(
      actor,
    );

  if (
    getContentKey(
      item,
    ) !==
      DEATH_KNIGHT_REBIRTH_CONTENT_KEY &&
    item?.id !==
      state?.weaponId
  ) {
    return false;
  }

  return (
    async () => {
      await removeManagedEffects(
        actor,
      );
      await unsetActorFlag(
        actor,
      );
      return true;
    }
  )();
}

function runeControlsMarkup(
  actor,
  {
    canManage =
      canManageActor(
        actor,
      ),
  } = {},
) {
  const weapons =
    getDeathKnightRuneEligibleWeapons(
      actor,
    );

  const state =
    getDeathKnightRuneState(
      actor,
    );

  const selectedWeapon =
    weapons.find(
      weapon =>
        weapon.id ===
        state?.weaponId,
    ) ??
    null;

  const activeRune =
    state
      ? DEATH_KNIGHT_RUNE_DEFINITIONS[
          state.rune
        ]
      : null;

  const disabled =
    canManage
      ? ""
      : " disabled";

  const weaponOptions = [
    `<option value="">${escapeHtml(
      localize(
        "BOA.deathKnightRunes.chooseWeapon",
        "Choose melee weapon",
      ),
    )}</option>`,
    ...weapons.map(
      weapon =>
        `<option value="${escapeHtml(
          weapon.id,
        )}"${
          weapon.id ===
            state?.weaponId
            ? " selected"
            : ""
        }>${escapeHtml(
          weapon.name,
        )}</option>`,
    ),
  ].join(
    "",
  );

  const runeButtons =
    getDeathKnightRuneDefinitions()
      .map(
        rune =>
          `<button type="button" class="boa-death-knight-rune-button${
            rune.key ===
              state?.rune
              ? " active"
              : ""
          }" data-boa-rune="${escapeHtml(
            rune.key,
          )}" title="${escapeHtml(
            localize(
              rune.name,
              rune.key,
            ),
          )}"${disabled}>`
          + `<img src="${escapeHtml(
            rune.icon,
          )}" alt="">`
          + `<span>${escapeHtml(
            localize(
              rune.name,
              rune.key,
            ),
          )}</span>`
          + `</button>`,
      )
      .join(
        "",
      );

  const activeText =
    activeRune &&
    selectedWeapon
      ? `${localize(
          "BOA.deathKnightRunes.active",
          "Active",
        )}: ${localize(
          activeRune.name,
          activeRune.key,
        )} — ${selectedWeapon.name}`
      : localize(
          "BOA.deathKnightRunes.none",
          "No rune engraved",
        );

  const noWeapons =
    weapons.length > 0
      ? ""
      : `<p class="hint">${
          escapeHtml(
            localize(
              "BOA.deathKnightRunes.noWeapons",
              "No melee weapons are available.",
            ),
          )
        }</p>`;

  return (
    `<section class="boa-death-knight-runes">`
    + `<h3>${escapeHtml(
      localize(
        "BOA.deathKnightRunes.title",
        "Death Knight Runes",
      ),
    )}</h3>`
    + `<p class="hint">${escapeHtml(
      localize(
        "BOA.deathKnightRunes.hint",
        "Engraving a rune takes a stretch. Choose the rune and melee weapon after the stretch is completed.",
      ),
    )}</p>`
    + `<div class="boa-death-knight-rune-controls">`
    + `<select class="boa-death-knight-rune-weapon"${disabled}>`
    + weaponOptions
    + `</select>`
    + `<div class="boa-death-knight-rune-buttons">`
    + runeButtons
    + `</div>`
    + `</div>`
    + noWeapons
    + `<p class="boa-death-knight-rune-active">${escapeHtml(
      activeText,
    )}</p>`
    + `<button type="button" class="boa-death-knight-rune-clear"${disabled}>`
    + escapeHtml(
      localize(
        "BOA.deathKnightRunes.clear",
        "Clear Rune",
      ),
    )
    + `</button>`
    + `</section>`
  );
}

export async function renderDeathKnightRuneControls(
  app,
  html,
) {
  const actor =
    app?.actor ??
    app?.document ??
    null;

  if (
    !actor ||
    actor.type !==
      "character"
  ) {
    return false;
  }

  const root =
    rootElement(
      html,
    );

  if (!root) {
    return false;
  }

  root
    .querySelector(
      ".boa-death-knight-runes",
    )
    ?.remove();

  if (
    !isDeathKnightRunesAutomationEnabled() ||
    !hasDeathKnightsRebirth(
      actor,
    )
  ) {
    return false;
  }

  if (
    canManageActor(
      actor,
    )
  ) {
    await reconcileDeathKnightRuneActor(
      actor,
    );
  }

  const heroicTable =
    root.querySelector(
      ".heroic-abilities",
    );

  if (!heroicTable) {
    return false;
  }

  const wrapper =
    globalThis.document
      ?.createElement?.(
        "div",
      );

  if (!wrapper) {
    return false;
  }

  wrapper.innerHTML =
    runeControlsMarkup(
      actor,
    );

  const section =
    wrapper.firstElementChild;

  if (!section) {
    return false;
  }

  heroicTable.insertAdjacentElement(
    "afterend",
    section,
  );

  const weaponSelect =
    section.querySelector(
      ".boa-death-knight-rune-weapon",
    );

  const selectedWeaponId =
    () =>
      weaponSelect?.value ||
      getDeathKnightRuneState(
        actor,
      )?.weaponId ||
      "";

  weaponSelect?.addEventListener(
    "change",
    async event => {
      const state =
        getDeathKnightRuneState(
          actor,
        );

      if (
        !state ||
        !event.currentTarget
          ?.value
      ) {
        return;
      }

      await setDeathKnightRune(
        actor,
        state.rune,
        event.currentTarget.value,
      );

      app.render?.(
        false,
      );
    },
  );

  for (
    const button
    of section.querySelectorAll(
      "[data-boa-rune]",
    )
  ) {
    button.addEventListener(
      "click",
      async event => {
        const weaponId =
          selectedWeaponId();

        if (!weaponId) {
          globalThis.ui
            ?.notifications
            ?.warn?.(
              localize(
                "BOA.deathKnightRunes.chooseWeaponFirst",
                "Choose a melee weapon first.",
              ),
            );
          return;
        }

        await setDeathKnightRune(
          actor,
          event.currentTarget
            ?.dataset
            ?.boaRune,
          weaponId,
        );

        app.render?.(
          false,
        );
      },
    );
  }

  section
    .querySelector(
      ".boa-death-knight-rune-clear",
    )
    ?.addEventListener(
      "click",
      async () => {
        await clearDeathKnightRune(
          actor,
        );

        app.render?.(
          false,
        );
      },
    );

  return true;
}

export function onRenderDeathKnightRuneActorSheet(
  app,
  html,
) {
  return renderDeathKnightRuneControls(
    app,
    html,
  ).catch(
    error => {
      console.error(
        `${MODULE_ID} | Failed to render Death Knight rune controls.`,
        error,
      );
      return false;
    },
  );
}
