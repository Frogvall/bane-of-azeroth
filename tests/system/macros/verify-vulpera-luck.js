const checks = [];
const notes = [];
const testKey =
  "vulpera-luck";
const testName =
  "BOA DEV – Verify Vulpera Luck";

const settingKey =
  "vulperaLuckAutomation";
const settingPath =
  `${BOA_TEST_MODULE_ID}.${settingKey}`;
const luckContentKey =
  "ability.luck";

let actor =
  null;
let originalSetting =
  null;
let settingRegistered =
  false;
const createdMessages =
  [];

function rememberMessage(
  message,
) {
  if (
    message?.id &&
    !createdMessages.some(
      candidate =>
        candidate.id ===
        message.id,
    )
  ) {
    createdMessages.push(
      message,
    );
  }
  return message;
}

async function createSkillTest(
  DoDSkillTest,
  skill,
  {
    formula = "10",
    canPush = true,
    isReroll = false,
    rerollOptions = undefined,
    boons = [],
    banes = [],
  } = {},
) {
  const test =
    new DoDSkillTest(
      actor,
      skill,
      {
        formula,
        canPush,
        skipDialog:
          true,
        defaultBanesBoons:
          !isReroll,
        isReroll,
        rerollOptions,
        boons,
        banes,
      },
    );

  await test.roll();
  rememberMessage(
    test.rollMessage,
  );

  return test;
}

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Macro is run by a game master",
    false,
    "Vulpera Luck tests create a temporary Actor, ChatMessages, and change a world setting.",
  );

  return boaFinish(
    testKey,
    testName,
    checks,
    notes,
  );
}

const settingsRegistry =
  game.settings?.settings ??
  null;
const settingDefinition =
  settingsRegistry
    ?.get?.(
      settingPath,
    ) ??
  null;

settingRegistered =
  boaCheck(
    checks,
    "Vulpera Luck automation setting is registered",
    Boolean(
      settingDefinition,
    ),
    settingPath,
  );

if (settingRegistered) {
  boaCheckEqual(
    checks,
    "Vulpera Luck automation defaults to enabled",
    settingDefinition.default,
    true,
  );

  originalSetting =
    game.settings.get(
      BOA_TEST_MODULE_ID,
      settingKey,
    );
}

const sourceLuck =
  boaFindWorldItem(
    luckContentKey,
    "ability",
  );

boaCheck(
  checks,
  "Vulpera Luck world Item exists",
  Boolean(
    sourceLuck,
  ),
  luckContentKey,
);

try {
  if (
    settingRegistered
  ) {
    await game.settings.set(
      BOA_TEST_MODULE_ID,
      settingKey,
      true,
    );
  }

  const luckRuntime =
    await import(
      `/modules/${BOA_TEST_MODULE_ID}/scripts/vulpera-luck.js`
    );

  const DoDSkillTest = (
    await import(
      "/systems/dragonbane/modules/tests/skill-test.js"
    )
  ).default;

  const {
    VULPERA_LUCK_ROLL_OPTION,
    VULPERA_LUCK_WP_COST,
    canUseVulperaLuck,
    useVulperaLuck,
  } =
    luckRuntime;

  boaCheckEqual(
    checks,
    "Vulpera Luck costs 3 WP",
    VULPERA_LUCK_WP_COST,
    3,
  );

  boaCheck(
    checks,
    "Vulpera Luck exposes a persistent roll-option key",
    typeof VULPERA_LUCK_ROLL_OPTION ===
      "string" &&
      VULPERA_LUCK_ROLL_OPTION
        .length >
        0,
    VULPERA_LUCK_ROLL_OPTION,
  );

  boaCheck(
    checks,
    "Vulpera Luck runtime exposes eligibility and execution APIs",
    typeof canUseVulperaLuck ===
      "function" &&
      typeof useVulperaLuck ===
      "function",
    {
      canUseVulperaLuck:
        typeof canUseVulperaLuck,
      useVulperaLuck:
        typeof useVulperaLuck,
    },
  );

  if (!sourceLuck) {
    throw new Error(
      "The generated Vulpera Luck source Item is unavailable.",
    );
  }

  actor =
    await Actor.create(
      {
        name:
          "[BOA TEST] Vulpera Luck " +
          foundry.utils
            .randomID(6),
        type:
          "character",
        flags: {
          [BOA_TEST_MODULE_ID]: {
            [BOA_TEST_FIXTURE_FLAG]:
              true,
          },
        },
      },
      {
        renderSheet:
          false,
      },
    );

  boaCheck(
    checks,
    "Temporary Vulpera Luck Actor was created",
    Boolean(
      actor?.id,
    ),
    actor?.uuid ??
      "",
  );

  const [
    embeddedLuck,
  ] =
    await actor
      .createEmbeddedDocuments(
        "Item",
        [
          boaCloneEmbeddedItem(
            sourceLuck,
          ),
        ],
      );

  boaCheck(
    checks,
    "Temporary Actor has the real Vulpera Luck ability",
    Boolean(
      embeddedLuck,
    ),
    embeddedLuck?.name ??
      "",
  );

  const skill =
    boaCollectionValues(
      actor.items,
    ).find(
      item =>
        item.type ===
        "skill",
    ) ??
    null;

  boaCheck(
    checks,
    "Temporary Actor has a Dragonbane skill for Luck reroll testing",
    Boolean(
      skill,
    ),
    skill?.name ??
      "",
  );

  if (!skill) {
    throw new Error(
      "Temporary Dragonbane character did not receive any skill.",
    );
  }

  await skill.update({
    "system.value":
      5,
  });

  await actor.update({
    "system.willPoints.value":
      10,
  });

  const original =
    await createSkillTest(
      DoDSkillTest,
      skill,
      {
        formula:
          "10",
        canPush:
          true,
        boons: [
          {
            source:
              "BOA Luck boon A",
            value:
              true,
          },
          {
            source:
              "BOA Luck boon B",
            value:
              true,
          },
        ],
      },
    );

  boaCheck(
    checks,
    "Native control roll is a non-demon pushable failure",
    original
      ?.postRollData
      ?.success ===
      false &&
      original
        ?.postRollData
        ?.isDemon ===
        false &&
      original
        ?.postRollData
        ?.canPush ===
        true,
    original
      ?.postRollData,
  );

  boaCheck(
    checks,
    "Luck is available on an eligible current roll",
    canUseVulperaLuck(
      original.rollMessage,
    ) ===
      true,
    {
      result:
        original
          ?.postRollData
          ?.result,
      wp:
        actor
          ?.system
          ?.willPoints
          ?.value,
    },
  );

  const originalRollOptions =
    original
      ?.rollMessage
      ?.rolls
      ?.[0]
      ?.options ??
    {};

  boaCheckEqual(
    checks,
    "Native control roll carries the full two-boon pool",
    originalRollOptions
      ?.boons
      ?.length ??
      0,
    2,
  );

  const wpBeforeLuck =
    actor
      .system
      .willPoints
      .value;

  const luckResult =
    await useVulperaLuck(
      original.rollMessage,
      {
        confirm:
          false,
      },
    );

  const luckTest =
    luckResult?.test ??
    luckResult;

  rememberMessage(
    luckTest
      ?.rollMessage,
  );

  boaCheck(
    checks,
    "Luck executes a real Dragonbane reroll",
    Boolean(
      luckTest
        ?.rollMessage &&
      luckTest
        ?.options
        ?.isReroll ===
        true,
    ),
    {
      handled:
        luckResult
          ?.handled ??
        null,
      rollMessage:
        luckTest
          ?.rollMessage
          ?.uuid ??
        null,
      isReroll:
        luckTest
          ?.options
          ?.isReroll ??
        null,
    },
  );

  boaCheckEqual(
    checks,
    "Luck spends exactly 3 WP",
    wpBeforeLuck -
      actor
        .system
        .willPoints
        .value,
    3,
  );

  boaCheckEqual(
    checks,
    "Luck reuses the complete boon pool from the current roll",
    luckTest
      ?.options
      ?.rerollOptions
      ?.boons
      ?.length ??
      0,
    2,
  );

  boaCheck(
    checks,
    "Luck marks the new Roll as having consumed Luck",
    luckTest
      ?.rollMessage
      ?.rolls
      ?.[0]
      ?.options
      ?.[
        VULPERA_LUCK_ROLL_OPTION
      ] ===
      true,
    luckTest
      ?.rollMessage
      ?.rolls
      ?.[0]
      ?.options ??
      null,
  );

  boaCheck(
    checks,
    "Luck cannot be used twice in the same reroll chain",
    canUseVulperaLuck(
      luckTest
        ?.rollMessage,
    ) ===
      false,
    luckTest
      ?.rollMessage
      ?.rolls
      ?.[0]
      ?.options ??
      null,
  );

  boaCheckEqual(
    checks,
    "Push remains available after Luck when the new current result is a non-demon failure",
    luckTest
      ?.postRollData
      ?.canPush,
    true,
  );

  const pushedControl =
    await createSkillTest(
      DoDSkillTest,
      skill,
      {
        formula:
          "10",
        canPush:
          false,
        isReroll:
          true,
        rerollOptions:
          originalRollOptions,
      },
    );

  boaCheckEqual(
    checks,
    "Native Push-style reroll keeps Push consumed",
    pushedControl
      ?.postRollData
      ?.canPush,
    false,
  );

  boaCheck(
    checks,
    "Luck remains available after Push when the current result is not a demon",
    canUseVulperaLuck(
      pushedControl
        .rollMessage,
    ) ===
      true,
    {
      canPush:
        pushedControl
          ?.postRollData
          ?.canPush,
      isDemon:
        pushedControl
          ?.postRollData
          ?.isDemon,
      rollOptions:
        pushedControl
          ?.rollMessage
          ?.rolls
          ?.[0]
          ?.options ??
        null,
    },
  );

  const pushedDemon =
    await createSkillTest(
      DoDSkillTest,
      skill,
      {
        formula:
          "20",
        canPush:
          false,
        isReroll:
          true,
        rerollOptions:
          originalRollOptions,
      },
    );

  boaCheck(
    checks,
    "A demon on the Push reroll blocks Luck",
    pushedDemon
      ?.postRollData
      ?.isDemon ===
      true &&
      canUseVulperaLuck(
        pushedDemon
          .rollMessage,
      ) ===
        false,
    pushedDemon
      ?.postRollData,
  );

  const luckConsumedOptions = {
    ...originalRollOptions,
    [
      VULPERA_LUCK_ROLL_OPTION
    ]:
      true,
  };

  const luckDemon =
    await createSkillTest(
      DoDSkillTest,
      skill,
      {
        formula:
          "20",
        canPush:
          true,
        isReroll:
          true,
        rerollOptions:
          luckConsumedOptions,
      },
    );

  boaCheck(
    checks,
    "A demon on the Luck reroll blocks further Push",
    luckDemon
      ?.postRollData
      ?.isDemon ===
      true &&
      luckDemon
        ?.postRollData
        ?.canPush ===
        false,
    luckDemon
      ?.postRollData,
  );

  boaCheck(
    checks,
    "Luck-consumed state survives into the resulting Roll options",
    luckDemon
      ?.rollMessage
      ?.rolls
      ?.[0]
      ?.options
      ?.[
        VULPERA_LUCK_ROLL_OPTION
      ] ===
      true,
    luckDemon
      ?.rollMessage
      ?.rolls
      ?.[0]
      ?.options ??
      null,
  );

  const pushDisabled =
    await createSkillTest(
      DoDSkillTest,
      skill,
      {
        formula:
          "10",
        canPush:
          false,
      },
    );

  boaCheck(
    checks,
    "Luck does not depend on Push being enabled for the test",
    pushDisabled
      ?.postRollData
      ?.canPush ===
      false &&
      canUseVulperaLuck(
        pushDisabled
          .rollMessage,
      ) ===
        true,
    {
      canPush:
        pushDisabled
          ?.postRollData
          ?.canPush,
      canLuck:
        canUseVulperaLuck(
          pushDisabled
            .rollMessage,
        ),
    },
  );

  if (
    settingRegistered
  ) {
    await game.settings.set(
      BOA_TEST_MODULE_ID,
      settingKey,
      false,
    );

    boaCheck(
      checks,
      "Disabling Vulpera Luck automation disables the Luck action only",
      canUseVulperaLuck(
        pushDisabled
          .rollMessage,
      ) ===
        false &&
        pushDisabled
          ?.postRollData
          ?.canPush ===
          false,
      {
        canLuck:
          canUseVulperaLuck(
            pushDisabled
              .rollMessage,
          ),
        nativeCanPush:
          pushDisabled
            ?.postRollData
            ?.canPush,
      },
    );
  }
} catch (error) {
  boaCheck(
    checks,
    "Vulpera Luck runtime integration loaded and completed",
    false,
    error.stack ??
      error.message ??
      String(
        error,
      ),
  );
} finally {
  for (
    const message
    of createdMessages
      .reverse()
  ) {
    try {
      if (
        game.messages
          ?.get?.(
            message.id,
          )
      ) {
        await message.delete();
      }
    } catch (error) {
      notes.push(
        "Could not delete temporary Vulpera Luck ChatMessage: " +
          error.message,
      );
    }
  }

  if (actor) {
    try {
      await actor.delete();
    } catch (error) {
      boaCheck(
        checks,
        "Temporary Vulpera Luck Actor cleanup succeeded",
        false,
        error.message,
      );
    }
  }

  if (
    settingRegistered &&
    originalSetting !==
      null
  ) {
    try {
      await game.settings.set(
        BOA_TEST_MODULE_ID,
        settingKey,
        originalSetting,
      );
    } catch (error) {
      boaCheck(
        checks,
        "Original Vulpera Luck automation setting was restored",
        false,
        error.message,
      );
    }
  }
}

return boaFinish(
  testKey,
  testName,
  checks,
  notes,
);
