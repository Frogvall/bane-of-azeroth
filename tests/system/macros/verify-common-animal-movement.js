const checks = [];
const notes = [];
const createdTokenIds = [];

const testKey =
  "common-animal-movement";
const testName =
  "BOA DEV – Verify Common Animal Movement";

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Common Animal movement verification is run by a game master",
    false,
    "The test creates and deletes temporary unlinked Tokens."
  );

  return boaFinish(
    testKey,
    testName,
    checks,
    notes
  );
}

const scene =
  canvas?.scene ??
  game.scenes?.active ??
  null;
const defaultAction =
  CONFIG.Token?.movement
    ?.defaultAction ??
  "walk";
const movementActions =
  CONFIG.Token?.movement
    ?.actions ??
  {};

boaCheck(
  checks,
  "An active Scene is available",
  Boolean(scene),
  "Open a Scene before running the test."
);
boaCheck(
  checks,
  "Foundry provides the fly movement action",
  Boolean(movementActions.fly),
  Object.keys(movementActions).join(", ")
);
boaCheck(
  checks,
  "Foundry provides the swim movement action",
  Boolean(movementActions.swim),
  Object.keys(movementActions).join(", ")
);
boaCheck(
  checks,
  "Foundry provides a default movement action",
  Boolean(defaultAction),
  String(defaultAction)
);

if (!scene) {
  return boaFinish(
    testKey,
    testName,
    checks,
    notes
  );
}

const dragonhawk = boaFindWorldActor(
  "actors.common-animals.dragonhawk"
);
const crocolisk = boaFindWorldActor(
  "actors.common-animals.crocolisk"
);
const gorilla = boaFindWorldActor(
  "actors.common-animals.gorilla"
);

for (const [
  name,
  actor,
  contentKey,
] of [
  [
    "Dragonhawk",
    dragonhawk,
    "actors.common-animals.dragonhawk",
  ],
  [
    "Crocolisk",
    crocolisk,
    "actors.common-animals.crocolisk",
  ],
  [
    "Gorilla",
    gorilla,
    "actors.common-animals.gorilla",
  ],
]) {
  boaCheck(
    checks,
    `${name} is imported`,
    Boolean(actor),
    contentKey
  );
}

if (
  !dragonhawk ||
  !crocolisk ||
  !gorilla
) {
  return boaFinish(
    testKey,
    testName,
    checks,
    notes
  );
}

boaCheckEqual(
  checks,
  "Dragonhawk has machine-readable movement rates",
  boaGetFlag(
    dragonhawk,
    "movementRates"
  ),
  {
    base: 2,
    fly: 14,
  }
);
boaCheckEqual(
  checks,
  "Crocolisk has machine-readable movement rates",
  boaGetFlag(
    crocolisk,
    "movementRates"
  ),
  {
    base: 6,
    swim: 12,
  }
);
boaCheckEqual(
  checks,
  "Gorilla has only its base movement rate",
  boaGetFlag(
    gorilla,
    "movementRates"
  ),
  {
    base: 8,
  }
);

function tokenDataFor(
  actor,
  label,
  x,
  y
) {
  const data =
    actor.prototypeToken.toObject();

  delete data._id;

  data.actorId = actor.id;
  data.actorLink = false;
  data.name =
    `BOA Test – ${label}`;
  data.x = x;
  data.y = y;
  data.hidden = true;
  data.movementAction =
    defaultAction;
  data.flags ??= {};
  data.flags[
    BOA_TEST_MODULE_ID
  ] = {
    ...(
      data.flags[
        BOA_TEST_MODULE_ID
      ] ?? {}
    ),
    [BOA_TEST_FIXTURE_FLAG]:
      true,
  };

  return data;
}

async function createTestToken(
  actor,
  label,
  x,
  y
) {
  const [token] =
    await scene.createEmbeddedDocuments(
      "Token",
      [
        tokenDataFor(
          actor,
          label,
          x,
          y
        ),
      ],
      {
        render: false,
      }
    );

  if (token?.id) {
    createdTokenIds.push(
      token.id
    );
  }

  return token;
}

function movementValue(token) {
  return Number(
    token?.actor?.system
      ?.movement?.value
  );
}

async function expectMovement({
  token,
  action,
  expected,
  description,
}) {
  await token.update({
    movementAction: action,
  });

  let reached = false;

  try {
    await boaWaitFor(
      () =>
        movementValue(token) ===
        expected,
      {
        timeout: 1200,
        interval: 40,
        description:
          `${description}: ${expected}`,
      }
    );
    reached = true;
  } catch {
    reached = false;
  }

  boaCheck(
    checks,
    description,
    reached,
    (
      `Action: ${action}; ` +
      `Expected movement: ${expected}; ` +
      `Actual movement: ${
        movementValue(token)
      }`
    )
  );
  boaCheckEqual(
    checks,
    `${description} stores the selected movement action`,
    token.movementAction,
    action
  );
}

async function deleteCreatedTokens() {
  const ids = Array.from(
    new Set(createdTokenIds)
  ).filter(id =>
    scene.tokens.get(id)
  );

  if (ids.length === 0) {
    return;
  }

  await scene.deleteEmbeddedDocuments(
    "Token",
    ids
  );
}

const worldMovementBefore = {
  dragonhawk:
    Number(
      dragonhawk.system
        .movement.value
    ),
  crocolisk:
    Number(
      crocolisk.system
        .movement.value
    ),
  gorilla:
    Number(
      gorilla.system
        .movement.value
    ),
};

try {
  const [
    dragonhawkFlyer,
    dragonhawkWalker,
    crocoliskSwimmer,
    gorillaControl,
  ] = await Promise.all([
    createTestToken(
      dragonhawk,
      "Dragonhawk Flyer",
      0,
      0
    ),
    createTestToken(
      dragonhawk,
      "Dragonhawk Walker",
      100,
      0
    ),
    createTestToken(
      crocolisk,
      "Crocolisk Swimmer",
      200,
      0
    ),
    createTestToken(
      gorilla,
      "Gorilla Control",
      300,
      0
    ),
  ]);

  for (const [
    label,
    token,
  ] of [
    [
      "Dragonhawk Flyer",
      dragonhawkFlyer,
    ],
    [
      "Dragonhawk Walker",
      dragonhawkWalker,
    ],
    [
      "Crocolisk Swimmer",
      crocoliskSwimmer,
    ],
    [
      "Gorilla Control",
      gorillaControl,
    ],
  ]) {
    boaCheck(
      checks,
      `${label} Token was created`,
      Boolean(token),
      label
    );
    boaCheckEqual(
      checks,
      `${label} is unlinked`,
      token?.actorLink,
      false
    );
  }

  boaCheckEqual(
    checks,
    "Dragonhawk Flyer starts at base movement 2",
    movementValue(
      dragonhawkFlyer
    ),
    2
  );
  boaCheckEqual(
    checks,
    "Dragonhawk Walker starts at base movement 2",
    movementValue(
      dragonhawkWalker
    ),
    2
  );
  boaCheckEqual(
    checks,
    "Crocolisk starts at base movement 6",
    movementValue(
      crocoliskSwimmer
    ),
    6
  );
  boaCheckEqual(
    checks,
    "Gorilla starts at base movement 8",
    movementValue(
      gorillaControl
    ),
    8
  );

  await expectMovement({
    token: dragonhawkFlyer,
    action: "fly",
    expected: 14,
    description:
      "Selecting fly gives the Dragonhawk movement 14",
  });

  boaCheckEqual(
    checks,
    "A second Dragonhawk Token remains at base movement",
    movementValue(
      dragonhawkWalker
    ),
    2
  );
  boaCheckEqual(
    checks,
    "The Dragonhawk world Actor remains at base movement",
    Number(
      dragonhawk.system
        .movement.value
    ),
    worldMovementBefore
      .dragonhawk
  );

  await expectMovement({
    token: dragonhawkFlyer,
    action: defaultAction,
    expected: 2,
    description:
      "Returning to normal movement restores Dragonhawk movement 2",
  });

  await expectMovement({
    token: crocoliskSwimmer,
    action: "swim",
    expected: 12,
    description:
      "Selecting swim gives the Crocolisk movement 12",
  });

  boaCheckEqual(
    checks,
    "The Crocolisk world Actor remains at base movement",
    Number(
      crocolisk.system
        .movement.value
    ),
    worldMovementBefore
      .crocolisk
  );

  await expectMovement({
    token: crocoliskSwimmer,
    action: defaultAction,
    expected: 6,
    description:
      "Returning to normal movement restores Crocolisk movement 6",
  });

  await expectMovement({
    token: crocoliskSwimmer,
    action: "fly",
    expected: 6,
    description:
      "An unsupported Crocolisk movement action uses base movement 6",
  });

  await expectMovement({
    token: gorillaControl,
    action: "swim",
    expected: 8,
    description:
      "An Actor without alternate movement remains at base movement",
  });

  boaCheckEqual(
    checks,
    "The Gorilla world Actor remains at base movement",
    Number(
      gorilla.system
        .movement.value
    ),
    worldMovementBefore
      .gorilla
  );

  boaCheck(
    checks,
    "Two Tokens from the same Actor can retain different movement states",
    (
      dragonhawkFlyer.actor !==
        dragonhawkWalker.actor &&
      dragonhawkFlyer.actor !==
        dragonhawk &&
      dragonhawkWalker.actor !==
        dragonhawk
    ),
    (
      `Flyer Actor: ${
        dragonhawkFlyer.actor?.uuid
      }; Walker Actor: ${
        dragonhawkWalker.actor?.uuid
      }; World Actor: ${
        dragonhawk.uuid
      }`
    )
  );
} catch (error) {
  boaCheck(
    checks,
    "Common Animal movement scenarios complete",
    false,
    error.stack ?? error.message
  );
} finally {
  try {
    await deleteCreatedTokens();

    boaCheck(
      checks,
      "Temporary Common Animal Tokens were removed",
      createdTokenIds.every(
        id => !scene.tokens.get(id)
      ),
      createdTokenIds.join(", ")
    );
  } catch (error) {
    boaCheck(
      checks,
      "Temporary Common Animal Tokens were removed",
      false,
      error.stack ?? error.message
    );
  }
}

notes.push(
  "The Macro changes TokenDocument.movementAction on real " +
  "unlinked Tokens and observes each synthetic Actor's " +
  "system.movement.value."
);
notes.push(
  "Dragonbane's Token ruler reads that movement value when " +
  "classifying normal movement, dash movement, and " +
  "out-of-range movement."
);
notes.push(
  "The imported world Actors must remain unchanged; only each " +
  "Token's ActorDelta may store the selected movement rate."
);

return boaFinish(
  testKey,
  testName,
  checks,
  notes
);
