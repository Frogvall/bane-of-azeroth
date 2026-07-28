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

async function markMessagesSince(before, kind) {
  const messages = messagesSince(before);

  for (const message of messages) {
    const authorId =
      message.author?.id
      ?? message.user?.id
      ?? message.user
      ?? null;
    const canUpdate =
      typeof message.canUserModify === "function"
        ? message.canUserModify(
            game.user,
            "update",
          )
        : (
            message.isOwner === true
            || authorId === game.user.id
          );

    if (!canUpdate) continue;

    await message.update({
      [`flags.${BOA_TEST_MODULE_ID}.${fixtureFlag}`]: {
        schemaVersion: 1,
        sessionId: session.sessionId,
        kind,
      },
      [`flags.${BOA_TEST_MODULE_ID}.${sessionIdFlag}`]:
        session.sessionId,
    });
  }

  return messages;
}

function tokenIdExists(targetScene, tokenId) {
  return Boolean(
    targetScene?.tokens?.get(tokenId),
  );
}

async function runRestMethod(
  restingActor,
  methodName,
  messageKind,
) {
  const beforeMessages = currentMessageIds();

  try {
    return await restingActor[methodName]();
  } finally {
    await markMessagesSince(
      beforeMessages,
      messageKind,
    );
  }
}

const actor = game.user.character;
const shiftActor =
  game.actors.get(session.shiftActorId) ?? null;
const sufferingActor =
  game.actors.get(session.sufferingActorId) ?? null;
const scene = game.scenes.get(session.sceneId);
const lifecycleScene =
  game.scenes.get(session.lifecycleSceneId);
const token = scene?.tokens.get(session.tokenId) ?? null;
const imp = game.actors.get(session.impActorId) ?? null;
const sayaad =
  game.actors.get(session.sayaadActorId) ?? null;
const impTargetToken =
  scene?.tokens.get(session.impTargetTokenId) ?? null;
const sayaadTargetToken =
  scene?.tokens.get(session.sayaadTargetTokenId) ?? null;
const sufferingActorToken =
  scene?.tokens.get(session.sufferingActorTokenId) ?? null;
const sufferingVoidwalkerToken =
  scene?.tokens.get(session.sufferingVoidwalkerTokenId) ?? null;
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
    && sessionIdOf(shiftActor) === session.sessionId
    && sessionIdOf(lifecycleScene) === session.sessionId
    && sessionIdOf(imp) === session.sessionId
    && sessionIdOf(sayaad) === session.sessionId
    && sessionIdOf(impTargetToken) === session.sessionId
    && sessionIdOf(sayaadTargetToken) === session.sessionId
    && sessionIdOf(sufferingActor) === session.sessionId
    && sessionIdOf(sufferingActorToken) === session.sessionId
    && sessionIdOf(sufferingVoidwalkerToken) === session.sessionId
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

if (
  impTargetToken
  && sayaadTargetToken
) {
  try {
    const {
      applyWarlockDemonDefenseBane,
    } = await import(
      `/modules/${BOA_TEST_MODULE_ID}/scripts/warlock-demons/defenses.js`
    );

    function defenseOutcome(
      targetToken,
      isRangedWeapon,
    ) {
      const test = {
        dialogData: {
          banes: [],
        },
        noBanesBoons: false,
        options: {
          targets: [{
            document: targetToken,
          }],
        },
        weapon: {
          isRangedWeapon,
        },
      };
      const applied =
        applyWarlockDemonDefenseBane(test);

      return {
        applied,
        banes: test.dialogData.banes.map(bane => ({
          source: bane.source,
          value: bane.value,
        })),
      };
    }

    const phaseShiftLabel = game.i18n.localize(
      "BOA.dialog.warlockDemon.phaseShiftBane",
    );
    const seductiveLabel = game.i18n.localize(
      "BOA.dialog.warlockDemon.seductiveBane",
    );

    boaCheckEqual(
      checks,
      "Real Player receives Phase Shift as a preselected bane against an Imp",
      {
        melee: defenseOutcome(
          impTargetToken,
          false,
        ),
        ranged: defenseOutcome(
          impTargetToken,
          true,
        ),
      },
      {
        melee: {
          applied: true,
          banes: [{
            source: phaseShiftLabel,
            value: true,
          }],
        },
        ranged: {
          applied: true,
          banes: [{
            source: phaseShiftLabel,
            value: true,
          }],
        },
      },
    );
    boaCheckEqual(
      checks,
      "Real Player receives Seductive only for a melee attack against a Sayaad",
      {
        melee: defenseOutcome(
          sayaadTargetToken,
          false,
        ),
        ranged: defenseOutcome(
          sayaadTargetToken,
          true,
        ),
      },
      {
        melee: {
          applied: true,
          banes: [{
            source: seductiveLabel,
            value: true,
          }],
        },
        ranged: {
          applied: false,
          banes: [],
        },
      },
    );
  } catch (error) {
    boaCheck(
      checks,
      "Real-player demon defense bane checks completed",
      false,
      error.stack ?? error.message,
    );
  }
} else {
  boaCheck(
    checks,
    "Prepared Imp and Sayaad target Tokens are available",
    false,
    `${
      impTargetToken?.id ?? "no Imp target"
    } / ${
      sayaadTargetToken?.id ?? "no Sayaad target"
    }`,
  );
}

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

if (
  sufferingActor
  && sufferingActorToken
  && sufferingVoidwalkerToken
) {
  const originalCasterHp = Number(
    sufferingActor.system?.hitPoints?.value ?? 0,
  );
  const originalVoidwalkerHp = Number(
    sufferingVoidwalkerToken.actor?.system
      ?.hitPoints?.value ?? 0,
  );
  const finalDamage = 5;
  const expectedSharedDamage = 3;

  try {
    if (typeof sufferingActor.applyDamage !== "function") {
      throw new Error(
        "The Suffering caster has no applyDamage() method.",
      );
    }
    if (originalCasterHp < finalDamage) {
      throw new Error(
        `The Suffering caster has only ${originalCasterHp} HP.`,
      );
    }
    if (originalVoidwalkerHp < expectedSharedDamage) {
      throw new Error(
        `The Voidwalker has only ${originalVoidwalkerHp} HP.`,
      );
    }

    const sufferingMessagesBefore =
      currentMessageIds();
    let sufferingMessages = [];
    try {
      await sufferingActor.applyDamage(finalDamage);
    } finally {
      sufferingMessages =
        await markMessagesSince(
          sufferingMessagesBefore,
          "player-suffering-message",
        );
    }
    await boaWaitFor(
      () => (
        Number(
          sufferingActor.system?.hitPoints?.value,
        ) === originalCasterHp - expectedSharedDamage
        && Number(
          sufferingVoidwalkerToken.actor?.system
            ?.hitPoints?.value,
        ) === originalVoidwalkerHp - expectedSharedDamage
      ),
      {
        timeout: 5000,
        interval: 100,
        description:
          "Voidwalker Suffering damage sharing through the active GM",
      },
    );

    boaCheckEqual(
      checks,
      "Real Player Suffering splits 5 final damage into 3 HP loss for caster and Voidwalker",
      {
        casterHpLoss:
          originalCasterHp
          - Number(
            sufferingActor.system?.hitPoints?.value,
          ),
        voidwalkerHpLoss:
          originalVoidwalkerHp
          - Number(
            sufferingVoidwalkerToken.actor?.system
              ?.hitPoints?.value,
          ),
        voidwalkerArmor:
          Number(
            sufferingVoidwalkerToken.actor?.system
              ?.armor ?? 0,
          ),
      },
      {
        casterHpLoss: 3,
        voidwalkerHpLoss: 3,
        voidwalkerArmor: 6,
      },
    );
    const voidwalkerActor =
      sufferingVoidwalkerToken.actor;
    const voidwalkerActorName =
      voidwalkerActor.isToken
        ? (
            voidwalkerActor.token?.name
            ?? voidwalkerActor.name
          )
        : voidwalkerActor.name;
    const localizedDamageApplied =
      game.i18n.format(
        "DoD.ui.chat.damageApplied",
        {
          damage: expectedSharedDamage,
          actor: voidwalkerActorName,
        },
      );
    const isNativeVoidwalkerDamageMessage =
      message => (
        String(message.content ?? "")
          .includes(localizedDamageApplied)
        && String(message.content ?? "")
          .includes(
            `data-actor-id="${voidwalkerActor.uuid}"`,
          )
      );

    await boaWaitFor(
      () => messagesSince(
        sufferingMessagesBefore,
      ).some(
        isNativeVoidwalkerDamageMessage,
      ),
      {
        timeout: 5000,
        interval: 100,
        description:
          "native Voidwalker damage card synchronization",
      },
    );

    sufferingMessages = messagesSince(
      sufferingMessagesBefore,
    );

    const sufferingFeatureMessages =
      sufferingMessages.filter(message =>
        boaGetFlag(
          message,
          "voidwalkerSuffering",
        )
      );
    const nativeVoidwalkerDamageMessages =
      sufferingMessages.filter(
        isNativeVoidwalkerDamageMessage,
      );
    const expectedFormula =
      `ceil(${finalDamage} / 2) = `
      + `${expectedSharedDamage}`;
    const featureMessage =
      sufferingFeatureMessages[0] ?? null;
    const featureData =
      boaGetFlag(
        featureMessage,
        "voidwalkerSuffering",
      );

    boaCheckEqual(
      checks,
      "Real Player Suffering shows its halving formula and one native Voidwalker damage card",
      {
        sufferingCards:
          sufferingFeatureMessages.length,
        nativeVoidwalkerDamageCards:
          nativeVoidwalkerDamageMessages.length,
        formula:
          featureData?.formula ?? null,
        visibleFormula:
          String(
            featureMessage?.content ?? "",
          ).includes(
            `⌈${finalDamage} ÷ 2⌉`,
          )
          && String(
            featureMessage?.content ?? "",
          ).includes(
            `<strong>${expectedSharedDamage}</strong>`,
          ),
      },
      {
        sufferingCards: 1,
        nativeVoidwalkerDamageCards: 1,
        formula: expectedFormula,
        visibleFormula: true,
      },
    );

  } catch (error) {
    boaCheck(
      checks,
      "Real-player Voidwalker Suffering completed",
      false,
      error.stack ?? error.message,
    );
  }
} else {
  boaCheck(
    checks,
    "Prepared Suffering caster and Voidwalker Tokens are available",
    false,
    {
      actor: sufferingActor?.id ?? null,
      casterToken: sufferingActorToken?.id ?? null,
      voidwalkerToken:
        sufferingVoidwalkerToken?.id ?? null,
    },
  );
}

if (
  actor
  && shiftActor
  && scene
  && lifecycleScene
) {
  try {
    if (typeof actor.restStretch !== "function") {
      throw new Error(
        "The assigned Actor has no restStretch() method.",
      );
    }

    await runRestMethod(
      actor,
      "restStretch",
      "player-stretch-rest",
    );
    await boaWaitFor(
      () => !tokenIdExists(
        lifecycleScene,
        session.stretchTotemTokenId,
      ),
      {
        timeout: 10000,
        interval: 100,
        description:
          "Stretch rest Totem cleanup through the active GM",
      },
    );

    boaCheckEqual(
      checks,
      "Real Player Stretch rest removes Totems but keeps Shift-duration demons",
      {
        totemExists: tokenIdExists(
          lifecycleScene,
          session.stretchTotemTokenId,
        ),
        demonExists: tokenIdExists(
          scene,
          session.stretchDemonTokenId,
        ),
        shiftTotemExists: tokenIdExists(
          scene,
          session.shiftTotemTokenId,
        ),
        shiftDemonExists: tokenIdExists(
          lifecycleScene,
          session.shiftDemonTokenId,
        ),
      },
      {
        totemExists: false,
        demonExists: true,
        shiftTotemExists: true,
        shiftDemonExists: true,
      },
    );
  } catch (error) {
    boaCheck(
      checks,
      "Real-player Stretch rest lifecycle completed",
      false,
      error.stack ?? error.message,
    );
  }

  try {
    if (typeof shiftActor.restShift !== "function") {
      throw new Error(
        "The Shift-rest Actor has no restShift() method.",
      );
    }

    await runRestMethod(
      shiftActor,
      "restShift",
      "player-shift-rest",
    );
    await boaWaitFor(
      () => (
        !tokenIdExists(
          scene,
          session.shiftTotemTokenId,
        )
        && !tokenIdExists(
          lifecycleScene,
          session.shiftDemonTokenId,
        )
      ),
      {
        timeout: 10000,
        interval: 100,
        description:
          "Shift rest summon cleanup through the active GM",
      },
    );

    boaCheckEqual(
      checks,
      "Real Player Shift rest removes Totems and Warlock demons across Scenes",
      {
        totemExists: tokenIdExists(
          scene,
          session.shiftTotemTokenId,
        ),
        demonExists: tokenIdExists(
          lifecycleScene,
          session.shiftDemonTokenId,
        ),
        otherCasterTotemExists: tokenIdExists(
          lifecycleScene,
          session.otherCasterTotemTokenId,
        ),
      },
      {
        totemExists: false,
        demonExists: false,
        otherCasterTotemExists: true,
      },
    );
  } catch (error) {
    boaCheck(
      checks,
      "Real-player Shift rest lifecycle completed",
      false,
      error.stack ?? error.message,
    );
  }
} else {
  boaCheck(
    checks,
    "Prepared Player rest lifecycle fixtures are available",
    false,
    {
      actor: actor?.id ?? null,
      shiftActor: shiftActor?.id ?? null,
      scene: scene?.id ?? null,
      lifecycleScene: lifecycleScene?.id ?? null,
    },
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
