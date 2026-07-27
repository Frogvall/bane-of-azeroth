const checks = [];
const notes = [];
const startedAt = new Date();
const testKey = "player-tests";
const testName = "BOA DEV – Run Player Tests";
const sessionFlag = "playerTestSession";
const fixtureFlag = "playerTestFixture";
const sessionIdFlag = "playerTestSessionId";
const reportFlag = "playerTestReport";
const stageResultFlag = "playerTestStageResult";

if (game.user.isGM) {
  boaCheck(
    checks,
    "Player tests are run by the generated Player User",
    false,
    "Log in with the credentials from the preparation Macro.",
  );
  return boaFinish(testKey, testName, checks, notes);
}

const session = boaGetFlag(game.user, sessionFlag);
if (!session || session.schemaVersion !== 1) {
  boaCheck(
    checks,
    "Current User belongs to a prepared player-test session",
    false,
    "Run BOA DEV – Prepare Player Tests as GM first.",
  );
  return boaFinish(testKey, testName, checks, notes);
}

function sessionIdOf(document) {
  return boaGetFlag(document, sessionIdFlag)
    ?? boaGetFlag(document, fixtureFlag)?.sessionId
    ?? null;
}

function currentMessageIds() {
  return new Set(
    boaCollectionValues(game.messages).map(message => message.id),
  );
}

function messagesSince(before) {
  return boaCollectionValues(game.messages)
    .filter(message => !before.has(message.id));
}

const actor = game.user.character;
const scene = game.scenes.get(session.sceneId);
const token = scene?.tokens.get(session.tokenId) ?? null;
const imp = game.actors.get(session.impActorId) ?? null;
const activeGMs = boaCollectionValues(game.users)
  .filter(user => user.active && user.isGM);

boaCheck(
  checks,
  "Current User is a real non-GM Player",
  (
    game.user.role === CONST.USER_ROLES.PLAYER
    && game.user.isGM === false
  ),
  `${game.user.name}: ${game.user.role}`,
);
boaCheck(
  checks,
  "At least one GM client is connected",
  activeGMs.length > 0,
  activeGMs.map(user => user.name).join(", "),
);
boaCheck(
  checks,
  "Assigned character matches the prepared session",
  actor?.id === session.actorId,
  actor?.uuid ?? "",
);
boaCheck(
  checks,
  "Player owns the assigned character",
  Boolean(
    actor?.testUserPermission(
      game.user,
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    )
  ),
  actor?.ownership ?? {},
);
boaCheck(
  checks,
  "Prepared Scene and linked character Token exist",
  Boolean(
    scene
    && token
    && token.actorLink === true
    && token.actor?.id === actor?.id
  ),
  `${scene?.id ?? "no scene"} / ${token?.id ?? "no token"}`,
);
boaCheck(
  checks,
  "Prepared fixtures share one session ID",
  (
    sessionIdOf(actor) === session.sessionId
    && sessionIdOf(scene) === session.sessionId
    && sessionIdOf(token) === session.sessionId
    && sessionIdOf(imp) === session.sessionId
  ),
  session.sessionId,
);

for (const contentKey of session.requiredAbilityKeys ?? []) {
  boaCheck(
    checks,
    `Assigned character has ${contentKey}`,
    boaCollectionValues(actor?.items).some(item =>
      boaContentKey(item) === contentKey
    ),
    contentKey,
  );
}

const elementalTotemSpell =
  boaCollectionValues(actor?.items).find(item => (
    item.type === "spell"
    && (
      boaContentKey(item) === "spells.elemental-totem"
      || boaGetFlag(item, "sourceSpell") === "spells.elemental-totem"
    )
  )) ?? null;

boaCheck(
  checks,
  "Shamanic Calling granted Elemental Totem to the player Actor",
  Boolean(elementalTotemSpell),
  elementalTotemSpell?.uuid ?? "",
);
boaCheck(
  checks,
  "Automatically granted Elemental Totem is prepared",
  Boolean(
    elementalTotemSpell
    && (
      elementalTotemSpell.system?.prepared === true
      || elementalTotemSpell.system?.memorized === true
      || boaGetFlag(elementalTotemSpell, "alwaysPrepared") === true
    )
  ),
  elementalTotemSpell?.system ?? {},
);

if (actor) {
  const originalWillPoints =
    Number(actor.system?.willPoints?.value ?? 0);
  try {
    await actor.update({
      "system.willPoints.value": Math.max(0, originalWillPoints - 1),
    });
    boaCheckEqual(
      checks,
      "Player can update the owned character",
      Number(actor.system?.willPoints?.value),
      Math.max(0, originalWillPoints - 1),
    );
  } catch (error) {
    boaCheck(
      checks,
      "Player can update the owned character",
      false,
      error.stack ?? error.message,
    );
  } finally {
    try {
      await actor.update({
        "system.willPoints.value": originalWillPoints,
      });
      boaCheckEqual(
        checks,
        "Owned-character test restored WP",
        Number(actor.system?.willPoints?.value),
        originalWillPoints,
      );
    } catch (error) {
      boaCheck(
        checks,
        "Owned-character test restored WP",
        false,
        error.stack ?? error.message,
      );
    }
  }
}

if (actor && imp) {
  const originalWillPoints =
    Number(actor.system?.willPoints?.value ?? 0);
  const paymentStart = Math.max(originalWillPoints, 5);
  let paymentMessage = null;
  try {
    await actor.update({
      "system.willPoints.value": paymentStart,
    });
    const {
      getMonsterCommand,
      getOrderedCommandAttacks,
      performMonsterCommandAttack,
    } = await import(
      `/modules/${BOA_TEST_MODULE_ID}/scripts/monster-command-control.js`
    );

    const tableUuid = String(imp.system?.attackTable ?? "");
    const table = tableUuid
      ? globalThis.fromUuidSync?.(tableUuid)
      : null;
    const tableResult =
      getOrderedCommandAttacks(table)[0] ?? null;
    const command = getMonsterCommand(imp);
    const beforeMessages = currentMessageIds();

    if (!table || !tableResult || !command) {
      throw new Error(
        "The player-owned Imp command data could not be resolved.",
      );
    }

    const outcome = await performMonsterCommandAttack(
      {
        actor: imp,
        choice: "pay",
        command,
        table,
        tableResult,
        user: game.user,
      },
      {
        utility: {
          monsterAttack: async () =>
            "BOA real-player command attack",
        },
      },
    );

    const createdMessages = messagesSince(beforeMessages);
    paymentMessage = createdMessages.find(message => (
      boaGetFlag(
        message,
        "monsterCommandResourcePayment",
      )?.payerActorUuid === actor.uuid
    )) ?? null;

    if (paymentMessage) {
      await paymentMessage.update({
        [`flags.${BOA_TEST_MODULE_ID}.${fixtureFlag}`]: {
          schemaVersion: 1,
          sessionId: session.sessionId,
          kind: "player-command-payment",
        },
        [`flags.${BOA_TEST_MODULE_ID}.${sessionIdFlag}`]:
          session.sessionId,
      });
    }

    boaCheckEqual(
      checks,
      "Real Player can pay for an Imp command",
      {
        status: outcome?.status ?? null,
        paid: outcome?.paid ?? null,
      },
      {
        status: "attacked",
        paid: true,
      },
    );
    boaCheckEqual(
      checks,
      "Imp command spends 2 WP from the assigned character",
      Number(actor.system?.willPoints?.value),
      paymentStart - 2,
    );
    boaCheck(
      checks,
      "Imp command creates a player-authored WP message",
      Boolean(
        paymentMessage
        && (
          paymentMessage.author?.id
          ?? paymentMessage.user?.id
          ?? paymentMessage.user
        ) === game.user.id
      ),
      paymentMessage?.id ?? "",
    );
    boaCheckEqual(
      checks,
      "Imp payment message speaker is the assigned character",
      paymentMessage?.speaker?.actor ?? null,
      actor.id,
    );
  } catch (error) {
    boaCheck(
      checks,
      "Real-player Warlock demon command completed",
      false,
      error.stack ?? error.message,
    );
  } finally {
    try {
      await actor.update({
        "system.willPoints.value": originalWillPoints,
      });
      boaCheckEqual(
        checks,
        "Player command test restored character WP",
        Number(actor.system?.willPoints?.value),
        originalWillPoints,
      );
    } catch (error) {
      boaCheck(
        checks,
        "Player command test restored character WP",
        false,
        error.stack ?? error.message,
      );
    }
  }
} else {
  boaCheck(
    checks,
    "Prepared player and Imp fixtures are available",
    false,
    `${actor?.id ?? "no actor"} / ${imp?.id ?? "no imp"}`,
  );
}

notes.push(
  "The player suite ran in a genuine Player User context.",
);
notes.push(
  "A real successful Elemental Totem spell roll and "
  + "pointer-driven placement remain interactive tests.",
);

const completedAt = new Date();
const result = boaBuildResult(
  testKey,
  testName,
  checks,
  notes,
);
const gmIds = boaCollectionValues(game.users)
  .filter(user => user.isGM)
  .map(user => user.id);
const recipients = [
  ...new Set([game.user.id, ...gmIds]),
];

await ChatMessage.create({
  content: boaResultHtml(result),
  whisper: recipients,
  flags: {
    [BOA_TEST_MODULE_ID]: {
      [fixtureFlag]: {
        schemaVersion: 1,
        sessionId: session.sessionId,
        kind: "player-report",
      },
      [sessionIdFlag]: session.sessionId,
      [stageResultFlag]: {
        schemaVersion: 1,
        sessionId: session.sessionId,
        stage: "player",
        result,
      },
      [reportFlag]: {
        schemaVersion: 1,
        sessionId: session.sessionId,
        userId: game.user.id,
        actorUuid: actor?.uuid ?? null,
        passed: result.passed,
        passedCount: result.passedCount,
        failedCount: result.failedCount,
        skippedCount: result.skippedCount,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
      },
    },
  },
});

const summary =
  `${testName}: ${result.passedCount} passed, `
  + `${result.failedCount} failed, `
  + `${result.skippedCount} skipped.`;

const gmSummaryContent = `
  <h2>BOA Player Tests Complete</h2>
  <p>
    <strong>
      ${result.passed ? "PASS" : "NEEDS ATTENTION"}
    </strong>
  </p>
  <p>
    ${result.passedCount} passed,
    ${result.failedCount} failed,
    ${result.skippedCount} skipped.
  </p>
  <p>
    Run <strong>BOA DEV – Cleanup Player Tests</strong>
    as a game master. Cleanup disconnects the temporary
    Player User, removes the test fixtures, and creates the
    final Journal report.
  </p>
`;

await ChatMessage.create({
  content: gmSummaryContent,
  whisper: gmIds,
  flags: {
    [BOA_TEST_MODULE_ID]: {
      [fixtureFlag]: {
        schemaVersion: 1,
        sessionId: session.sessionId,
        kind: "player-summary",
      },
      [sessionIdFlag]: session.sessionId,
    },
  },
});

if (result.passed) {
  ui.notifications.info(summary);
} else {
  ui.notifications.error(summary);
  const error = new Error(
    `${testName} failed ${result.failedCount} check(s).`,
  );
  error.boaResult = result;
  throw error;
}

return result;
