const checks = [];
const notes = [];
const created = {
  users: [],
  actors: [],
  scenes: [],
  macros: [],
  messages: [],
};
const testKey = "prepare-player-tests";
const testName = "BOA DEV – Prepare Player Tests";
const sessionSchemaVersion = 1;
const sessionFlag = "playerTestSession";
const fixtureFlag = "playerTestFixture";
const sessionIdFlag = "playerTestSessionId";
const stageResultFlag = "playerTestStageResult";
let credentialMessageData = null;

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Player-test preparation is run by a game master",
    false,
    "Only a GM may create temporary Users and world fixtures.",
  );
  return boaFinish(testKey, testName, checks, notes);
}

function sessionIdOf(document) {
  return boaGetFlag(document, sessionIdFlag)
    ?? boaGetFlag(document, sessionFlag)?.sessionId
    ?? null;
}

function markFixture(data, sessionId, kind) {
  foundry.utils.setProperty(
    data,
    `flags.${BOA_TEST_MODULE_ID}.${fixtureFlag}`,
    {
      schemaVersion: sessionSchemaVersion,
      sessionId,
      kind,
    },
  );
  foundry.utils.setProperty(
    data,
    `flags.${BOA_TEST_MODULE_ID}.${sessionIdFlag}`,
    sessionId,
  );
  return data;
}

function findPackEntry(index, key) {
  return index.find(entry => (
    foundry.utils.getProperty(
      entry,
      `flags.${BOA_TEST_MODULE_ID}.systemTestKey`,
    ) === key
  ));
}

function sourceItem(contentKey, name) {
  return boaFindWorldItem(contentKey)
    ?? boaCollectionValues(game.items).find(item => (
      item.name === name && item.type === "ability"
    ));
}

function ownedActorClone(source, userId, sessionId, kind) {
  const data = source.toObject();
  delete data._id;
  delete data.folder;
  data.name =
    `[BOA TEST] ${source.name} ${sessionId.slice(-6)}`;
  data.ownership = {
    default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
    [userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
  };
  markFixture(data, sessionId, kind);
  return data;
}

async function createFixtureToken(
  sourceActor,
  scene,
  tokenOverrides,
  sessionId,
  kind,
  moduleFlags = {},
) {
  const tokenDocument = await sourceActor.getTokenDocument(
    tokenOverrides,
    { parent: scene },
  );
  const tokenData = tokenDocument.toObject();
  delete tokenData._id;
  markFixture(tokenData, sessionId, kind);

  for (const [key, value] of Object.entries(moduleFlags)) {
    foundry.utils.setProperty(
      tokenData,
      `flags.${BOA_TEST_MODULE_ID}.${key}`,
      value,
    );
  }

  const [token] = await scene.createEmbeddedDocuments(
    "Token",
    [tokenData],
  );
  if (!token) {
    throw new Error(
      `The ${kind} Token fixture could not be created.`,
    );
  }

  return token;
}

async function rollback() {
  for (const message of [...created.messages].reverse()) {
    if (game.messages.get(message.id)) await message.delete();
  }
  for (const macro of [...created.macros].reverse()) {
    if (game.macros.get(macro.id)) await macro.delete();
  }
  for (const scene of [...created.scenes].reverse()) {
    if (game.scenes.get(scene.id)) await scene.delete();
  }
  for (const actor of [...created.actors].reverse()) {
    if (game.actors.get(actor.id)) await actor.delete();
  }
  for (const user of [...created.users].reverse()) {
    if (game.users.get(user.id)) await user.delete();
  }
}

const existingFixtureUsers = boaCollectionValues(game.users)
  .filter(user => Boolean(boaGetFlag(user, fixtureFlag)));

if (existingFixtureUsers.length > 0) {
  boaCheck(
    checks,
    "No previous player-test fixture exists",
    false,
    existingFixtureUsers
      .map(user => `${user.name} (${sessionIdOf(user) ?? "unknown"})`)
      .join(", "),
  );
  notes.push(
    "Run BOA DEV – Cleanup Player Tests before preparing a new session.",
  );
  return boaFinish(testKey, testName, checks, notes);
}

const pack = game.packs.get(BOA_TEST_PACK_ID);
if (!boaCheck(
  checks,
  "Developer-test compendium is available",
  Boolean(pack),
  BOA_TEST_PACK_ID,
)) {
  return boaFinish(testKey, testName, checks, notes);
}

const requiredAbilities = [
  {
    key: "heroic-class-ability.shaman.shamanic-calling",
    name: "Shamanic Calling",
  },
  {
    key: "heroic-class-ability.death-knight.summon-ghoul",
    name: "Raise Ghoul",
  },
  {
    key: "heroic-class-ability.warlock.demonologist",
    name: "Demonologist",
  },
].map(expected => ({
  ...expected,
  item: sourceItem(expected.key, expected.name),
}));

const missingAbilities = requiredAbilities.filter(entry => !entry.item);
if (missingAbilities.length > 0) {
  boaCheck(
    checks,
    "Required Heroic Abilities are imported",
    false,
    missingAbilities.map(entry => entry.key).join(", "),
  );
  notes.push("Import the current Bane of Azeroth Adventure first.");
  return boaFinish(testKey, testName, checks, notes);
}

const demonHunterInitiationContentKey =
  "heroic-class-ability.demon-hunter.demon-hunter-initiation";
const demonHunterInitiationSource =
  sourceItem(
    demonHunterInitiationContentKey,
    "Demon Hunter Initiation",
  );

if (!boaCheck(
  checks,
  "Demon Hunter Initiation source ability is imported for the real-Player flow",
  Boolean(
    demonHunterInitiationSource,
  ),
  demonHunterInitiationContentKey,
)) {
  notes.push(
    "Import the current Bane of Azeroth Adventure first.",
  );
  return boaFinish(
    testKey,
    testName,
    checks,
    notes,
  );
}

const impTemplate = boaFindWorldActor(
  "actors.summoned-monsters.imp",
);
const sayaadTemplate = boaFindWorldActor(
  "actors.summoned-monsters.sayaad",
);
const voidwalkerTemplate = boaFindWorldActor(
  "actors.summoned-monsters.voidwalker",
);
const cleansingTotemTemplate =
  boaFindWorldActor(
    "actors.elemental-totems.cleansing",
  )
  ?? boaCollectionValues(game.actors).find(actor => (
    actor.name === "Cleansing Totem"
  ))
  ?? null;

const requiredActorTemplates = [
  {
    key: "actors.summoned-monsters.imp",
    actor: impTemplate,
  },
  {
    key: "actors.summoned-monsters.sayaad",
    actor: sayaadTemplate,
  },
  {
    key: "actors.summoned-monsters.voidwalker",
    actor: voidwalkerTemplate,
  },
  {
    key: "actors.elemental-totems.cleansing",
    actor: cleansingTotemTemplate,
  },
];
const missingActorTemplates =
  requiredActorTemplates.filter(entry => !entry.actor);

if (!boaCheck(
  checks,
  "Imported Player-test Actor templates are available",
  missingActorTemplates.length === 0,
  missingActorTemplates.map(entry => entry.key).join(", "),
)) {
  return boaFinish(testKey, testName, checks, notes);
}

const originalAutomationSetting = game.settings.get(
  BOA_TEST_MODULE_ID,
  "elementalTotemAutomation",
);
const originalDemonAutomationSetting = game.settings.get(
  BOA_TEST_MODULE_ID,
  "demonAutomation",
);
const originalDemonHunterInitiationAutomationSetting =
  game.settings.get(
    BOA_TEST_MODULE_ID,
    "demonHunterInitiationAutomation",
  );
const previousActiveSceneId = game.scenes.active?.id ?? null;
const sessionId =
  `boa-player-${Date.now()}-${foundry.utils.randomID(8)}`;
const password = `Boa-${foundry.utils.randomID(12)}!`;
const suffix = sessionId.slice(-6);

try {
  const index = await pack.getIndex({
    fields: [
      `flags.${BOA_TEST_MODULE_ID}.systemTestKey`,
    ],
  });
  const playerEntry = findPackEntry(index, "player-tests");
  if (!playerEntry) {
    throw new Error(
      "BOA DEV – Run Player Tests is missing from the developer-test pack.",
    );
  }
  const playerTemplate = await pack.getDocument(playerEntry._id);
  if (!playerTemplate) {
    throw new Error(
      "The player-test Macro template could not be loaded.",
    );
  }

  const user = await User.create(
    markFixture({
      name: `[BOA TEST] Player ${suffix}`,
      role: CONST.USER_ROLES.PLAYER,
      password,
      color: "#4f8bc9",
    }, sessionId, "user"),
  );
  if (!user) {
    throw new Error("The temporary Player User could not be created.");
  }
  created.users.push(user);

  const actor = await Actor.create(
    markFixture({
      name: `[BOA TEST] Player Character ${suffix}`,
      type: "character",
      ownership: {
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
        [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      },
    }, sessionId, "character"),
    { renderSheet: false },
  );
  if (!actor) {
    throw new Error("The temporary player Actor could not be created.");
  }
  created.actors.push(actor);

  await actor.update({
    "system.willPoints.base": 10,
    "system.willPoints.max": 10,
    "system.willPoints.value": 10,
  });

  const shiftActor = await Actor.create(
    markFixture({
      name: `[BOA TEST] Shift Rest Character ${suffix}`,
      type: "character",
      ownership: {
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
        [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      },
    }, sessionId, "shift-rest-character"),
    { renderSheet: false },
  );
  if (!shiftActor) {
    throw new Error(
      "The temporary Shift-rest Actor could not be created.",
    );
  }
  created.actors.push(shiftActor);
  const demonHunterInitiationSourceData =
    markFixture(
      boaCloneEmbeddedItem(
        demonHunterInitiationSource,
      ),
      sessionId,
      "demon-hunter-initiation-source-item",
    );

  const [demonHunterInitiationSourceItem] =
    await shiftActor.createEmbeddedDocuments(
      "Item",
      [
        demonHunterInitiationSourceData,
      ],
    );

  if (
    !demonHunterInitiationSourceItem
  ) {
    throw new Error(
      "The Demon Hunter Initiation Player-flow source Item "
      + "could not be embedded.",
    );
  }

  const sufferingActor = await Actor.create(
    markFixture({
      name: `[BOA TEST] Suffering Character ${suffix}`,
      type: "character",
      ownership: {
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
        [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      },
    }, sessionId, "suffering-character"),
    { renderSheet: false },
  );
  if (!sufferingActor) {
    throw new Error(
      "The temporary Suffering Actor could not be created.",
    );
  }
  created.actors.push(sufferingActor);
  await sufferingActor.update({
    "system.hitPoints.base": 20,
    "system.hitPoints.max": 20,
    "system.hitPoints.value": 20,
  });


  const summonActor = await Actor.create(
    markFixture({
      name:
        `[BOA TEST] Demon Summoner ${suffix}`,
      type: "character",
      ownership: {
        default:
          CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
        [user.id]:
          CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      },
    }, sessionId, "demon-summoner"),
    { renderSheet: false },
  );
  if (!summonActor) {
    throw new Error(
      "The temporary demon-summoner Actor "
      + "could not be created.",
    );
  }
  created.actors.push(summonActor);

  const demonologistSource =
    requiredAbilities.find(entry =>
      entry.key
        === "heroic-class-ability.warlock.demonologist"
    )?.item ?? null;
  if (!demonologistSource) {
    throw new Error(
      "The imported Demonologist ability "
      + "could not be found.",
    );
  }

  await summonActor.createEmbeddedDocuments(
    "Item",
    [
      boaCloneEmbeddedItem(
        demonologistSource,
      ),
    ],
  );
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
      "Demonologist was not embedded in the "
      + "temporary demon summoner.",
    );
  }

  await actor.createEmbeddedDocuments(
    "Item",
    requiredAbilities.map(entry =>
      boaCloneEmbeddedItem(entry.item)
    ),
  );

  const elementalTotemSpell = await boaWaitFor(
    () => boaCollectionValues(actor.items).find(item => (
      item.type === "spell"
      && (
        boaContentKey(item) === "spells.elemental-totem"
        || boaGetFlag(item, "sourceSpell") === "spells.elemental-totem"
      )
    )),
    {
      timeout: 6000,
      description: "automatic Elemental Totem spell grant",
    },
  );

  const imp = await Actor.create(
    ownedActorClone(
      impTemplate,
      user.id,
      sessionId,
      "controlled-demon",
    ),
    { renderSheet: false },
  );
  if (!imp) {
    throw new Error("The player-owned Imp fixture could not be created.");
  }
  created.actors.push(imp);

  const sayaad = await Actor.create(
    ownedActorClone(
      sayaadTemplate,
      user.id,
      sessionId,
      "defense-target-sayaad",
    ),
    { renderSheet: false },
  );
  if (!sayaad) {
    throw new Error(
      "The player-owned Sayaad fixture could not be created.",
    );
  }
  created.actors.push(sayaad);

  const scene = await Scene.create(
    markFixture({
      name: `[BOA TEST] Player Tests ${suffix}`,
      active: false,
      navigation: true,
      width: 2000,
      height: 1200,
      padding: 0,
      grid: {
        type: CONST.GRID_TYPES?.SQUARE ?? 1,
        size: 100,
        distance: 2,
        units: "m",
      },
    }, sessionId, "scene"),
    { renderSheet: false },
  );
  if (!scene) {
    throw new Error("The temporary player-test Scene could not be created.");
  }
  created.scenes.push(scene);

  const lifecycleScene = await Scene.create(
    markFixture({
      name: `[BOA TEST] Player Lifecycle ${suffix}`,
      active: false,
      navigation: true,
      width: 2000,
      height: 1200,
      padding: 0,
      grid: {
        type: CONST.GRID_TYPES?.SQUARE ?? 1,
        size: 100,
        distance: 2,
        units: "m",
      },
    }, sessionId, "lifecycle-scene"),
    { renderSheet: false },
  );
  if (!lifecycleScene) {
    throw new Error(
      "The temporary lifecycle Scene could not be created.",
    );
  }
  created.scenes.push(lifecycleScene);

  const token = await createFixtureToken(
    actor,
    scene,
    {
      x: 400,
      y: 400,
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
    },
    sessionId,
    "character-token",
  );


  const summonCasterToken =
    await createFixtureToken(
      summonActor,
      lifecycleScene,
      {
        x: 1400,
        y: 800,
        actorLink: true,
        disposition:
          CONST.TOKEN_DISPOSITIONS?.FRIENDLY
          ?? 1,
      },
      sessionId,
      "demon-summoner-token",
    );

  const impTargetToken = await createFixtureToken(
    imp,
    scene,
    {
      x: 700,
      y: 200,
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS?.HOSTILE ?? -1,
    },
    sessionId,
    "phase-shift-target",
  );
  const sayaadTargetToken = await createFixtureToken(
    sayaad,
    scene,
    {
      x: 1000,
      y: 200,
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS?.HOSTILE ?? -1,
    },
    sessionId,
    "seductive-target",
  );

  const stretchTotemToken = await createFixtureToken(
    cleansingTotemTemplate,
    lifecycleScene,
    {
      x: 400,
      y: 400,
      actorLink: false,
      disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
    },
    sessionId,
    "stretch-totem",
    {
      summonType: "elementalTotem",
      casterActorUuid: actor.uuid,
      duration: "stretch",
    },
  );
  const stretchDemonToken = await createFixtureToken(
    impTemplate,
    scene,
    {
      x: 1300,
      y: 500,
      actorLink: false,
      disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
    },
    sessionId,
    "stretch-demon",
    {
      summonType: "warlock-demon",
      casterActorUuid: actor.uuid,
      demonKey: "imp",
      duration: "shift",
    },
  );
  const shiftTotemToken = await createFixtureToken(
    cleansingTotemTemplate,
    scene,
    {
      x: 1500,
      y: 500,
      actorLink: false,
      disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
    },
    sessionId,
    "shift-totem",
    {
      summonType: "elementalTotem",
      casterActorUuid: shiftActor.uuid,
      duration: "stretch",
    },
  );
  const shiftDemonToken = await createFixtureToken(
    sayaadTemplate,
    lifecycleScene,
    {
      x: 700,
      y: 400,
      actorLink: false,
      disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
    },
    sessionId,
    "shift-demon",
    {
      summonType: "warlock-demon",
      casterActorUuid: shiftActor.uuid,
      demonKey: "sayaad",
      duration: "shift",
    },
  );
  const otherCasterTotemToken = await createFixtureToken(
    cleansingTotemTemplate,
    lifecycleScene,
    {
      x: 1000,
      y: 400,
      actorLink: false,
      disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
    },
    sessionId,
    "other-caster-control",
    {
      summonType: "elementalTotem",
      casterActorUuid: "Actor.BoaOtherPlayerTestCaster",
      duration: "stretch",
    },
  );
  const sufferingActorToken = await createFixtureToken(
    sufferingActor,
    scene,
    {
      x: 400,
      y: 800,
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
    },
    sessionId,
    "suffering-caster-token",
  );
  const sufferingVoidwalkerToken = await createFixtureToken(
    voidwalkerTemplate,
    scene,
    {
      x: 700,
      y: 800,
      actorLink: false,
      disposition: CONST.TOKEN_DISPOSITIONS?.FRIENDLY ?? 1,
    },
    sessionId,
    "suffering-voidwalker-token",
    {
      summonType: "warlock-demon",
      casterActorUuid: sufferingActor.uuid,
      demonKey: "voidwalker",
      duration: "shift",
    },
  );
  const playerMacro = await Macro.create(
    markFixture({
      name: `[BOA TEST] Run Player Tests ${suffix}`,
      type: "script",
      scope: "global",
      command: playerTemplate.command,
      img: playerTemplate.img,
      ownership: {
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
        [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      },
    }, sessionId, "player-macro"),
  );
  if (!playerMacro) {
    throw new Error("The temporary player-test Macro could not be created.");
  }
  created.macros.push(playerMacro);

  await game.settings.set(
    BOA_TEST_MODULE_ID,
    "elementalTotemAutomation",
    true,
  );
  await game.settings.set(
    BOA_TEST_MODULE_ID,
    "demonAutomation",
    true,
  );
  await game.settings.set(
    BOA_TEST_MODULE_ID,
    "demonHunterInitiationAutomation",
    true,
  );

  const session = {
    schemaVersion: sessionSchemaVersion,
    sessionId,
    actorId: actor.id,
    actorUuid: actor.uuid,
    shiftActorId: shiftActor.id,
    shiftActorUuid: shiftActor.uuid,
    sufferingActorId: sufferingActor.id,
    sufferingActorUuid: sufferingActor.uuid,
    summonActorId: summonActor.id,
    summonActorUuid: summonActor.uuid,
    summonCasterTokenId: summonCasterToken.id,
    sceneId: scene.id,
    lifecycleSceneId: lifecycleScene.id,
    tokenId: token.id,
    impActorId: imp.id,
    sayaadActorId: sayaad.id,
    impTargetTokenId: impTargetToken.id,
    sayaadTargetTokenId: sayaadTargetToken.id,
    stretchTotemTokenId: stretchTotemToken.id,
    stretchDemonTokenId: stretchDemonToken.id,
    shiftTotemTokenId: shiftTotemToken.id,
    shiftDemonTokenId: shiftDemonToken.id,
    otherCasterTotemTokenId: otherCasterTotemToken.id,
    sufferingActorTokenId: sufferingActorToken.id,
    sufferingVoidwalkerTokenId: sufferingVoidwalkerToken.id,
    playerMacroId: playerMacro.id,
    demonHunterInitiationSourceActorId:
      shiftActor.id,
    demonHunterInitiationSourceItemId:
      demonHunterInitiationSourceItem.id,
    previousActiveSceneId,
    originalAutomationSetting,
    originalDemonAutomationSetting,
    originalDemonHunterInitiationAutomationSetting,
    requiredAbilityKeys: requiredAbilities.map(entry => entry.key),
    createdAt: new Date().toISOString(),
  };

  await user.update({
    character: actor.id,
    "hotbar.1": playerMacro.id,
    [`flags.${BOA_TEST_MODULE_ID}.${sessionFlag}`]: session,
  });
  await scene.update({
    [`flags.${BOA_TEST_MODULE_ID}.${sessionFlag}`]: session,
  });
  await lifecycleScene.update({
    [`flags.${BOA_TEST_MODULE_ID}.${sessionFlag}`]: session,
  });
  await actor.update({
    [`flags.${BOA_TEST_MODULE_ID}.${sessionFlag}`]: session,
  });
  await shiftActor.update({
    [`flags.${BOA_TEST_MODULE_ID}.${sessionFlag}`]: session,
  });
  await sufferingActor.update({
    [`flags.${BOA_TEST_MODULE_ID}.${sessionFlag}`]: session,
  });
  await summonActor.update({
    [`flags.${BOA_TEST_MODULE_ID}.${sessionFlag}`]: session,
  });

  await scene.activate();

  const gmIds = boaCollectionValues(game.users)
    .filter(candidate => candidate.isGM)
    .map(candidate => candidate.id);
  credentialMessageData = {
    content: `
      <h2>BOA Player Test Environment Ready</h2>
      <p><strong>User:</strong> ${boaHtmlEscape(user.name)}</p>
      <p><strong>Password:</strong> ${boaHtmlEscape(password)}</p>
      <p>
        Open an incognito window, log in as this user,
        and run <strong>${boaHtmlEscape(playerMacro.name)}</strong>
        from hotbar slot 1.
      </p>
      <p>
        Keep a GM client connected while the player tests run.
        Cleanup will disconnect and remove the temporary Player User.
      </p>
    `,
    whisper: gmIds,
    flags: {
      [BOA_TEST_MODULE_ID]: {
        [fixtureFlag]: {
          schemaVersion: sessionSchemaVersion,
          sessionId,
          kind: "credentials-message",
        },
        [sessionIdFlag]: sessionId,
      },
    },
  };

  boaCheckEqual(
    checks,
    "Temporary User has the Player role",
    user.role,
    CONST.USER_ROLES.PLAYER,
  );
  boaCheck(
    checks,
    "Temporary character is assigned to the Player",
    game.users.get(user.id)?.character?.id === actor.id,
    actor.uuid,
  );
  boaCheck(
    checks,
    "Player owns the temporary character",
    actor.testUserPermission(
      user,
      CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    ),
    actor.ownership,
  );
  boaCheckEqual(
    checks,
    "All required Heroic Abilities were embedded",
    requiredAbilities.every(expected =>
      boaCollectionValues(actor.items).some(item =>
        boaContentKey(item) === expected.key
        || item.name === expected.name
      )
    ),
    true,
  );
  boaCheck(
    checks,
    "Shamanic Calling granted Elemental Totem",
    Boolean(elementalTotemSpell),
    elementalTotemSpell?.uuid ?? "",
  );
  boaCheck(
    checks,
    "Player owns the Shift-rest and demon defense Actors",
    Boolean(
      shiftActor.testUserPermission(
        user,
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      )
      && imp.testUserPermission(
        user,
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      )
      && sayaad.testUserPermission(
        user,
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      )
      && sufferingActor.testUserPermission(
        user,
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      )
    ),
    {
      shiftActor: shiftActor.ownership,
      imp: imp.ownership,
      sayaad: sayaad.ownership,
      sufferingActor: sufferingActor.ownership,
    },
  );
  boaCheckEqual(
    checks,
    "Rest and demon defense Token fixtures were created",
    {
      defenseTargets: [
        impTargetToken.id,
        sayaadTargetToken.id,
      ].filter(Boolean).length,
      stretchFixtures: [
        stretchTotemToken.id,
        stretchDemonToken.id,
      ].filter(Boolean).length,
      shiftFixtures: [
        shiftTotemToken.id,
        shiftDemonToken.id,
      ].filter(Boolean).length,
      controls: [
        otherCasterTotemToken.id,
      ].filter(Boolean).length,
      sufferingFixtures: [
        sufferingActorToken.id,
        sufferingVoidwalkerToken.id,
      ].filter(Boolean).length,
    },
    {
      defenseTargets: 2,
      stretchFixtures: 2,
      shiftFixtures: 2,
      controls: 1,
      sufferingFixtures: 2,
    },
  );
  boaCheck(
    checks,
    "Player-test Macro is assigned to hotbar slot 1",
    game.users.get(user.id)?.hotbar?.["1"] === playerMacro.id,
    playerMacro.id,
  );
  boaCheckEqual(
    checks,
    "Elemental Totem automation is enabled for player tests",
    game.settings.get(
      BOA_TEST_MODULE_ID,
      "elementalTotemAutomation",
    ),
    true,
  );
  boaCheckEqual(
    checks,
    "Warlock demon automation is enabled for player tests",
    game.settings.get(
      BOA_TEST_MODULE_ID,
      "demonAutomation",
    ),
    true,
  );

  boaCheckEqual(
    checks,
    "Demon Hunter Initiation automation is enabled for player tests",
    game.settings.get(
      BOA_TEST_MODULE_ID,
      "demonHunterInitiationAutomation",
    ),
    true,
  );
  notes.push(`Session: ${sessionId}`);
  notes.push(
    "The password was shown only in the GM-whispered credentials message.",
  );
  notes.push(
    "Run BOA DEV – Cleanup Player Tests when the player tests are complete.",
  );
} catch (error) {
  boaCheck(
    checks,
    "Player-test preparation completed",
    false,
    error.stack ?? error.message,
  );

  try {
    await game.settings.set(
      BOA_TEST_MODULE_ID,
      "elementalTotemAutomation",
      originalAutomationSetting,
    );
  } catch (settingError) {
    notes.push(
      `Could not restore Elemental Totem automation: ${settingError.message}`,
    );
  }

  try {
    await game.settings.set(
      BOA_TEST_MODULE_ID,
      "demonAutomation",
      originalDemonAutomationSetting,
    );
  } catch (settingError) {
    notes.push(
      `Could not restore Warlock demon automation: ${settingError.message}`,
    );
  }

  try {
    await game.settings.set(
      BOA_TEST_MODULE_ID,
      "demonHunterInitiationAutomation",
      originalDemonHunterInitiationAutomationSetting,
    );
  } catch (settingError) {
    notes.push(
      `Could not restore Demon Hunter Initiation automation: ${settingError.message}`,
    );
  }
  try {
    if (previousActiveSceneId) {
      await game.scenes.get(previousActiveSceneId)?.activate();
    }
  } catch (sceneError) {
    notes.push(
      `Could not restore the previous Scene: ${sceneError.message}`,
    );
  }

  try {
    await rollback();
  } catch (rollbackError) {
    notes.push(
      `Preparation rollback was incomplete: ${rollbackError.message}`,
    );
  }
}

const prepareResult = boaBuildResult(
  testKey,
  testName,
  checks,
  notes,
);
const reportRecipients = boaCollectionValues(game.users)
  .filter(candidate => candidate.isGM)
  .map(candidate => candidate.id);

await ChatMessage.create({
  content: boaResultHtml(prepareResult),
  whisper: reportRecipients,
  flags: {
    [BOA_TEST_MODULE_ID]: {
      [fixtureFlag]: {
        schemaVersion: sessionSchemaVersion,
        sessionId,
        kind: "prepare-report",
      },
      [sessionIdFlag]: sessionId,
      [stageResultFlag]: {
        schemaVersion: sessionSchemaVersion,
        sessionId,
        stage: "prepare",
        result: prepareResult,
      },
    },
  },
});

if (prepareResult.passed && credentialMessageData) {
  await ChatMessage.create(credentialMessageData);
}

return boaFinish(
  testKey,
  testName,
  checks,
  notes,
  {
    createChatMessage: false,
  },
);
