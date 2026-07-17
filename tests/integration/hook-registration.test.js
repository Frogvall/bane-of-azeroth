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

    expect(
      Hooks.on.mock.calls.map(([name]) => name)
    ).toEqual([
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
    expect(game.settings.register).toHaveBeenCalledOnce();
    expect(CONFIG.DoD.weaponFeatureTypes).toMatchObject({
      ammunition: "BOA.weaponFeatureTypes.ammunition",
      armorPiercing: "BOA.weaponFeatureTypes.armorPiercing",
      freehanded: "BOA.weaponFeatureTypes.freehanded",
      returning: "BOA.weaponFeatureTypes.returning",
      scattershot: "BOA.weaponFeatureTypes.scattershot",
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
