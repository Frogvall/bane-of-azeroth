const checks = [];
const notes = [];
const testKey = "cleanup-player-tests";
const testName = "BOA DEV – Cleanup Player Tests";
const sessionFlag = "playerTestSession";
const fixtureFlag = "playerTestFixture";
const sessionIdFlag = "playerTestSessionId";
const reportFlag = "playerTestReport";
const stageResultFlag = "playerTestStageResult";

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Player-test cleanup is run by a game master",
    false,
    "Only a GM may delete temporary Users and world fixtures.",
  );
  return boaFinish(testKey, testName, checks, notes);
}

function fixture(document) {
  return boaGetFlag(document, fixtureFlag);
}

function session(document) {
  return boaGetFlag(document, sessionFlag);
}

function sessionIdOf(document) {
  return boaGetFlag(document, sessionIdFlag)
    ?? fixture(document)?.sessionId
    ?? session(document)?.sessionId
    ?? boaGetFlag(document, reportFlag)?.sessionId
    ?? boaGetFlag(document, stageResultFlag)?.sessionId
    ?? null;
}

const fixtureUsers = boaCollectionValues(game.users)
  .filter(user => Boolean(fixture(user)));
const activeFixtureUsers = fixtureUsers
  .filter(user => user.active);

for (const user of activeFixtureUsers) {
  try {
    await user.update({
      role: CONST.USER_ROLES.NONE,
    });
    await boaWaitFor(
      () => game.users.get(user.id)?.active === false,
      {
        timeout: 10000,
        interval: 100,
        description: "temporary Player User to disconnect",
      },
    );
    boaCheck(
      checks,
      `Disconnected active Player User ${user.name}`,
      true,
      user.id,
    );
  } catch (error) {
    boaCheck(
      checks,
      `Disconnected active Player User ${user.name}`,
      false,
      error.stack ?? error.message,
    );
  }
}

const allSessionDocuments = [
  ...fixtureUsers,
  ...boaCollectionValues(game.actors),
  ...boaCollectionValues(game.scenes),
  ...boaCollectionValues(game.macros),
  ...boaCollectionValues(game.messages),
];
const sessions = allSessionDocuments
  .map(document => session(document))
  .filter(Boolean)
  .filter((value, index, values) => (
    values.findIndex(candidate => (
      candidate.sessionId === value.sessionId
    )) === index
  ));
const sessionIds = new Set(
  allSessionDocuments
    .map(document => sessionIdOf(document))
    .filter(Boolean),
);
const nativeSufferingActorUuids = new Set(
  sessions
    .map(preparedSession => {
      const targetScene = game.scenes.get(
        preparedSession.sceneId,
      );
      const voidwalkerToken =
        targetScene?.tokens?.get(
          preparedSession
            .sufferingVoidwalkerTokenId,
        )
        ?? null;

      return voidwalkerToken?.actor?.uuid
        ?? null;
    })
    .filter(Boolean),
);

function isNativeSufferingFixtureMessage(
  message,
) {
  const content = String(
    message?.content ?? "",
  );

  return Array.from(
    nativeSufferingActorUuids,
  ).some(actorUuid =>
    content.includes(
      `data-actor-id="${actorUuid}"`,
    )
  );
}

const stageResultsBySession = new Map();
for (const message of boaCollectionValues(game.messages)) {
  const stageResult = boaGetFlag(
    message,
    stageResultFlag,
  );
  if (
    !stageResult?.sessionId
    || !sessionIds.has(stageResult.sessionId)
    || !stageResult.stage
    || !stageResult.result
  ) {
    continue;
  }

  const stages = stageResultsBySession.get(
    stageResult.sessionId,
  ) ?? new Map();
  stages.set(stageResult.stage, stageResult.result);
  stageResultsBySession.set(stageResult.sessionId, stages);
}

if (sessionIds.size === 0) {
  boaCheck(
    checks,
    "No player-test fixtures remain",
    true,
  );
  notes.push("Cleanup was already complete.");
  return boaFinish(testKey, testName, checks, notes);
}

for (const preparedSession of sessions) {
  try {
    await game.settings.set(
      BOA_TEST_MODULE_ID,
      "elementalTotemAutomation",
      preparedSession.originalAutomationSetting,
    );
    boaCheckEqual(
      checks,
      `Restored Elemental Totem automation for ${preparedSession.sessionId}`,
      game.settings.get(
        BOA_TEST_MODULE_ID,
        "elementalTotemAutomation",
      ),
      preparedSession.originalAutomationSetting,
    );
  } catch (error) {
    boaCheck(
      checks,
      `Restored Elemental Totem automation for ${preparedSession.sessionId}`,
      false,
      error.stack ?? error.message,
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      preparedSession,
      "originalDemonAutomationSetting",
    )
  ) {
    try {
      await game.settings.set(
        BOA_TEST_MODULE_ID,
        "demonAutomation",
        preparedSession.originalDemonAutomationSetting,
      );
      boaCheckEqual(
        checks,
        `Restored Warlock demon automation for ${preparedSession.sessionId}`,
        game.settings.get(
          BOA_TEST_MODULE_ID,
          "demonAutomation",
        ),
        preparedSession.originalDemonAutomationSetting,
      );
    } catch (error) {
      boaCheck(
        checks,
        `Restored Warlock demon automation for ${preparedSession.sessionId}`,
        false,
        error.stack ?? error.message,
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      preparedSession,
      "originalDemonHunterInitiationAutomationSetting",
    )
  ) {
    try {
      await game.settings.set(
        BOA_TEST_MODULE_ID,
        "demonHunterInitiationAutomation",
        preparedSession.originalDemonHunterInitiationAutomationSetting,
      );

      boaCheckEqual(
        checks,
        `Restored Demon Hunter Initiation automation for ${preparedSession.sessionId}`,
        game.settings.get(
          BOA_TEST_MODULE_ID,
          "demonHunterInitiationAutomation",
        ),
        preparedSession.originalDemonHunterInitiationAutomationSetting,
      );
    } catch (error) {
      boaCheck(
        checks,
        `Restored Demon Hunter Initiation automation for ${preparedSession.sessionId}`,
        false,
        error.stack ??
          error.message,
      );
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(
      preparedSession,
      "originalFrostreaperAutomationSetting",
    )
  ) {
    try {
      await game.settings.set(
        BOA_TEST_MODULE_ID,
        "frostreaperAutomation",
        preparedSession.originalFrostreaperAutomationSetting,
      );
      boaCheckEqual(
        checks,
        `Restored Frostreaper automation for ${preparedSession.sessionId}`,
        game.settings.get(
          BOA_TEST_MODULE_ID,
          "frostreaperAutomation",
        ),
        preparedSession.originalFrostreaperAutomationSetting,
      );
    } catch (error) {
      boaCheck(
        checks,
        `Restored Frostreaper automation for ${preparedSession.sessionId}`,
        false,
        error.stack ??
          error.message,
      );
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(
      preparedSession,
      "originalDeathKnightRunesAutomationSetting",
    )
  ) {
    try {
      await game.settings.set(
        BOA_TEST_MODULE_ID,
        "deathKnightRunesAutomation",
        preparedSession.originalDeathKnightRunesAutomationSetting,
      );
      boaCheckEqual(
        checks,
        `Restored Death Knight Runes automation for ${preparedSession.sessionId}`,
        game.settings.get(
          BOA_TEST_MODULE_ID,
          "deathKnightRunesAutomation",
        ),
        preparedSession.originalDeathKnightRunesAutomationSetting,
      );
    } catch (error) {
      boaCheck(
        checks,
        `Restored Death Knight Runes automation for ${preparedSession.sessionId}`,
        false,
        error.stack ?? error.message,
      );
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(
      preparedSession,
      "originalDruidFormsAutomationSetting",
    )
  ) {
    try {
      await game.settings.set(
        BOA_TEST_MODULE_ID,
        "druidFormsAutomation",
        preparedSession.originalDruidFormsAutomationSetting,
      );
      boaCheckEqual(
        checks,
        `Restored Druid Forms automation for ${preparedSession.sessionId}`,
        game.settings.get(
          BOA_TEST_MODULE_ID,
          "druidFormsAutomation",
        ),
        preparedSession.originalDruidFormsAutomationSetting,
      );
    } catch (error) {
      boaCheck(
        checks,
        `Restored Druid Forms automation for ${preparedSession.sessionId}`,
        false,
        error.stack ?? error.message,
      );
    }
  }
  // BOA 0.11.7 Druid artwork Player-test setting cleanup.
  if (
    Object.prototype.hasOwnProperty.call(
      preparedSession,
      "originalDruidFormArtworkAutomationSetting",
    )
  ) {
    try {
      await game.settings.set(
        BOA_TEST_MODULE_ID,
        "druidFormArtworkAutomation",
        preparedSession.originalDruidFormArtworkAutomationSetting,
      );
      boaCheckEqual(
        checks,
        `Restored Druid form artwork automation for ${preparedSession.sessionId}`,
        game.settings.get(
          BOA_TEST_MODULE_ID,
          "druidFormArtworkAutomation",
        ),
        preparedSession.originalDruidFormArtworkAutomationSetting,
      );
    } catch (error) {
      boaCheck(
        checks,
        `Restored Druid form artwork automation for ${preparedSession.sessionId}`,
        false,
        error.stack ?? error.message,
      );
    }
  }
  try {
    const previousScene = preparedSession.previousActiveSceneId
      ? game.scenes.get(preparedSession.previousActiveSceneId)
      : null;
    if (previousScene) await previousScene.activate();
    boaCheck(
      checks,
      `Restored previous active Scene for ${preparedSession.sessionId}`,
      !preparedSession.previousActiveSceneId || Boolean(previousScene),
      preparedSession.previousActiveSceneId ?? "",
    );
  } catch (error) {
    boaCheck(
      checks,
      `Restored previous active Scene for ${preparedSession.sessionId}`,
      false,
      error.stack ?? error.message,
    );
  }
}

const messageIds = [
  ...new Set(
    boaCollectionValues(game.messages)
      .filter(message => (
        sessionIds.has(
          sessionIdOf(message),
        )
        || isNativeSufferingFixtureMessage(
          message,
        )
      ))
      .map(message => message.id),
  ),
];
if (messageIds.length > 0) {
  await ChatMessage.deleteDocuments(messageIds);
}

const macroIds = boaCollectionValues(game.macros)
  .filter(macro => sessionIds.has(sessionIdOf(macro)))
  .map(macro => macro.id);
if (macroIds.length > 0) {
  await Macro.deleteDocuments(macroIds);
}

const sceneIds = boaCollectionValues(game.scenes)
  .filter(scene => sessionIds.has(sessionIdOf(scene)))
  .map(scene => scene.id);
if (sceneIds.length > 0) {
  await Scene.deleteDocuments(sceneIds);
}

const actorIds = boaCollectionValues(game.actors)
  .filter(actor => sessionIds.has(sessionIdOf(actor)))
  .map(actor => actor.id);
if (actorIds.length > 0) {
  await Actor.deleteDocuments(actorIds);
}

const userIds = fixtureUsers.map(user => user.id);
if (userIds.length > 0) {
  await User.deleteDocuments(userIds);
}

const remaining = {
  users: boaCollectionValues(game.users)
    .filter(user => sessionIds.has(sessionIdOf(user))).length,
  actors: boaCollectionValues(game.actors)
    .filter(actor => sessionIds.has(sessionIdOf(actor))).length,
  scenes: boaCollectionValues(game.scenes)
    .filter(scene => sessionIds.has(sessionIdOf(scene))).length,
  macros: boaCollectionValues(game.macros)
    .filter(macro => sessionIds.has(sessionIdOf(macro))).length,
  messages: boaCollectionValues(game.messages)
    .filter(message => sessionIds.has(sessionIdOf(message))).length,
};

boaCheckEqual(
  checks,
  "All player-test fixtures were removed",
  remaining,
  {
    users: 0,
    actors: 0,
    scenes: 0,
    macros: 0,
    messages: 0,
  },
);

notes.push(
  `${userIds.length} User(s), ${actorIds.length} Actor(s), `
  + `${sceneIds.length} Scene(s), ${macroIds.length} Macro(s), `
  + `and ${messageIds.length} ChatMessage(s) were removed.`,
);

const cleanupResult = boaBuildResult(
  testKey,
  testName,
  checks,
  notes,
);
const results = [];

function missingStageResult(key, name, description) {
  return boaBuildResult(
    key,
    name,
    [{
      status: "FAIL",
      description,
      details:
        "The expected structured stage result was not found.",
    }],
  );
}

for (const sessionId of sessionIds) {
  const stages = stageResultsBySession.get(sessionId)
    ?? new Map();
  results.push(
    stages.get("prepare")
      ?? missingStageResult(
        "prepare-player-tests",
        "BOA DEV – Prepare Player Tests",
        "Missing Prepare Player Tests result",
      ),
  );
  results.push(
    stages.get("player")
      ?? missingStageResult(
        "player-tests",
        "BOA DEV – Run Player Tests",
        "Missing Run Player Tests result",
      ),
  );
}
results.push(cleanupResult);

const suiteResult = boaBuildResult(
  "player-test-harness",
  "BOA DEV – Player Test Harness",
  results.map(result => ({
    status: result.passed ? "PASS" : "FAIL",
    description: result.name,
    details:
      `${result.passedCount ?? 0} passed, `
      + `${result.failedCount ?? 0} failed, `
      + `${result.skippedCount ?? 0} skipped`,
  })),
  [
    "The report covers preparation, genuine Player execution, and cleanup.",
  ],
);
const sessionStartedAt = sessions
  .map(value => new Date(value.createdAt))
  .filter(value => !Number.isNaN(value.getTime()))
  .sort((left, right) => left - right)[0]
  ?? new Date();
const completedAt = new Date();
let report = null;

try {
  const created = await boaCreateSystemTestReport({
    suiteResult,
    results,
    startedAt: sessionStartedAt,
    completedAt,
  });
  report = created.report;
  boaCheck(
    checks,
    "Dated Journal player-test report was created",
    Boolean(report?.id),
    report?.uuid ?? "",
  );
  report?.sheet?.render(true);
} catch (error) {
  boaCheck(
    checks,
    "Dated Journal player-test report was created",
    false,
    error.stack ?? error.message,
  );
}

const totals = boaSystemTestTotals(results);
const reportLink = report
  ? (
      report.link
      ?? `@UUID[${report.uuid}]{Open the complete player-test report}`
    )
  : "<em>The Journal report could not be created.</em>";
const finalResult = boaBuildResult(
  testKey,
  testName,
  checks,
  notes,
);
const chatContent = `
  <p>
    <strong>
      BOA player tests:
      ${suiteResult.passed && finalResult.passed ? "PASS" : "FAIL"}
    </strong>
  </p>
  <p>
    ${totals.passed} passed,
    ${totals.failed} failed,
    ${totals.skipped} skipped.
  </p>
  <p>${reportLink}</p>
`;

return boaFinish(
  testKey,
  testName,
  checks,
  notes,
  {
    chatContent,
  },
);
