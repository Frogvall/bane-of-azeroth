const checks = [];
const notes = [];

try {
  const content = await boaFetchJson(
    "content/elemental-totems.json"
  );
  const definitions = content.totems ?? [];
  const defaults = content.defaults ?? {};
  const allowedKeys = new Set(
    definitions.map(definition => definition.key)
  );

  for (const definition of definitions) {
    const actor = boaFindWorldActor(
      `actors.elemental-totems.${definition.key}`
    );

    if (!boaCheck(
      checks,
      `Template exists: ${definition.name}`,
      Boolean(actor)
    )) {
      continue;
    }

    boaCheckEqual(
      checks,
      `${definition.name} has prototype aura range`,
      Number(
        boaGetFlag(
          actor.prototypeToken,
          "auraRange"
        )
      ),
      Number(defaults.auraRange)
    );

    boaCheckEqual(
      checks,
      `${definition.name} has prototype aura color`,
      boaGetFlag(
        actor.prototypeToken,
        "auraColor"
      ),
      definition.auraColor
    );

    const expectedAlpha =
      definition.auraAlpha ??
      defaults.auraAlpha;

    boaCheckEqual(
      checks,
      `${definition.name} has prototype aura alpha`,
      Number(
        boaGetFlag(
          actor.prototypeToken,
          "auraAlpha"
        )
      ),
      Number(expectedAlpha)
    );
  }

  let fixtureScene = null;

  try {
    fixtureScene = await Scene.create({
      name:
        `[BOA TEST] Elemental Totem Runtime ` +
        foundry.utils.randomID(6),
      active: false,
      navigation: false,
      width: 2000,
      height: 1200,
      padding: 0,
      grid: {
        type: CONST.GRID_TYPES?.SQUARE ?? 1,
        size: 100,
        distance: 2,
        units: "m",
      },
      flags: {
        [BOA_TEST_MODULE_ID]: {
          [BOA_TEST_FIXTURE_FLAG]: true,
        },
      },
    }, {
      renderSheet: false,
    });

    boaCheck(
      checks,
      "Temporary Elemental Totem test Scene was created",
      Boolean(fixtureScene?.id),
      fixtureScene?.uuid ?? ""
    );

    const castId = foundry.utils.randomID();
    const casterActorUuid =
      "Actor.BoaTestCaster";
    const tokenData = [];

    for (
      let index = 0;
      index < definitions.length;
      index += 1
    ) {
      const definition = definitions[index];
      const actorTemplate = boaFindWorldActor(
        `actors.elemental-totems.${definition.key}`
      );

      if (!actorTemplate) {
        throw new Error(
          `Missing Elemental Totem Actor template: ` +
          definition.name
        );
      }

      const tokenDocument =
        await actorTemplate.getTokenDocument(
          {
            x: 200 + (index * 300),
            y: 300,
            actorLink: false,
          },
          {
            parent: fixtureScene,
          }
        );

      const data = tokenDocument.toObject();

      delete data._id;

      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.summonType`,
        "elementalTotem"
      );
      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.casterActorUuid`,
        casterActorUuid
      );
      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.sourceSpell`,
        "spells.elemental-totem"
      );
      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.sourceMessageId`,
        "BoaTestMessage01"
      );
      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.castId`,
        castId
      );
      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.instanceId`,
        foundry.utils.randomID()
      );
      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.totemType`,
        definition.key
      );
      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.auraRange`,
        defaults.auraRange
      );
      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.${BOA_TEST_FIXTURE_FLAG}`,
        true
      );

      tokenData.push(data);
    }

    const createdTokens =
      await fixtureScene.createEmbeddedDocuments(
        "Token",
        tokenData
      );

    boaCheckEqual(
      checks,
      "Four summoned-token fixtures were created",
      createdTokens.length,
      definitions.length
    );

    const tokensByType = new Map(
      createdTokens.map(token => [
        boaGetFlag(token, "totemType"),
        token,
      ])
    );

    for (const definition of definitions) {
      const token = tokensByType.get(definition.key);

      boaCheck(
        checks,
        `Summoned token exists: ${definition.name}`,
        Boolean(token),
        `Expected totemType: ${definition.key}`
      );

      if (!token) {
        continue;
      }

      const actor = token.actor;
      const expectedAlpha =
        definition.auraAlpha ??
        defaults.auraAlpha;

      boaCheck(
        checks,
        `Synthetic Actor exists: ${definition.name}`,
        Boolean(actor?.isToken),
        actor?.uuid ?? "missing"
      );

      if (!actor?.isToken) {
        continue;
      }

      await actor.update({
        "ownership.default":
          CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
        "system.hitPoints.base":
          defaults.hitPoints,
        "system.hitPoints.max":
          defaults.hitPoints,
        "system.hitPoints.value":
          defaults.hitPoints,
      });

      const armor = boaCollectionValues(actor.items)
        .find(item =>
          item.type === "armor" &&
          (
            boaContentKey(item).endsWith(".armor") ||
            item.name === "Totem Armor"
          )
        );

      if (armor) {
        await armor.update({
          "system.rating":
            defaults.armorRating,
          "system.worn": true,
        });
      }

      boaCheckEqual(
        checks,
        `Summoned type: ${definition.name}`,
        boaGetFlag(token, "totemType"),
        definition.key
      );

      boaCheckEqual(
        checks,
        `Summon flag: ${definition.name}`,
        boaGetFlag(token, "summonType"),
        "elementalTotem"
      );

      boaCheckEqual(
        checks,
        `Caster UUID: ${definition.name}`,
        boaGetFlag(token, "casterActorUuid"),
        casterActorUuid
      );

      boaCheckEqual(
        checks,
        `Cast ID: ${definition.name}`,
        boaGetFlag(token, "castId"),
        castId
      );

      boaCheck(
        checks,
        `Instance ID exists: ${definition.name}`,
        typeof boaGetFlag(token, "instanceId") ===
          "string" &&
        boaGetFlag(token, "instanceId").length > 0
      );

      boaCheckEqual(
        checks,
        `Aura range: ${definition.name}`,
        Number(boaGetFlag(token, "auraRange")),
        Number(defaults.auraRange)
      );

      boaCheckEqual(
        checks,
        `Aura color: ${definition.name}`,
        boaGetFlag(token, "auraColor"),
        definition.auraColor
      );

      boaCheckEqual(
        checks,
        `Aura alpha: ${definition.name}`,
        Number(boaGetFlag(token, "auraAlpha")),
        Number(expectedAlpha)
      );

      boaCheckEqual(
        checks,
        `Token image: ${definition.name}`,
        token.texture?.src,
        definition.tokenImage
      );

      boaCheckEqual(
        checks,
        `Token is unlinked: ${definition.name}`,
        token.actorLink,
        false
      );

      boaCheckEqual(
        checks,
        `Player ownership: ${definition.name}`,
        actor.ownership?.default,
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
      );

      boaCheckEqual(
        checks,
        `Hit points: ${definition.name}`,
        {
          base:
            Number(actor.system?.hitPoints?.base),
          max:
            Number(actor.system?.hitPoints?.max),
          value:
            Number(actor.system?.hitPoints?.value),
        },
        {
          base: Number(defaults.hitPoints),
          max: Number(defaults.hitPoints),
          value: Number(defaults.hitPoints),
        }
      );

      boaCheck(
        checks,
        `Totem Armor exists: ${definition.name}`,
        Boolean(armor)
      );

      if (armor) {
        boaCheckEqual(
          checks,
          `Armor rating: ${definition.name}`,
          Number(armor.system?.rating),
          Number(defaults.armorRating)
        );

        boaCheckEqual(
          checks,
          `Armor is worn: ${definition.name}`,
          armor.system?.worn,
          true
        );
      }
    }

    notes.push(
      `${createdTokens.length} temporary summoned ` +
      "Elemental Totem token(s) were created and inspected."
    );
  } finally {
    if (fixtureScene) {
      try {
        const sceneName = fixtureScene.name;

        await fixtureScene.delete();

        boaCheck(
          checks,
          "Temporary Elemental Totem test Scene was deleted",
          !game.scenes.has(fixtureScene.id),
          sceneName
        );
      } catch (cleanupError) {
        boaCheck(
          checks,
          "Temporary Elemental Totem test Scene was deleted",
          false,
          cleanupError.stack ??
            cleanupError.message
        );
      }
    }
  }
} catch (error) {
  boaCheck(
    checks,
    "Elemental Totem system verification completed",
    false,
    error.stack ?? error.message
  );
}

return boaFinish(
  "elemental-totems",
  "BOA DEV – Verify Elemental Totems",
  checks,
  notes
);
