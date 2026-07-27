const checks = [];
const notes = [];
const testKey = "warlock-demons";
const testName = "BOA DEV – Verify Warlock Demons";

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Warlock demon verification is run by a game master",
    false,
    "The test reads imported world content and creates temporary fixtures.",
  );
  return boaFinish(testKey, testName, checks, notes);
}

const expectedDemons = [
  {
    key: "felhunter",
    name: "Felhunter",
    attackName: "Mana Bite",
    attackKey: "mana-bite",
    portrait: "modules/bane-of-azeroth/assets/actors/demons/felhunter.webp",
    token: "modules/bane-of-azeroth/assets/tokens/demons/felhunter-token.webp",
  },
  {
    key: "imp",
    name: "Imp",
    attackName: "Firebolt",
    attackKey: "firebolt",
    portrait: "modules/bane-of-azeroth/assets/actors/demons/imp.webp",
    token: "modules/bane-of-azeroth/assets/tokens/demons/imp-token.webp",
  },
  {
    key: "sayaad",
    name: "Sayaad",
    attackName: "Soothing Kiss",
    attackKey: "soothing-kiss",
    portrait: "modules/bane-of-azeroth/assets/actors/demons/sayaad.webp",
    token: "modules/bane-of-azeroth/assets/tokens/demons/sayaad-token.webp",
  },
  {
    key: "voidwalker",
    name: "Voidwalker",
    attackName: "Torment",
    attackKey: "torment",
    portrait: "modules/bane-of-azeroth/assets/actors/demons/voidwalker.webp",
    token: "modules/bane-of-azeroth/assets/tokens/demons/voidwalker-token.webp",
  },
];

const moduleId = "bane-of-azeroth";
const boaModule = game.modules.get(moduleId);
boaCheck(
  checks,
  "Bane of Azeroth module is active",
  boaModule?.active === true,
  boaModule ? `${boaModule.id} ${boaModule.version}` : moduleId,
);

const actors = new Map();
const tables = new Map();
const attacks = new Map();

for (const expected of expectedDemons) {
  const contentKey = `actors.summoned-monsters.${expected.key}`;
  const actor = boaFindWorldActor(contentKey);

  boaCheck(
    checks,
    `${expected.name} Actor is imported`,
    Boolean(actor),
    contentKey,
  );
  if (!actor) continue;
  actors.set(expected.key, actor);

  boaCheckEqual(
    checks,
    `${expected.name} is a monster Actor`,
    actor.type,
    "monster",
  );
  boaCheckEqual(
    checks,
    `${expected.name} portrait artwork is configured`,
    actor.img,
    expected.portrait,
  );
  boaCheckEqual(
    checks,
    `${expected.name} token artwork is configured`,
    actor.prototypeToken?.texture?.src ?? null,
    expected.token,
  );

  const demonFolder = actor.folder ?? null;
  const rootId = boaDocumentParentFolderId(demonFolder);
  const rootFolder = rootId ? game.folders.get(rootId) : null;
  boaCheckEqual(
    checks,
    `${expected.name} is in the Demons Actor folder`,
    demonFolder?.name ?? null,
    "Demons",
  );
  boaCheckEqual(
    checks,
    `Demons is under Bane of Azeroth for ${expected.name}`,
    rootFolder?.name ?? null,
    "Bane of Azeroth",
  );
  boaCheckEqual(
    checks,
    `Actor root folder is blue for ${expected.name}`,
    boaColorHex(rootFolder?.color ?? null),
    "#0000ff",
  );

  boaCheckEqual(
    checks,
    `${expected.name} command metadata is configured`,
    boaGetFlag(actor, "monsterControl"),
    {
      schemaVersion: 1,
      key: expected.key,
      attackSelection: { mode: "system-default" },
      command: {
        resource: "willPoints",
        amount: 2,
        payer: "assigned-character",
        freeActionWhenPaid: true,
      },
    },
  );

  const tableUuid = String(actor.system?.attackTable ?? "");
  const table = tableUuid ? globalThis.fromUuidSync?.(tableUuid) : null;
  boaCheck(
    checks,
    `${expected.name} attack table resolves`,
    Boolean(table),
    tableUuid,
  );
  if (!table) continue;
  tables.set(expected.key, table);

  const results = boaCollectionValues(table.results);
  boaCheckEqual(
    checks,
    `${expected.name} has exactly one command attack`,
    results.length,
    1,
  );
  const result = results[0] ?? null;
  if (!result) continue;
  attacks.set(expected.key, result);

  boaCheckEqual(
    checks,
    `${expected.name} attack metadata is configured`,
    boaGetFlag(result, "monsterAttack"),
    { schemaVersion: 1, key: expected.attackKey },
  );
  const description = String(result.description ?? "");
  boaCheck(
    checks,
    `${expected.name} attack description names ${expected.attackName}`,
    description.includes(expected.attackName),
    description,
  );
}

const imp = actors.get("imp") ?? null;
const impTable = tables.get("imp") ?? null;
const firebolt = attacks.get("imp") ?? null;

if (imp && impTable && firebolt) {
  try {
    const {
      getMonsterCommand,
      handleMonsterCommandAttackClick,
      performMonsterCommandAttack,
    } = await import(
      "/modules/bane-of-azeroth/scripts/monster-command-control.js"
    );

    let shortcutDialogOpened = false;
    let shortcutAttackKey = null;
    const shortcutMessagesBefore = new Set(
      boaCollectionValues(game.messages).map(message => message.id),
    );

    const shortcutOutcome = await handleMonsterCommandAttackClick(
      imp,
      { shiftKey: true, ctrlKey: false },
      {
        dialogV2: {
          wait: async () => {
            shortcutDialogOpened = true;
            throw new Error("The command dialog opened during a shortcut.");
          },
        },
        fromUuidSyncFn: uuid => (
          uuid === String(imp.system.attackTable) ? impTable : null
        ),
        settings: { get: () => true },
        user: {
          id: game.user.id,
          isGM: false,
          character: null,
        },
        utility: {
          monsterAttack: async (_actor, _table, tableResult) => {
            shortcutAttackKey = boaGetFlag(
              tableResult,
              "monsterAttack",
            )?.key ?? null;
            return "BOA shortcut attack";
          },
        },
      },
    );

    const shortcutMessages = boaCollectionValues(game.messages)
      .filter(message => !shortcutMessagesBefore.has(message.id));
    boaCheckEqual(
      checks,
      "Dragonbane dialog shortcut assumes Use Action",
      {
        status: shortcutOutcome?.status ?? null,
        paid: shortcutOutcome?.paid ?? null,
        dialogOpened: shortcutDialogOpened,
        attackKey: shortcutAttackKey,
        messages: shortcutMessages.length,
      },
      {
        status: "attacked",
        paid: false,
        dialogOpened: false,
        attackKey: "firebolt",
        messages: 0,
      },
    );

    let payer = null;
    let createdMessageIds = [];
    try {
      payer = await Actor.create(
        {
          name: `[BOA TEST] Warlock Demon WP Payer ${foundry.utils.randomID(6)}`,
          type: "npc",
          system: {
            attributes: { wil: { base: 10, value: 10 } },
            willPoints: { base: 10, max: 10, value: 5 },
          },
          flags: {
            [BOA_TEST_MODULE_ID]: {
              [BOA_TEST_FIXTURE_FLAG]: true,
            },
          },
        },
        { renderSheet: false },
      );
      if (!payer) {
        throw new Error("The temporary WP payer Actor could not be created.");
      }
      await payer.update({ "system.willPoints.value": 5 });

      const messageIdsBefore = new Set(
        boaCollectionValues(game.messages).map(message => message.id),
      );
      const paymentOutcome = await performMonsterCommandAttack(
        {
          actor: imp,
          choice: "pay",
          command: getMonsterCommand(imp),
          table: impTable,
          tableResult: firebolt,
          user: {
            id: game.user.id,
            isGM: false,
            character: payer,
          },
        },
        {
          utility: {
            monsterAttack: async () => "BOA paid command attack",
          },
        },
      );

      const createdMessages = boaCollectionValues(game.messages)
        .filter(message => !messageIdsBefore.has(message.id));
      createdMessageIds = createdMessages
        .map(message => message.id)
        .filter(Boolean);
      const paymentMessage = createdMessages.find(message => (
        boaGetFlag(message, "monsterCommandResourcePayment")
          ?.payerActorUuid === payer.uuid
      )) ?? null;
      const paymentFlag = paymentMessage
        ? boaGetFlag(paymentMessage, "monsterCommandResourcePayment")
        : null;
      const content = String(paymentMessage?.content ?? "")
        .replace(/\s+/g, " ");

      boaCheckEqual(
        checks,
        "Imp command completed the paid attack",
        {
          status: paymentOutcome?.status ?? null,
          paid: paymentOutcome?.paid ?? null,
        },
        { status: "attacked", paid: true },
      );
      boaCheckEqual(
        checks,
        "Imp command spent 2 WP from the assigned character",
        payer.system.willPoints.value,
        3,
      );
      boaCheck(
        checks,
        "Imp command created a WP payment chat message",
        Boolean(paymentMessage),
        createdMessageIds.join(", "),
      );
      boaCheckEqual(
        checks,
        "Imp payment chat metadata is correct",
        paymentFlag,
        {
          schemaVersion: 1,
          attackKey: "firebolt",
          resource: "willPoints",
          amount: 2,
          payerActorUuid: payer.uuid,
          sourceActorUuid: imp.uuid,
        },
      );
      boaCheckEqual(
        checks,
        "WP payment chat speaker is the assigned character",
        paymentMessage?.speaker?.actor ?? null,
        payer.id,
      );
      boaCheck(
        checks,
        "Imp payment chat shows the demon, attack, and WP change",
        (
          content.includes("Imp") &&
          content.includes("Firebolt") &&
          content.includes("5") &&
          content.includes("3")
        ),
        content,
      );
    } catch (error) {
      boaCheck(
        checks,
        "Paid Warlock demon command scenario completes",
        false,
        error.stack ?? error.message,
      );
    } finally {
      try {
        const liveIds = createdMessageIds.filter(id => game.messages.get(id));
        if (liveIds.length > 0) {
          await ChatMessage.deleteDocuments(liveIds);
        }
        boaCheck(
          checks,
          "Temporary Warlock demon WP payment chat message was deleted",
          createdMessageIds.every(id => !game.messages.get(id)),
          createdMessageIds.join(", "),
        );
      } catch (error) {
        boaCheck(
          checks,
          "Temporary Warlock demon WP payment chat message was deleted",
          false,
          error.stack ?? error.message,
        );
      }

      try {
        const payerId = payer?.id ?? null;
        if (payerId && game.actors.get(payerId)) {
          await payer.delete();
        }
        boaCheck(
          checks,
          "Temporary Warlock demon WP payer Actor was deleted",
          !payerId || !game.actors.get(payerId),
          payerId,
        );
      } catch (error) {
        boaCheck(
          checks,
          "Temporary Warlock demon WP payer Actor was deleted",
          false,
          error.stack ?? error.message,
        );
      }
    }
  } catch (error) {
    boaCheck(
      checks,
      "Warlock demon command runtime scenarios complete",
      false,
      error.stack ?? error.message,
    );
  }
} else {
  notes.push(
    "Runtime scenarios were skipped because the imported Imp or Firebolt " +
    "attack table was unavailable.",
  );
}


const originalDemonAutomationSetting =
  game.settings.get(
    BOA_TEST_MODULE_ID,
    "demonAutomation",
  );
const automationMessageIds = [];
let disabledPlacementCalls = 0;
let disabledCreationCalls = 0;
let enabledPlacementCalls = 0;
let enabledCreationCalls = 0;

try {
  const {
    executeWarlockDemonPlan,
  } = await import(
    "/modules/bane-of-azeroth/scripts/warlock-demons.js"
  );
  const automationPlan = {
    sourceMessageId:
      "BoaWarlockDemonAutomationMessage",
    actorUuid: "Actor.BoaWarlock",
    abilityUuid:
      "Actor.BoaWarlock.Item.Demonologist",
    sceneId: "BoaWarlockScene",
    casterTokenId: "BoaWarlockToken",
    demonKey: "imp",
    placementRange: 10,
    duration: "shift",
  };

  await game.settings.set(
    BOA_TEST_MODULE_ID,
    "demonAutomation",
    false,
  );
  boaCheckEqual(
    checks,
    "Warlock demon automation was disabled",
    game.settings.get(
      BOA_TEST_MODULE_ID,
      "demonAutomation",
    ),
    false,
  );

  const messagesBefore = new Set(
    boaCollectionValues(game.messages)
      .map(message => message.id),
  );
  const disabledOutcome =
    await executeWarlockDemonPlan(
      automationPlan,
      {
        chatMessageClass: ChatMessage,
        collectPositionFn: async () => {
          disabledPlacementCalls += 1;
          return { x: 100, y: 100 };
        },
        i18n: game.i18n,
        messages: game.messages,
        notifications: {
          info: () => {},
          warn: () => {},
        },
        requestCreationFn: async () => {
          disabledCreationCalls += 1;
          return {
            createdTokenId: "unexpected",
            failedCleanupScenes: [],
          };
        },
        settings: game.settings,
      },
    );

  const disabledMessages =
    boaCollectionValues(game.messages)
      .filter(message =>
        !messagesBefore.has(message.id)
      );
  automationMessageIds.push(
    ...disabledMessages
      .map(message => message.id)
      .filter(Boolean),
  );
  const manualMessage =
    disabledMessages.find(message =>
      boaGetFlag(
        message,
        "warlockDemonManualPlacement",
      )?.demonKey === "imp"
    ) ?? null;

  boaCheckEqual(
    checks,
    "Disabled demon automation skipped placement and creation",
    {
      status:
        disabledOutcome?.status ?? null,
      placementCalls:
        disabledPlacementCalls,
      creationCalls:
        disabledCreationCalls,
    },
    {
      status: "manual",
      placementCalls: 0,
      creationCalls: 0,
    },
  );
  boaCheck(
    checks,
    "Disabled demon automation posted manual instructions",
    Boolean(manualMessage),
    automationMessageIds.join(", "),
  );

  await game.settings.set(
    BOA_TEST_MODULE_ID,
    "demonAutomation",
    true,
  );
  const enabledOutcome =
    await executeWarlockDemonPlan(
      automationPlan,
      {
        collectPositionFn: async () => {
          enabledPlacementCalls += 1;
          return { x: 100, y: 100 };
        },
        i18n: game.i18n,
        notifications: {
          info: () => {},
          warn: () => {},
        },
        requestCreationFn: async () => {
          enabledCreationCalls += 1;
          return {
            createdTokenId:
              "BoaSyntheticDemonToken",
            failedCleanupScenes: [],
          };
        },
        settings: game.settings,
      },
    );

  boaCheckEqual(
    checks,
    "Enabled demon automation reached placement and creation",
    {
      status:
        enabledOutcome?.status ?? null,
      placementCalls:
        enabledPlacementCalls,
      creationCalls:
        enabledCreationCalls,
    },
    {
      status: "created",
      placementCalls: 1,
      creationCalls: 1,
    },
  );
} catch (error) {
  boaCheck(
    checks,
    "Warlock demon automation setting workflow completed",
    false,
    error.stack ?? error.message,
  );
} finally {
  try {
    const liveIds =
      automationMessageIds.filter(
        id => game.messages.get(id),
      );
    if (liveIds.length > 0) {
      await ChatMessage.deleteDocuments(
        liveIds,
      );
    }
    boaCheck(
      checks,
      "Temporary manual Warlock demon message was deleted",
      automationMessageIds.every(
        id => !game.messages.get(id),
      ),
      automationMessageIds.join(", "),
    );
  } catch (error) {
    boaCheck(
      checks,
      "Temporary manual Warlock demon message was deleted",
      false,
      error.stack ?? error.message,
    );
  }

  try {
    await game.settings.set(
      BOA_TEST_MODULE_ID,
      "demonAutomation",
      originalDemonAutomationSetting,
    );
    boaCheckEqual(
      checks,
      "Warlock demon automation setting was restored",
      game.settings.get(
        BOA_TEST_MODULE_ID,
        "demonAutomation",
      ),
      originalDemonAutomationSetting,
    );
  } catch (error) {
    boaCheck(
      checks,
      "Warlock demon automation setting was restored",
      false,
      error.stack ?? error.message,
    );
  }
}

notes.push(
  "The runtime checks inject a harmless attack executor. They verify " +
  "shortcut behavior, real WP payment, ChatMessage metadata, and cleanup " +
  "without rolling a real Dragonbane attack.",
);
notes.push(
  "Placement, setting branches, replacement helpers, ownership, "
  + "shift duration, and cleanup are automated. A real pointer-driven "
  + "Demonologist summon remains an interactive verification.",
);

return boaFinish(testKey, testName, checks, notes);
