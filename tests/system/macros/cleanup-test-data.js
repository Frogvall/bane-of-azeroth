const checks = [];
const notes = [];

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Macro is run by a game master",
    false,
    "Cleanup modifies world documents."
  );

  return boaFinish(
    "cleanup",
    "BOA DEV – Cleanup Test Data",
    checks,
    notes
  );
}

let deletedScenes = 0;
let deletedTokens = 0;
let deletedActors = 0;
let deletedItems = 0;

try {
  const fixtureScenes =
    boaCollectionValues(game.scenes)
      .filter(
        scene =>
          boaGetFlag(
            scene,
            BOA_TEST_FIXTURE_FLAG
          ) === true
      );

  for (const scene of fixtureScenes) {
    await scene.delete();
    deletedScenes += 1;
  }

  for (const scene of boaCollectionValues(game.scenes)) {
    const tokenIds = boaCollectionValues(scene.tokens)
      .filter(
        token =>
          boaGetFlag(
            token,
            BOA_TEST_FIXTURE_FLAG
          ) === true
      )
      .map(token => token.id);

    if (tokenIds.length > 0) {
      await scene.deleteEmbeddedDocuments(
        "Token",
        tokenIds
      );
      deletedTokens += tokenIds.length;
    }
  }

  const actors = boaCollectionValues(game.actors)
    .filter(
      actor =>
        boaGetFlag(
          actor,
          BOA_TEST_FIXTURE_FLAG
        ) === true
    );

  for (const actor of actors) {
    await actor.delete();
    deletedActors += 1;
  }

  const items = boaCollectionValues(game.items)
    .filter(
      item =>
        boaGetFlag(
          item,
          BOA_TEST_FIXTURE_FLAG
        ) === true
    );

  for (const item of items) {
    await item.delete();
    deletedItems += 1;
  }

  boaCheck(
    checks,
    "Flagged test fixtures were removed",
    true,
    `${deletedScenes} Scenes, ` +
    `${deletedActors} Actors, ` +
    `${deletedItems} Items, ` +
    `${deletedTokens} Tokens`
  );
} catch (error) {
  boaCheck(
    checks,
    "Flagged test fixtures were removed",
    false,
    error.stack ?? error.message
  );
}

notes.push(
  "Only documents with the explicit " +
  `${BOA_TEST_MODULE_ID}.${BOA_TEST_FIXTURE_FLAG} ` +
  "flag were eligible for deletion."
);

return boaFinish(
  "cleanup",
  "BOA DEV – Cleanup Test Data",
  checks,
  notes
);
