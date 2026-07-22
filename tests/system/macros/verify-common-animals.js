const checks = [];
const notes = [];

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Common Animals verification is run by a game master",
    false,
    "The test reads imported world Actors."
  );
  return boaFinish(
    "common-animals",
    "BOA DEV – Verify Common Animals",
    checks,
    notes
  );
}

const moduleId = "bane-of-azeroth";
const poisonRuleUuid =
  "JournalEntry.SbbSMsuvWeo3HaID." +
  "JournalEntryPage.6WPxPxUjh4W80RNy#poison";

const expectedAnimals = [
  {
    key: "crocolisk",
    name: "Crocolisk",
    movement: 6,
    hitPoints: 15,
    armorRating: 1,
    attacks: [
      {
        name: "Bite",
        skillLevel: 12,
        damage: "2D8",
        range: "2",
        effects: [],
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 10,
      },
      {
        name: "Evade",
        value: 6,
      },
    ],
    traitSnippets: [
      "Swim:",
      "automatically succeeds on SWIMMING rolls",
      "movement rate of 12",
    ],
  },
  {
    key: "dragonhawk",
    name: "Dragonhawk",
    movement: 2,
    hitPoints: 8,
    armorRating: 0,
    attacks: [
      {
        name: "Beak",
        skillLevel: 10,
        damage: "D10",
        range: "2",
        effects: [],
      },
      {
        name: "Talons",
        skillLevel: 12,
        damage: "2D4",
        range: "2",
        effects: [],
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 14,
      },
      {
        name: "Evade",
        value: 12,
      },
    ],
    traitSnippets: [
      "Fly:",
      "moves freely through the air",
      "movement rate of 14",
    ],
  },
  {
    key: "large-serpent",
    name: "Large Serpent",
    movement: 10,
    hitPoints: 8,
    armorRating: 0,
    attacks: [
      {
        name: "Bite",
        skillLevel: 12,
        damage: "D6",
        range: "2",
        effects: [
          {
            type: "lethalPoison",
            potency: 15,
            ruleUuid: poisonRuleUuid,
          },
        ],
      },
      {
        name: "Constriction",
        skillLevel: 10,
        damage: "D6",
        range: "2",
        effects: [
          {
            type: "constrain",
            strength: 12,
          },
        ],
      },
    ],
    skills: [
      {
        name: "Awareness",
        value: 12,
      },
      {
        name: "Evade",
        value: 16,
      },
    ],
    traitSnippets: [
      "Lethal Poison:",
      `@UUID[${poisonRuleUuid}]{lethal poison}`,
      "potency of 15",
      "as if the poison had been ingested",
      "Constrain:",
      "open opposed STR roll against 12",
      "can still parry while constrained",
      "cannot evade",
    ],
  },
  {
    key: "gorilla",
    name: "Gorilla",
    movement: 8,
    hitPoints: 16,
    armorRating: 0,
    attacks: [
      {
        name: "Bite",
        skillLevel: 12,
        damage: "2D6",
        range: "2",
        effects: [],
      },
      {
        name: "Fist",
        skillLevel: 14,
        damage: "2D4",
        range: "2",
        effects: [],
      },
    ],
    skills: [
      {
        name: "Acrobatics",
        value: 15,
      },
      {
        name: "Awareness",
        value: 10,
      },
      {
        name: "Evade",
        value: 14,
      },
    ],
    traitSnippets: [],
  },
];

function itemByTypeAndName(
  actor,
  type,
  name
) {
  return boaCollectionValues(actor.items).find(
    item =>
      item.type === type &&
      item.name === name
  );
}

function actorFolderPath(actor) {
  const commonAnimals = actor.folder ?? null;
  const rootId =
    boaDocumentParentFolderId(commonAnimals);
  const root = rootId
    ? game.folders.get(rootId)
    : null;

  return {
    commonAnimals,
    root,
  };
}

function attackEffects(item) {
  return boaGetFlag(
    item,
    "attackEffects"
  ) ?? [];
}

const importedAnimals =
  boaCollectionValues(game.actors)
    .filter(actor =>
      boaContentKey(actor).startsWith(
        "actors.common-animals."
      )
    );

boaCheckEqual(
  checks,
  "Exactly the current four Common Animals are imported",
  importedAnimals
    .map(actor => actor.name)
    .sort(),
  expectedAnimals
    .map(animal => animal.name)
    .sort()
);

for (const expected of expectedAnimals) {
  const actor = boaFindWorldActor(
    `actors.common-animals.${expected.key}`
  );

  if (!boaCheck(
    checks,
    `${expected.name} Actor is imported`,
    Boolean(actor),
    `actors.common-animals.${expected.key}`
  )) {
    continue;
  }

  boaCheckEqual(
    checks,
    `${expected.name} is a plain NPC Actor`,
    actor.type,
    "npc"
  );
  boaCheckEqual(
    checks,
    `${expected.name} has a blank description`,
    actor.system.description,
    ""
  );
  boaCheckEqual(
    checks,
    `${expected.name} base movement is correct`,
    actor.system.movement.base,
    expected.movement
  );
  boaCheckEqual(
    checks,
    `${expected.name} maximum HP is correct`,
    actor.system.hitPoints.max,
    expected.hitPoints
  );
  boaCheckEqual(
    checks,
    `${expected.name} base HP is correct`,
    actor.system.hitPoints.base,
    expected.hitPoints
  );
  boaCheckEqual(
    checks,
    `${expected.name} maximum WP is zero`,
    actor.system.willPoints.max,
    0
  );

  const folderPath = actorFolderPath(actor);

  boaCheckEqual(
    checks,
    `${expected.name} is in Common Animals`,
    folderPath.commonAnimals?.name ?? null,
    "Common Animals"
  );
  boaCheckEqual(
    checks,
    `${expected.name} Common Animals folder is under Bane of Azeroth`,
    folderPath.root?.name ?? null,
    "Bane of Azeroth"
  );

  for (const expectedSkill of expected.skills) {
    const skill = itemByTypeAndName(
      actor,
      "skill",
      expectedSkill.name
    );

    if (!boaCheck(
      checks,
      `${expected.name} has ${expectedSkill.name}`,
      Boolean(skill),
      expectedSkill.name
    )) {
      continue;
    }

    boaCheckEqual(
      checks,
      `${expected.name} ${expectedSkill.name} value is correct`,
      skill.system.value,
      expectedSkill.value
    );
    boaCheckEqual(
      checks,
      `${expected.name} ${expectedSkill.name} is a core skill`,
      skill.system.skillType,
      "core"
    );
  }

  for (const expectedAttack of expected.attacks) {
    const skill = itemByTypeAndName(
      actor,
      "skill",
      expectedAttack.name
    );
    const weapon = itemByTypeAndName(
      actor,
      "weapon",
      expectedAttack.name
    );

    if (!boaCheck(
      checks,
      `${expected.name} has ${expectedAttack.name} weapon skill`,
      Boolean(skill),
      expectedAttack.name
    )) {
      continue;
    }

    if (!boaCheck(
      checks,
      `${expected.name} has ${expectedAttack.name} weapon`,
      Boolean(weapon),
      expectedAttack.name
    )) {
      continue;
    }

    boaCheckEqual(
      checks,
      `${expected.name} ${expectedAttack.name} attack value is correct`,
      skill.system.value,
      expectedAttack.skillLevel
    );
    boaCheckEqual(
      checks,
      `${expected.name} ${expectedAttack.name} is a weapon skill`,
      skill.system.skillType,
      "weapon"
    );
    boaCheckEqual(
      checks,
      `${expected.name} ${expectedAttack.name} damage is correct`,
      weapon.system.damage,
      expectedAttack.damage
    );
    boaCheckEqual(
      checks,
      `${expected.name} ${expectedAttack.name} range is correct`,
      String(weapon.system.range),
      expectedAttack.range
    );
    boaCheckEqual(
      checks,
      `${expected.name} ${expectedAttack.name} references its attack skill`,
      weapon.system.skill.name,
      expectedAttack.name
    );
    boaCheckEqual(
      checks,
      `${expected.name} ${expectedAttack.name} effect metadata is correct`,
      attackEffects(weapon),
      expectedAttack.effects
    );

    try {
      const roll = await new Roll(
        weapon.system.damage
      ).evaluate();

      boaCheck(
        checks,
        `${expected.name} ${expectedAttack.name} damage formula evaluates`,
        Number.isFinite(Number(roll.total)),
        (
          `Formula: ${weapon.system.damage}; ` +
          `Result: ${boaDiagnosticValue(roll.total)}`
        )
      );
    } catch (error) {
      boaCheck(
        checks,
        `${expected.name} ${expectedAttack.name} damage formula evaluates`,
        false,
        error.stack ?? error.message
      );
    }
  }

  const armorItems =
    boaCollectionValues(actor.items)
      .filter(item => item.type === "armor");
  const wornArmorItems = armorItems.filter(
    item => item.system.worn === true
  );

  if (expected.armorRating === 0) {
    boaCheckEqual(
      checks,
      `${expected.name} has no armor Item`,
      armorItems.length,
      0
    );
  } else {
    boaCheckEqual(
      checks,
      `${expected.name} has exactly one armor Item`,
      armorItems.length,
      1
    );
    boaCheckEqual(
      checks,
      `${expected.name} has exactly one worn armor Item`,
      wornArmorItems.length,
      1
    );
    boaCheckEqual(
      checks,
      `${expected.name} worn armor rating is correct`,
      wornArmorItems[0]?.system.rating ?? null,
      expected.armorRating
    );
  }

  const traits = String(
    actor.system.traits ?? ""
  );

  for (const snippet of expected.traitSnippets) {
    boaCheck(
      checks,
      `${expected.name} trait text contains ${snippet}`,
      traits.includes(snippet),
      traits
    );
  }

  if (expected.traitSnippets.length === 0) {
    boaCheckEqual(
      checks,
      `${expected.name} has no generated special traits`,
      traits,
      ""
    );
  }

  const automationData = JSON.stringify({
    actorFlags: actor.flags ?? {},
    tokenFlags:
      actor.prototypeToken?.flags ?? {},
  });

  boaCheck(
    checks,
    `${expected.name} has no summon or totem automation metadata`,
    !/summonType|casterActorUuid|sourceSpell|auraRange|castId|instanceId|socket/i
      .test(automationData),
    automationData
  );
}

notes.push(
  "Damage formulas were evaluated through Foundry's Roll engine " +
  "without creating chat messages."
);
notes.push(
  "Armor verification checks the live imported worn armor Item. " +
  "Dragonbane remains responsible for applying armor during damage."
);

return boaFinish(
  "common-animals",
  "BOA DEV – Verify Common Animals",
  checks,
  notes
);
