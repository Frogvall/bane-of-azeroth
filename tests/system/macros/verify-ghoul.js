const checks = [];
const notes = [];

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Ghoul verification is run by a game master",
    false,
    "The test reads imported world Actors and Roll Tables.",
  );
  return boaFinish(
    "ghoul",
    "BOA DEV – Verify Ghoul",
    checks,
    notes,
  );
}

const ghoul = boaFindWorldActor("actors.summoned-monsters.ghoul");
if (!boaCheck(
  checks,
  "Ghoul Actor is imported",
  Boolean(ghoul),
  "actors.summoned-monsters.ghoul",
)) {
  return boaFinish(
    "ghoul",
    "BOA DEV – Verify Ghoul",
    checks,
    notes,
  );
}

boaCheckEqual(checks, "Ghoul is a monster Actor", ghoul.type, "monster");
boaCheckEqual(checks, "Ghoul movement is 8", ghoul.system.movement.base, 8);
boaCheckEqual(checks, "Ghoul maximum HP is 10", ghoul.system.hitPoints.max, 10);
boaCheckEqual(checks, "Ghoul armor is zero", ghoul.system.armor, 0);
boaCheckEqual(checks, "Ghoul ferocity is 1", ghoul.system.ferocity.base, 1);
boaCheckEqual(checks, "Ghoul size is normal", ghoul.system.size, "normal");
boaCheckEqual(
  checks,
  "Ghoul summon metadata is present",
  boaGetFlag(ghoul, "summonType"),
  "ghoul",
);
boaCheckEqual(
  checks,
  "Ghoul has no embedded Items",
  boaCollectionValues(ghoul.items).length,
  0,
);

const undeadFolder = ghoul.folder ?? null;
const actorRootId = boaDocumentParentFolderId(undeadFolder);
const actorRoot = actorRootId ? game.folders.get(actorRootId) : null;
boaCheckEqual(
  checks,
  "Ghoul is in the Undead Actor folder",
  undeadFolder?.name ?? null,
  "Undead",
);
boaCheckEqual(
  checks,
  "Undead is under the blue Bane of Azeroth Actor folder",
  actorRoot?.name ?? null,
  "Bane of Azeroth",
);
boaCheckEqual(
  checks,
  "Actor Bane of Azeroth folder is blue",
  actorRoot?.color ?? null,
  "#0000ff",
);

const traits = String(ghoul.system.traits ?? "");
for (const snippet of [
  "Cannot Heal",
  "cannot heal HP",
  "Resistance",
  "piercing damage is halved",
  "Immunity",
  "immune to fear and PERSUASION",
  "Vulnerable Neck",
  "immediately severs its head",
]) {
  boaCheck(
    checks,
    `Ghoul traits contain ${snippet}`,
    traits.includes(snippet),
    traits,
  );
}

const attackTableUuid = String(ghoul.system.attackTable ?? "");
boaCheckEqual(
  checks,
  "Ghoul references the generated attack table",
  attackTableUuid,
  "RollTable.GhoulAtk4mN7Qx2P",
);

let attackTable = null;
try {
  attackTable = await fromUuid(attackTableUuid);
} catch (error) {
  notes.push(
    "Attack table lookup failed: " + (error.stack ?? error.message),
  );
}

if (boaCheck(
  checks,
  "Ghoul attack table resolves",
  Boolean(attackTable),
  attackTableUuid,
)) {
  boaCheckEqual(
    checks,
    "Ghoul attack table name is correct",
    attackTable.name,
    "Monster Attacks – Ghoul",
  );
  boaCheckEqual(
    checks,
    "Ghoul attack table formula is 1d2",
    attackTable.formula,
    "1d2",
  );

  const monsterAttacksFolder = attackTable.folder ?? null;
  const tableRootId = boaDocumentParentFolderId(monsterAttacksFolder);
  const tableRoot = tableRootId ? game.folders.get(tableRootId) : null;
  boaCheckEqual(
    checks,
    "Ghoul table is in Monster Attacks",
    monsterAttacksFolder?.name ?? null,
    "Monster Attacks",
  );
  boaCheckEqual(
    checks,
    "Monster Attacks is under Bane of Azeroth",
    tableRoot?.name ?? null,
    "Bane of Azeroth",
  );
  boaCheckEqual(
    checks,
    "Roll Table Bane of Azeroth folder is blue",
    tableRoot?.color ?? null,
    "#0000ff",
  );

  const results = boaCollectionValues(attackTable.results)
    .sort((left, right) => left.range[0] - right.range[0]);
  boaCheckEqual(
    checks,
    "Ghoul attack table contains two attacks",
    results.length,
    2,
  );

  const claws = String(results[0]?.description ?? "");
  boaCheck(
    checks,
    "Claws attack is present",
    claws.includes("<b>Claws.</b>"),
    claws,
  );
  boaCheck(
    checks,
    "Claws rolls D6 damage",
    claws.includes("[[/damage D6]]"),
    claws,
  );
  boaCheck(
    checks,
    "Claws is slashing damage",
    claws.includes("slashing damage"),
    claws,
  );
  boaCheck(
    checks,
    "Claws can be dodged or parried",
    claws.includes("dodged or parried"),
    claws,
  );

  const bite = String(results[1]?.description ?? "");
  boaCheck(
    checks,
    "Infectious Bite attack is present",
    bite.includes("<b>Infectious Bite.</b>"),
    bite,
  );
  boaCheck(
    checks,
    "Infectious Bite rolls 2D6 damage",
    bite.includes("[[/damage 2D6]]"),
    bite,
  );
  boaCheck(
    checks,
    "Infectious Bite is piercing damage",
    bite.includes("piercing damage"),
    bite,
  );
  boaCheck(
    checks,
    "Infectious Bite cannot be parried",
    bite.includes("not parried"),
    bite,
  );
  boaCheck(
    checks,
    "Infectious Bite applies a bane",
    bite.includes("bane on its next attack or spell roll"),
    bite,
  );
  boaCheck(
    checks,
    "Infectious Bite records the Death Knight WP cost",
    bite.includes("Costs 2 WP, paid by the Death Knight"),
    bite,
  );
}


const monsterControl = boaGetFlag(ghoul, "monsterControl");
boaCheckEqual(
  checks,
  "Ghoul attack selection uses the manual policy",
  monsterControl?.attackSelection?.mode ?? null,
  "manual",
);
boaCheckEqual(
  checks,
  "Ghoul random-attack fallback is Claws",
  monsterControl?.attackSelection?.fallbackAttackKey ?? null,
  "claws",
);
boaCheckEqual(
  checks,
  "Ghoul monster-control schema is version 1",
  monsterControl?.schemaVersion ?? null,
  1,
);
if (attackTable) {
  const controlledResults = boaCollectionValues(attackTable.results)
    .sort((left, right) => left.range[0] - right.range[0]);
  const clawsPolicy = boaGetFlag(controlledResults[0], "monsterAttack");
  const bitePolicy = boaGetFlag(controlledResults[1], "monsterAttack");
  boaCheckEqual(checks, "Claws has a stable attack key", clawsPolicy?.key ?? null, "claws");
  boaCheckEqual(
    checks,
    "Infectious Bite has a stable attack key",
    bitePolicy?.key ?? null,
    "infectious-bite",
  );
  boaCheckEqual(
    checks,
    "Infectious Bite costs 2 assigned-character WP",
    bitePolicy?.resourceCost?.amount ?? null,
    2,
  );
  boaCheckEqual(
    checks,
    "Infectious Bite permits an unpaid attack",
    bitePolicy?.resourceCost?.allowUnpaid ?? null,
    true,
  );
}

if (attackTable) {
  let paymentActor = null;
  let paymentMessage = null;
  try {
    const {
      performControlledMonsterAttack,
    } = await import(
      "/modules/bane-of-azeroth/scripts/monster-attack-control.js"
    );
    const biteResult = boaCollectionValues(attackTable.results)
      .find(result => (
        boaGetFlag(result, "monsterAttack")?.key === "infectious-bite"
      ));
    if (!biteResult) {
      throw new Error("The Infectious Bite table result was not found.");
    }

    paymentActor = await Actor.create(
      {
        name: `[BOA TEST] Ghoul WP Payer ${foundry.utils.randomID(6)}`,
        type: "npc",
        system: {
          attributes: {
            wil: {
              base: 10,
              value: 10,
            },
          },
          willPoints: {
            base: 10,
            max: 10,
            value: 5,
          },
        },
        flags: {
          [BOA_TEST_MODULE_ID]: {
            [BOA_TEST_FIXTURE_FLAG]: true,
          },
        },
      },
      { renderSheet: false },
    );
    if (!paymentActor) {
      throw new Error("The temporary WP payer Actor could not be created.");
    }
    await paymentActor.update({
      "system.willPoints.value": 5,
    });

    const existingMessageIds = new Set(
      boaCollectionValues(game.messages).map(message => message.id),
    );
    const outcome = await performControlledMonsterAttack(
      {
        actor: ghoul,
        table: attackTable,
        tableResult: biteResult,
        user: {
          id: game.user.id,
          isGM: false,
          character: paymentActor,
        },
      },
      {
        dialogV2: {
          wait: async () => "pay",
        },
        utility: {
          monsterAttack: async () => "BOA system-test attack",
        },
      },
    );

    paymentMessage = boaCollectionValues(game.messages).find(message => (
      !existingMessageIds.has(message.id) &&
      boaGetFlag(message, "monsterAttackResourcePayment")?.payerActorUuid ===
        paymentActor.uuid
    )) ?? null;
    const paymentFlag = paymentMessage
      ? boaGetFlag(paymentMessage, "monsterAttackResourcePayment")
      : null;
    const paymentContent = String(paymentMessage?.content ?? "");

    boaCheckEqual(
      checks,
      "Infectious Bite payment completed the controlled attack",
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
      "Infectious Bite spent 2 WP from the assigned character",
      Number(paymentActor.system.willPoints.value),
      3,
    );
    boaCheck(
      checks,
      "Infectious Bite created a WP payment chat message",
      Boolean(paymentMessage),
      paymentMessage?.uuid ?? "No payment message was created.",
    );
    boaCheckEqual(
      checks,
      "WP payment chat records the attack and payer",
      paymentFlag
        ? {
            schemaVersion: paymentFlag.schemaVersion,
            attackKey: paymentFlag.attackKey,
            resource: paymentFlag.resource,
            amount: paymentFlag.amount,
            payerActorUuid: paymentFlag.payerActorUuid,
            sourceActorUuid: paymentFlag.sourceActorUuid,
          }
        : null,
      {
        schemaVersion: 1,
        attackKey: "infectious-bite",
        resource: "willPoints",
        amount: 2,
        payerActorUuid: paymentActor.uuid,
        sourceActorUuid: ghoul.uuid,
      },
    );
    boaCheck(
      checks,
      "WP payment chat uses Dragonbane's expandable ability styling",
      paymentContent.includes('class="ability-use"') &&
        paymentContent.includes("damage-details") &&
        paymentContent.includes("fa-arrow-right"),
      paymentContent,
    );
    boaCheck(
      checks,
      "WP payment chat names the payer, attack, and WP change",
      paymentContent.includes(paymentActor.name) &&
        paymentContent.includes("Infectious Bite") &&
        /<b>.*:<\/b>\s*5\s*<i class="fa-solid fa-arrow-right"><\/i>\s*3<br>/s
          .test(paymentContent),
      paymentContent,
    );
    boaCheckEqual(
      checks,
      "WP payment chat speaker is the assigned character",
      paymentMessage?.speaker?.actor ?? null,
      paymentActor.id,
    );
  } catch (error) {
    boaCheck(
      checks,
      "Infectious Bite WP payment and chat system test completed",
      false,
      error.stack ?? error.message,
    );
  } finally {
    if (paymentMessage) {
      try {
        const messageId = paymentMessage.id;
        await paymentMessage.delete();
        boaCheck(
          checks,
          "Temporary Ghoul WP payment chat message was deleted",
          !game.messages.has(messageId),
          messageId,
        );
      } catch (error) {
        boaCheck(
          checks,
          "Temporary Ghoul WP payment chat message was deleted",
          false,
          error.stack ?? error.message,
        );
      }
    }
    if (paymentActor) {
      try {
        const actorId = paymentActor.id;
        await paymentActor.delete();
        boaCheck(
          checks,
          "Temporary Ghoul WP payer Actor was deleted",
          !game.actors.has(actorId),
          actorId,
        );
      } catch (error) {
        boaCheck(
          checks,
          "Temporary Ghoul WP payer Actor was deleted",
          false,
          error.stack ?? error.message,
        );
      }
    }
  }
}

notes.push(
  "This verifies the imported Ghoul Actor, its native Dragonbane " +
  "monster attack table, and the metadata used by its attack controls.",
);
notes.push(
  "Manual player verification: Dragonbane\'s native monster attack " +
  "dialog offers Claws and Infectious Bite without Random; shortcuts " +
  "that normally roll randomly execute Claws instead. Infectious Bite " +
  "Yes spends 2 WP from the assigned character and posts an " +
  "expandable payment card, No attacks unpaid, and Escape or " +
  "closing either dialog prevents the attack.",
);
return boaFinish(
  "ghoul",
  "BOA DEV – Verify Ghoul",
  checks,
  notes,
);
