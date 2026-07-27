const checks = [];
const notes = [];
const testKey = "cleanup-player-tests";
const testName = "BOA DEV – Cleanup Player Tests";
const sessionFlag = "playerTestSession";
const fixtureFlag = "playerTestFixture";
const sessionIdFlag = "playerTestSessionId";
const reportFlag = "playerTestReport";

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
    ?? null;
}

const fixtureUsers = boaCollectionValues(game.users)
  .filter(user => Boolean(fixture(user)));
const activeFixtureUsers = fixtureUsers
  .filter(user => user.active);

if (activeFixtureUsers.length > 0) {
  boaCheck(
    checks,
    "Generated Player Users are logged out",
    false,
    activeFixtureUsers.map(user => user.name).join(", "),
  );
  notes.push(
    "Log the incognito player client out, then run cleanup again.",
  );
  return boaFinish(testKey, testName, checks, notes);
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

const messageIds = boaCollectionValues(game.messages)
  .filter(message => sessionIds.has(sessionIdOf(message)))
  .map(message => message.id);
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

return boaFinish(testKey, testName, checks, notes);
