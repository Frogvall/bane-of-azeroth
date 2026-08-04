import {
  isMageBrillianceAutomationEnabled,
} from "./automation-settings.js";
import {
  getContentKey,
  getModuleFlag,
} from "./core/documents.js";

export const MAGES_BRILLIANCE_CONTENT_KEY =
  "heroic-class-ability.mage.mages-brilliance";
export const SENSE_MAGIC_UUID =
  "Item.RPnxXYVb8z7EG5Wl";

const SPELL_COST_PATCH =
  Symbol.for(
    "bane-of-azeroth.mage-brilliance.spell-cost",
  );

export function actorHasMagesBrilliance(actor) {
  return Boolean(
    actor?.items?.some?.(
      item =>
        item.type === "ability" &&
        getContentKey(item) ===
          MAGES_BRILLIANCE_CONTENT_KEY,
    ),
  );
}

export function isSenseMagicItem(item) {
  if (item?.type !== "spell") return false;

  // Managed grants have the stable external source UUID.
  if (
    getModuleFlag(item, "sourceUuid") ===
    SENSE_MAGIC_UUID
  ) {
    return true;
  }

  // A manually dragged/copied source can preserve the original
  // Foundry source UUID in core provenance.
  if (
    item.getFlag?.("core", "sourceId") ===
    SENSE_MAGIC_UUID
  ) {
    return true;
  }

  // The existing grant reconciler deliberately treats a manually
  // owned spell with the same source name as the same Sense Magic
  // and does not create a duplicate. Mirror that graceful fallback
  // here so such a manual Item also receives the rule benefit.
  return (
    item.name === "Sense Magic" &&
    Number(item.system?.rank) === 0
  );
}

export function isFreeMagesBrillianceSenseMagic(
  item,
  settings = globalThis.game?.settings,
) {
  const actor = item?.parent;

  return Boolean(
    actor?.documentName === "Actor" &&
    actorHasMagesBrilliance(actor) &&
    isSenseMagicItem(item) &&
    isMageBrillianceAutomationEnabled(settings)
  );
}

export function getMagesBrillianceSpellCost(
  item,
  powerLevel,
  originalGetSpellCost,
  settings = globalThis.game?.settings,
) {
  if (
    isFreeMagesBrillianceSenseMagic(
      item,
      settings,
    )
  ) {
    return 0;
  }

  return originalGetSpellCost.call(
    item,
    powerLevel,
  );
}

/**
 * Dragonbane spell-test paths derive affordability and WP payment from
 * Item#getSpellCost(). Dragonbane 4.0.1 has one exception: rank-0
 * spells clicked from the Actor sheet use a direct 1 WP path. The
 * legacy adapter below handles only that detected exception.
 */
export function patchMageBrillianceSpellCost({
  ItemClass =
    globalThis.CONFIG?.Item?.documentClass,
} = {}) {
  const prototype = ItemClass?.prototype;
  const current = prototype?.getSpellCost;

  if (typeof current !== "function") {
    console.error(
      "bane-of-azeroth | Dragonbane Item#getSpellCost " +
      "was not available for Mage's Brilliance automation.",
    );
    return false;
  }

  if (current[SPELL_COST_PATCH] === true) {
    return true;
  }

  const originalGetSpellCost = current;

  function boaMagesBrillianceGetSpellCost(
    powerLevel,
  ) {
    return getMagesBrillianceSpellCost(
      this,
      powerLevel,
      originalGetSpellCost,
    );
  }

  Object.defineProperty(
    boaMagesBrillianceGetSpellCost,
    SPELL_COST_PATCH,
    {
      value: true,
    },
  );

  prototype.getSpellCost =
    boaMagesBrillianceGetSpellCost;

  return true;
}

const LEGACY_MAGIC_TRICK_ADAPTER_STATE =
  Symbol.for(
    "bane-of-azeroth.mage-brilliance.legacy-magic-trick",
  );

const LEGACY_MAGIC_TRICK_HANDLER_MARKERS =
  Object.freeze([
    "castMagicTrickTitle",
    "willPoints.value < 1",
    "oldWP - 1",
  ]);

/**
 * Detect Dragonbane's legacy rank-0 sheet path by behavior markers,
 * not by a hard-coded system version.
 *
 * Dragonbane 4.0.1 handles magic tricks directly in _onSkillRoll:
 * it checks for at least 1 WP and then subtracts oldWP - 1.
 * Newer implementations which route rank-0 spells through the normal
 * spell-test/cost machinery do not need this adapter.
 */
export function isLegacyDragonbaneMagicTrickHandler(
  handler,
) {
  if (typeof handler !== "function") {
    return false;
  }

  const source =
    Function.prototype.toString.call(handler);

  return LEGACY_MAGIC_TRICK_HANDLER_MARKERS
    .every(marker => source.includes(marker));
}

function getSkillRollHandler(app) {
  const action =
    app?.options?.actions?.skillRoll;

  if (typeof action === "function") {
    return action;
  }

  return action?.handler;
}

/**
 * Reproduce only Dragonbane 4.0.1's rank-0 spell presentation while
 * deliberately omitting its hard-coded 1 WP requirement/payment.
 */
export async function castLegacyFreeSenseMagicTrick(
  actor,
  item,
  {
    confirmCast = true,
    createMessage = true,
    DialogClass =
      globalThis.foundry
        ?.applications
        ?.api
        ?.DialogV2,
    ChatMessageClass =
      globalThis.ChatMessage,
    i18n =
      globalThis.game?.i18n,
    user =
      globalThis.game?.user,
  } = {},
) {
  if (
    actor?.documentName !== "Actor" ||
    actor?.type === "monster" ||
    item?.parent !== actor ||
    Number(item?.system?.rank) !== 0 ||
    !isFreeMagesBrillianceSenseMagic(item)
  ) {
    return {
      handled: false,
      cast: false,
      wpCost: null,
    };
  }

  let use = true;

  if (confirmCast) {
    if (
      typeof DialogClass?.confirm !== "function" ||
      typeof i18n?.localize !== "function" ||
      typeof i18n?.format !== "function"
    ) {
      throw new Error(
        "bane-of-azeroth | Dragonbane magic-trick dialog " +
        "services are unavailable.",
      );
    }

    use = await DialogClass.confirm({
      window: {
        title: i18n.localize(
          "DoD.ui.dialog.castMagicTrickTitle",
        ),
      },
      content: i18n.format(
        "BOA.dialog.mageBrillianceFreeSenseMagicContent",
        {
          spell: item.name,
        },
      ),
    });
  }

  if (!use) {
    return {
      handled: true,
      cast: false,
      wpCost: 0,
    };
  }

  if (createMessage) {
    if (
      typeof ChatMessageClass?.create !== "function" ||
      typeof ChatMessageClass?.getSpeaker !== "function" ||
      typeof i18n?.format !== "function"
    ) {
      throw new Error(
        "bane-of-azeroth | Dragonbane magic-trick chat " +
        "services are unavailable.",
      );
    }

    const content =
      "<p>" +
      i18n.format(
        "DoD.ui.chat.castMagicTrick",
        {
          actor: actor.name,
          spell: item.name,
          uuid: item.uuid,
        },
      ) +
      "</p>";

    await ChatMessageClass.create({
      user: user?.id,
      speaker:
        ChatMessageClass.getSpeaker({
          actor,
        }),
      content,
    });
  }

  return {
    handled: true,
    cast: true,
    wpCost: 0,
  };
}

function findSkillRollActionTarget(event) {
  return event?.target?.closest?.(
    '[data-action="skillRoll"]',
  );
}

function findSheetItem(app, actionTarget) {
  const row =
    actionTarget?.closest?.(
      ".sheet-table-data",
    );

  const itemId = row?.dataset?.itemId;

  return itemId
    ? app.actor?.items?.get?.(itemId)
    : null;
}

/**
 * Attach a capture listener to the rendered sheet. The listener only
 * stops propagation for Mage's Brilliance + Sense Magic on a detected
 * legacy Dragonbane magic-trick handler. Every unrelated action is left
 * untouched and reaches Dragonbane normally.
 */
export function attachMageBrillianceLegacyMagicTrickAdapter(
  app,
  {
    cast =
      castLegacyFreeSenseMagicTrick,
  } = {},
) {
  const element = app?.element;
  if (
    typeof element?.addEventListener !==
    "function"
  ) {
    return false;
  }

  const nativeHandler =
    getSkillRollHandler(app);

  if (
    !isLegacyDragonbaneMagicTrickHandler(
      nativeHandler,
    )
  ) {
    return false;
  }

  const existing =
    app[LEGACY_MAGIC_TRICK_ADAPTER_STATE];

  if (existing?.element === element) {
    return true;
  }

  if (
    existing?.element &&
    typeof existing.element
      .removeEventListener === "function"
  ) {
    existing.element.removeEventListener(
      "click",
      existing.listener,
      true,
    );
  }

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

    const actionTarget =
      findSkillRollActionTarget(event);

    if (!actionTarget) return;

    const item =
      findSheetItem(
        app,
        actionTarget,
      );

    if (
      app.actor?.type === "monster" ||
      Number(item?.system?.rank) !== 0 ||
      !isFreeMagesBrillianceSenseMagic(
        item,
      )
    ) {
      return;
    }

    event.preventDefault?.();
    event.stopImmediatePropagation?.();

    if (!app.actor?.isObserver) {
      return;
    }

    try {
      await cast(
        app.actor,
        item,
      );
    } catch (error) {
      console.error(
        "bane-of-azeroth | Failed to cast free " +
        "Sense Magic through the Dragonbane legacy adapter.",
        error,
      );
    }
  };

  element.addEventListener(
    "click",
    listener,
    true,
  );

  app[LEGACY_MAGIC_TRICK_ADAPTER_STATE] = {
    element,
    listener,
  };

  return true;
}

export function onRenderMageBrillianceActorSheet(
  app,
) {
  const legacyMagicTrick =
    attachMageBrillianceLegacyMagicTrickAdapter(
      app,
    );

  const languages =
    attachMageBrillianceLanguagesAdapter(
      app,
    );

  return (
    legacyMagicTrick ||
    languages
  );
}

let legacyAdapterHookRegistered = false;

export function registerMageBrillianceLegacyMagicTrickAdapter(
  hooks = globalThis.Hooks,
) {
  if (legacyAdapterHookRegistered) {
    return true;
  }

  if (typeof hooks?.on !== "function") {
    return false;
  }

  hooks.on(
    "renderDoDActorBaseSheet",
    onRenderMageBrillianceActorSheet,
  );

  legacyAdapterHookRegistered = true;
  return true;
}

const MAGE_LANGUAGES_ADAPTER_STATE =
  Symbol.for(
    "bane-of-azeroth.mage-brilliance.languages",
  );

const MAGE_LANGUAGES_NAMES =
  new Set([
    "languages",
    "språk",
  ]);

export function isMageBrillianceLanguagesSkill(
  item,
) {
  return (
    item?.type === "skill" &&
    MAGE_LANGUAGES_NAMES.has(
      String(item.name ?? "")
        .trim()
        .toLocaleLowerCase(),
    )
  );
}

export function canUseMageBrillianceLanguagesTen(
  actor,
  skill,
  settings = globalThis.game?.settings,
) {
  return Boolean(
    actor?.documentName === "Actor" &&
    skill?.parent === actor &&
    isMageBrillianceLanguagesSkill(skill) &&
    actorHasMagesBrilliance(actor) &&
    isMageBrillianceAutomationEnabled(settings)
  );
}

async function loadDragonbaneSkillTestClass() {
  const relativePath =
    "systems/dragonbane/modules/tests/skill-test.js";

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
      "bane-of-azeroth | Dragonbane DoDSkillTest " +
      "could not be loaded for Mage's Brilliance.",
    );
  }

  return module.default;
}

export async function takeMageBrillianceLanguagesTen(
  actor,
  skill,
  {
    SkillTestClass = null,
    targets = null,
  } = {},
) {
  if (
    !canUseMageBrillianceLanguagesTen(
      actor,
      skill,
    )
  ) {
    return {
      handled: false,
      choice: null,
      result: null,
      test: null,
    };
  }

  const TestClass =
    SkillTestClass ??
    await loadDragonbaneSkillTestClass();

  const rollTargets =
    targets ??
    Array.from(
      globalThis.game
        ?.user
        ?.targets ??
      [],
    );

  const options = {
    formula: "10",
    skipDialog: true,
    canPush: false,
  };

  if (rollTargets.length > 0) {
    options.targets = rollTargets;
  }

  const test =
    new TestClass(
      actor,
      skill,
      options,
    );

  const rolled =
    await test.roll();

  const completed =
    rolled ?? test;

  return {
    handled: true,
    choice: "take10",
    result:
      Number(
        completed
          ?.postRollData
          ?.result ??
        completed
          ?.roll
          ?.result ??
        10,
      ),
    test: completed,
  };
}

export async function chooseMageBrillianceLanguagesRoll(
  actor,
  skill,
  {
    nativeRoll,
    takeTen =
      takeMageBrillianceLanguagesTen,
    DialogClass =
      globalThis.foundry
        ?.applications
        ?.api
        ?.DialogV2,
    i18n =
      globalThis.game?.i18n,
  } = {},
) {
  if (
    !canUseMageBrillianceLanguagesTen(
      actor,
      skill,
    )
  ) {
    return {
      handled: false,
      choice: null,
    };
  }

  if (
    typeof DialogClass?.wait !== "function" ||
    typeof i18n?.format !== "function" ||
    typeof i18n?.localize !== "function"
  ) {
    throw new Error(
      "bane-of-azeroth | Mage's Brilliance " +
      "LANGUAGES choice dialog is unavailable.",
    );
  }

  const choice =
    await DialogClass.wait({
      window: {
        title: i18n.format(
          "BOA.dialog.mageBrillianceLanguagesTitle",
          {
            skill: skill.name,
          },
        ),
      },
      content: i18n.format(
        "BOA.dialog.mageBrillianceLanguagesContent",
        {
          skill: skill.name,
        },
      ),
      buttons: [
        {
          action: "roll",
          label: i18n.localize(
            "BOA.dialog.mageBrillianceLanguagesRoll",
          ),
          default: true,
        },
        {
          action: "take10",
          label: i18n.localize(
            "BOA.dialog.mageBrillianceLanguagesTakeTen",
          ),
        },
        {
          action: "cancel",
          label: i18n.localize(
            "BOA.dialog.mageBrillianceLanguagesCancel",
          ),
        },
      ],
      rejectClose: false,
      modal: true,
    });

  if (choice === "roll") {
    if (typeof nativeRoll === "function") {
      await nativeRoll();
    }

    return {
      handled: true,
      choice: "roll",
    };
  }

  if (choice === "take10") {
    return takeTen(
      actor,
      skill,
    );
  }

  return {
    handled: true,
    choice: "cancel",
  };
}

export function attachMageBrillianceLanguagesAdapter(
  app,
  {
    choose =
      chooseMageBrillianceLanguagesRoll,
  } = {},
) {
  const element = app?.element;

  if (
    typeof element?.addEventListener !==
    "function"
  ) {
    return false;
  }

  const nativeHandler =
    getSkillRollHandler(app);

  if (
    typeof nativeHandler !== "function"
  ) {
    return false;
  }

  const existing =
    app[MAGE_LANGUAGES_ADAPTER_STATE];

  if (existing?.element === element) {
    return true;
  }

  if (
    existing?.element &&
    typeof existing.element
      .removeEventListener === "function"
  ) {
    existing.element.removeEventListener(
      "click",
      existing.listener,
      true,
    );
  }

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

    const actionTarget =
      findSkillRollActionTarget(event);

    if (!actionTarget) return;

    const skill =
      findSheetItem(
        app,
        actionTarget,
      );

    if (
      !app.actor?.isObserver ||
      !canUseMageBrillianceLanguagesTen(
        app.actor,
        skill,
      )
    ) {
      return;
    }

    event.preventDefault?.();
    event.stopImmediatePropagation?.();

    try {
      await choose(
        app.actor,
        skill,
        {
          nativeRoll: () =>
            nativeHandler.call(
              app,
              event,
              actionTarget,
            ),
        },
      );
    } catch (error) {
      console.error(
        "bane-of-azeroth | Failed to resolve " +
        "Mage's Brilliance LANGUAGES choice.",
        error,
      );
    }
  };

  element.addEventListener(
    "click",
    listener,
    true,
  );

  app[MAGE_LANGUAGES_ADAPTER_STATE] = {
    element,
    listener,
  };

  return true;
}
