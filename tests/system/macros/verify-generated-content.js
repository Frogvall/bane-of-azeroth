const checks = [];
const notes = [];

try {
  const [
    abilityContent,
    spellContent,
    totemContent,
  ] = await Promise.all([
    boaFetchJson(
      "content/heroic-class-abilities.json"
    ),
    boaFetchJson("content/spells.json"),
    boaFetchJson("content/elemental-totems.json"),
  ]);

  const grantingAbilities = [];

  for (const classEntry of abilityContent.classes ?? []) {
    for (const ability of classEntry.abilities ?? []) {
      if (!ability.grantsSpell) continue;

      grantingAbilities.push({
        abilityKey:
          `heroic-class-ability.${classEntry.key}.` +
          ability.key,
        abilityName: ability.name,
        spellKey: `spells.${ability.grantsSpell}`,
      });
    }
  }

  boaCheck(
    checks,
    "Six spell-grant relationships are defined",
    grantingAbilities.length === 6,
    String(grantingAbilities.length)
  );

  for (const entry of grantingAbilities) {
    boaCheck(
      checks,
      `World ability exists: ${entry.abilityName}`,
      Boolean(
        boaFindWorldItem(
          entry.abilityKey,
          "ability"
        )
      ),
      entry.abilityKey
    );

    boaCheck(
      checks,
      `Granted world spell exists: ${entry.spellKey}`,
      Boolean(
        boaFindWorldItem(
          entry.spellKey,
          "spell"
        )
      ),
      entry.spellKey
    );
  }

  const spells = spellContent.spells ?? [];

  boaCheck(
    checks,
    "Generated spell count matches source",
    spells.length === spellContent.expectedCount,
    `${spells.length}/${spellContent.expectedCount}`
  );

  for (const definition of spells) {
    boaCheck(
      checks,
      `World spell exists: ${definition.name}`,
      Boolean(
        boaFindWorldItem(
          `spells.${definition.key}`,
          "spell"
        )
      )
    );
  }

  const defaults = totemContent.defaults ?? {};
  const totems = totemContent.totems ?? [];

  boaCheck(
    checks,
    "Elemental Totem count matches source",
    totems.length === totemContent.expectedCount,
    `${totems.length}/${totemContent.expectedCount}`
  );

  for (const definition of totems) {
    const contentKey =
      `actors.elemental-totems.${definition.key}`;
    const actor = boaFindWorldActor(contentKey);

    if (!boaCheck(
      checks,
      `Totem Actor exists: ${definition.name}`,
      Boolean(actor),
      contentKey
    )) {
      continue;
    }

    boaCheck(
      checks,
      `${definition.name} is an NPC`,
      actor.type === "npc",
      actor.type
    );

    boaCheck(
      checks,
      `${definition.name} uses its portrait`,
      actor.img === definition.image,
      actor.img
    );

    boaCheck(
      checks,
      `${definition.name} uses its token image`,
      actor.prototypeToken?.texture?.src ===
        definition.tokenImage,
      actor.prototypeToken?.texture?.src ?? ""
    );

    boaCheck(
      checks,
      `${definition.name} has movement 0`,
      Number(actor.system?.movement?.value) ===
        Number(defaults.movement),
      String(actor.system?.movement?.value)
    );

    const hp = actor.system?.hitPoints;

    boaCheck(
      checks,
      `${definition.name} has base HP`,
      Number(hp?.value) ===
        Number(defaults.hitPoints) &&
      Number(hp?.max) ===
        Number(defaults.hitPoints),
      `${hp?.value}/${hp?.max}`
    );

    boaCheck(
      checks,
      `${definition.name} prototype is unlinked`,
      actor.prototypeToken?.actorLink === false
    );

    boaCheck(
      checks,
      `${definition.name} prototype has correct size`,
      Number(actor.prototypeToken?.width) ===
        Number(defaults.tokenWidth) &&
      Number(actor.prototypeToken?.height) ===
        Number(defaults.tokenHeight),
      `${actor.prototypeToken?.width} x ` +
      `${actor.prototypeToken?.height}`
    );

    const armor = boaCollectionValues(actor.items)
      .find(item => item.type === "armor");

    boaCheck(
      checks,
      `${definition.name} has Totem Armor`,
      Boolean(armor)
    );

    if (armor) {
      boaCheck(
        checks,
        `${definition.name} has armor rating 2`,
        Number(armor.system?.rating) ===
          Number(defaults.armorRating),
        String(armor.system?.rating)
      );
    }

    boaCheck(
      checks,
      `${definition.name} uses once-per-round text`,
      String(actor.system?.traits ?? "")
        .toLowerCase()
        .includes("once per round")
    );

    boaCheck(
      checks,
      `${definition.name} has matching aura color`,
      boaGetFlag(actor, "auraColor") ===
        definition.auraColor,
      String(boaGetFlag(actor, "auraColor"))
    );

    boaCheck(
      checks,
      `${definition.name} prototype has aura flags`,
      boaGetFlag(
        actor.prototypeToken,
        "summonType"
      ) === "elementalTotem" &&
      boaGetFlag(
        actor.prototypeToken,
        "totemType"
      ) === definition.key
    );
  }
} catch (error) {
  boaCheck(
    checks,
    "Generated-content verification completed",
    false,
    error.stack ?? error.message
  );
}

return boaFinish(
  "generated-content",
  "BOA DEV – Verify Generated Content",
  checks,
  notes
);
