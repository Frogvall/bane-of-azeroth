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

const artworkSettingKey =
  "druidFormArtworkAutomation";
const artworkSettingDefinition =
  game.settings?.settings?.get?.(
    `${BOA_TEST_MODULE_ID}.${artworkSettingKey}`,
  ) ?? null;

boaCheck(
  checks,
  "Druid Form Artwork automation setting is registered",
  Boolean(artworkSettingDefinition),
  `${BOA_TEST_MODULE_ID}.${artworkSettingKey}`,
);

if (artworkSettingDefinition) {
  boaCheckEqual(
    checks,
    "Druid Form Artwork automation defaults to enabled",
    artworkSettingDefinition.default,
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
  "openDruidFormArtworkDialog",
  "restoreDruidHumanoidArtwork",
  "applyDruidFormArtwork",
  "activateDruidIncarnation",
  "switchDruidForm",
  "expireDruidIncarnationsForRest",
  "getDruidFormSwitchOptions",
  "openDruidFormSwitchDialog",
  "executeDruidFormLifecycleRequest",
  "getDruidIncarnationDefinitions",
  "isDruidFormsAutomationEnabled",
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
let originalArtworkSetting = null;

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
  if (artworkSettingDefinition) {
    originalArtworkSetting = game.settings.get(
      BOA_TEST_MODULE_ID,
      artworkSettingKey,
    );
    await game.settings.set(
      BOA_TEST_MODULE_ID,
      artworkSettingKey,
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

  if (
    typeof api.applyDruidFormArtwork === "function" &&
    typeof api.restoreDruidHumanoidArtwork === "function" &&
    typeof api.setDruidFormArtwork === "function"
  ) {
    const humanoidPortrait =
      "icons/svg/mystery-man.svg";
    const humanoidToken =
      "icons/svg/cowled.svg";

    await actor.update({
      img: humanoidPortrait,
      "prototypeToken.texture.src":
        humanoidToken,
    });

    const travelPl1Portrait =
      "icons/svg/wing.svg";
    const travelPl1Token =
      "icons/svg/eagle-emblem.svg";
    const travelPl2Portrait =
      "icons/svg/fish.svg";
    const travelPl2Token =
      "icons/svg/fish.svg";

    await api.setDruidFormArtwork(
      actor,
      "travelPl1",
      {
        portrait:
          travelPl1Portrait,
        token:
          travelPl1Token,
      },
    );

    await api.setDruidFormArtwork(
      actor,
      "travelPl2",
      {
        portrait:
          travelPl2Portrait,
        token:
          travelPl2Token,
      },
    );

    const firstApplied =
      await api.applyDruidFormArtwork(
        actor,
        "travelPl1",
      );

    boaCheckEqual(
      checks,
      "Applying configured Travel artwork changes the Actor portrait and prototype token",
      {
        applied:
          firstApplied,
        portrait:
          actor.img,
        token:
          actor.prototypeToken?.texture?.src,
      },
      {
        applied:
          true,
        portrait:
          travelPl1Portrait,
        token:
          travelPl1Token,
      },
    );

    const secondApplied =
      await api.applyDruidFormArtwork(
        actor,
        "travelPl2",
      );

    boaCheckEqual(
      checks,
      "Switching form artwork applies the new profile without restoring humanoid artwork between forms",
      {
        applied:
          secondApplied,
        portrait:
          actor.img,
        token:
          actor.prototypeToken?.texture?.src,
      },
      {
        applied:
          true,
        portrait:
          travelPl2Portrait,
        token:
          travelPl2Token,
      },
    );

    const restored =
      await api.restoreDruidHumanoidArtwork(
        actor,
      );

    boaCheckEqual(
      checks,
      "Restoring humanoid artwork returns the exact original Actor portrait and prototype token",
      {
        restored,
        portrait:
          actor.img,
        token:
          actor.prototypeToken?.texture?.src,
      },
      {
        restored:
          true,
        portrait:
          humanoidPortrait,
        token:
          humanoidToken,
      },
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
  // BOA 0.11.7 slice 3 lifecycle contract.
  if (
    typeof api.activateDruidIncarnation === "function"
    && typeof api.switchDruidForm === "function"
    && typeof api.expireDruidIncarnationsForRest === "function"
    && typeof api.getDruidFormSwitchOptions === "function"
  ) {
    await actor.update({
      "system.willPoints.value": 10,
    });

    const savageActivation =
      await api.activateDruidIncarnation(
        actor,
        spellContentKeys.savage,
        2,
        {
          initialForm: "travel",
          bypassAuthority: true,
        },
      );

    boaCheckEqual(
      checks,
      "Savage Incarnation activates Travel Form at the cast power level",
      {
        resultForm:
          savageActivation?.currentForm ?? null,
        state:
          api.getDruidFormState(actor),
      },
      {
        resultForm: "travel",
        state: {
          currentForm: "travel",
          activations: {
            savage: {
              active: true,
              powerLevel: 2,
              duration: "shift",
            },
          },
        },
      },
    );

    const feralActivation =
      await api.activateDruidIncarnation(
        actor,
        spellContentKeys.feral,
        3,
        {
          initialForm: "bear",
          bypassAuthority: true,
        },
      );

    boaCheckEqual(
      checks,
      "Feral Incarnation overlaps Savage and makes Bear and Cat available",
      {
        resultForm:
          feralActivation?.currentForm ?? null,
        forms:
          api.getDruidFormSwitchOptions(actor)
            .map(option => option.form),
      },
      {
        resultForm: "bear",
        forms: [
          "humanoid",
          "travel",
          "bear",
          "cat",
        ],
      },
    );

    const wpBeforeAction =
      Number(actor.system?.willPoints?.value ?? 0);
    await api.switchDruidForm(
      actor,
      "cat",
      {
        mode: "action",
        bypassAuthority: true,
      },
    );
    boaCheckEqual(
      checks,
      "Changing Druid form as an action costs 0 WP",
      {
        form:
          api.getDruidFormState(actor).currentForm,
        wp:
          Number(actor.system?.willPoints?.value ?? 0),
      },
      {
        form: "cat",
        wp: wpBeforeAction,
      },
    );

    const wpBeforeFree =
      Number(actor.system?.willPoints?.value ?? 0);
    await api.switchDruidForm(
      actor,
      "humanoid",
      {
        mode: "free",
        bypassAuthority: true,
      },
    );
    boaCheckEqual(
      checks,
      "Changing Druid form as a free action costs exactly 1 WP",
      {
        form:
          api.getDruidFormState(actor).currentForm,
        wp:
          Number(actor.system?.willPoints?.value ?? 0),
      },
      {
        form: "humanoid",
        wp: wpBeforeFree - 1,
      },
    );

    await api.expireDruidIncarnationsForRest(
      actor,
      "stretch",
      {
        bypassAuthority: true,
      },
    );
    boaCheckEqual(
      checks,
      "Stretch rest expires Feral while Savage remains active",
      api.getDruidFormState(actor),
      {
        currentForm: "humanoid",
        activations: {
          savage: {
            active: true,
            powerLevel: 2,
            duration: "shift",
          },
        },
      },
    );

    await api.switchDruidForm(
      actor,
      "travel",
      {
        mode: "action",
        bypassAuthority: true,
      },
    );
    await api.expireDruidIncarnationsForRest(
      actor,
      "shift",
      {
        bypassAuthority: true,
      },
    );
    boaCheckEqual(
      checks,
      "Shift rest expires Savage and restores Humanoid Form",
      api.getDruidFormState(actor),
      {
        currentForm: "humanoid",
        activations: {},
      },
    );
  }
  // BOA 0.11.7 regression: multi-profile reset and placed-token Shift restore
  if (
    typeof api.setDruidFormArtwork === "function" &&
    typeof api.resetDruidFormArtwork === "function" &&
    typeof api.getDruidFormArtwork === "function" &&
    typeof api.getDruidFormProfileDefinitions === "function"
  ) {
    const definitions =
      Object.fromEntries(
        api.getDruidFormProfileDefinitions().map(
          profile => [profile.key, profile],
        ),
      );

    const firstCustom = {
      portrait: "worlds/boa-test/reset-first-portrait.webp",
      token: "worlds/boa-test/reset-first-token.webp",
    };
    const secondCustom = {
      portrait: "worlds/boa-test/reset-second-portrait.webp",
      token: "worlds/boa-test/reset-second-token.webp",
    };

    await api.setDruidFormArtwork(
      actor,
      "travelPl1",
      firstCustom,
    );
    await api.setDruidFormArtwork(
      actor,
      "travelPl2",
      secondCustom,
    );
    await api.resetDruidFormArtwork(
      actor,
      "travelPl1",
    );

    const firstAfterReset =
      api.getDruidFormArtwork(
        actor,
        "travelPl1",
      );
    const secondAfterReset =
      api.getDruidFormArtwork(
        actor,
        "travelPl2",
      );

    boaCheckEqual(
      checks,
      "Resetting one Druid artwork profile removes only that override",
      {
        resetPortrait:
          firstAfterReset?.portrait,
        resetToken:
          firstAfterReset?.token,
        resetPortraitIsCustom:
          firstAfterReset?.portraitIsCustom,
        resetTokenIsCustom:
          firstAfterReset?.tokenIsCustom,
        otherPortrait:
          secondAfterReset?.portrait,
        otherToken:
          secondAfterReset?.token,
      },
      {
        resetPortrait:
          definitions.travelPl1?.defaultPortrait,
        resetToken:
          definitions.travelPl1?.defaultToken,
        resetPortraitIsCustom:
          false,
        resetTokenIsCustom:
          false,
        otherPortrait:
          secondCustom.portrait,
        otherToken:
          secondCustom.token,
      },
    );

    await api.resetDruidFormArtwork(
      actor,
      "travelPl2",
    );
  }

  if (
    typeof api.activateDruidIncarnation === "function" &&
    typeof api.expireDruidIncarnationsForRest === "function" &&
    typeof api.setDruidFormArtwork === "function" &&
    typeof globalThis.Scene?.create === "function"
  ) {
    let regressionScene = null;

    try {
      await actor.unsetFlag?.(
        BOA_TEST_MODULE_ID,
        "druidFormState",
      );
      await api.restoreDruidHumanoidArtwork?.(
        actor,
      );

      const humanoidPortrait =
        "icons/svg/mystery-man.svg";
      const humanoidPrototypeToken =
        "icons/svg/cowled.svg";
      const humanoidSceneToken =
        "icons/svg/eye.svg";
      const travelPortrait =
        "icons/svg/wing.svg";
      const travelToken =
        "icons/svg/eagle-emblem.svg";

      await actor.update({
        img: humanoidPortrait,
        "prototypeToken.texture.src":
          humanoidPrototypeToken,
      });

      await api.setDruidFormArtwork(
        actor,
        "travelPl1",
        {
          portrait:
            travelPortrait,
          token:
            travelToken,
        },
      );

      regressionScene =
        await globalThis.Scene.create(
          {
            name:
              "[BOA TEST] Druid Token Restore " +
              foundry.utils.randomID(6),
            active:
              false,
            navigation:
              false,
          },
          {
            renderSheet:
              false,
          },
        );

      const createdTokens =
        await regressionScene.createEmbeddedDocuments(
          "Token",
          [
            {
              name:
                "[BOA TEST] Druid",
              actorId:
                actor.id,
              actorLink:
                true,
              x: 0,
              y: 0,
              texture: {
                src:
                  humanoidSceneToken,
              },
            },
          ],
        );

      const sceneToken =
        createdTokens?.[0] ?? null;

      await api.activateDruidIncarnation(
        actor,
        "spells.savage-incarnation",
        1,
        {
          bypassAuthority:
            true,
        },
      );

      const transformedToken =
        sceneToken?.texture?.src ?? null;

      await api.expireDruidIncarnationsForRest(
        actor,
        "shift",
        {
          bypassAuthority:
            true,
        },
      );

      boaCheckEqual(
        checks,
        "Shift-rest restores a placed Scene Token to its exact humanoid artwork",
        {
          transformed:
            transformedToken,
          restored:
            sceneToken?.texture?.src ?? null,
          portrait:
            actor.img,
          prototypeToken:
            actor.prototypeToken?.texture?.src ?? null,
        },
        {
          transformed:
            travelToken,
          restored:
            humanoidSceneToken,
          portrait:
            humanoidPortrait,
          prototypeToken:
            humanoidPrototypeToken,
        },
      );
    } finally {
      if (regressionScene) {
        await regressionScene.delete();
      }
    }
  }

// BOA 0.11.7 unified expiration RED/GREEN contract.
  {
    const summonMarker = Symbol.for(
      `${BOA_TEST_MODULE_ID}.summonDurationLifecycle`,
    );
    const druidMarker = Symbol.for(
      `${BOA_TEST_MODULE_ID}.druidFormLifecycle.rest`,
    );
    const prototype =
      CONFIG.Actor?.documentClass?.prototype;

    boaCheck(
      checks,
      "Pass One Shift uses the shared summon lifecycle",
      Boolean(
        prototype?.restReset?.[summonMarker],
      ),
      prototype?.restReset?.name ?? null,
    );
    boaCheck(
      checks,
      "Pass One Shift expires Druid incarnations",
      Boolean(
        prototype?.restReset?.[druidMarker],
      ),
      prototype?.restReset?.name ?? null,
    );

    for (const functionName of [
      "endDruidIncarnation",
      "getManagedEffectsForActor",
      "endManagedEffect",
      "endAllManagedEffects",
      "openManagedEffectEndDialog",
    ]) {
      boaCheck(
        checks,
        `Unified effect lifecycle API exposes ${functionName}`,
        typeof api[functionName] === "function",
        typeof api[functionName],
      );
    }
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
  if (originalArtworkSetting !== null) {
    try {
      await game.settings.set(
        BOA_TEST_MODULE_ID,
        artworkSettingKey,
        originalArtworkSetting,
      );
    } catch (error) {
      boaCheck(
        checks,
        "Druid Form Artwork automation setting was restored",
        false,
        error.message,
      );
    }
  }
}

notes.push(
  "Slice 3 adds incarnation activation, overlapping form availability, action/free-action switching, " +
  "rest expiration, artwork synchronization, and Player-to-GM authority. Form-specific combat mechanics and Maul come later.",
);
notes.push(
  "Humanoid portrait and token remain Dragonbane-owned data; BoA only captures and restores them while transformed.",
);
notes.push(
  "Rejuvenation remains manual; BoA does not implement healing-over-time tracking.",
);
notes.push(
  "Scene-token artwork provenance and real Player authority are covered by focused tests before GREEN.",
);

return boaFinish(
  testKey,
  testName,
  checks,
  notes,
);
