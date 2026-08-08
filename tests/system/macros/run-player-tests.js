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
function normalizeDemonHunterRange(
  range,
) {
  if (
    range === null ||
    range === undefined
  ) {
    return null;
  }

  const numeric =
    Number(
      range,
    );

  return Number.isFinite(
    numeric,
  )
    ? numeric
    : null;
}

function demonHunterSightSnapshot(
  sight,
) {
  const source =
    sight?.toObject?.() ??
    sight ??
    {};

  return {
    enabled:
      Boolean(
        source.enabled,
      ),
    range:
      normalizeDemonHunterRange(
        source.range,
      ),
    visionMode:
      source.visionMode ??
      "basic",
    angle:
      source.angle ??
      null,
    attenuation:
      source.attenuation ??
      null,
    saturation:
      source.saturation ??
      null,
    brightness:
      source.brightness ??
      null,
    contrast:
      source.contrast ??
      null,
    color:
      source.color ??
      null,
  };
}

function sameDemonHunterValue(
  left,
  right,
) {
  if (
    typeof left ===
      "number" &&
    typeof right ===
      "number"
  ) {
    return (
      Math.abs(
        left - right,
      ) <
      0.000001
    );
  }

  return left === right;
}

function sameDemonHunterSight(
  left,
  right,
) {
  return [
    "enabled",
    "range",
    "visionMode",
    "angle",
    "attenuation",
    "saturation",
    "brightness",
    "contrast",
    "color",
  ].every(
    field =>
      sameDemonHunterValue(
        left?.[field],
        right?.[field],
      ),
  );
}

function isUnlimitedDemonHunterDarkvision(
  sight,
) {
  const range =
    sight?.range;

  const unlimited =
    range === null ||
    range === undefined ||
    !Number.isFinite(
      Number(
        range,
      ),
    );

  return (
    sight?.enabled === true &&
    unlimited &&
    sight?.visionMode ===
      "darkvision"
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
const demonHunterInitiationSourceActor =
  game.actors.get(
    session.demonHunterInitiationSourceActorId,
  ) ??
  null;
const demonHunterInitiationSourceItem =
  demonHunterInitiationSourceActor
    ?.items
    ?.get?.(
      session.demonHunterInitiationSourceItemId,
    ) ??
  null;
const sufferingActor =
  game.actors.get(session.sufferingActorId) ?? null;
const summonActor =
  game.actors.get(session.summonActorId) ?? null;
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
const summonCasterToken =
  lifecycleScene?.tokens.get(
    session.summonCasterTokenId,
  ) ?? null;
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

boaCheck(
  checks,
  "Prepared Demon Hunter Initiation Player-flow source Item exists",
  Boolean(
    demonHunterInitiationSourceActor &&
    demonHunterInitiationSourceItem
  ),
  {
    actorId:
      demonHunterInitiationSourceActor?.id ??
      null,
    itemId:
      demonHunterInitiationSourceItem?.id ??
      null,
  },
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

if (
  actor &&
  scene &&
  token &&
  demonHunterInitiationSourceItem
) {
  try {
    const requestDemonHunterInitiationReconcile =
      game.modules.get(
        BOA_TEST_MODULE_ID,
      )?.api
        ?.requestDemonHunterInitiationReconcile;

    boaCheck(
      checks,
      "Demon Hunter Initiation Player authority API is available",
      typeof requestDemonHunterInitiationReconcile ===
        "function",
      "requestDemonHunterInitiationReconcile",
    );

    if (
      typeof requestDemonHunterInitiationReconcile !==
        "function"
    ) {
      throw new Error(
        "The Demon Hunter Initiation Player authority API is unavailable.",
      );
    }

    const authorityProbe =
      await requestDemonHunterInitiationReconcile(
        actor,
      );

    boaCheckEqual(
      checks,
      "Player can request Demon Hunter Initiation reconciliation through the primary GM",
      authorityProbe?.actorId ??
        null,
      actor.id,
    );

    const prototypeBaseline =
      demonHunterSightSnapshot(
        actor.prototypeToken?.sight,
      );

    const tokenBaseline =
      demonHunterSightSnapshot(
        scene.tokens.get(
          token.id,
        )?.sight,
      );

    const initiationData =
      boaCloneEmbeddedItem(
        demonHunterInitiationSourceItem,
      );

    const [createdInitiation] =
      await actor.createEmbeddedDocuments(
        "Item",
        [
          initiationData,
        ],
      );

    if (!createdInitiation) {
      throw new Error(
        "The real Player could not add Demon Hunter Initiation.",
      );
    }

    await boaWaitFor(
      () => (
        isUnlimitedDemonHunterDarkvision(
          actor.prototypeToken?.sight,
        ) &&
        isUnlimitedDemonHunterDarkvision(
          scene.tokens.get(
            token.id,
          )?.sight,
        )
      ),
      {
        timeout:
          10000,
        interval:
          100,
        description:
          "Demon Hunter Initiation Player assignment through the active GM",
      },
    );

    boaCheck(
      checks,
      "Real Player adds Demon Hunter Initiation and receives Darkvision through the active GM",
      (
        boaContentKey(
          createdInitiation,
        ) ===
          "heroic-class-ability.demon-hunter.demon-hunter-initiation" &&
        isUnlimitedDemonHunterDarkvision(
          actor.prototypeToken?.sight,
        ) &&
        isUnlimitedDemonHunterDarkvision(
          scene.tokens.get(
            token.id,
          )?.sight,
        )
      ),
      {
        prototype:
          demonHunterSightSnapshot(
            actor.prototypeToken?.sight,
          ),
        token:
          demonHunterSightSnapshot(
            scene.tokens.get(
              token.id,
            )?.sight,
          ),
      },
    );

    await actor.deleteEmbeddedDocuments(
      "Item",
      [
        createdInitiation.id,
      ],
    );

    await boaWaitFor(
      () => (
        sameDemonHunterSight(
          demonHunterSightSnapshot(
            actor.prototypeToken?.sight,
          ),
          prototypeBaseline,
        ) &&
        sameDemonHunterSight(
          demonHunterSightSnapshot(
            scene.tokens.get(
              token.id,
            )?.sight,
          ),
          tokenBaseline,
        )
      ),
      {
        timeout:
          10000,
        interval:
          100,
        description:
          "Demon Hunter Initiation Player removal through the active GM",
      },
    );

    boaCheck(
      checks,
      "Real Player removes Demon Hunter Initiation and restores the complete sight baseline",
      (
        !boaCollectionValues(
          actor.items,
        ).some(
          item =>
            boaContentKey(
              item,
            ) ===
              "heroic-class-ability.demon-hunter.demon-hunter-initiation",
        ) &&
        sameDemonHunterSight(
          demonHunterSightSnapshot(
            actor.prototypeToken?.sight,
          ),
          prototypeBaseline,
        ) &&
        sameDemonHunterSight(
          demonHunterSightSnapshot(
            scene.tokens.get(
              token.id,
            )?.sight,
          ),
          tokenBaseline,
        )
      ),
      {
        expectedPrototype:
          prototypeBaseline,
        actualPrototype:
          demonHunterSightSnapshot(
            actor.prototypeToken?.sight,
          ),
        expectedToken:
          tokenBaseline,
        actualToken:
          demonHunterSightSnapshot(
            scene.tokens.get(
              token.id,
            )?.sight,
          ),
      },
    );
  } catch (error) {
    boaCheck(
      checks,
      "Real-player Demon Hunter Initiation GM-authority lifecycle completed",
      false,
      error.stack ??
        error.message,
    );
  }
} else {
  boaCheck(
    checks,
    "Prepared Demon Hunter Initiation Player-flow fixtures are available",
    false,
    {
      actor:
        actor?.id ??
        null,
      scene:
        scene?.id ??
        null,
      token:
        token?.id ??
        null,
      sourceItem:
        demonHunterInitiationSourceItem?.id ??
        null,
    },
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


if (
  summonActor
  && summonCasterToken
) {
  try {
    const summonAbility =
      boaCollectionValues(
        summonActor.items,
      ).find(item =>
        boaContentKey(item)
          === "heroic-class-ability.warlock.demonologist"
        || item.name === "Demonologist"
      ) ?? null;
    if (!summonAbility) {
      throw new Error(
        "The prepared summon Actor has no "
        + "Demonologist ability.",
      );
    }

    const summonSourceMessage =
      await ChatMessage.create({
        speaker: {
          actor: summonActor.id,
          token: summonCasterToken.id,
          scene: lifecycleScene.id,
          alias: summonActor.name,
        },
        content:
          "<p>BOA real-player Demonologist "
          + "source-message fixture.</p>",
        flags: {
          [BOA_TEST_MODULE_ID]: {
            [fixtureFlag]: {
              schemaVersion: 1,
              sessionId: session.sessionId,
              kind:
                "demonologist-source-message",
            },
            [sessionIdFlag]:
              session.sessionId,
          },
        },
      });
    if (!summonSourceMessage) {
      throw new Error(
        "The real Player could not create the "
        + "Demonologist source message.",
      );
    }

    const summonMessageAuthorId =
      summonSourceMessage.author?.id
      ?? summonSourceMessage.user?.id
      ?? summonSourceMessage.user
      ?? null;

    boaCheckEqual(
      checks,
      "Real Player authored the Demonologist source message",
      summonMessageAuthorId,
      game.user.id,
    );

    await summonSourceMessage.update({
      content:
        `@UUID[${summonAbility.uuid}]`
        + `{${summonAbility.name}}`,
    });

    const {
      buildWarlockDemonPlan,
      requestWarlockDemonCreation,
    } = await import(
      `/modules/${BOA_TEST_MODULE_ID}/scripts/warlock-demons.js`
    );

    const impPlan =
      buildWarlockDemonPlan(
        summonSourceMessage,
        {
          actor: summonActor,
          ability: summonAbility,
        },
        "imp",
      );

    let outsideRangeRejected = false;
    let outsideRangeError = "";
    try {
      await requestWarlockDemonCreation(
        impPlan,
        {
          x: 100,
          y: 100,
        },
      );
    } catch (error) {
      outsideRangeRejected = true;
      outsideRangeError =
        error.message ?? String(error);
    }

    boaCheck(
      checks,
      "Primary GM rejects an out-of-range real Player demon placement",
      outsideRangeRejected
        && outsideRangeError.includes(
          "outside range",
        ),
      outsideRangeError,
    );

    const firstResult =
      await requestWarlockDemonCreation(
        impPlan,
        {
          x: 1600,
          y: 800,
        },
      );
    const firstToken =
      lifecycleScene.tokens.get(
        firstResult.createdTokenId,
      ) ?? null;
    const firstFlags =
      firstToken?.flags
        ?.[BOA_TEST_MODULE_ID]
      ?? {};

    boaCheckEqual(
      checks,
      "Real Player creates an owned Imp through the primary GM socket",
      {
        exists: Boolean(firstToken),
        actorIsSynthetic:
          firstToken?.actor?.isToken
          ?? false,
        playerIsOwner:
          firstToken?.actor
            ?.testUserPermission(
              game.user,
              CONST
                .DOCUMENT_OWNERSHIP_LEVELS
                .OWNER,
            )
          ?? false,
        defaultOwnership:
          firstToken?.actor?.ownership
            ?.default
          ?? null,
        casterActorUuid:
          firstFlags.casterActorUuid
          ?? null,
        summonType:
          firstFlags.summonType
          ?? null,
        demonKey:
          firstFlags.demonKey
          ?? null,
        duration:
          firstFlags.duration
          ?? null,
      },
      {
        exists: true,
        actorIsSynthetic: true,
        playerIsOwner: true,
        defaultOwnership:
          CONST
            .DOCUMENT_OWNERSHIP_LEVELS
            .OBSERVER,
        casterActorUuid:
          summonActor.uuid,
        summonType:
          "warlock-demon",
        demonKey: "imp",
        duration: "shift",
      },
    );

    const sayaadPlan = {
      ...impPlan,
      demonKey: "sayaad",
    };
    const secondResult =
      await requestWarlockDemonCreation(
        sayaadPlan,
        {
          x: 1800,
          y: 800,
        },
      );
    const secondToken =
      lifecycleScene.tokens.get(
        secondResult.createdTokenId,
      ) ?? null;
    const secondFlags =
      secondToken?.flags
        ?.[BOA_TEST_MODULE_ID]
      ?? {};

    boaCheckEqual(
      checks,
      "A second real Player summon replaces the previous demon",
      {
        firstExists:
          Boolean(
            lifecycleScene.tokens.get(
              firstResult.createdTokenId,
            ),
          ),
        secondExists:
          Boolean(secondToken),
        demonKey:
          secondFlags.demonKey
          ?? null,
        casterActorUuid:
          secondFlags.casterActorUuid
          ?? null,
      },
      {
        firstExists: false,
        secondExists: true,
        demonKey: "sayaad",
        casterActorUuid:
          summonActor.uuid,
      },
    );

    await runRestMethod(
      summonActor,
      "restShift",
      "player-created-demon-shift-rest",
    );
    await boaWaitFor(
      () => !lifecycleScene.tokens.get(
        secondResult.createdTokenId,
      ),
      {
        timeout: 10000,
        interval: 100,
        description:
          "Shift rest cleanup of the real "
          + "Player-created Warlock demon",
      },
    );

    boaCheckEqual(
      checks,
      "Real Player Shift rest removes the demon created through the GM socket",
      Boolean(
        lifecycleScene.tokens.get(
          secondResult.createdTokenId,
        ),
      ),
      false,
    );
  } catch (error) {
    boaCheck(
      checks,
      "Real-player Demonologist summoning through the primary GM completed",
      false,
      error.stack ?? error.message,
    );
  }
} else {
  boaCheck(
    checks,
    "Prepared Demonologist summoning fixtures are available",
    false,
    {
      summonActor:
        summonActor?.id ?? null,
      summonCasterToken:
        summonCasterToken?.id ?? null,},
  );
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
    const isNativeVoidwalkerDamageMessage =
      message => {
        const content = String(
          message.content ?? "",
        );

        return (
          content.includes(
            'class="damage-message',
          )
          && content.includes(
            `data-actor-id="${voidwalkerActor.uuid}"`,
          )
          && !boaGetFlag(
            message,
            "voidwalkerSuffering",
          )
        );
      };

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

const frostreaperAbility =
  boaCollectionValues(
    actor?.items,
  ).find(item =>
    boaContentKey(
      item,
    ) ===
      "heroic-class-ability.death-knight.frostreaper"
  ) ??
  null;

boaCheck(
  checks,
  "Assigned Player character has Frostreaper",
  Boolean(
    frostreaperAbility,
  ),
  frostreaperAbility?.uuid ??
    "",
);

if (
  actor &&
  scene &&
  token &&
  frostreaperAbility
) {
  try {
    const {
      createFrostreaperActivationData,
      getFrostreaperAuraData,
      isFrostreaperActivationActive,
    } = await import(
      `/modules/${BOA_TEST_MODULE_ID}/scripts/frostreaper.js`
    );

    const combatantId =
      `boa-player-frostreaper-${actor.id}`;
    const syntheticCombat = {
      id:
        `boa-player-frostreaper-${session.sessionId}`,
      started:
        true,
      round:
        4,
      turn:
        0,
      scene: {
        id:
          scene.id,
      },
      turns: [{
        id:
          combatantId,
        actorId:
          actor.id,
        tokenId:
          token.id,
      }],
    };

    const sourceMessage = {
      content:
        `<div class="ability-use" `
        + `data-ability-id="${frostreaperAbility.id}">`
        + `${frostreaperAbility.name}</div>`,
      speaker: {
        actor:
          actor.id,
        scene:
          scene.id,
        token:
          token.id,
      },
    };

    const activation =
      createFrostreaperActivationData(
        sourceMessage,
        {
          actors:
            game.actors,
          combat:
            syntheticCombat,
        },
      );

    boaCheckEqual(
      checks,
      "Real Player Frostreaper activation identifies the owned Actor and Token",
      {
        actorId:
          activation?.actorId ??
          null,
        sceneId:
          activation?.sceneId ??
          null,
        tokenId:
          activation?.tokenId ??
          null,
        combatantId:
          activation?.combatantId ??
          null,
        range:
          activation?.range ??
          null,
      },
      {
        actorId:
          actor.id,
        sceneId:
          scene.id,
        tokenId:
          token.id,
        combatantId,
        range:
          10,
      },
    );

    const messagesBefore =
      currentMessageIds();

    let frostreaperMessage = null;

    try {
      frostreaperMessage =
        await ChatMessage.create({
          speaker: {
            actor:
              actor.id,
            scene:
              scene.id,
            token:
              token.id,
          },
          content:
            `<p>BOA real-player Frostreaper state `
            + `${session.sessionId}</p>`,
          flags: {
            [BOA_TEST_MODULE_ID]: {
              frostreaperActivation:
                activation,
            },
          },
        });
    } finally {
      await markMessagesSince(
        messagesBefore,
        "player-frostreaper-message",
      );
    }

    const authorId =
      frostreaperMessage?.author?.id
      ?? frostreaperMessage?.user?.id
      ?? frostreaperMessage?.user
      ?? null;

    boaCheckEqual(
      checks,
      "Real Player authors the persisted Frostreaper activation message",
      authorId,
      game.user.id,
    );

    const persistedActivation =
      boaGetFlag(
        frostreaperMessage,
        "frostreaperActivation",
      );

    boaCheckEqual(
      checks,
      "Real Player can persist Frostreaper activation state without Token writes",
      persistedActivation,
      activation,
    );

    const aura =
      getFrostreaperAuraData(
        token.object ??
          token,
        {
          settings: {
            get:
              () =>
                true,
          },
          combat:
            syntheticCombat,
          messages: [
            frostreaperMessage,
          ],
        },
      );

    boaCheckEqual(
      checks,
      "Real Player Frostreaper state produces the expected visual aura data",
      {
        active:
          isFrostreaperActivationActive(
            activation,
            syntheticCombat,
          ),
        range:
          aura?.range ??
          null,
        radius:
          aura?.radius ??
          null,
        color:
          aura?.color ??
          null,
      },
      {
        active:
          true,
        range:
          10,
        radius:
          500,
        color:
          0x8edbff,
      },
    );
  } catch (error) {
    boaCheck(
      checks,
      "Real-player Frostreaper persisted-aura workflow completed",
      false,
      error.stack ??
        error.message,
    );
  }
} else {
  boaCheck(
    checks,
    "Prepared real-player Frostreaper fixtures are available",
    false,
    {
      actor:
        actor?.id ??
        null,
      scene:
        scene?.id ??
        null,
      token:
        token?.id ??
        null,
      frostreaper:
        frostreaperAbility?.id ??
        null,
    },
  );
}

const deathKnightRebirth =
  boaCollectionValues(
    actor?.items,
  ).find(
    item =>
      boaContentKey(
        item,
      ) ===
        "heroic-class-ability.death-knight.death-knights-rebirth",
  ) ??
  null;

const runeTestWeapon =
  actor?.items?.get?.(
    session.runeTestWeaponId,
  ) ??
  boaCollectionValues(
    actor?.items,
  ).find(
    item =>
      item.id ===
        session.runeTestWeaponId,
  ) ??
  null;

boaCheck(
  checks,
  "Assigned Player character has Death Knight's Rebirth",
  Boolean(
    deathKnightRebirth,
  ),
  deathKnightRebirth?.uuid ??
    "",
);

boaCheck(
  checks,
  "Prepared Player rune test weapon is available",
  Boolean(
    runeTestWeapon,
  ),
  runeTestWeapon?.uuid ??
    "",
);

if (
  actor &&
  deathKnightRebirth &&
  runeTestWeapon
) {
  try {
    const {
      DEATH_KNIGHT_RUNE_EFFECT_FLAG,
      clearDeathKnightRune,
      getDeathKnightRuneState,
      setDeathKnightRune,
    } = await import(
      `/modules/${BOA_TEST_MODULE_ID}/scripts/death-knight-runes.js`
    );

    const managedRuneEffectCount =
      () =>
        boaCollectionValues(
          runeTestWeapon.effects,
        ).filter(
          effect =>
            Boolean(
              boaGetFlag(
                effect,
                DEATH_KNIGHT_RUNE_EFFECT_FLAG,
              ),
            ),
        ).length;

    await clearDeathKnightRune(
      actor,
    );

    if (
      runeTestWeapon.system
        ?.worn
    ) {
      await runeTestWeapon.update({
        "system.worn":
          false,
      });
    }

    const baselineMovement =
      Number(
        actor.system
          ?.movement
          ?.value,
      );

    boaCheck(
      checks,
      "Real Player rune test has a numeric baseline Movement",
      Number.isFinite(
        baselineMovement,
      ),
      actor.system
        ?.movement
        ?.value,
    );

    const unendingSelected =
      await setDeathKnightRune(
        actor,
        "unendingThirst",
        runeTestWeapon.id,
      );

    boaCheck(
      checks,
      "Real Player selects Unending Thirst on an owned melee weapon",
      unendingSelected,
      getDeathKnightRuneState(
        actor,
      ),
    );

    boaCheckEqual(
      checks,
      "Real Player Unending Thirst creates exactly one managed weapon Active Effect",
      managedRuneEffectCount(),
      1,
    );

    boaCheckEqual(
      checks,
      "Unending Thirst does not change Movement while its weapon is not wielded",
      Number(
        actor.system
          ?.movement
          ?.value,
      ),
      baselineMovement,
    );

    await runeTestWeapon.update({
      "system.worn":
        true,
    });

    const equippedMovement =
      await boaWaitFor(
        () => {
          const value =
            Number(
              actor.system
                ?.movement
                ?.value,
            );

          return (
            value ===
              baselineMovement +
                2
          )
            ? value
            : null;
        },
        {
          timeout:
            4000,
          description:
            "Unending Thirst equipped Movement +2",
        },
      );

    boaCheckEqual(
      checks,
      "Real Player gains +2 Movement while wielding the Unending Thirst weapon",
      equippedMovement,
      baselineMovement +
        2,
    );

    await runeTestWeapon.update({
      "system.worn":
        false,
    });

    const restoredMovement =
      await boaWaitFor(
        () => {
          const value =
            Number(
              actor.system
                ?.movement
                ?.value,
            );

          return (
            value ===
              baselineMovement
          )
            ? value
            : null;
        },
        {
          timeout:
            4000,
          description:
            "Unending Thirst unequipped Movement restoration",
        },
      );

    boaCheckEqual(
      checks,
      "Real Player loses the +2 Movement when the Unending Thirst weapon is no longer wielded",
      restoredMovement,
      baselineMovement,
    );

    const razoriceSelected =
      await setDeathKnightRune(
        actor,
        "razorice",
        runeTestWeapon.id,
      );

    boaCheckEqual(
      checks,
      "Real Player can replace Unending Thirst with visual-only Razorice",
      {
        selected:
          razoriceSelected,
        rune:
          getDeathKnightRuneState(
            actor,
          )?.rune ??
          null,
        managedEffects:
          managedRuneEffectCount(),
        movement:
          Number(
            actor.system
              ?.movement
              ?.value,
          ),
      },
      {
        selected:
          true,
        rune:
          "razorice",
        managedEffects:
          0,
        movement:
          baselineMovement,
      },
    );

    const fallenSelected =
      await setDeathKnightRune(
        actor,
        "fallenCrusader",
        runeTestWeapon.id,
      );

    boaCheckEqual(
      checks,
      "Real Player can replace Razorice with visual-only Fallen Crusader",
      {
        selected:
          fallenSelected,
        rune:
          getDeathKnightRuneState(
            actor,
          )?.rune ??
          null,
        managedEffects:
          managedRuneEffectCount(),
      },
      {
        selected:
          true,
        rune:
          "fallenCrusader",
        managedEffects:
          0,
      },
    );

    await clearDeathKnightRune(
      actor,
    );

    boaCheckEqual(
      checks,
      "Real Player can clear the rune selection and managed effect",
      {
        state:
          getDeathKnightRuneState(
            actor,
          ),
        managedEffects:
          managedRuneEffectCount(),
      },
      {
        state:
          null,
        managedEffects:
          0,
      },
    );
  } catch (error) {
    boaCheck(
      checks,
      "Real-player Death Knight rune workflow completed",
      false,
      error.stack ??
        error.message,
    );
  } finally {
    try {
      if (
        runeTestWeapon?.system
          ?.worn
      ) {
        await runeTestWeapon.update({
          "system.worn":
            false,
        });
      }
    } catch (error) {
      notes.push(
        `Could not leave the rune test weapon unequipped: ${error.message}`,
      );
    }
  }
} else {
  boaCheck(
    checks,
    "Prepared real-player Death Knight rune fixtures are available",
    false,
    {
      actor:
        actor?.id ??
        null,
      rebirth:
        deathKnightRebirth?.id ??
        null,
      weapon:
        runeTestWeapon?.id ??
        null,
    },
  );
}

// BOA 0.11.7 Druid lifecycle + artwork real-Player authority flow.
const druidSavageItem =
  actor?.items?.get?.(
    session.druidSavageItemId,
  )
  ?? boaCollectionValues(
    actor?.items,
  ).find(
    item =>
      boaContentKey(item) ===
        "spells.savage-incarnation",
  )
  ?? null;
if (
  actor &&
  druidSavageItem &&
  scene &&
  token
) {
  try {
    const druidApi =
      game.modules.get(
        BOA_TEST_MODULE_ID,
      )?.api ?? {};
    const activateDruidIncarnation =
      druidApi.activateDruidIncarnation;
    const switchDruidForm =
      druidApi.switchDruidForm;
    const getDruidFormState =
      druidApi.getDruidFormState;
    const getDruidFormArtwork =
      druidApi.getDruidFormArtwork;
    if (
      typeof activateDruidIncarnation !== "function"
      || typeof switchDruidForm !== "function"
      || typeof getDruidFormState !== "function"
      || typeof getDruidFormArtwork !== "function"
    ) {
      throw new Error(
        "The Druid lifecycle/artwork Player authority API is unavailable.",
      );
    }

    function liveDruidToken() {
      return scene.tokens.get(
        token.id,
      ) ?? null;
    }
    function druidArtworkSnapshot() {
      const liveToken =
        liveDruidToken();
      return {
        portrait:
          actor.img ?? null,
        prototypeToken:
          actor.prototypeToken
            ?.texture
            ?.src ?? null,
        sceneToken:
          liveToken?.texture
            ?.src ?? null,
        actorBaseline:
          boaGetFlag(
            actor,
            "druidFormArtworkBaseline",
          ) ?? null,
        tokenBaseline:
          liveToken
            ? boaGetFlag(
                liveToken,
                "druidFormTokenArtworkBaseline",
              ) ?? null
            : null,
      };
    }
    function artworkMatches(
      actual,
      expected,
    ) {
      return (
        actual?.portrait ===
          expected?.portrait &&
        actual?.prototypeToken ===
          expected?.prototypeToken &&
        actual?.sceneToken ===
          expected?.sceneToken
      );
    }

    // BOA 0.11.7 Druid Player Token provenance RED.
    function liveDruidPlaceable() {
      if (
        globalThis.canvas?.scene?.id !==
          scene.id
      ) {
        return null;
      }

      return globalThis.canvas
        ?.tokens
        ?.get?.(
          token.id,
        ) ?? null;
    }

    function playerDruidTokenDocumentDiagnostic(
      expectedSrc,
    ) {
      const placeable =
        liveDruidPlaceable();
      const documentSrc =
        placeable
          ?.document
          ?.texture
          ?.src ??
        token.texture
          ?.src ??
        null;

      return {
        activeSceneId:
          globalThis.canvas
            ?.scene
            ?.id ?? null,
        expectedSceneId:
          scene.id,
        tokenId:
          token.id,
        placeableExists:
          Boolean(
            placeable,
          ),
        documentSrc,
        expectedSrc,
        pathMatches:
          documentSrc ===
            expectedSrc,
      };
    }

    function playerDruidTokenDocumentMatches(
      expectedSrc,
    ) {
      return playerDruidTokenDocumentDiagnostic(
        expectedSrc,
      ).pathMatches ===
        true;
    }

    // BOA 0.11.7 rendered Token baseline fingerprint RED.
    function druidRenderedTextureHash(
      value,
    ) {
      if (
        typeof value !==
          "string"
      ) {
        return null;
      }

      let hash =
        2166136261;

      for (
        let index = 0;
        index < value.length;
        index += 1
      ) {
        hash ^=
          value.charCodeAt(
            index,
          );
        hash =
          Math.imul(
            hash,
            16777619,
          );
      }

      return (
        hash >>> 0
      )
        .toString(16)
        .padStart(
          8,
          "0",
        );
    }

    async function druidRenderedTextureFingerprint() {
      const placeable =
        liveDruidPlaceable();
      const texture =
        placeable
          ?.texture ??
        placeable
          ?.mesh
          ?.texture ??
        null;
      const ImageHelper =
        globalThis.foundry
          ?.helpers
          ?.media
          ?.ImageHelper ??
        globalThis.ImageHelper ??
        null;

      let png =
        null;

      if (
        texture &&
        typeof ImageHelper
          ?.textureToImage ===
          "function"
      ) {
        try {
          png =
            await ImageHelper
              .textureToImage(
                texture,
                {
                  format:
                    "image/png",
                },
              );
        } catch (_error) {
          png =
            null;
        }
      }

      return {
        activeSceneId:
          globalThis.canvas
            ?.scene
            ?.id ?? null,
        expectedSceneId:
          scene.id,
        tokenId:
          token.id,
        placeableExists:
          Boolean(
            placeable,
          ),
        documentSrc:
          placeable
            ?.document
            ?.texture
            ?.src ??
          null,
        textureExists:
          Boolean(
            texture,
          ),
        width:
          texture
            ?.width ??
          null,
        height:
          texture
            ?.height ??
          null,
        pngLength:
          png
            ?.length ??
          null,
        hash:
          druidRenderedTextureHash(
            png,
          ),
      };
    }

    const preparedHumanoidArtwork =
      session.druidHumanoidArtwork;
    if (
      !preparedHumanoidArtwork ||
      typeof preparedHumanoidArtwork !==
        "object"
    ) {
      throw new Error(
        "The prepared Humanoid artwork baseline is missing from the Player-test session.",
      );
    }
    const humanoidExpected = {
      portrait:
        preparedHumanoidArtwork.portrait ??
        null,
      prototypeToken:
        preparedHumanoidArtwork.prototypeToken ??
        null,
      sceneToken:
        preparedHumanoidArtwork.sceneToken ??
        null,
    };
    const initialHumanoidArtwork =
      druidArtworkSnapshot();
    boaCheckEqual(
      checks,
      "Real Player starts with the prepared Humanoid Actor, prototype Token, and TokenDocument artwork",
      {
        portrait:
          initialHumanoidArtwork.portrait,
        prototypeToken:
          initialHumanoidArtwork.prototypeToken,
        sceneToken:
          initialHumanoidArtwork.sceneToken,
      },
      humanoidExpected,
    );
    const initialHumanoidRenderedFingerprint =
      await druidRenderedTextureFingerprint();

    boaCheck(
      checks,
      "Real Player captures a rendered Humanoid Token baseline fingerprint",
      Boolean(
        initialHumanoidRenderedFingerprint
          ?.hash,
      ),
      initialHumanoidRenderedFingerprint,
    );


    boaCheck(
      checks,
      "Real Player canvas TokenDocument starts with the prepared Humanoid texture",
      playerDruidTokenDocumentMatches(
        humanoidExpected.sceneToken,
      ),
      playerDruidTokenDocumentDiagnostic(
        humanoidExpected.sceneToken,
      ),
    );
    const travelArtwork =
      getDruidFormArtwork(
        actor,
        "travelPl2",
      );
    if (!travelArtwork) {
      throw new Error(
        "Travel Form PL2 artwork is unavailable for the Player fixture.",
      );
    }
    const travelExpected = {
      portrait:
        travelArtwork.portrait,
      prototypeToken:
        travelArtwork.token,
      sceneToken:
        travelArtwork.token,
    };

    await actor.update({
      "system.willPoints.value": 10,
    });

    await activateDruidIncarnation(
      actor,
      "spells.savage-incarnation",
      2,
      {
        initialForm: "travel",
      },
    );
    await boaWaitFor(
      () => {
        const state =
          getDruidFormState(actor);
        return (
          state.currentForm === "travel"
          && state.activations?.savage?.active === true
          && state.activations?.savage?.powerLevel === 2
        )
          ? state
          : null;
      },
      {
        timeout: 10000,
        interval: 100,
        description:
          "Savage Incarnation Player activation through the active GM",
      },
    );
    boaCheck(
      checks,
      "Real Player can activate Savage Incarnation through GM authority",
      getDruidFormState(actor).currentForm === "travel",
      getDruidFormState(actor),
    );

    let travelArtworkWaitError = null;
    try {
      await boaWaitFor(
        () => {
          const snapshot =
            druidArtworkSnapshot();
          return artworkMatches(
            snapshot,
            travelExpected,
          )
            ? snapshot
            : null;
        },
        {
          timeout: 10000,
          interval: 100,
          description:
            "Druid Travel Form artwork on Actor, prototype Token, and live Scene Token",
        },
      );
    } catch (error) {
      travelArtworkWaitError =
        error.message ??
        String(error);
    }
    boaCheckEqual(
      checks,
      "Real Player Travel Form updates portrait, prototype Token, and live Scene Token through GM authority",
      {
        portrait:
          druidArtworkSnapshot().portrait,
        prototypeToken:
          druidArtworkSnapshot().prototypeToken,
        sceneToken:
          druidArtworkSnapshot().sceneToken,
      },
      travelExpected,
    );

    let TravelRenderedTokenWaitError =
      null;
    try {
      await boaWaitFor(
        () =>
          playerDruidTokenDocumentMatches(
            travelExpected.sceneToken,
          )
            ? true
            : null,
        {
          timeout: 10000,
          interval: 100,
          description:
            "Druid Travel Player-side TokenDocument texture",
        },
      );
    } catch (error) {
      TravelRenderedTokenWaitError =
        error.message ??
        String(error);
    }
    boaCheck(
      checks,
      "Real Player canvas TokenDocument uses the expected Travel texture",
      playerDruidTokenDocumentMatches(
        travelExpected.sceneToken,
      ),
      playerDruidTokenDocumentDiagnostic(
        travelExpected.sceneToken,
      ),
    );
    if (
      TravelRenderedTokenWaitError
    ) {
      notes.push(
        `Travel Player-side TokenDocument wait: ${
          TravelRenderedTokenWaitError
        }; diagnostic=${JSON.stringify(
          playerDruidTokenDocumentDiagnostic(
            travelExpected.sceneToken,
          ),
        )}`,
      );
    }
    if (travelArtworkWaitError) {
      notes.push(
        `Travel artwork wait: ${travelArtworkWaitError}; snapshot=${JSON.stringify(
          druidArtworkSnapshot(),
        )}`,
      );
    }

    // BOA 0.11.7 token-local Druid artwork provenance contract.
    const travelRenderedFingerprint =
      await druidRenderedTextureFingerprint();

    boaCheck(
      checks,
      "Real Player rendered Token changes from the Humanoid baseline in Travel Form",
      Boolean(
        travelRenderedFingerprint
          ?.hash &&
        initialHumanoidRenderedFingerprint
          ?.hash &&
        travelRenderedFingerprint
          .hash !==
          initialHumanoidRenderedFingerprint
            .hash
      ),
      {
        humanoid:
          initialHumanoidRenderedFingerprint,
        travel:
          travelRenderedFingerprint,
      },
    );

    const travelProvenance =
      druidArtworkSnapshot();
    const travelTokenBaseline =
      travelProvenance.tokenBaseline;

    boaCheckEqual(
      checks,
      "Real Player Travel Token-local provenance preserves the prepared Humanoid original",
      {
        tokenOriginal:
          travelTokenBaseline
            ?.original ?? null,
        tokenApplied:
          travelTokenBaseline
            ?.applied ?? null,
        currentSceneToken:
          travelProvenance
            .sceneToken,
      },
      {
        tokenOriginal:
          humanoidExpected
            .sceneToken,
        tokenApplied:
          travelExpected
            .sceneToken,
        currentSceneToken:
          travelExpected
            .sceneToken,
      },
    );

    const wpBeforeFree =
      Number(
        actor.system?.willPoints?.value ?? 0,
      );
    await switchDruidForm(
      actor,
      "humanoid",
      {
        mode: "free",
      },
    );
    await boaWaitFor(
      () => (
        getDruidFormState(actor).currentForm === "humanoid"
        && Number(actor.system?.willPoints?.value ?? 0)
          === wpBeforeFree - 1
      ),
      {
        timeout: 10000,
        interval: 100,
        description:
          "Druid free-action form change through the active GM",
      },
    );
    boaCheckEqual(
      checks,
      "Real Player free-action form change spends exactly 1 WP",
      {
        form:
          getDruidFormState(actor).currentForm,
        wp:
          Number(actor.system?.willPoints?.value ?? 0),
      },
      {
        form: "humanoid",
        wp: wpBeforeFree - 1,
      },
    );

    let humanoidArtworkWaitError = null;
    try {
      await boaWaitFor(
        () => {
          const snapshot =
            druidArtworkSnapshot();
          return artworkMatches(
            snapshot,
            humanoidExpected,
          )
            ? snapshot
            : null;
        },
        {
          timeout: 10000,
          interval: 100,
          description:
            "Druid Humanoid artwork restore on Actor, prototype Token, and live Scene Token",
        },
      );
    } catch (error) {
      humanoidArtworkWaitError =
        error.message ??
        String(error);
    }
    const restoredArtwork =
      druidArtworkSnapshot();
    boaCheckEqual(
      checks,
      "Real Player returns to Humanoid and restores portrait, prototype Token, and live Scene Token",
      {
        portrait:
          restoredArtwork.portrait,
        prototypeToken:
          restoredArtwork.prototypeToken,
        sceneToken:
          restoredArtwork.sceneToken,
      },
      humanoidExpected,
    );

    let HumanoidRenderedTokenWaitError =
      null;
    try {
      await boaWaitFor(
        () =>
          playerDruidTokenDocumentMatches(
            humanoidExpected.sceneToken,
          )
            ? true
            : null,
        {
          timeout: 10000,
          interval: 100,
          description:
            "Druid Humanoid Player-side TokenDocument texture",
        },
      );
    } catch (error) {
      HumanoidRenderedTokenWaitError =
        error.message ??
        String(error);
    }
    boaCheck(
      checks,
      "Real Player canvas TokenDocument uses the restored Humanoid texture",
      playerDruidTokenDocumentMatches(
        humanoidExpected.sceneToken,
      ),
      playerDruidTokenDocumentDiagnostic(
        humanoidExpected.sceneToken,
      ),
    );
    if (
      HumanoidRenderedTokenWaitError
    ) {
      notes.push(
        `Humanoid Player-side TokenDocument wait: ${
          HumanoidRenderedTokenWaitError
        }; diagnostic=${JSON.stringify(
          playerDruidTokenDocumentDiagnostic(
            humanoidExpected.sceneToken,
          ),
        )}`,
      );
    }
    const restoredHumanoidRenderedFingerprint =
      await druidRenderedTextureFingerprint();

    boaCheck(
      checks,
      "Real Player rendered Token returns to the original Humanoid fingerprint",
      Boolean(
        restoredHumanoidRenderedFingerprint
          ?.hash &&
        initialHumanoidRenderedFingerprint
          ?.hash &&
        restoredHumanoidRenderedFingerprint
          .hash ===
          initialHumanoidRenderedFingerprint
            .hash
      ),
      {
        originalHumanoid:
          initialHumanoidRenderedFingerprint,
        travel:
          travelRenderedFingerprint,
        restoredHumanoid:
          restoredHumanoidRenderedFingerprint,
      },
    );

    boaCheck(
      checks,
      "Humanoid restore clears Druid artwork provenance only after all managed artwork is restored",
      (
        artworkMatches(
          restoredArtwork,
          humanoidExpected,
        )
        && restoredArtwork.actorBaseline === null
        && restoredArtwork.tokenBaseline === null
      ),
      restoredArtwork,
    );
    if (humanoidArtworkWaitError) {
      notes.push(
        `Humanoid artwork wait: ${humanoidArtworkWaitError}; snapshot=${JSON.stringify(
          restoredArtwork,
        )}`,
      );
    }
  } catch (error) {
    boaCheck(
      checks,
      "Real-player Druid form lifecycle and artwork restore completed",
      false,
      error.stack ?? error.message,
    );
  }
} else {
  boaCheck(
    checks,
    "Prepared Druid real-Player fixture is available",
    false,
    {
      actor:
        actor?.id ?? null,
      spell:
        druidSavageItem?.id ?? null,
      scene:
        scene?.id ?? null,
      token:
        token?.id ?? null,
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
