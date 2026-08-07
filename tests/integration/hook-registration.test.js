import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

async function importFreshModule() {
  vi.resetModules();
  return import(
    "../../foundry/scripts/bane-of-azeroth.js"
  );
}

function getOnceCallback(name) {
  return Hooks.once.mock.calls.find(
    ([hookName]) => hookName === name
  )?.[1];
}

describe("Foundry hook registration", () => {
  beforeEach(() => {
    Hooks.once.mockReset();
    Hooks.on.mockReset();
    game.settings.register.mockReset();
    game.system.id = "dragonbane";
    CONFIG.DoD.weaponFeatureTypes = {};
    CONFIG.Item ??= {};
    class FakeDragonbaneItem {
      getSpellCost() {
        return 1;
      }
    }
    CONFIG.Item.documentClass = FakeDragonbaneItem;
  });

  test("registers one init hook and one ready hook", async () => {
    await importFreshModule("entrypoints");

    expect(
      Hooks.once.mock.calls.map(([name]) => name)
    ).toEqual(["init", "ready"]);
    expect(getOnceCallback("init")).toEqual(expect.any(Function));
    expect(getOnceCallback("ready")).toEqual(expect.any(Function));
  });

  test("registers all runtime hooks during Dragonbane init", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await importFreshModule("dragonbane-init");
    const init = getOnceCallback("init");

    Hooks.on.mockClear();
    init();

    const attackEffects =
      await import(
        "../../foundry/scripts/common-animal-attack-effects.js"
      );
    const {
      onCommonAnimalRollDamageChatMessage,
      onCommonAnimalWeaponTestChatMessage,
    } = attackEffects;
    const movement =
      await import(
        "../../foundry/scripts/common-animal-movement.js"
      );
    const {
      onUpdateCommonAnimalMovementToken,
    } = movement;
    const effectOnlyAttacks = await import(
      "../../foundry/scripts/common-animal-effect-only-attacks.js"
    );
    const {
      onCreateCommonAnimalEffectOnlyWeaponTestMessage,
    } = effectOnlyAttacks;

        const statusEffects = await import(
      "../../foundry/scripts/common-animal-status-effects.js"
    );
    const {
      onRenderCommonAnimalRestrainedSource,
    } = statusEffects;
    const monsterAttackControl = await import(
      "../../foundry/scripts/monster-attack-control.js"
    );
    const { onRenderControlledMonsterSheet } = monsterAttackControl;
    const mageBrilliance =
      await import(
        "../../foundry/scripts/mage-brilliance.js"
      );
    const {
      onRenderMageBrillianceActorSheet,
    } = mageBrilliance;
    const abilityActions =
      await import(
        "../../foundry/scripts/ability-actions.js"
      );
    const {
      onRenderAbilityActionActorSheet,
      onUpdateAbilityActionChatMessage,
    } = abilityActions;
    const druidForms = await import(
      "../../foundry/scripts/druid-forms.js"
    );
    const {
      onRenderDruidFormArtworkActorSheet,
    } = druidForms;
    const warlockDemons = await import(
      "../../foundry/scripts/warlock-demons.js"
    );
    const {
      onCreateWarlockDemonChatMessage,
} = warlockDemons;
const registeredHooks =
      Hooks.on.mock.calls;
    const registeredHookNames =
      registeredHooks.map(([name]) => name);
    const createChatMessageCallbacks =
      registeredHooks
        .filter(
          ([name]) =>
            name === "createChatMessage"
        )
        .map(([, callback]) => callback);
    const updateChatMessageCallbacks =
      registeredHooks
        .filter(
          ([name]) =>
            name === "updateChatMessage"
        )
        .map(([, callback]) => callback);
const updateTokenCallbacks =
      registeredHooks
        .filter(
          ([name]) =>
            name === "updateToken"
        )
        .map(([, callback]) => callback);

        const renderActorSheetCallbacks = registeredHooks
      .filter(
        ([name]) => name === "renderDoDActorBaseSheet"
      )
      .map(([, callback]) => callback);
expect([
      ...new Set(registeredHookNames),
    ]).toEqual([
      "drawToken",
      "updateToken",
      "deleteToken",
      "preUpdateToken",
      "canvasReady",
      "createItem",
      "createToken",
      "updateItem",
      "deleteItem",
      "preCreateChatMessage",
      "createChatMessage",
      "deleteChatMessage",
      "updateCombat",
      "updateCombatant",
      "deleteCombatant",
      "deleteCombat",
      "updateChatMessage",
      "renderDoDActorBaseSheet",
      "preUpdateItem",
    ]);
    // BOA 0.11.7 Druid lifecycle adds one createChatMessage and one renderDoDActorBaseSheet hook.
    expect(
      createChatMessageCallbacks
    ).toHaveLength(6);
    expect(
      new Set(
        createChatMessageCallbacks
      ).size
    ).toBe(6);
    expect(
      onUpdateCommonAnimalMovementToken
    ).toEqual(expect.any(Function));
    expect(
      updateTokenCallbacks
    ).toHaveLength(3);
    expect(
      new Set(
        updateTokenCallbacks
      ).size
    ).toBe(3);
    expect(
      updateTokenCallbacks
    ).toContain(
      onUpdateCommonAnimalMovementToken
    );
    expect(
      updateChatMessageCallbacks
    ).toHaveLength(3);
    expect(
      new Set(
        updateChatMessageCallbacks
      ).size
    ).toBe(3);
    expect(
      updateChatMessageCallbacks
    ).toContain(
      onUpdateAbilityActionChatMessage,
    );
    expect(
      onCommonAnimalRollDamageChatMessage
    ).toEqual(expect.any(Function));
    expect(
      createChatMessageCallbacks
    ).toContain(
      onCommonAnimalRollDamageChatMessage
    );
    expect(
      createChatMessageCallbacks
    ).toContain(
      onCreateWarlockDemonChatMessage
    );
expect(
      createChatMessageCallbacks
    ).toContain(
      onCreateCommonAnimalEffectOnlyWeaponTestMessage
    );

    if (
      typeof onCommonAnimalWeaponTestChatMessage ===
      "function"
    ) {
      expect(
        createChatMessageCallbacks
      ).not.toContain(
        onCommonAnimalWeaponTestChatMessage
      );
    }
        expect(renderActorSheetCallbacks).toHaveLength(11);
    expect(new Set(renderActorSheetCallbacks).size).toBe(11);
    expect(renderActorSheetCallbacks).toContain(
      onRenderCommonAnimalRestrainedSource
    );
    expect(renderActorSheetCallbacks).toContain(
      onRenderControlledMonsterSheet,
    );
    expect(renderActorSheetCallbacks).toContain(
      onRenderMageBrillianceActorSheet,
    );
    expect(renderActorSheetCallbacks).toContain(
      onRenderAbilityActionActorSheet,
    );
    expect(renderActorSheetCallbacks).toContain(
      onRenderDruidFormArtworkActorSheet,
    );
expect(game.settings.register).toHaveBeenCalledTimes(13); // Druid Forms automation registration count // Druid Form Artwork setting
    expect(CONFIG.DoD.weaponFeatureTypes).toMatchObject({
      ammunition: "BOA.weaponFeatureTypes.ammunition",
      armorPiercing: "BOA.weaponFeatureTypes.armorPiercing",
      freehanded: "BOA.weaponFeatureTypes.freehanded",
      returning: "BOA.weaponFeatureTypes.returning",
      scattershot: "BOA.weaponFeatureTypes.scattershot",
    });
  });

  test("exposes the Common Animal attack-result adapter through the module API", async () => {
    // BOA expected module-init log capture
    const consoleLog = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});

    try {
        const module = {
          id: "bane-of-azeroth",
          api: {
            existingApi: true,
          },
        };
        game.modules = new Map([
          [module.id, module],
        ]);

        await importFreshModule(
          "common-animal-api"
        );
        const init = getOnceCallback("init");

        init();

        expect(module.api).toMatchObject({
          existingApi: true,
          processCommonAnimalAttackResult:
            expect.any(Function),
        });
      

      expect(consoleLog).toHaveBeenCalledWith(
        "bane-of-azeroth | Registered custom weapon features, Armor Piercing, and Scattershot.",
      );
    } finally {
      consoleLog.mockRestore();
    }
  });

  test("does not activate runtime hooks for another game system", async () => {
    game.system.id = "other-system";
    await importFreshModule("other-system");
    const init = getOnceCallback("init");

    Hooks.on.mockClear();
    init();

    expect(Hooks.on).not.toHaveBeenCalled();
    expect(game.settings.register).not.toHaveBeenCalled();
  });
});
