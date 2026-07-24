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

notes.push(
  "This verifies the imported Ghoul Actor, its native Dragonbane " +
  "monster attack table, and the metadata used by its attack controls.",
);
notes.push(
  "Manual player verification: Dragonbane\'s native monster attack " +
  "dialog offers Claws and Infectious Bite without Random; shortcuts " +
  "that normally roll randomly execute Claws instead. Infectious Bite " +
  "Yes spends 2 WP from the assigned character, No attacks unpaid, " +
  "and Escape or closing either dialog prevents the attack.",
);
return boaFinish(
  "ghoul",
  "BOA DEV – Verify Ghoul",
  checks,
  notes,
);
