const checks = [];
const notes = [];
const createdMessageIds = [];

const testKey =
  "common-animal-attack-messages";
const testName =
  "BOA DEV – Verify Common Animal Attack Messages";

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Attack-message verification is run by a game master",
    false,
    "The test creates and deletes temporary attack ChatMessages."
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

function liveMessageIds() {
  return new Set(
    boaCollectionValues(game.messages)
      .map(message => message.id)
  );
}

function messagesCreatedSince(beforeIds) {
  return boaCollectionValues(game.messages)
    .filter(message =>
      !beforeIds.has(message.id)
    );
}

function recordMessages(messages) {
  for (const message of messages) {
    if (message?.id) {
      createdMessageIds.push(message.id);
    }
  }
}

function messageContent(message) {
  return String(message?.content ?? "");
}

function normalizedText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
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

async function waitFor(
  predicate,
  timeoutMs = 1500
) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (predicate()) {
      return true;
    }

    await new Promise(resolve =>
      setTimeout(resolve, 25)
    );
  }

  return predicate();
}

function rollDamageModelClass() {
  return (
    CONFIG.ChatMessage
      ?.dataModels
      ?.rollDamage ??
    null
  );
}

function weaponTestModelClass() {
  return (
    CONFIG.ChatMessage
      ?.dataModels
      ?.weaponTest ??
    null
  );
}

function effectOnlySkillContext(actor, weapon) {
  const skillName =
    weapon?.system?.skill?.name ??
    weapon?.name ??
    "Effect-only attack";
  return (
    itemByTypeAndName(
      actor,
      "skill",
      skillName
    ) ??
    {
      name: skillName,
      system: {
        value: Number(
          weapon?.system?.skill?.value ??
          0
        ),
      },
    }
  );
}

function countOccurrences(value, needle) {
  if (!needle) {
    return 0;
  }
  return String(value ?? "")
    .split(needle)
    .length - 1;
}

function hasRollDamageAction(content) {
  return (
    /data-action=["']rollWeaponDamage["']/i.test(
      String(content ?? "")
    ) ||
    normalizedText(content).includes(
      "Roll Damage"
    )
  );
}

function hasCriticalAction(content) {
  return (
    /data-action=["']critical["']/i.test(
      String(content ?? "")
    ) ||
    String(content ?? "").includes(
      "critical-roll"
    )
  );
}

async function createWeaponTestMessage({
  actor,
  weapon,
  targetActor = null,
  result,
  success,
  isDragon = false,
  isDemon = false,
}) {
  const Model = weaponTestModelClass();
  if (!Model) {
    throw new Error(
      "Dragonbane's weaponTest ChatMessage " +
      "data model is not registered."
    );
  }

  const roll =
    await new Roll(String(result)).evaluate();
  const skill =
    effectOnlySkillContext(actor, weapon);
  const model = Model.fromContext({
    actor,
    weapon,
    skill,
    action: "normal",
    damageType: "DoD.damageTypes.none",
    extraDamage: "",
    extraDragons: 0,
    isDamaging: true,
    targetActor,
    criticalEffect: "",
    isRanged: false,
    banes: 0,
    boons: 0,
    canPush: false,
    isDemon,
    isDragon,
    result,
    success,
    target: Number(
      skill?.system?.value ??
      weapon?.system?.skill?.value ??
      0
    ),
  });
  const messageData =
    await model.createMessageData(roll);
  const beforeIds = liveMessageIds();
  const message =
    await ChatMessage.create(messageData);

  await waitFor(() => {
    const current = game.messages.get(message.id);
    if (!current) {
      return false;
    }
    if (current.system?.isDamaging !== false) {
      return false;
    }
    if (success && !isDemon) {
      return normalizedText(
        messageContent(current)
      ).includes("constrains");
    }
    return true;
  });
  await new Promise(resolve =>
    setTimeout(resolve, 50)
  );

  const created = messagesCreatedSince(beforeIds);
  recordMessages(created);
  return {
    message:
      game.messages.get(message.id) ??
      message,
    created,
    originalContent:
      String(messageData.content ?? ""),
    roll,
  };
}

function checkEffectOnlyWeaponTest({
  scenario,
  run,
  actor,
  weapon,
  targetActor,
  expectsEffect,
}) {
  boaCheckEqual(
    checks,
    `${scenario} creates only the Dragonbane weaponTest ChatMessage`,
    run.created.length,
    1
  );
  boaCheckEqual(
    checks,
    `${scenario} keeps the original ChatMessage document`,
    run.created[0]?.id ?? null,
    run.message.id
  );
  boaCheckEqual(
    checks,
    `${scenario} keeps the weaponTest message type`,
    run.message.type,
    "weaponTest"
  );
  boaCheckEqual(
    checks,
    `${scenario} is classified as non-damaging`,
    run.message.system?.isDamaging,
    false
  );
  boaCheckEqual(
    checks,
    `${scenario} remains a melee attack`,
    run.message.system?.isRanged,
    false
  );

  const content = normalizedText(
    messageContent(run.message)
  );
  boaCheck(
    checks,
    `${scenario} has no Roll Damage action`,
    !hasRollDamageAction(
      messageContent(run.message)
    ),
    content
  );

  const effectLead = targetActor
    ? `${actor.name} constrains ${targetActor.name}`
    : `${actor.name} constrains the target`;
  if (expectsEffect) {
    boaCheck(
      checks,
      `${scenario} appends Constrain to the same attack card`,
      content.includes(effectLead),
      content
    );
    boaCheck(
      checks,
      `${scenario} includes Constrain strength 10`,
      content.includes(
        "open opposed STR roll against 10"
      ),
      content
    );
    boaCheckEqual(
      checks,
      `${scenario} appends the effect exactly once`,
      countOccurrences(content, effectLead),
      1
    );
  } else {
    boaCheck(
      checks,
      `${scenario} does not apply Constrain`,
      !content.includes(`${actor.name} constrains`),
      content
    );
  }
}


async function createRollDamageMessage({
  actor,
  weapon,
  targetActor = null,
  formula,
}) {
  const Model =
    rollDamageModelClass();

  if (!Model) {
    throw new Error(
      "Dragonbane's rollDamage ChatMessage " +
      "data model is not registered."
    );
  }

  const roll =
    await new Roll(formula).evaluate();
  const model = Model.fromContext({
    actor,
    weapon,
    targetActor,
    damage: Number(roll.total),
    damageType: "DoD.damageTypes.none",
    formula,
    isHealing: false,
    ignoreArmor: false,
    penetrating: 0,
  });
  const messageData =
    await model.createMessageData(roll);
  const beforeIds = liveMessageIds();
  const message =
    await ChatMessage.create(messageData);

  await waitFor(() => {
    const current =
      game.messages.get(message.id);

    return Boolean(
      current &&
      current.content !== messageData.content
    );
  });

  await new Promise(resolve =>
    setTimeout(resolve, 50)
  );

  const created =
    messagesCreatedSince(beforeIds);

  recordMessages(created);

  return {
    message:
      game.messages.get(message.id) ??
      message,
    created,
    originalContent:
      String(messageData.content ?? ""),
    roll,
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

function checkSingleEnrichedMessage({
  scenario,
  run,
  actor,
  weapon,
  targetActor,
  effectChecks,
}) {
  boaCheckEqual(
    checks,
    `${scenario} creates only the Dragonbane damage ChatMessage`,
    run.created.length,
    1
  );
  boaCheckEqual(
    checks,
    `${scenario} keeps the original ChatMessage document`,
    run.created[0]?.id ?? null,
    run.message.id
  );
  boaCheckEqual(
    checks,
    `${scenario} keeps the rollDamage message type`,
    run.message.type,
    "rollDamage"
  );
  boaCheckEqual(
    checks,
    `${scenario} keeps the Large Serpent speaker`,
    run.message.speaker?.alias ?? null,
    actor.name
  );
  boaCheckEqual(
    checks,
    `${scenario} keeps the original damage formula`,
    run.message.system?.formula ?? null,
    run.roll.formula
  );
  boaCheckEqual(
    checks,
    `${scenario} keeps the original damage total`,
    run.message.system?.damage ?? null,
    Number(run.roll.total)
  );

  const content =
    normalizedText(
      messageContent(run.message)
    );

  boaCheck(
    checks,
    `${scenario} keeps Dragonbane's damage text`,
    (
      content.includes(actor.name) &&
      content.includes(weapon.name) &&
      content.includes(
        String(run.roll.total)
      )
    ),
    content
  );

  if (targetActor) {
    boaCheck(
      checks,
      `${scenario} keeps the target in the damage text`,
      content.includes(targetActor.name),
      content
    );
  }

  for (const {
    label,
    predicate,
  } of effectChecks) {
    boaCheck(
      checks,
      `${scenario} ${label}`,
      predicate(content),
      content
    );
  }
}

const spider = boaFindWorldActor(
  "actors.common-animals.giant-spider"
);
boaCheck(
  checks,
  "Giant Spider is imported",
  Boolean(spider),
  "actors.common-animals.giant-spider"
);
const webSpray = itemByTypeAndName(
  spider,
  "weapon",
  "Web Spray"
);
boaCheck(
  checks,
  "Giant Spider Web Spray weapon is available",
  Boolean(webSpray),
  "Web Spray"
);
boaCheck(
  checks,
  "Dragonbane weaponTest data model is registered",
  Boolean(weaponTestModelClass()),
  "CONFIG.ChatMessage.dataModels.weaponTest"
);

const serpent = boaFindWorldActor(
  "actors.common-animals.large-serpent"
);
const target = boaFindWorldActor(
  "actors.common-animals.crocolisk"
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
  "Dragonbane rollDamage data model is registered",
  Boolean(rollDamageModelClass()),
  "CONFIG.ChatMessage.dataModels.rollDamage"
);

if (
  !serpent ||
  !target ||
  !bite ||
  !constriction ||
  !rollDamageModelClass()
) {
  return boaFinish(
    testKey,
    testName,
    checks,
    notes
  );
}

try {
  const targetedPoison =
    await createRollDamageMessage({
      actor: serpent,
      weapon: bite,
      targetActor: target,
      formula: "11",
    });

  checkSingleEnrichedMessage({
    scenario: "Targeted Bite",
    run: targetedPoison,
    actor: serpent,
    weapon: bite,
    targetActor: target,
    effectChecks: [
      {
        label:
          "identifies attacker and target in the poison text",
        predicate: content =>
          content.includes(
            `${serpent.name} exposes ${target.name}`
          ),
      },
      {
        label:
          "includes poison potency 15",
        predicate: content =>
          content.includes("potency of 15"),
      },
      {
        label:
          "links Dragonbane's lethal poison rule",
        predicate:
          containsPoisonRuleLink,
      },
      {
        label:
          "explains ingested exposure",
        predicate: content =>
          content.includes(
            "as if the poison had been ingested"
          ),
      },
    ],
  });

  const untargetedPoison =
    await createRollDamageMessage({
      actor: serpent,
      weapon: bite,
      targetActor: null,
      formula: "4",
    });

  checkSingleEnrichedMessage({
    scenario: "Untargeted Bite",
    run: untargetedPoison,
    actor: serpent,
    weapon: bite,
    targetActor: null,
    effectChecks: [
      {
        label:
          "uses the target placeholder",
        predicate: content =>
          content.includes(
            `${serpent.name} exposes the target`
          ),
      },
      {
        label:
          "includes poison potency 15",
        predicate: content =>
          content.includes("potency of 15"),
      },
      {
        label:
          "links Dragonbane's lethal poison rule",
        predicate:
          containsPoisonRuleLink,
      },
    ],
  });

  const targetedConstrain =
    await createRollDamageMessage({
      actor: serpent,
      weapon: constriction,
      targetActor: target,
      formula: "6",
    });

  checkSingleEnrichedMessage({
    scenario: "Targeted Constriction",
    run: targetedConstrain,
    actor: serpent,
    weapon: constriction,
    targetActor: target,
    effectChecks: [
      {
        label:
          "identifies attacker and target in the constrain text",
        predicate: content =>
          content.includes(
            `${serpent.name} constrains ${target.name}`
          ),
      },
      {
        label:
          "explains the escape roll",
        predicate: content =>
          content.includes(
            "open opposed STR roll against 12"
          ),
      },
      {
        label:
          "preserves parry",
        predicate: content =>
          content.includes(
            "can still parry"
          ),
      },
      {
        label:
          "prevents evade",
        predicate: content =>
          content.includes(
            "cannot evade"
          ),
      },
    ],
  });


  if (
    spider &&
    webSpray &&
    weaponTestModelClass()
  ) {
    const targetedWebSpray =
      await createWeaponTestMessage({
        actor: spider,
        weapon: webSpray,
        targetActor: target,
        result: 10,
        success: true,
      });
    checkEffectOnlyWeaponTest({
      scenario: "Targeted Web Spray",
      run: targetedWebSpray,
      actor: spider,
      weapon: webSpray,
      targetActor: target,
      expectsEffect: true,
    });

    const untargetedWebSpray =
      await createWeaponTestMessage({
        actor: spider,
        weapon: webSpray,
        targetActor: null,
        result: 10,
        success: true,
      });
    checkEffectOnlyWeaponTest({
      scenario: "Untargeted Web Spray",
      run: untargetedWebSpray,
      actor: spider,
      weapon: webSpray,
      targetActor: null,
      expectsEffect: true,
    });

    const failedWebSpray =
      await createWeaponTestMessage({
        actor: spider,
        weapon: webSpray,
        targetActor: target,
        result: 13,
        success: false,
      });
    checkEffectOnlyWeaponTest({
      scenario: "Failed Web Spray",
      run: failedWebSpray,
      actor: spider,
      weapon: webSpray,
      targetActor: target,
      expectsEffect: false,
    });

    const demonWebSpray =
      await createWeaponTestMessage({
        actor: spider,
        weapon: webSpray,
        targetActor: target,
        result: 20,
        success: false,
        isDemon: true,
      });
    checkEffectOnlyWeaponTest({
      scenario: "Demon Web Spray",
      run: demonWebSpray,
      actor: spider,
      weapon: webSpray,
      targetActor: target,
      expectsEffect: false,
    });

    const dragonWebSpray =
      await createWeaponTestMessage({
        actor: spider,
        weapon: webSpray,
        targetActor: target,
        result: 1,
        success: true,
        isDragon: true,
      });
    checkEffectOnlyWeaponTest({
      scenario: "Dragon Web Spray",
      run: dragonWebSpray,
      actor: spider,
      weapon: webSpray,
      targetActor: target,
      expectsEffect: true,
    });
    boaCheck(
      checks,
      "Dragon Web Spray keeps the Critical Hit action",
      hasCriticalAction(
        messageContent(dragonWebSpray.message)
      ),
      normalizedText(
        messageContent(dragonWebSpray.message)
      )
    );
  } else {
    boaCheck(
      checks,
      "Web Spray weaponTest scenarios have their prerequisites",
      false,
      "Giant Spider, Web Spray, or weaponTest data model is missing."
    );
  }
} catch (error) {
  boaCheck(
    checks,
    "Dragonbane attack-message scenarios complete",
    false,
    error.stack ?? error.message
  );
} finally {
  try {
    await deleteCreatedMessages();

    boaCheck(
      checks,
      "Temporary attack ChatMessages were removed",
      createdMessageIds.every(
        id => !game.messages.get(id)
      ),
      createdMessageIds.join(", ")
    );
  } catch (error) {
    boaCheck(
      checks,
      "Temporary attack ChatMessages were removed",
      false,
      error.stack ?? error.message
    );
  }
}

notes.push(
  "The Macro creates real Dragonbane rollDamage " +
  "ChatMessages through the registered system data model."
);
notes.push(
  "The expected implementation enriches the same damage " +
  "card and must not create a separate Gamemaster message."
);
notes.push(
  "No poison damage, condition, Active Effect, constrained " +
  "state, target update, or movement automation is expected."
);

notes.push(
  "Web Spray scenarios create real Dragonbane weaponTest " +
  "ChatMessages and verify their non-damaging classification."
);
notes.push(
  "Critical Hit dialog choices and Extra Attack card rebuilding " +
  "remain explicit manual Foundry checks."
);
return boaFinish(
  testKey,
  testName,
  checks,
  notes
);
