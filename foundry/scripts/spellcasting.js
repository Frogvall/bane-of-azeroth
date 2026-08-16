import { MODULE_ID } from "./core/constants.js";

const COST_PATCH = Symbol.for(`${MODULE_ID}.spellcasting.cost`);
const SPELL_TEST_DIALOG_PATCH = Symbol.for(
  `${MODULE_ID}.spellcasting.spell-test-dialog`,
);
const LEGACY_STATE = Symbol.for(`${MODULE_ID}.spellcasting.legacy`);
const costPolicies = new Map();
const castPolicies = new Map();
const LEGACY_MARKERS = [
  "castMagicTrickTitle",
  "willPoints.value < 1",
  "oldWP - 1",
];

export function registerBoASpellCostPolicy(id, policy) {
  costPolicies.set(id, policy);
  return true;
}

export function registerBoASpellCastPolicy(id, policy) {
  castPolicies.set(id, policy);
  return true;
}

export function clearBoASpellcastingPoliciesForTests() {
  costPolicies.clear();
  castPolicies.clear();
}

export function getBoASpellCost(
  item,
  powerLevel,
  baseCost,
) {
  let cost = baseCost;

  for (const [id, policy] of costPolicies) {
    try {
      const previousCost = cost;
      const next = policy({
        item,
        actor: item?.parent ?? item?.actor ?? null,
        powerLevel,
        cost,
        baseCost,
      });

      if (next === undefined) continue;

      const previousNumeric = Number(previousCost);
      const nextNumeric = Number(next);

      // A spell that is already free must stay free. This makes zero
      // an absorbing result across independently registered BoA rules.
      if (
        Number.isFinite(previousNumeric) &&
        previousNumeric <= 0 &&
        Number.isFinite(nextNumeric) &&
        nextNumeric > 0
      ) {
        continue;
      }

      cost = next;
    } catch (error) {
      console.error(
        `${MODULE_ID} | Spell-cost policy ${id} failed.`,
        error,
      );
    }
  }

  return cost;
}

export function canBoACastSpell(actor, spell) {
  for (const [id, policy] of castPolicies) {
    try {
      if (policy({ actor, spell }) === false) {
        return {
          allowed: false,
          policyId: id,
        };
      }
    } catch (error) {
      console.error(
        `${MODULE_ID} | Spell-cast policy ${id} failed.`,
        error,
      );
    }
  }

  return {
    allowed: true,
    policyId: null,
  };
}

export function patchBoASpellCost({
  ItemClass = globalThis.CONFIG?.Item?.documentClass,
} = {}) {
  const prototype = ItemClass?.prototype;
  const current = prototype?.getSpellCost;

  if (typeof current !== "function") {
    console.error(
      `${MODULE_ID} | Dragonbane Item#getSpellCost was unavailable.`,
    );
    return false;
  }

  if (current[COST_PATCH] === true) {
    return true;
  }

  const original = current;

  function boaGetSpellCost(powerLevel) {
    return getBoASpellCost(
      this,
      powerLevel,
      original.call(this, powerLevel),
    );
  }

  Object.defineProperty(
    boaGetSpellCost,
    COST_PATCH,
    {
      value: true,
    },
  );

  prototype.getSpellCost = boaGetSpellCost;
  return true;
}

/**
 * Dragonbane 4.1 routes magic tricks through DoDSpellTest, but the Actor
 * sheet still prepares the stock rank-0 dialog copy before the spell test
 * evaluates Item#getSpellCost(). Normalize the dialog from the same live
 * cost method used for affordability and payment.
 *
 * This is intentionally behavior-based rather than version-based. On the
 * Dragonbane 4.0.1 Actor-sheet path this code is dormant and the existing
 * legacy adapter remains responsible for rank-0 casting.
 */
export function applyBoAMagicTrickDialogCost(
  test,
) {
  const spell = test?.spell;
  if (
    spell?.type !== "spell" ||
    Number(spell?.system?.rank) !== 0 ||
    typeof spell?.getSpellCost !== "function"
  ) {
    return false;
  }

  const cost = Number(
    spell.getSpellCost(0),
  );
  if (
    !Number.isFinite(cost) ||
    cost === 1
  ) {
    return false;
  }

  test.options ??= {};
  test.dialogData ??= {};

  if (cost <= 0) {
    /*
     * Tell Dragonbane's native SpellTest that this cast has no WP cost.
     * This keeps the dialog, affordability check, power-source handling,
     * pre-roll data, and final payment on the same interpretation.
     */
    test.options.noWpCost = true;
    delete test.dialogData.wpSources;

    test.options.content = localize(
      "BOA.dialog.spellcastingFreeMagicTrickContent",
      `Cast ${spell.name} without spending WP?`,
      {
        spell: spell.name,
      },
    );
  } else {
    test.options.content = localize(
      "BOA.dialog.spellcastingMagicTrickContent",
      `Cast ${spell.name} for ${cost} WP?`,
      {
        spell: spell.name,
        cost,
      },
    );
  }

  return true;
}

export function patchBoASpellTestDialog({
  SpellTestClass,
} = {}) {
  const prototype =
    SpellTestClass?.prototype;
  const current =
    prototype?.updateDialogData;

  if (typeof current !== "function") {
    return false;
  }
  if (
    current[
      SPELL_TEST_DIALOG_PATCH
    ] === true
  ) {
    return true;
  }

  const original = current;
  function boaSpellTestUpdateDialogData(
    ...args
  ) {
    const result =
      original.apply(
        this,
        args,
      );
    applyBoAMagicTrickDialogCost(
      this,
    );
    return result;
  }

  Object.defineProperty(
    boaSpellTestUpdateDialogData,
    SPELL_TEST_DIALOG_PATCH,
    {
      value: true,
    },
  );

  prototype.updateDialogData =
    boaSpellTestUpdateDialogData;
  return true;
}

async function loadDragonbaneSpellTestClass() {
  const relativePath =
    "systems/dragonbane/modules/tests/spell-test.js";
  const route =
    globalThis.foundry
      ?.utils
      ?.getRoute?.(relativePath) ??
    `/${relativePath}`;
  const module =
    await import(route);

  if (
    typeof module?.default !== "function"
  ) {
    throw new Error(
      `${MODULE_ID} | Dragonbane DoDSpellTest could not be loaded.`,
    );
  }

  return module.default;
}

export async function registerBoASpellTestAdapter({
  SpellTestClass = null,
} = {}) {
  const TestClass =
    SpellTestClass ??
    await loadDragonbaneSpellTestClass();

  return patchBoASpellTestDialog({
    SpellTestClass: TestClass,
  });
}

export function isLegacyDragonbaneMagicTrickHandler(
  handler,
) {
  if (typeof handler !== "function") {
    return false;
  }

  const source =
    Function.prototype.toString.call(handler);

  return LEGACY_MARKERS.every(
    marker => source.includes(marker),
  );
}

function nativeSkillRollHandler(app) {
  const action =
    app?.options?.actions?.skillRoll;

  return typeof action === "function"
    ? action
    : action?.handler;
}

function clickedSpell(app, event) {
  const action = event?.target?.closest?.(
    '[data-action="skillRoll"]',
  );
  const id = action
    ?.closest?.(".sheet-table-data")
    ?.dataset?.itemId;

  return id
    ? app.actor?.items?.get?.(id) ?? null
    : null;
}

function localize(
  key,
  fallback,
  data = {},
) {
  const formatted =
    globalThis.game?.i18n?.format?.(
      key,
      data,
    );

  if (
    formatted &&
    formatted !== key
  ) {
    return formatted;
  }

  const localized =
    globalThis.game?.i18n?.localize?.(
      key,
    );

  return (
    localized &&
    localized !== key
  )
    ? localized
    : fallback;
}

export async function castLegacyBoAMagicTrick(
  actor,
  item,
  {
    wpCost = getBoASpellCost(
      item,
      0,
      1,
    ),
    DialogClass =
      globalThis.foundry
        ?.applications
        ?.api
        ?.DialogV2,
    ChatMessageClass =
      globalThis.ChatMessage,
    user = globalThis.game?.user,
  } = {},
) {
  if (
    actor?.documentName !== "Actor" ||
    actor?.type === "monster" ||
    item?.parent !== actor ||
    item?.type !== "spell" ||
    Number(item?.system?.rank) !== 0
  ) {
    return {
      handled: false,
      cast: false,
      wpCost: null,
    };
  }

  const cost = Math.max(
    0,
    Number(wpCost) || 0,
  );
  const currentWP =
    Number(
      actor.system?.willPoints?.value,
    ) || 0;

  if (currentWP < cost) {
    globalThis.ui?.notifications?.warn?.(
      localize(
        "BOA.notifications.spellcastingNotEnoughWP",
        `Not enough Willpower Points to cast ${item.name}.`,
        {
          spell: item.name,
          cost,
        },
      ),
    );

    return {
      handled: true,
      cast: false,
      wpCost: cost,
    };
  }

  const confirmed =
    typeof DialogClass?.confirm === "function"
      ? await DialogClass.confirm({
          window: {
            title: localize(
              "DoD.ui.dialog.castMagicTrickTitle",
              "Cast Magic Trick",
            ),
          },
          content: `<p>${localize(
            "BOA.dialog.spellcastingMagicTrickContent",
            `Cast ${item.name} for ${cost} WP?`,
            {
              spell: item.name,
              cost,
            },
          )}</p>`,
        })
      : true;

  if (!confirmed) {
    return {
      handled: true,
      cast: false,
      wpCost: cost,
    };
  }

  if (cost > 0) {
    await actor.update({
      "system.willPoints.value":
        currentWP - cost,
    });
  }

  if (
    typeof ChatMessageClass?.create ===
      "function"
  ) {
    await ChatMessageClass.create({
      user: user?.id,
      speaker:
        ChatMessageClass.getSpeaker?.({
          actor,
        }),
      content: `<p>${localize(
        "DoD.ui.chat.castMagicTrick",
        `${actor.name} casts ${item.name}.`,
        {
          actor: actor.name,
          spell: item.name,
          uuid: item.uuid,
        },
      )}</p>`,
    });
  }

  return {
    handled: true,
    cast: true,
    wpCost: cost,
  };
}

export function attachBoALegacyMagicTrickAdapter(
  app,
  {
    cast = castLegacyBoAMagicTrick,
  } = {},
) {
  const element = app?.element;

  if (
    typeof element?.addEventListener !==
      "function"
  ) {
    return false;
  }

  if (
    !isLegacyDragonbaneMagicTrickHandler(
      nativeSkillRollHandler(app),
    )
  ) {
    return false;
  }

  const existing = app[LEGACY_STATE];

  if (existing?.element === element) {
    return true;
  }

  existing?.element?.removeEventListener?.(
    "click",
    existing.listener,
    true,
  );

  const listener = async event => {
    if (
      event?.type !== "click" ||
      (
        event.button !== undefined &&
        event.button !== 0
      )
    ) {
      return;
    }

    const item = clickedSpell(
      app,
      event,
    );

    if (
      app.actor?.type === "monster" ||
      item?.type !== "spell" ||
      Number(item?.system?.rank) !== 0
    ) {
      return;
    }

    const permission =
      canBoACastSpell(
        app.actor,
        item,
      );

    // Dragonbane 4.0.1 hard-codes rank-0 tricks to 1 WP in the
    // legacy Actor-sheet handler. Feed that native legacy cost into
    // the same BoA policy chain instead of calling getSpellCost()
    // again and accidentally applying policies twice.
    const wpCost = Number(
      getBoASpellCost(
        item,
        0,
        1,
      ),
    );

    if (
      permission.allowed &&
      wpCost === 1
    ) {
      return;
    }

    event.preventDefault?.();
    event.stopImmediatePropagation?.();

    if (!app.actor?.isObserver) {
      return;
    }

    if (!permission.allowed) {
      globalThis.ui?.notifications?.warn?.(
        localize(
          "BOA.notifications.druidFormWordOnlySpell",
          "Only spells requiring Word alone can be cast in this Druid form.",
        ),
      );
      return;
    }

    await cast(
      app.actor,
      item,
      {
        wpCost,
      },
    );
  };

  element.addEventListener(
    "click",
    listener,
    true,
  );
  app[LEGACY_STATE] = {
    element,
    listener,
  };

  return true;
}

let registered = false;

export function registerBoALegacyMagicTrickAdapter(
  hooks = globalThis.Hooks,
) {
  if (registered) {
    return true;
  }

  if (typeof hooks?.on !== "function") {
    return false;
  }

  hooks.on(
    "renderDoDActorBaseSheet",
    app =>
      attachBoALegacyMagicTrickAdapter(
        app,
      ),
  );
  registered = true;
  return true;
}
