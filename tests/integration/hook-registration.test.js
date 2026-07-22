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

    expect([
      ...new Set(registeredHookNames),
    ]).toEqual([
      "drawToken",
      "updateToken",
      "deleteToken",
      "preUpdateToken",
      "canvasReady",
      "createItem",
      "updateItem",
      "deleteItem",
      "createChatMessage",
      "updateChatMessage",
      "renderDoDActorBaseSheet",
      "preUpdateItem",
    ]);
    expect(
      createChatMessageCallbacks
    ).toHaveLength(2);
    expect(
      new Set(
        createChatMessageCallbacks
      ).size
    ).toBe(2);
    expect(
      onCommonAnimalRollDamageChatMessage
    ).toEqual(expect.any(Function));
    expect(
      createChatMessageCallbacks
    ).toContain(
      onCommonAnimalRollDamageChatMessage
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
    expect(game.settings.register).toHaveBeenCalledOnce();
    expect(CONFIG.DoD.weaponFeatureTypes).toMatchObject({
      ammunition: "BOA.weaponFeatureTypes.ammunition",
      armorPiercing: "BOA.weaponFeatureTypes.armorPiercing",
      freehanded: "BOA.weaponFeatureTypes.freehanded",
      returning: "BOA.weaponFeatureTypes.returning",
      scattershot: "BOA.weaponFeatureTypes.scattershot",
    });
  });

  test("exposes the Common Animal attack-result adapter through the module API", async () => {
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
