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

  boaCheckEqual(
    checks,
    "Six spell-grant relationships are defined",
    grantingAbilities.length,
    6
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

  boaCheckEqual(
    checks,
    "Generated spell count matches source",
    spells.length,
    spellContent.expectedCount
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

  boaCheckEqual(
    checks,
    "Elemental Totem count matches source",
    totems.length,
    totemContent.expectedCount
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

    boaCheckEqual(
      checks,
      `${definition.name} is an NPC`,
      actor.type,
      "npc"
    );

    boaCheckEqual(
      checks,
      `${definition.name} uses its portrait`,
      actor.img,
      definition.image
    );

    boaCheckEqual(
      checks,
      `${definition.name} uses its token image`,
      actor.prototypeToken?.texture?.src,
      definition.tokenImage
    );

    boaCheckEqual(
      checks,
      `${definition.name} has movement 0`,
      Number(actor.system?.movement?.value),
      Number(defaults.movement)
    );

    const hp = actor.system?.hitPoints;

    boaCheckEqual(
      checks,
      `${definition.name} has base HP`,
      {
        value: Number(hp?.value),
        max: Number(hp?.max),
      },
      {
        value: Number(defaults.hitPoints),
        max: Number(defaults.hitPoints),
      }
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
      boaCheckEqual(
        checks,
        `${definition.name} has armor rating 2`,
        Number(armor.system?.rating),
        Number(defaults.armorRating)
      );
    }

    boaCheck(
      checks,
      `${definition.name} uses once-per-round text`,
      String(actor.system?.traits ?? "")
        .toLowerCase()
        .includes("once per round")
    );

    boaCheckEqual(
      checks,
      `${definition.name} has matching aura color`,
      boaGetFlag(actor, "auraColor"),
      definition.auraColor
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

// BOA Great Helm + Firearms compatibility RED/GREEN contract.
{
  let greatHelmProbe =
    null;

  try {
    greatHelmProbe =
      await Item.create(
        {
          name:
            "Great Helm",
          type:
            "helmet",
          img:
            "icons/svg/helmet.svg",
          system: {
            weight:
              1,
            quantity:
              1,
            cost:
              "100 gold",
            supply:
              "rare",
            worn:
              false,
            memento:
              false,
            boons:
              "",
            banes:
              "Awareness, Bows, Crossbows, Slings",
            rating:
              2,
            gmDescription:
              "",
            itemDescription:
              "<p>Bane on all ranged attacks</p>",
            storage:
              false,
          },
        },
        {
          renderSheet:
            false,
        },
      );

    const startedAt =
      Date.now();

    while (
      !String(
        greatHelmProbe
          ?.system
          ?.banes ??
          "",
      )
        .split(",")
        .map(
          value =>
            value.trim(),
        )
        .includes(
          "Firearms",
        ) &&
      Date.now() -
        startedAt <
        1500
    ) {
      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            25,
          ),
      );
    }

    const banes =
      String(
        greatHelmProbe
          ?.system
          ?.banes ??
          "",
      )
        .split(",")
        .map(
          value =>
            value.trim(),
        )
        .filter(Boolean);

    boaCheck(
      checks,
      "Great Helm Details includes Firearms as a Bane",
      banes.includes(
        "Firearms",
      ),
      banes.join(
        ", ",
      ),
    );
  } finally {
    if (
      greatHelmProbe
        ?.id
    ) {
      await greatHelmProbe.delete();
    }
  }
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
