const checks = [];
const notes = [];

try {
  const {
    configureCreatedElementalTotem,
    executeElementalTotemPlan,
    deletePreviousElementalTotems,
    drawElementalTotemAura,
    onDeleteElementalTotemAura,
    onUpdateElementalTotemAura,
  } = await import(
    `/modules/${BOA_TEST_MODULE_ID}/scripts/elemental-totems.js`
  );

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
  let cleanupScene = null;

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
    const ownerUserId = "BoaOwnerUser0001";
    const observerUserId = "BoaObserverUsr01";
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

    const sourceTokenDataByType = new Map(
      tokenData.map(data => [
        foundry.utils.getProperty(
          data,
          `flags.${BOA_TEST_MODULE_ID}.totemType`
        ),
        data,
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

      const sourceTokenData =
        sourceTokenDataByType.get(definition.key);
      boaCheck(
        checks,
        `Synthetic Actor exists: ${definition.name}`,
        Boolean(actor?.isToken),
        actor?.uuid ?? "missing"
      );

      if (!actor?.isToken) {
        continue;
      }

      await configureCreatedElementalTotem(
        token,
        {
          hitPoints: Number(defaults.hitPoints),
          armorRating: Number(defaults.armorRating),
        },
        [ownerUserId]
      );

      const armor = boaCollectionValues(actor.items)
        .find(item =>
          item.type === "armor" &&
          (
            boaContentKey(item).endsWith(".armor") ||
            item.name === "Totem Armor"
          )
        );

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

      boaCheck(
        checks,
        `Source token fixture exists: ${definition.name}`,
        Boolean(sourceTokenData)
      );
      const createdTokenData = token.toObject();
      boaCheckEqual(
        checks,
        `Light data is preserved: ${definition.name}`,
        createdTokenData.light ?? {},
        sourceTokenData?.light ?? {}
      );
      boaCheckEqual(
        checks,
        `Sight data is preserved: ${definition.name}`,
        createdTokenData.sight ?? {},
        sourceTokenData?.sight ?? {}
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
        `Caster-owner ownership: ${definition.name}`,
        actor.ownership?.[ownerUserId],
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
      );
      boaCheck(
        checks,
        `Observer relies on default ownership: ${definition.name}`,
        actor.ownership?.[observerUserId] === undefined &&
          actor.ownership?.default ===
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

    cleanupScene = await Scene.create({
      name:
        `[BOA TEST] Elemental Totem Cleanup ` +
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
      "Temporary cleanup test Scene was created",
      Boolean(cleanupScene?.id),
      cleanupScene?.uuid ?? ""
    );

    const oldCastId = foundry.utils.randomID();
    const otherCasterActorUuid = "Actor.BoaOtherCaster";

    function makeCleanupTokenData({
      casterUuid,
      cleanupCastId,
      x,
      y,
    }) {
      const data = foundry.utils.deepClone(tokenData[0]);
      delete data._id;
      data.x = x;
      data.y = y;
      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.casterActorUuid`,
        casterUuid
      );
      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.castId`,
        cleanupCastId
      );
      foundry.utils.setProperty(
        data,
        `flags.${BOA_TEST_MODULE_ID}.instanceId`,
        foundry.utils.randomID()
      );
      return data;
    }

    const [oldLocalToken] =
      await fixtureScene.createEmbeddedDocuments(
        "Token",
        [
          makeCleanupTokenData({
            casterUuid: casterActorUuid,
            cleanupCastId: oldCastId,
            x: 200,
            y: 700,
          }),
        ]
      );

    const cleanupTokens = await cleanupScene.createEmbeddedDocuments(
      "Token",
      [
        makeCleanupTokenData({
          casterUuid: casterActorUuid,
          cleanupCastId: oldCastId,
          x: 200,
          y: 300,
        }),
        makeCleanupTokenData({
          casterUuid: casterActorUuid,
          cleanupCastId: castId,
          x: 500,
          y: 300,
        }),
        makeCleanupTokenData({
          casterUuid: otherCasterActorUuid,
          cleanupCastId: oldCastId,
          x: 800,
          y: 300,
        }),
      ]
    );
      const oldRemoteToken = cleanupTokens.find(token => (
        boaGetFlag(token, "casterActorUuid") === casterActorUuid &&
        boaGetFlag(token, "castId") === oldCastId
      )) ?? null;
      const currentRemoteToken = cleanupTokens.find(token => (
        boaGetFlag(token, "casterActorUuid") === casterActorUuid &&
        boaGetFlag(token, "castId") === castId
      )) ?? null;
      const otherCasterToken = cleanupTokens.find(token => (
        boaGetFlag(token, "casterActorUuid") === otherCasterActorUuid
      )) ?? null;

      if (!oldRemoteToken || !currentRemoteToken || !otherCasterToken) {
        throw new Error(
          "Cross-scene cleanup fixtures were resolved by flags: " +
          JSON.stringify(
            cleanupTokens.map(token => ({
              id: token.id,
              casterActorUuid: boaGetFlag(token, "casterActorUuid"),
              castId: boaGetFlag(token, "castId"),
            })),
          ),
        );
      }

    const cleanupFailures =
      await deletePreviousElementalTotems(
        casterActorUuid,
        castId
      );

    boaCheckEqual(
      checks,
      "Cross-scene cleanup reported no failed Scenes",
      cleanupFailures,
      []
    );
    boaCheck(
      checks,
      "Cross-scene cleanup removed the local previous cast",
      !fixtureScene.tokens.get(oldLocalToken.id)
    );
    boaCheck(
      checks,
      "Cross-scene cleanup removed the remote previous cast",
      !cleanupScene.tokens.get(oldRemoteToken.id)
    );
    boaCheck(
      checks,
      "Cross-scene cleanup preserved the current cast",
      Boolean(cleanupScene.tokens.get(currentRemoteToken.id))
    );
    boaCheck(
      checks,
      "Cross-scene cleanup preserved another caster's totem",
      Boolean(cleanupScene.tokens.get(otherCasterToken.id))
    );
    boaCheck(
      checks,
      "Cross-scene cleanup preserved all primary current-cast tokens",
      createdTokens.every(token =>
        Boolean(fixtureScene.tokens.get(token.id))
      )
    );

    const auraChildren = [];
    const auraScene = canvas.scene;
    boaCheck(
      checks,
      "Active canvas Scene exists for aura lifecycle checks",
      Boolean(auraScene?.id),
      auraScene?.id ?? ""
    );

    const auraDocument = {
      flags: {
        [BOA_TEST_MODULE_ID]: {
          summonType: "elementalTotem",
          auraRange: defaults.auraRange,
          auraColor:
            definitions[0]?.auraColor ?? "#00ff00",
          auraAlpha:
            definitions[0]?.auraAlpha ??
            defaults.auraAlpha,
        },
      },
      parent: auraScene,
      object: null,
    };
    const auraToken = {
      document: auraDocument,
      scene: auraScene,
      destroyed: false,
      w: 50,
      h: 50,
      addChildAt(graphics, index) {
        auraChildren.splice(index, 0, graphics);
        return graphics;
      },
    };
    auraDocument.object = auraToken;

    drawElementalTotemAura(auraToken);
    const firstAuraGraphics = auraChildren[0];

    boaCheck(
      checks,
      "Aura draw creates PIXI graphics",
      Boolean(firstAuraGraphics) &&
        firstAuraGraphics.destroyed !== true
    );
    boaCheckEqual(
      checks,
      "Aura graphics do not receive pointer events",
      {
        eventMode: firstAuraGraphics?.eventMode,
        interactive: firstAuraGraphics?.interactive,
      },
      {
        eventMode: "none",
        interactive: false,
      }
    );

    onUpdateElementalTotemAura(
      auraDocument,
      {
        x: 100,
      },
      {},
      game.user.id
    );
    await new Promise(resolve => {
      requestAnimationFrame(resolve);
    });

    const secondAuraGraphics = auraChildren[0];

    boaCheck(
      checks,
      "Aura redraw destroys the previous graphics",
      firstAuraGraphics?.destroyed === true
    );
    boaCheck(
      checks,
      "Aura redraw creates replacement graphics",
      Boolean(secondAuraGraphics) &&
        secondAuraGraphics !== firstAuraGraphics &&
        secondAuraGraphics.destroyed !== true
    );

    onDeleteElementalTotemAura(
      auraDocument,
      {},
      game.user.id
    );
    boaCheck(
      checks,
      "Aura deletion destroys the active graphics",
      secondAuraGraphics?.destroyed === true
    );


    // BOA automation-setting workflow test.
    const automationSettingKey =
      "elementalTotemAutomation";
    const originalAutomationSetting =
      game.settings.get(
        BOA_TEST_MODULE_ID,
        automationSettingKey,
      );
    const automationMessageIds = [];
    let disabledPlacementCalls = 0;
    let disabledCreationCalls = 0;
    let enabledPlacementCalls = 0;
    let enabledCreationCalls = 0;

    const selectedDefinition =
      definitions.find(
        definition => definition.key === "flametongue",
      )
      ?? definitions[0]
      ?? null;

    if (!selectedDefinition) {
      boaCheck(
        checks,
        "Elemental Totem automation setting has a test definition",
        false,
        "No Elemental Totem definition was available.",
      );
    } else {
      const automationPlan = {
        sourceMessageId: "BoaAutomationSettingMessage",
        actorUuid: casterActorUuid,
        spellUuid:
          "Actor.BoaTestCaster.Item.elemental-totem",
        sceneId: fixtureScene.id,
        casterTokenId: null,
        powerLevel: 2,
        criticalEffect: "",
        totemTypes: [selectedDefinition.key],
        reachUpgrades: 1,
        durabilityUpgrades: 0,
        auraRange: Number(defaults.auraRange) * 2,
        hitPoints: Number(defaults.hitPoints),
        armorRating: Number(defaults.armorRating),
        placementRange: 6,
      };

      try {
        await game.settings.set(
          BOA_TEST_MODULE_ID,
          automationSettingKey,
          false,
        );

        boaCheckEqual(
          checks,
          "Elemental Totem automation was disabled",
          game.settings.get(
            BOA_TEST_MODULE_ID,
            automationSettingKey,
          ),
          false,
        );

        const messagesBeforeDisabled = new Set(
          boaCollectionValues(game.messages)
            .map(message => message.id),
        );

        const disabledOutcome =
          await executeElementalTotemPlan(
            automationPlan,
            {
              ...content,
              totems: definitions,
            },
            {
              chatMessageClass: ChatMessage,
              collectPositionsFn: async () => {
                disabledPlacementCalls += 1;
                return [
                  {
                    totemType: selectedDefinition.key,
                    x: 100,
                    y: 100,
                  },
                ];
              },
              i18n: game.i18n,
              messages: game.messages,
              notifications: {
                info: () => {},
                warn: () => {},
              },
              requestCreationFn: async () => {
                disabledCreationCalls += 1;
                return {
                  createdTokenIds: ["unexpected-token"],
                  failedCleanupScenes: [],
                };
              },
              settings: game.settings,
            },
          );

        const disabledMessages = boaCollectionValues(
          game.messages,
        ).filter(message => (
          !messagesBeforeDisabled.has(message.id)
        ));
        automationMessageIds.push(
          ...disabledMessages
            .map(message => message.id)
            .filter(Boolean),
        );

        const manualMessage =
          disabledMessages.find(message => (
            boaGetFlag(
              message,
              "elementalTotemManualPlacement",
            )?.sourceMessageId
            === automationPlan.sourceMessageId
          ))
          ?? null;
        const manualFlag = manualMessage
          ? boaGetFlag(
            manualMessage,
            "elementalTotemManualPlacement",
          )
          : null;
        const manualContent = String(
          manualMessage?.content ?? "",
        ).replace(/\s+/g, " ");

        boaCheckEqual(
          checks,
          "Disabled automation skipped placement and creation",
          {
            status: disabledOutcome?.status ?? null,
            placementCalls: disabledPlacementCalls,
            creationCalls: disabledCreationCalls,
          },
          {
            status: "manual",
            placementCalls: 0,
            creationCalls: 0,
          },
        );
        boaCheck(
          checks,
          "Disabled automation created manual instructions",
          Boolean(manualMessage),
          automationMessageIds.join(", "),
        );
        boaCheckEqual(
          checks,
          "Manual instructions preserve the selected plan",
          manualFlag,
          {
            schemaVersion: 1,
            actorUuid: casterActorUuid,
            sourceMessageId:
              automationPlan.sourceMessageId,
            powerLevel: 2,
            totemTypes: [selectedDefinition.key],
            automationEnabled: false,
          },
        );
        boaCheck(
          checks,
          "Manual instructions show the selected totem and power level",
          (
            manualContent.includes(selectedDefinition.name)
            && manualContent.includes("2")
            && manualContent.includes("automation is disabled")
          ),
          manualContent,
        );

        await game.settings.set(
          BOA_TEST_MODULE_ID,
          automationSettingKey,
          true,
        );

        boaCheckEqual(
          checks,
          "Elemental Totem automation was enabled",
          game.settings.get(
            BOA_TEST_MODULE_ID,
            automationSettingKey,
          ),
          true,
        );

        const enabledOutcome =
          await executeElementalTotemPlan(
            automationPlan,
            {
              ...content,
              totems: definitions,
            },
            {
              collectPositionsFn: async () => {
                enabledPlacementCalls += 1;
                return [
                  {
                    totemType: selectedDefinition.key,
                    x: 100,
                    y: 100,
                  },
                ];
              },
              i18n: game.i18n,
              notifications: {
                info: () => {},
                warn: () => {},
              },
              requestCreationFn: async () => {
                enabledCreationCalls += 1;
                return {
                  createdTokenIds: [
                    "BoaSyntheticAutomationToken",
                  ],
                  failedCleanupScenes: [],
                };
              },
              settings: game.settings,
            },
          );

        boaCheckEqual(
          checks,
          "Enabled automation reached placement and creation",
          {
            status: enabledOutcome?.status ?? null,
            placementCalls: enabledPlacementCalls,
            creationCalls: enabledCreationCalls,
          },
          {
            status: "created",
            placementCalls: 1,
            creationCalls: 1,
          },
        );
      } catch (automationError) {
        boaCheck(
          checks,
          "Elemental Totem automation setting workflow completed",
          false,
          automationError.stack ?? automationError.message,
        );
      } finally {
        try {
          const liveMessageIds = automationMessageIds.filter(
            id => game.messages.get(id),
          );
          if (liveMessageIds.length > 0) {
            await ChatMessage.deleteDocuments(liveMessageIds);
          }
          boaCheck(
            checks,
            "Temporary manual Elemental Totem chat message was deleted",
            automationMessageIds.every(
              id => !game.messages.get(id),
            ),
            automationMessageIds.join(", "),
          );
        } catch (messageCleanupError) {
          boaCheck(
            checks,
            "Temporary manual Elemental Totem chat message was deleted",
            false,
            messageCleanupError.stack ?? messageCleanupError.message,
          );
        }

        try {
          await game.settings.set(
            BOA_TEST_MODULE_ID,
            automationSettingKey,
            originalAutomationSetting,
          );
          boaCheckEqual(
            checks,
            "Elemental Totem automation setting was restored",
            game.settings.get(
              BOA_TEST_MODULE_ID,
              automationSettingKey,
            ),
            originalAutomationSetting,
          );
        } catch (settingCleanupError) {
          boaCheck(
            checks,
            "Elemental Totem automation setting was restored",
            false,
            settingCleanupError.stack ?? settingCleanupError.message,
          );
        }
      }
    }

    notes.push(
      `${createdTokens.length} temporary summoned ` +
      "Elemental Totem token(s) were created and inspected."
    );
  } finally {
      if (cleanupScene) {
        try {
          const cleanupSceneName = cleanupScene.name;
          await cleanupScene.delete();
          boaCheck(
            checks,
            "Temporary cleanup test Scene was deleted",
            !game.scenes.has(cleanupScene.id),
            cleanupSceneName
          );
        } catch (cleanupError) {
          boaCheck(
            checks,
            "Temporary cleanup test Scene was deleted",
            false,
            cleanupError.stack ??
              cleanupError.message
          );
        }
      }

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

// BOA 0.11.7 unified expiration RED/GREEN contract.
{
  const summonMarker = Symbol.for(
    `${BOA_TEST_MODULE_ID}.summonDurationLifecycle`,
  );
  const prototype =
    CONFIG.Actor?.documentClass?.prototype;
  const lifecycleApi =
    game.modules.get(
      BOA_TEST_MODULE_ID,
    )?.api ?? {};

  boaCheck(
    checks,
    "Pass One Shift removes managed summons",
    Boolean(
      prototype?.restReset?.[summonMarker],
    ),
    prototype?.restReset?.name ?? null,
  );

  for (const functionName of [
    "getManagedEffectsForActor",
    "endManagedEffect",
    "endAllManagedEffects",
    "openManagedEffectEndDialog",
  ]) {
    boaCheck(
      checks,
      `Managed summon lifecycle API exposes ${functionName}`,
      typeof lifecycleApi[functionName] === "function",
      typeof lifecycleApi[functionName],
    );
  }
}

return boaFinish(
  "elemental-totems",
  "BOA DEV – Verify Elemental Totems",
  checks,
  notes
);
