const checks = [];
const notes = [];
const testKey = "druid-forms";
const testName = "BOA DEV – Verify Druid Forms";

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Macro is run by a game master",
    false,
    "Druid Forms slice 1 creates a temporary Actor and changes a world setting.",
  );
  return boaFinish(testKey, testName, checks, notes);
}

const settingKey = "druidFormsAutomation";
const settingDefinition =
  game.settings?.settings?.get?.(
    `${BOA_TEST_MODULE_ID}.${settingKey}`,
  ) ?? null;

boaCheck(
  checks,
  "Druid Forms automation setting is registered",
  Boolean(settingDefinition),
  `${BOA_TEST_MODULE_ID}.${settingKey}`,
);
if (settingDefinition) {
  boaCheckEqual(
    checks,
    "Druid Forms automation defaults to enabled",
    settingDefinition.default,
    true,
  );
}

const spellContentKeys = {
  savage: "spells.savage-incarnation",
  feral: "spells.feral-incarnation",
  harmony: "spells.incarnation-of-harmony",
  stars: "spells.incarnation-of-the-stars",
};

const sourceSpells = Object.fromEntries(
  Object.entries(spellContentKeys).map(
    ([key, contentKey]) => [
      key,
      boaFindWorldItem(contentKey, "spell"),
    ],
  ),
);

for (const [key, contentKey] of Object.entries(spellContentKeys)) {
  boaCheck(
    checks,
    `${contentKey} source spell is imported`,
    Boolean(sourceSpells[key]),
    sourceSpells[key]?.uuid ?? contentKey,
  );
}

const api =
  game.modules.get(BOA_TEST_MODULE_ID)?.api ?? {};

for (const functionName of [
  "getDruidFormProfileDefinitions",
  "getAvailableDruidFormProfiles",
  "getDruidFormArtwork",
  "setDruidFormArtwork",
  "resetDruidFormArtwork",
  "getDruidFormState",
]) {
  boaCheck(
    checks,
    `Druid Forms API exposes ${functionName}`,
    typeof api[functionName] === "function",
    typeof api[functionName],
  );
}

if (typeof api.getDruidFormProfileDefinitions === "function") {
  const definitions = api.getDruidFormProfileDefinitions();

  boaCheckEqual(
    checks,
    "Druid Forms defines exactly seven artwork profiles",
    definitions.map(profile => profile.key),
    [
      "travelPl1",
      "travelPl2",
      "travelPl3",
      "bear",
      "cat",
      "tree",
      "moonkin",
    ],
  );

  boaCheckEqual(
    checks,
    "Druid artwork profiles map to the correct spells and Travel power levels",
    definitions.map(profile => ({
      key: profile.key,
      spellContentKey: profile.spellContentKey,
      powerLevel: profile.powerLevel ?? null,
      form: profile.form,
    })),
    [
      {
        key: "travelPl1",
        spellContentKey: "spells.savage-incarnation",
        powerLevel: 1,
        form: "travel",
      },
      {
        key: "travelPl2",
        spellContentKey: "spells.savage-incarnation",
        powerLevel: 2,
        form: "travel",
      },
      {
        key: "travelPl3",
        spellContentKey: "spells.savage-incarnation",
        powerLevel: 3,
        form: "travel",
      },
      {
        key: "bear",
        spellContentKey: "spells.feral-incarnation",
        powerLevel: null,
        form: "bear",
      },
      {
        key: "cat",
        spellContentKey: "spells.feral-incarnation",
        powerLevel: null,
        form: "cat",
      },
      {
        key: "tree",
        spellContentKey: "spells.incarnation-of-harmony",
        powerLevel: null,
        form: "tree",
      },
      {
        key: "moonkin",
        spellContentKey: "spells.incarnation-of-the-stars",
        powerLevel: null,
        form: "moonkin",
      },
    ],
  );

  boaCheck(
    checks,
    "Every form profile provides default portrait and token artwork",
    definitions.every(
      profile =>
        typeof profile.defaultPortrait === "string" &&
        profile.defaultPortrait.length > 0 &&
        typeof profile.defaultToken === "string" &&
        profile.defaultToken.length > 0,
    ),
    definitions.map(profile => ({
      key: profile.key,
      defaultPortrait: profile.defaultPortrait,
      defaultToken: profile.defaultToken,
    })),
  );

  boaCheck(
    checks,
    "Humanoid is not a configurable BoA artwork profile",
    !definitions.some(
      profile =>
        profile.key === "humanoid" ||
        profile.form === "humanoid",
    ),
    definitions.map(profile => profile.key),
  );
}

let actor = null;
let originalSetting = null;

try {
  if (settingDefinition) {
    originalSetting = game.settings.get(
      BOA_TEST_MODULE_ID,
      settingKey,
    );
    await game.settings.set(
      BOA_TEST_MODULE_ID,
      settingKey,
      true,
    );
  }

  actor = await Actor.create(
    {
      name:
        "[BOA TEST] Druid Forms " +
        foundry.utils.randomID(6),
      type: "character",
      flags: {
        [BOA_TEST_MODULE_ID]: {
          [BOA_TEST_FIXTURE_FLAG]: true,
        },
      },
    },
    { renderSheet: false },
  );

  if (typeof api.getDruidFormState === "function") {
    const state = api.getDruidFormState(actor);
    boaCheckEqual(
      checks,
      "A new Druid Forms state starts in humanoid form without active incarnations",
      {
        currentForm: state?.currentForm,
        activations: state?.activations ?? {},
      },
      {
        currentForm: "humanoid",
        activations: {},
      },
    );
  }

  if (sourceSpells.savage) {
    await actor.createEmbeddedDocuments(
      "Item",
      [boaCloneEmbeddedItem(sourceSpells.savage)],
    );
  }

  if (typeof api.getAvailableDruidFormProfiles === "function") {
    boaCheckEqual(
      checks,
      "Owning only Savage Incarnation exposes only Travel PL1, PL2, and PL3",
      api
        .getAvailableDruidFormProfiles(actor)
        .map(profile => profile.key),
      [
        "travelPl1",
        "travelPl2",
        "travelPl3",
      ],
    );
  }

  if (
    typeof api.setDruidFormArtwork === "function" &&
    typeof api.getDruidFormArtwork === "function" &&
    typeof api.resetDruidFormArtwork === "function"
  ) {
    const customPortrait =
      "worlds/boa-test/druid-travel-pl2-portrait.webp";
    const customToken =
      "worlds/boa-test/druid-travel-pl2-token.webp";

    const changed = await api.setDruidFormArtwork(
      actor,
      "travelPl2",
      {
        portrait: customPortrait,
        token: customToken,
      },
    );
    const artwork =
      api.getDruidFormArtwork(actor, "travelPl2");

    boaCheckEqual(
      checks,
      "A spell-owned profile stores portrait and token overrides independently",
      {
        changed,
        portrait: artwork?.portrait,
        token: artwork?.token,
        portraitIsCustom:
          artwork?.portraitIsCustom ?? null,
        tokenIsCustom:
          artwork?.tokenIsCustom ?? null,
      },
      {
        changed: true,
        portrait: customPortrait,
        token: customToken,
        portraitIsCustom: true,
        tokenIsCustom: true,
      },
    );

    const rejected = await api.setDruidFormArtwork(
      actor,
      "bear",
      {
        portrait:
          "worlds/boa-test/should-not-save.webp",
      },
    );
    boaCheckEqual(
      checks,
      "Artwork cannot be configured for a form whose spell the Actor does not own",
      rejected,
      false,
    );

    await api.resetDruidFormArtwork(
      actor,
      "travelPl2",
    );
    const resetArtwork =
      api.getDruidFormArtwork(actor, "travelPl2");

    boaCheck(
      checks,
      "Resetting a profile restores module defaults for portrait and token",
      Boolean(
        resetArtwork &&
        resetArtwork.portraitIsCustom === false &&
        resetArtwork.tokenIsCustom === false &&
        typeof resetArtwork.portrait === "string" &&
        resetArtwork.portrait.length > 0 &&
        typeof resetArtwork.token === "string" &&
        resetArtwork.token.length > 0,
      ),
      resetArtwork ?? null,
    );
  }

  if (sourceSpells.feral) {
    await actor.createEmbeddedDocuments(
      "Item",
      [boaCloneEmbeddedItem(sourceSpells.feral)],
    );
  }

  if (typeof api.getAvailableDruidFormProfiles === "function") {
    boaCheckEqual(
      checks,
      "Adding Feral Incarnation adds Bear and Cat but not Tree or Moonkin",
      api
        .getAvailableDruidFormProfiles(actor)
        .map(profile => profile.key),
      [
        "travelPl1",
        "travelPl2",
        "travelPl3",
        "bear",
        "cat",
      ],
    );
  }
} catch (error) {
  boaCheck(
    checks,
    "Druid Forms slice 1 workflow completed",
    false,
    error.stack ?? error.message,
  );
} finally {
  if (actor) {
    try {
      await actor.delete();
    } catch (error) {
      boaCheck(
        checks,
        "Temporary Druid Forms Actor cleanup succeeded",
        false,
        error.message,
      );
    }
  }

  if (originalSetting !== null) {
    try {
      await game.settings.set(
        BOA_TEST_MODULE_ID,
        settingKey,
        originalSetting,
      );
    } catch (error) {
      boaCheck(
        checks,
        "Druid Forms automation setting was restored",
        false,
        error.message,
      );
    }
  }
}

notes.push(
  "Slice 1 covers the Druid form-state/artwork foundation only. " +
  "Spell activation, actual transformation, form mechanics, and Maul come later.",
);
notes.push(
  "Humanoid portrait and token remain Dragonbane-owned data; BoA only captures and restores them while transformed.",
);
notes.push(
  "Rejuvenation remains manual; BoA does not implement healing-over-time tracking.",
);

return boaFinish(
  testKey,
  testName,
  checks,
  notes,
);
