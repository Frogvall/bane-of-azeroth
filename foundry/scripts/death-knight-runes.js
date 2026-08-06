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

  const rawFeatures =
    item?.system?.features;

  const features =
    Array.isArray(
      rawFeatures,
    )
      ? rawFeatures
      : (
          typeof rawFeatures
            ?.values ===
            "function"
            ? Array.from(
                rawFeatures.values(),
              )
            : []
        );

  const featureKeys =
    new Set(
      features.map(
        feature =>
          String(
            feature,
          )
            .trim()
            .toLowerCase(),
      ),
    );

  if (
    featureKeys.has(
      "shield",
    ) ||
    featureKeys.has(
      "unarmed",
    )
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

function runePickerMarkup(
  actor,
  weapon,
) {
  const state =
    getDeathKnightRuneState(
      actor,
    );

  const selectedRune =
    state?.weaponId ===
      weapon?.id
      ? state.rune
      : null;

  const choices =
    getDeathKnightRuneDefinitions()
      .map(
        rune => {
          const checked =
            rune.key ===
              selectedRune
              ? " checked"
              : "";

          return (
            `<label class="boa-death-knight-rune-choice">`
            + `<input type="radio" name="boa-rune" value="${escapeHtml(
              rune.key,
            )}"${checked}>`
            + `<img src="${escapeHtml(
              rune.icon,
            )}" alt="">`
            + `<span>${escapeHtml(
              localize(
                rune.name,
                rune.key,
              ),
            )}</span>`
            + `</label>`
          );
        },
      )
      .join(
        "",
      );

  const clearChecked =
    selectedRune
      ? ""
      : " checked";

  return (
    `<form class="boa-death-knight-rune-picker">`
    + `<p class="hint">${escapeHtml(
      localize(
        "BOA.deathKnightRunes.pickerHint",
        "Choose the rune to engrave on this weapon. Engraving here replaces any rune already engraved by this character.",
      ),
    )}</p>`
    + choices
    + `<label class="boa-death-knight-rune-choice boa-death-knight-rune-choice-clear">`
    + `<input type="radio" name="boa-rune" value=""${clearChecked}>`
    + `<span>${escapeHtml(
      localize(
        "BOA.deathKnightRunes.clear",
        "Clear Rune",
      ),
    )}</span>`
    + `</label>`
    + `</form>`
  );
}

async function chooseDeathKnightRuneForWeapon(
  actor,
  weapon,
) {
  if (
    !canManageActor(
      actor,
    ) ||
    !isDeathKnightRuneEligibleWeapon(
      weapon,
    )
  ) {
    return false;
  }

  const DialogV2 =
    globalThis.foundry
      ?.applications
      ?.api
      ?.DialogV2;

  if (
    typeof DialogV2?.wait !==
    "function"
  ) {
    globalThis.ui
      ?.notifications
      ?.error?.(
        localize(
          "BOA.deathKnightRunes.dialogUnavailable",
          "The rune picker could not be opened.",
        ),
      );
    return false;
  }

  const result =
    await DialogV2.wait({
      window: {
        title:
          `${localize(
            "BOA.deathKnightRunes.pickerTitle",
            "Death Knight Rune",
          )} — ${weapon.name}`,
      },
      content:
        runePickerMarkup(
          actor,
          weapon,
        ),
      buttons: [
        {
          action:
            "apply",
          label:
            localize(
              "BOA.deathKnightRunes.apply",
              "Apply Rune",
            ),
          default:
            true,
          callback:
            (
              _event,
              button,
            ) =>
              button?.form
                ?.querySelector?.(
                  'input[name="boa-rune"]:checked',
                )
                ?.value ??
              null,
        },
        {
          action:
            "cancel",
          label:
            localize(
              "BOA.deathKnightRunes.cancel",
              "Cancel",
            ),
        },
      ],
      close:
        () =>
          null,
    });

  if (
    result ===
      null ||
    result ===
      undefined
  ) {
    return false;
  }

  if (
    result ===
    ""
  ) {
    await clearDeathKnightRune(
      actor,
    );
    return true;
  }

  return setDeathKnightRune(
    actor,
    result,
    weapon.id,
  );
}

function createDeathKnightRuneSlot(
  actor,
  weapon,
  app,
  {
    canManage =
      canManageActor(
        actor,
      ),
  } = {},
) {
  const element =
    globalThis.document
      ?.createElement?.(
        canManage
          ? "a"
          : "span",
      );

  if (!element) {
    return null;
  }

  const state =
    getDeathKnightRuneState(
      actor,
    );

  const active =
    state?.weaponId ===
      weapon.id
      ? DEATH_KNIGHT_RUNE_DEFINITIONS[
          state.rune
        ] ??
        null
      : null;

  element.classList.add(
    "boa-death-knight-rune-slot",
  );
  element.dataset
    .boaRuneWeaponId =
    weapon.id;

  if (active) {
    element.classList.add(
      "active",
    );

    const image =
      globalThis.document
        ?.createElement?.(
          "img",
        );

    if (image) {
      image.src =
        active.icon;
      image.alt =
        "";
      element.append(
        image,
      );
    }

    element.title =
      `${localize(
        active.name,
        active.key,
      )} — ${localize(
        "BOA.deathKnightRunes.engraved",
        "Engraved Rune",
      )}`;
  } else {
    element.classList.add(
      "empty",
    );

    const marker =
      globalThis.document
        ?.createElement?.(
          "span",
        );

    if (marker) {
      marker.classList.add(
        "boa-death-knight-rune-empty-marker",
      );
      marker.textContent =
        "+";
      element.append(
        marker,
      );
    }

    element.title =
      localize(
        "BOA.deathKnightRunes.slot",
        "Engrave Rune",
      );
  }

  if (canManage) {
    element.href =
      "#";
    element.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        void chooseDeathKnightRuneForWeapon(
          actor,
          weapon,
        )
          .then(
            changed => {
              if (changed) {
                app?.render?.(
                  false,
                );
              }
            },
          )
          .catch(
            error => {
              console.error(
                `${MODULE_ID} | Failed to update Death Knight rune selection.`,
                error,
              );
            },
          );
      },
    );
  } else {
    element.setAttribute(
      "aria-disabled",
      "true",
    );
  }

  return element;
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

  for (
    const existing
    of root.querySelectorAll(
      ".boa-death-knight-rune-slot",
    )
  ) {
    existing.remove();
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

  const weaponTable =
    root.querySelector(
      ".weapon-table.item-list",
    );

  if (!weaponTable) {
    return false;
  }

  const rows =
    Array.from(
      weaponTable.querySelectorAll(
        "tr.sheet-table-data.item[data-item-id]",
      ),
    );

  let rendered =
    0;

  for (
    const weapon
    of getDeathKnightRuneEligibleWeapons(
      actor,
    )
  ) {
    const row =
      rows.find(
        candidate =>
          candidate.dataset
            ?.itemId ===
          weapon.id,
      );

    const nameCell =
      row?.querySelector(
        "td.text-data",
      );

    if (!nameCell) {
      continue;
    }

    const slot =
      createDeathKnightRuneSlot(
        actor,
        weapon,
        app,
      );

    if (!slot) {
      continue;
    }

    nameCell.append(
      slot,
    );
    rendered +=
      1;
  }

  return rendered >
    0;
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
