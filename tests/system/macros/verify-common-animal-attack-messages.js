const checks = [];
const notes = [];
const createdMessageIds = [];

const moduleId = "bane-of-azeroth";
const testKey =
  "common-animal-attack-messages";
const testName =
  "BOA DEV – Verify Common Animal Attack Messages";

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Attack-message verification is run by a game master",
    false,
    "The test creates and deletes temporary ChatMessages."
  );

  return boaFinish(
    testKey,
    testName,
    checks,
    notes
  );
}

function itemByTypeAndName(
  actor,
  type,
  name
) {
  return boaCollectionValues(actor?.items)
    .find(item =>
      item.type === type &&
      item.name === name
    );
}

function actorState(actor) {
  return {
    hitPoints:
      actor?.system?.hitPoints?.value ?? null,
    activeEffectIds:
      boaCollectionValues(actor?.effects)
        .map(effect => effect.id)
        .sort(),
    statuses:
      Array.from(actor?.statuses ?? [])
        .map(value => String(value))
        .sort(),
  };
}

function messageContent(message) {
  return String(message?.content ?? "");
}

function containsPoisonRuleLink(content) {
  return (
    content.includes(
      "JournalEntry.SbbSMsuvWeo3HaID." +
      "JournalEntryPage.6WPxPxUjh4W80RNy#poison"
    ) ||
    content.includes(
      "data-uuid=" +
      '"JournalEntry.SbbSMsuvWeo3HaID.' +
      "JournalEntryPage.6WPxPxUjh4W80RNy#poison" +
      '"'
    )
  );
}

function recordCreatedMessages(messages) {
  for (const message of messages) {
    if (message?.id) {
      createdMessageIds.push(message.id);
    }
  }
}

function liveMessageIds() {
  return new Set(
    boaCollectionValues(game.messages)
      .map(message => message.id)
  );
}

async function callAdapter(
  processAttackResult,
  options
) {
  const beforeIds = liveMessageIds();
  const result =
    await processAttackResult(options);
  const afterMessages =
    boaCollectionValues(game.messages)
      .filter(message =>
        !beforeIds.has(message.id)
      );

  if (Array.isArray(result)) {
    recordCreatedMessages(result);
  }

  recordCreatedMessages(afterMessages);

  return {
    result,
    createdMessages: afterMessages,
  };
}

async function deleteCreatedMessages() {
  const ids = Array.from(
    new Set(createdMessageIds)
  ).filter(id => game.messages.get(id));

  if (ids.length === 0) {
    return;
  }

  await ChatMessage.deleteDocuments(ids);
}

const boaModule = game.modules.get(
  moduleId
);

boaCheck(
  checks,
  "Bane of Azeroth module is active",
  boaModule?.active === true,
  boaModule
    ? `${boaModule.id} ${boaModule.version}`
    : moduleId
);

const processAttackResult =
  boaModule?.api
    ?.processCommonAnimalAttackResult;

if (!boaCheck(
  checks,
  "Common Animal attack-result adapter is available",
  typeof processAttackResult === "function",
  (
    "Expected game.modules.get(" +
    "'bane-of-azeroth').api." +
    "processCommonAnimalAttackResult"
  )
)) {
  notes.push(
    "This failure is expected in the red-test step. " +
    "No ChatMessages or world documents were changed."
  );

  return boaFinish(
    testKey,
    testName,
    checks,
    notes
  );
}

const serpent = boaFindWorldActor(
  "actors.common-animals.large-serpent"
);
const target = boaFindWorldActor(
  "actors.common-animals.crocolisk"
);
const gorilla = boaFindWorldActor(
  "actors.common-animals.gorilla"
);

boaCheck(
  checks,
  "Large Serpent is imported",
  Boolean(serpent),
  "actors.common-animals.large-serpent"
);
boaCheck(
  checks,
  "Crocolisk target is imported",
  Boolean(target),
  "actors.common-animals.crocolisk"
);
boaCheck(
  checks,
  "Gorilla control Actor is imported",
  Boolean(gorilla),
  "actors.common-animals.gorilla"
);

const bite = itemByTypeAndName(
  serpent,
  "weapon",
  "Bite"
);
const constriction = itemByTypeAndName(
  serpent,
  "weapon",
  "Constriction"
);
const ordinaryAttack = itemByTypeAndName(
  gorilla,
  "weapon",
  "Fist"
);

boaCheck(
  checks,
  "Large Serpent Bite weapon is available",
  Boolean(bite),
  "Bite"
);
boaCheck(
  checks,
  "Large Serpent Constriction weapon is available",
  Boolean(constriction),
  "Constriction"
);
boaCheck(
  checks,
  "An attack without attack effects is available",
  Boolean(ordinaryAttack),
  "Gorilla Fist"
);

if (
  !serpent ||
  !target ||
  !gorilla ||
  !bite ||
  !constriction ||
  !ordinaryAttack
) {
  return boaFinish(
    testKey,
    testName,
    checks,
    notes
  );
}

const targetBefore = actorState(target);

try {
  const poisonRun = await callAdapter(
    processAttackResult,
    {
      successful: true,
      attackerActor: serpent,
      weaponItem: bite,
      targets: [target],
    }
  );

  boaCheck(
    checks,
    "Successful Bite creates exactly one ChatMessage",
    poisonRun.createdMessages.length === 1,
    (
      `Created: ${poisonRun.createdMessages.length}; ` +
      `Returned: ${
        Array.isArray(poisonRun.result)
          ? poisonRun.result.length
          : boaDiagnosticValue(poisonRun.result)
      }`
    )
  );

  const poisonContent = messageContent(
    poisonRun.createdMessages[0]
  );

  boaCheck(
    checks,
    "Bite message identifies Lethal Poison",
    poisonContent.includes("Lethal Poison"),
    poisonContent
  );
  boaCheck(
    checks,
    "Bite message identifies attacker and target",
    (
      poisonContent.includes(serpent.name) &&
      poisonContent.includes(target.name)
    ),
    poisonContent
  );
  boaCheck(
    checks,
    "Bite message includes potency 15",
    poisonContent.includes("potency of 15"),
    poisonContent
  );
  boaCheck(
    checks,
    "Bite message links Dragonbane's poison rule",
    containsPoisonRuleLink(poisonContent),
    poisonContent
  );
  boaCheck(
    checks,
    "Bite message explains ingested exposure",
    poisonContent.includes(
      "as if the poison had been ingested"
    ),
    poisonContent
  );

  const constrainRun = await callAdapter(
    processAttackResult,
    {
      successful: true,
      attackerActor: serpent,
      weaponItem: constriction,
      targets: [target],
    }
  );

  boaCheck(
    checks,
    "Successful Constriction creates exactly one ChatMessage",
    constrainRun.createdMessages.length === 1,
    (
      `Created: ${constrainRun.createdMessages.length}; ` +
      `Returned: ${
        Array.isArray(constrainRun.result)
          ? constrainRun.result.length
          : boaDiagnosticValue(constrainRun.result)
      }`
    )
  );

  const constrainContent = messageContent(
    constrainRun.createdMessages[0]
  );

  boaCheck(
    checks,
    "Constriction message identifies Constrain",
    constrainContent.includes("Constrain"),
    constrainContent
  );
  boaCheck(
    checks,
    "Constriction message identifies attacker and target",
    (
      constrainContent.includes(serpent.name) &&
      constrainContent.includes(target.name)
    ),
    constrainContent
  );
  boaCheck(
    checks,
    "Constriction message explains the escape roll",
    constrainContent.includes(
      "open opposed STR roll against 12"
    ),
    constrainContent
  );
  boaCheck(
    checks,
    "Constriction message preserves parry",
    constrainContent.includes(
      "can still parry"
    ),
    constrainContent
  );
  boaCheck(
    checks,
    "Constriction message prevents evade",
    constrainContent.includes(
      "cannot evade"
    ),
    constrainContent
  );

  const failedRun = await callAdapter(
    processAttackResult,
    {
      successful: false,
      attackerActor: serpent,
      weaponItem: bite,
      targets: [target],
    }
  );

  boaCheckEqual(
    checks,
    "Failed attacks create no ChatMessages",
    failedRun.createdMessages.length,
    0
  );

  const untargetedRun = await callAdapter(
    processAttackResult,
    {
      successful: true,
      attackerActor: serpent,
      weaponItem: bite,
      targets: [],
    }
  );

  boaCheckEqual(
    checks,
    "Attacks without targets create no ChatMessages",
    untargetedRun.createdMessages.length,
    0
  );

  const ordinaryRun = await callAdapter(
    processAttackResult,
    {
      successful: true,
      attackerActor: gorilla,
      weaponItem: ordinaryAttack,
      targets: [target],
    }
  );

  boaCheckEqual(
    checks,
    "Attacks without attackEffects create no ChatMessages",
    ordinaryRun.createdMessages.length,
    0
  );

  boaCheckEqual(
    checks,
    "Attack messages do not change target HP, effects, or statuses",
    actorState(target),
    targetBefore
  );
} catch (error) {
  boaCheck(
    checks,
    "Common Animal attack-message scenarios complete",
    false,
    error.stack ?? error.message
  );
} finally {
  try {
    await deleteCreatedMessages();

    boaCheck(
      checks,
      "Temporary attack-message ChatMessages were removed",
      createdMessageIds.every(
        id => !game.messages.get(id)
      ),
      createdMessageIds.join(", ")
    );
  } catch (error) {
    boaCheck(
      checks,
      "Temporary attack-message ChatMessages were removed",
      false,
      error.stack ?? error.message
    );
  }
}

notes.push(
  "The Macro invokes the normalized Bane of Azeroth " +
  "attack-result API with controlled success values; " +
  "it does not depend on random attack rolls."
);
notes.push(
  "No poison damage, condition, Active Effect, " +
  "or constrained state is expected."
);

return boaFinish(
  testKey,
  testName,
  checks,
  notes
);
