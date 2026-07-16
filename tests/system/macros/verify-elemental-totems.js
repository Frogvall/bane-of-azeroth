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

    boaCheck(
      checks,
      `${definition.name} has prototype aura range`,
      Number(
        boaGetFlag(
          actor.prototypeToken,
          "auraRange"
        )
      ) === Number(defaults.auraRange),
      String(
        boaGetFlag(
          actor.prototypeToken,
          "auraRange"
        )
      )
    );

    boaCheck(
      checks,
      `${definition.name} has prototype aura color`,
      boaGetFlag(
        actor.prototypeToken,
        "auraColor"
      ) === definition.auraColor,
      String(
        boaGetFlag(
          actor.prototypeToken,
          "auraColor"
        )
      )
    );

    const expectedAlpha =
      definition.auraAlpha ??
      defaults.auraAlpha;

    boaCheck(
      checks,
      `${definition.name} has prototype aura alpha`,
      Number(
        boaGetFlag(
          actor.prototypeToken,
          "auraAlpha"
        )
      ) === Number(expectedAlpha),
      String(
        boaGetFlag(
          actor.prototypeToken,
          "auraAlpha"
        )
      )
    );
  }

  const summoned = [];

  for (const scene of boaCollectionValues(game.scenes)) {
    for (const token of boaCollectionValues(scene.tokens)) {
      if (
        boaGetFlag(token, "summonType") ===
        "elementalTotem"
      ) {
        summoned.push({
          scene,
          token,
        });
      }
    }
  }

  if (summoned.length === 0) {
    boaSkip(
      checks,
      "Summoned-token runtime checks",
      "No summoned Elemental Totems exist in any scene."
    );
  }

  for (const { scene, token } of summoned) {
    const type = boaGetFlag(token, "totemType");
    const actor = token.actor;

    boaCheck(
      checks,
      `Summoned token has a known type: ${token.name}`,
      allowedKeys.has(type),
      `${scene.name}: ${type}`
    );

    boaCheck(
      checks,
      `Summoned token records its caster: ${token.name}`,
      typeof boaGetFlag(
        token,
        "casterActorUuid"
      ) === "string" &&
      boaGetFlag(
        token,
        "casterActorUuid"
      ).length > 0
    );

    boaCheck(
      checks,
      `Summoned token records its cast ID: ${token.name}`,
      typeof boaGetFlag(token, "castId") ===
        "string" &&
      boaGetFlag(token, "castId").length > 0
    );

    boaCheck(
      checks,
      `Summoned token has valid aura data: ${token.name}`,
      Number(boaGetFlag(token, "auraRange")) > 0 &&
      typeof boaGetFlag(token, "auraColor") ===
        "string" &&
      Number(boaGetFlag(token, "auraAlpha")) > 0
    );

    boaCheck(
      checks,
      `Summoned Actor is readable by players: ${token.name}`,
      actor?.ownership?.default ===
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
      String(actor?.ownership?.default)
    );

    boaCheck(
      checks,
      `Summoned Actor has positive HP: ${token.name}`,
      Number(actor?.system?.hitPoints?.value) > 0 &&
      Number(actor?.system?.hitPoints?.max) > 0,
      `${actor?.system?.hitPoints?.value}/` +
      `${actor?.system?.hitPoints?.max}`
    );

    const armor = boaCollectionValues(actor?.items)
      .find(item => item.type === "armor");

    boaCheck(
      checks,
      `Summoned Actor has positive armor: ${token.name}`,
      Number(armor?.system?.rating) > 0,
      String(armor?.system?.rating)
    );
  }

  notes.push(
    `${summoned.length} summoned totem token(s) inspected.`
  );
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
