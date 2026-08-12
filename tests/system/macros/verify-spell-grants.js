const checks = [];
const notes = [];
let actor = null;

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Macro is run by a game master",
    false,
    "Spell-grant tests create a temporary Actor."
  );

  return boaFinish(
    "spell-grants",
    "BOA DEV – Verify Spell Grants",
    checks,
    notes
  );
}

const abilityContentKey =
  "heroic-class-ability.shaman.shamanic-calling";
const spellContentKey = "spells.elemental-totem";

try {
  const sourceAbility = boaFindWorldItem(
    abilityContentKey,
    "ability"
  );
  const sourceSpell = boaFindWorldItem(
    spellContentKey,
    "spell"
  );

  if (!boaCheck(
    checks,
    "Shamanic Calling world Item exists",
    Boolean(sourceAbility),
    abilityContentKey
  )) {
    throw new Error(
      "Import the current Adventure before running this test."
    );
  }

  if (!boaCheck(
    checks,
    "Elemental Totem world Item exists",
    Boolean(sourceSpell),
    spellContentKey
  )) {
    throw new Error(
      "Import the current Adventure before running this test."
    );
  }

  actor = await Actor.create({
    name:
      `[BOA TEST] Spell Grants ` +
      foundry.utils.randomID(6),
    type: "character",
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
    "Temporary test Actor was created",
    Boolean(actor?.id),
    actor?.uuid ?? ""
  );

  const [abilityOne] =
    await actor.createEmbeddedDocuments(
      "Item",
      [boaCloneEmbeddedItem(sourceAbility)]
    );

  const automaticSpell = await boaWaitFor(
    () => boaCollectionValues(actor.items).find(
      item =>
        item.type === "spell" &&
        boaGetFlag(item, "autoGranted") === true &&
        boaGetFlag(item, "sourceSpell") ===
          spellContentKey
    ),
    {
      description: "automatic Elemental Totem grant",
    }
  );

  boaCheck(
    checks,
    "Adding Shamanic Calling grants Elemental Totem",
    Boolean(automaticSpell)
  );

  boaCheck(
    checks,
    "Granted spell is prepared",
    automaticSpell.system?.memorized === true
  );

  boaCheck(
    checks,
    "Granted spell has automation flags",
    boaGetFlag(automaticSpell, "autoGranted") ===
      true &&
    boaGetFlag(automaticSpell, "sourceSpell") ===
      spellContentKey &&
    boaGetFlag(
      automaticSpell,
      "grantedByAbility"
    ) === abilityContentKey
  );

  await automaticSpell.update({
    "system.memorized": false,
  });

  boaCheck(
    checks,
    "Granted spell cannot be unprepared",
    automaticSpell.system?.memorized === true
  );

  const [abilityTwo] =
    await actor.createEmbeddedDocuments(
      "Item",
      [boaCloneEmbeddedItem(sourceAbility)]
    );

  await boaWaitFor(
    () =>
      boaCollectionValues(actor.items).filter(
        item =>
          item.type === "spell" &&
          (
            boaContentKey(item) ===
              spellContentKey ||
            boaGetFlag(item, "sourceSpell") ===
              spellContentKey
          )
      ).length === 1,
    {
      description: "duplicate grant protection",
    }
  );

  boaCheck(
    checks,
    "A second granting ability does not duplicate the spell",
    boaCollectionValues(actor.items).filter(
      item =>
        item.type === "spell" &&
        (
          boaContentKey(item) === spellContentKey ||
          boaGetFlag(item, "sourceSpell") ===
            spellContentKey
        )
    ).length === 1
  );

  await actor.deleteEmbeddedDocuments(
    "Item",
    [abilityOne.id]
  );

  await new Promise(resolve => setTimeout(resolve, 150));

  boaCheck(
    checks,
    "Spell remains while another granting ability exists",
    boaCollectionValues(actor.items).some(
      item =>
        item.type === "spell" &&
        boaGetFlag(item, "sourceSpell") ===
          spellContentKey
    )
  );

  await actor.deleteEmbeddedDocuments(
    "Item",
    [abilityTwo.id]
  );

  await boaWaitFor(
    () =>
      !boaCollectionValues(actor.items).some(
        item =>
          item.type === "spell" &&
          boaGetFlag(item, "autoGranted") === true &&
          boaGetFlag(item, "sourceSpell") ===
            spellContentKey
      ),
    {
      description:
        "automatic spell removal after final ability",
    }
  );

  boaCheck(
    checks,
    "Removing the final ability removes the automatic spell",
    true
  );

  const [manualSpell] =
    await actor.createEmbeddedDocuments(
      "Item",
      [boaCloneEmbeddedItem(sourceSpell)]
    );

  const [manualPhaseAbility] =
    await actor.createEmbeddedDocuments(
      "Item",
      [boaCloneEmbeddedItem(sourceAbility)]
    );

  await new Promise(resolve => setTimeout(resolve, 200));

  const matchingSpells =
    boaCollectionValues(actor.items).filter(
      item =>
        item.type === "spell" &&
        (
          boaContentKey(item) === spellContentKey ||
          boaGetFlag(item, "sourceSpell") ===
            spellContentKey
        )
    );

  boaCheck(
    checks,
    "A manual spell prevents an automatic duplicate",
    matchingSpells.length === 1 &&
      matchingSpells[0].id === manualSpell.id,
    String(matchingSpells.length)
  );

  await actor.deleteEmbeddedDocuments(
    "Item",
    [manualPhaseAbility.id]
  );

  await new Promise(resolve => setTimeout(resolve, 200));

  boaCheck(
    checks,
    "Manual spell remains after ability removal",
    actor.items.has(manualSpell.id) &&
      boaGetFlag(manualSpell, "autoGranted") !== true
  );
} catch (error) {
  boaCheck(
    checks,
    "Spell-grant workflow completed",
    false,
    error.stack ?? error.message
  );
} finally {
  if (actor) {
    try {
      await actor.delete();
      notes.push(
        "Temporary spell-grant test Actor was deleted."
      );
    } catch (error) {
      boaCheck(
        checks,
        "Temporary Actor cleanup succeeded",
        false,
        error.message
      );
    }
  }
}

return boaFinish(
  "spell-grants",
  "BOA DEV – Verify Spell Grants",
  checks,
  notes
);
