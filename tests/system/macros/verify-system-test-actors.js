const checks = [];
const notes = [];
const testKey = "system-test-actors";
const testName = "BOA DEV – Verify System Test Actors";

const expectedActorNames = [
  "BOA TEST – Death Knight",
  "BOA TEST – Demon Hunter",
  "BOA TEST – Druid",
  "BOA TEST – Shaman",
  "BOA TEST – Warlock",
  "BOA TEST – Mage",
  "BOA TEST – Monk",
  "BOA TEST – Evoker",
  "BOA TEST – Shadow Priest",
  "BOA TEST – Tauren",
  "BOA TEST – Hunter",
  "BOA TEST – Target",
];

function worldActorsNamed(name) {
  return boaCollectionValues(game.actors)
    .filter(actor => actor.name === name);
}

function actorItem(
  actor,
  name,
  type = null,
) {
  return boaCollectionValues(actor?.items)
    .find(item =>
      item.name === name &&
      (!type || item.type === type)
    ) ?? null;
}

const managedActors = boaCollectionValues(game.actors)
  .filter(actor =>
    boaGetFlag(
      actor,
      "managedSystemTestActor",
    ) === true
  );

boaCheckEqual(
  checks,
  "Exactly twelve managed shared System Test Actors are imported",
  managedActors.length,
  12,
);

for (const name of expectedActorNames) {
  const matches = worldActorsNamed(name);
  boaCheckEqual(
    checks,
    `${name} exists exactly once`,
    matches.length,
    1,
  );

  const actor = matches[0] ?? null;
  if (!actor) continue;

  boaCheckEqual(
    checks,
    `${name} is a BoA-managed shared fixture`,
    boaGetFlag(
      actor,
      "managedSystemTestActor",
    ),
    true,
  );

  boaCheckEqual(
    checks,
    `${name} defaults Players to Observer rather than Owner`,
    actor.ownership?.default ?? null,
    CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
  );
}

const shaman =
  worldActorsNamed(
    "BOA TEST – Shaman",
  )[0] ?? null;
const druid =
  worldActorsNamed(
    "BOA TEST – Druid",
  )[0] ?? null;
const priest =
  worldActorsNamed(
    "BOA TEST – Shadow Priest",
  )[0] ?? null;

const castReadyFixtures = [
  {
    actor: shaman,
    actorName: "Shaman",
    profession: "Elementalist",
    skill: "Elementalism",
  },
  {
    actor: druid,
    actorName: "Druid",
    profession: "Animist",
    skill: "Animism",
  },
  {
    actor: priest,
    actorName: "Shadow Priest",
    profession: "Mentalist",
    skill: "Mentalism",
  },
];

for (const fixture of castReadyFixtures) {
  const profession = actorItem(
    fixture.actor,
    fixture.profession,
    "profession",
  );
  const skill = actorItem(
    fixture.actor,
    fixture.skill,
    "skill",
  );

  boaCheck(
    checks,
    `${fixture.actorName} has ${fixture.profession}`,
    Boolean(profession),
    profession?.uuid ?? "",
  );
  boaCheckEqual(
    checks,
    `${fixture.actorName} has ${fixture.skill} 15`,
    Number(
      skill?.system?.value ??
        NaN,
    ),
    15,
  );
}

if (shaman) {
  try {
    const {
      getElementalTotemOwnerUserIds,
    } = await import(
      `/modules/${BOA_TEST_MODULE_ID}/scripts/elemental-totems/creation.js`
    );
    const inheritedPlayerOwners =
      getElementalTotemOwnerUserIds(
        shaman,
      );

    boaCheckEqual(
      checks,
      "Shared BOA TEST – Shaman gives no Player ownership to summoned Totems",
      inheritedPlayerOwners,
      [],
    );
  } catch (error) {
    boaCheck(
      checks,
      "Shared System Test Actor summon-ownership contract is available",
      false,
      error.stack ?? error.message,
    );
  }
}

return boaFinish(
  testKey,
  testName,
  checks,
  notes,
);
