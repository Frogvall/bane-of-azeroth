import {
  isVulperaLuckAutomationEnabled,
} from "./automation-settings.js";
import {
  MODULE_ID,
} from "./core/constants.js";

export const VULPERA_LUCK_WP_COST = 3;

export const VULPERA_LUCK_ROLL_OPTION =
  `${MODULE_ID}.vulperaLuckUsed`;

export const VULPERA_LUCK_CAN_PUSH_OPTION =
  `${MODULE_ID}.vulperaLuckCanPush`;

export const VULPERA_LUCK_CHAIN_OPTION =
  `${MODULE_ID}.vulperaLuckChain`;

const TEST_MESSAGE_TYPES =
  new Set([
    "attributeTest",
    "skillTest",
    "weaponTest",
    "spellTest",
  ]);

const ROLL_METADATA_PATCH =
  Symbol.for(
    `${MODULE_ID}.vulperaLuckRollMetadataPatch`,
  );

let fallbackChainCounter = 0;
let testClassesPromise = null;

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) {
    return collection.contents;
  }
  if (typeof collection.values === "function") {
    return Array.from(collection.values());
  }
  return [];
}

function getRollOptions(message) {
  return message?.rolls?.[0]?.options ?? {};
}

function makeChainId() {
  const randomID =
    globalThis.foundry?.utils?.randomID;

  if (typeof randomID === "function") {
    return randomID(16);
  }

  fallbackChainCounter += 1;
  return (
    `boa-luck-${Date.now()}-` +
    `${fallbackChainCounter}`
  );
}

function getActorFromMessage(message) {
  try {
    const context =
      message?.system?.toContext?.();
    if (context?.actor) {
      return context.actor;
    }
  } catch (_error) {
    // Fall through to UUID lookup.
  }

  const actorUuid =
    message?.system?.actorUuid;

  if (
    actorUuid &&
    typeof globalThis.fromUuidSync === "function"
  ) {
    try {
      return globalThis.fromUuidSync(actorUuid);
    } catch (_error) {
      return null;
    }
  }

  return null;
}

function isLuckAbility(item) {
  if (item?.type !== "ability") {
    return false;
  }

  const contentKey =
    item?.flags?.[MODULE_ID]?.contentKey ??
    item?.getFlag?.(
      MODULE_ID,
      "contentKey",
    );

  if (contentKey === "ability.luck") {
    return true;
  }

  return (
    item?.name === "Luck" &&
    String(
      item?.system?.requirement ?? "",
    )
      .trim()
      .toLowerCase() === "vulpera"
  );
}

export function actorHasVulperaLuck(actor) {
  return collectionValues(
    actor?.items,
  ).some(isLuckAbility);
}

function getWillPoints(actor) {
  return Number(
    actor?.system?.willPoints?.value ??
    0,
  );
}

function isCurrentLuckChainMessage(message) {
  const chainId =
    getRollOptions(message)[
      VULPERA_LUCK_CHAIN_OPTION
    ];

  if (!chainId) {
    return true;
  }

  const sameChain =
    collectionValues(
      globalThis.game?.messages,
    ).filter(
      candidate =>
        getRollOptions(candidate)[
          VULPERA_LUCK_CHAIN_OPTION
        ] === chainId,
    );

  if (sameChain.length === 0) {
    return true;
  }

  return (
    sameChain[
      sameChain.length - 1
    ]?.id === message?.id
  );
}

export function canUseVulperaLuck(message) {
  if (!isVulperaLuckAutomationEnabled()) {
    return false;
  }

  if (!TEST_MESSAGE_TYPES.has(message?.type)) {
    return false;
  }

  if (!message?.rolls?.[0]) {
    return false;
  }

  if (message?.system?.isDemon === true) {
    return false;
  }

  if (
    getRollOptions(message)[
      VULPERA_LUCK_ROLL_OPTION
    ] === true
  ) {
    return false;
  }

  if (!isCurrentLuckChainMessage(message)) {
    return false;
  }

  const actor =
    getActorFromMessage(message);

  if (!actor) {
    return false;
  }

  if (actor.isOwner === false) {
    return false;
  }

  if (!actorHasVulperaLuck(actor)) {
    return false;
  }

  return (
    getWillPoints(actor) >=
    VULPERA_LUCK_WP_COST
  );
}

export function applyVulperaLuckRollMetadata(test) {
  const rollOptions =
    test?.roll?.options;

  if (!rollOptions) {
    return false;
  }

  const rerollOptions =
    test?.options?.rerollOptions ??
    {};

  rollOptions[
    VULPERA_LUCK_ROLL_OPTION
  ] = (
    rerollOptions[
      VULPERA_LUCK_ROLL_OPTION
    ] === true ||
    test?.options?.[
      VULPERA_LUCK_ROLL_OPTION
    ] === true
  );

  /*
   * This is capability, not current button visibility.
   * Native Push creates its reroll with canPush:false, so a pushed
   * roll automatically carries false here without BoA tracking Push.
   */
  rollOptions[
    VULPERA_LUCK_CAN_PUSH_OPTION
  ] =
    test?.preRollData?.canPush ===
    true;

  rollOptions[
    VULPERA_LUCK_CHAIN_OPTION
  ] =
    rerollOptions[
      VULPERA_LUCK_CHAIN_OPTION
    ] ??
    test?.options?.[
      VULPERA_LUCK_CHAIN_OPTION
    ] ??
    makeChainId();

  return true;
}

export function patchVulperaLuckRollMetadata({
  TestClass,
} = {}) {
  const prototype =
    TestClass?.prototype;

  if (
    !prototype ||
    typeof prototype.updatePostRollData !==
      "function"
  ) {
    return false;
  }

  if (prototype[ROLL_METADATA_PATCH]) {
    return true;
  }

  const nativeUpdatePostRollData =
    prototype.updatePostRollData;

  prototype.updatePostRollData =
    async function (...args) {
      const result =
        await nativeUpdatePostRollData
          .apply(this, args);

      applyVulperaLuckRollMetadata(
        this,
      );

      return result;
    };

  Object.defineProperty(
    prototype,
    ROLL_METADATA_PATCH,
    {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    },
  );

  return true;
}

async function loadDragonbaneTestClasses() {
  if (!testClassesPromise) {
    testClassesPromise =
      Promise.all([
        import(
          "/systems/dragonbane/modules/tests/dod-test.js"
        ),
        import(
          "/systems/dragonbane/modules/tests/attribute-test.js"
        ),
        import(
          "/systems/dragonbane/modules/tests/skill-test.js"
        ),
        import(
          "/systems/dragonbane/modules/tests/weapon-test.js"
        ),
        import(
          "/systems/dragonbane/modules/tests/spell-test.js"
        ),
      ]).then(
        ([
          baseModule,
          attributeModule,
          skillModule,
          weaponModule,
          spellModule,
        ]) => ({
          DoDTest:
            baseModule.default,
          DoDAttributeTest:
            attributeModule.default,
          DoDSkillTest:
            skillModule.default,
          DoDWeaponTest:
            weaponModule.default,
          DoDSpellTest:
            spellModule.default,
        }),
      );
  }

  return testClassesPromise;
}

export async function registerVulperaLuckAdapter() {
  const {
    DoDTest,
  } =
    await loadDragonbaneTestClasses();

  return patchVulperaLuckRollMetadata({
    TestClass: DoDTest,
  });
}

function buildRerollOptions(message) {
  return {
    ...getRollOptions(message),
    [
      VULPERA_LUCK_ROLL_OPTION
    ]: true,
  };
}

async function buildVulperaLuckTest(message) {
  const classes =
    await loadDragonbaneTestClasses();

  const context =
    message?.system?.toContext?.();

  const actor =
    context?.actor ??
    getActorFromMessage(message);

  if (!actor) {
    return null;
  }

  const sourceRollOptions =
    getRollOptions(message);

  const options = {
    actorId:
      message?.system?.actorUuid,
    attribute:
      message?.system?.attribute,
    formula:
      message?.system?.formula,
    canPush:
      sourceRollOptions[
        VULPERA_LUCK_CAN_PUSH_OPTION
      ] === true,
    skipDialog: true,
    isReroll: true,
    rerollOptions:
      buildRerollOptions(message),
  };

  if (context?.targetActor) {
    const targetToken =
      globalThis.canvas
        ?.scene
        ?.tokens
        ?.find?.(
          token =>
            token?.actor?.uuid ===
            context.targetActor.uuid,
        );

    if (targetToken) {
      options.targets = [
        targetToken,
      ];
    }
  }

  switch (message?.type) {
    case "attributeTest":
      return new classes.DoDAttributeTest(
        actor,
        options.attribute,
        options,
      );

    case "skillTest":
      options.skill =
        context?.skill;
      if (!options.skill) {
        return null;
      }
      return new classes.DoDSkillTest(
        actor,
        options.skill,
        options,
      );

    case "weaponTest":
      options.action =
        context?.action;
      options.extraDamage =
        context?.extraDamage;
      options.weapon =
        context?.weapon;
      if (!options.weapon) {
        return null;
      }
      return new classes.DoDWeaponTest(
        actor,
        options.weapon,
        options,
      );

    case "spellTest":
      options.spell =
        context?.spell;
      options.powerLevel =
        context?.powerLevel;
      options.wpNew =
        context?.wpNew;
      options.wpOld =
        context?.wpOld;
      options.wpCost =
        Number(
          context?.wpOld ?? 0,
        ) -
        Number(
          context?.wpNew ?? 0,
        );
      options.wpSource =
        context?.wpSource;
      options.craftItem =
        context?.craftItem;
      if (!options.spell) {
        return null;
      }
      return new classes.DoDSpellTest(
        actor,
        options.spell,
        options,
      );

    default:
      return null;
  }
}

async function confirmVulperaLuck() {
  const DialogV2 =
    globalThis.foundry
      ?.applications
      ?.api
      ?.DialogV2;

  if (
    typeof DialogV2?.confirm !==
      "function"
  ) {
    return true;
  }

  /*
   * Foundry V14's static confirm() calls this.wait(...), so the class
   * receiver must be preserved.
   */
  return Boolean(
    await DialogV2.confirm({
      window: {
        title:
          globalThis.game
            ?.i18n
            ?.localize?.(
              "BOA.dialog.vulperaLuckTitle",
            ) ??
          "Vulpera Luck",
      },
      content:
        `<p>${
          globalThis.game
            ?.i18n
            ?.localize?.(
              "BOA.dialog.vulperaLuckContent",
            ) ??
          "Spend 3 WP to re-roll this test? The new result must be used."
        }</p>`,
    }),
  );
}

async function setWillPoints(
  actor,
  value,
) {
  if (
    typeof actor?.update !==
      "function"
  ) {
    throw new Error(
      "Vulpera Luck could not update the actor's WP.",
    );
  }

  await actor.update({
    "system.willPoints.value":
      value,
  });
}

export async function useVulperaLuck(
  message,
  {
    confirm = true,
  } = {},
) {
  if (!canUseVulperaLuck(message)) {
    return {
      handled: false,
      test: null,
    };
  }

  if (
    confirm &&
    !await confirmVulperaLuck()
  ) {
    return {
      handled: false,
      test: null,
    };
  }

  /*
   * Be safe for direct Macro/API use too: the metadata adapter must be
   * installed before the new Dragonbane Roll is serialized to ChatMessage.
   */
  await registerVulperaLuckAdapter();

  const actor =
    getActorFromMessage(message);

  const oldWp =
    getWillPoints(actor);

  if (
    oldWp <
    VULPERA_LUCK_WP_COST
  ) {
    return {
      handled: false,
      test: null,
    };
  }

  const test =
    await buildVulperaLuckTest(
      message,
    );

  if (!test) {
    return {
      handled: false,
      test: null,
    };
  }

  await setWillPoints(
    actor,
    oldWp -
      VULPERA_LUCK_WP_COST,
  );

  try {
    const rolled =
      await test.roll();

    if (!rolled) {
      throw new Error(
        "Dragonbane cancelled the Vulpera Luck reroll.",
      );
    }

    return {
      handled: true,
      test: rolled,
    };
  } catch (error) {
    try {
      await setWillPoints(
        actor,
        oldWp,
      );
    } catch (refundError) {
      console.error(
        `${MODULE_ID} | Vulpera Luck reroll failed and WP refund also failed.`,
        refundError,
      );
    }

    throw error;
  }
}

function getHtmlRoot(html) {
  if (html?.querySelector) {
    return html;
  }
  if (html?.[0]?.querySelector) {
    return html[0];
  }
  return null;
}

export function onRenderVulperaLuckChatMessage(
  message,
  html,
) {
  if (!canUseVulperaLuck(message)) {
    return;
  }

  const root =
    getHtmlRoot(html);

  if (!root) {
    return;
  }

  if (
    root.querySelector(
      '[data-action="boaVulperaLuck"]',
    )
  ) {
    return;
  }

  const container =
    root.querySelector(
      ".permission-owner",
    ) ??
    root.querySelector(
      ".message-content",
    );

  if (!container) {
    return;
  }

  const wrapper =
    globalThis.document
      ?.createElement?.(
        "div",
      );
  const button =
    globalThis.document
      ?.createElement?.(
        "button",
      );

  if (!wrapper || !button) {
    return;
  }

  button.type = "button";
  button.className =
    "chat-button boa-vulpera-luck";
  button.dataset.action =
    "boaVulperaLuck";
  button.innerHTML =
    '<i class="fas fa-clover"></i> ' +
    (
      globalThis.game
        ?.i18n
        ?.localize?.(
          "BOA.chat.vulperaLuck",
        ) ??
      "Luck (3 WP)"
    );

  button.addEventListener(
    "click",
    async event => {
      event.preventDefault();
      event.stopPropagation();

      if (button.disabled) {
        return;
      }

      button.disabled = true;

      try {
        const result =
          await useVulperaLuck(
            message,
          );

        if (!result.handled) {
          button.disabled =
            false;
        }
      } catch (error) {
        button.disabled =
          false;
        console.error(
          `${MODULE_ID} | Vulpera Luck reroll failed.`,
          error,
        );
        globalThis.ui
          ?.notifications
          ?.error?.(
            globalThis.game
              ?.i18n
              ?.localize?.(
                "BOA.notifications.vulperaLuckFailed",
              ) ??
            "Vulpera Luck could not be completed.",
          );
      }
    },
  );

  wrapper.append(button);
  container.append(wrapper);
}
