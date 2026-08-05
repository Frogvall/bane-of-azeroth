import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  AUTOMATION_SETTING_KEYS,
  AutomationSettingsForm,
  isAutomationEnabled,
  isDemonAutomationEnabled,
  isElementalTotemAutomationEnabled,
  registerAutomationSettings,
} from "../../foundry/scripts/automation-settings.js";

const MODULE_ID = "bane-of-azeroth";

afterEach(() => {
  delete globalThis.game;
});

describe("automation setting reads", () => {
  test("defines an independent Mage's Brilliance setting key", () => {
    expect(
      AUTOMATION_SETTING_KEYS.MAGES_BRILLIANCE,
    ).toBe("mageBrillianceAutomation");
  });

  test("registers Mage's Brilliance automation enabled by default", () => {
    const register = vi.fn();
    const registerMenu = vi.fn();

    registerAutomationSettings({
      register,
      registerMenu,
    });

    const mageRegistration =
      register.mock.calls.find(
        ([moduleId, key]) =>
          moduleId === MODULE_ID &&
          key === "mageBrillianceAutomation",
      );

    expect(mageRegistration?.[2]).toEqual(
      expect.objectContaining({
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
      }),
    );
  });

  test("Evoker's Legacy spell-cost automation uses an independent enabled-by-default setting", () => {
    expect(
      AUTOMATION_SETTING_KEYS.EVOKERS_LEGACY,
    ).toBe("evokersLegacyAutomation");

    const register = vi.fn();
    const registerMenu = vi.fn();

    registerAutomationSettings({
      register,
      registerMenu,
    });

    const registration =
      register.mock.calls.find(
        ([moduleId, key]) =>
          moduleId === MODULE_ID &&
          key === "evokersLegacyAutomation",
      );

    expect(registration?.[2]).toEqual(
      expect.objectContaining({
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
      }),
    );
  });
  test("defines independent War Stomp and Eye Beam settings enabled by default", () => {
    expect(
      AUTOMATION_SETTING_KEYS.WAR_STOMP,
    ).toBe("warStompAutomation");

    expect(
      AUTOMATION_SETTING_KEYS.EYE_BEAM,
    ).toBe("eyeBeamAutomation");

    const register = vi.fn();
    const registerMenu = vi.fn();

    registerAutomationSettings({
      register,
      registerMenu,
    });

    for (const key of [
      "warStompAutomation",
      "eyeBeamAutomation",
    ]) {
      const registration =
        register.mock.calls.find(
          ([moduleId, registeredKey]) =>
            moduleId === MODULE_ID &&
            registeredKey === key,
        );

      expect(registration?.[2]).toEqual(
        expect.objectContaining({
          scope: "world",
          config: false,
          type: Boolean,
          default: true,
          onChange: expect.any(Function),
        }),
      );
    }
  });
  test("defaults safely to enabled", () => {
    expect(
      isAutomationEnabled(
        AUTOMATION_SETTING_KEYS.DEMONS,
        null,
      ),
    ).toBe(true);

    expect(
      isAutomationEnabled(
        AUTOMATION_SETTING_KEYS.DEMONS,
        {
          get: vi.fn(() => {
            throw new Error("not registered");
          }),
        },
      ),
    ).toBe(true);
  });

  test("only explicit false disables a workflow", () => {
    const settings = {
      get: vi.fn((_moduleId, key) => (
        key === AUTOMATION_SETTING_KEYS.DEMONS
          ? false
          : true
      )),
    };

    expect(
      isDemonAutomationEnabled(settings),
    ).toBe(false);
    expect(
      isElementalTotemAutomationEnabled(settings),
    ).toBe(true);
    expect(settings.get).toHaveBeenCalledWith(
      MODULE_ID,
      AUTOMATION_SETTING_KEYS.DEMONS,
    );
  });
});

describe("ApplicationV2 automation settings form", () => {
  test("prepares schema, values, and the native footer button", async () => {
    globalThis.game = {
      settings: {
        get: vi.fn((_moduleId, key) => (
          key ===
            AUTOMATION_SETTING_KEYS.ELEMENTAL_TOTEMS
        )),
      },
    };

    const form = new AutomationSettingsForm();
    const context = await form._prepareContext({});

    expect(context.schema).toBe(
      AutomationSettingsForm.schema,
    );
    expect(context.source).toEqual({
      elementalTotemAutomation: true,
      demonAutomation: false,
      mageBrillianceAutomation: false,
      evokersLegacyAutomation: false,
      warStompAutomation: false,
      eyeBeamAutomation: false,
      serenityAutomation: false,
      demonHunterInitiationAutomation: false,
    });
    expect(context.buttons).toEqual([
      {
        type: "submit",
        icon: "fa-solid fa-floppy-disk",
        label: "SETTINGS.Save",
      },
    ]);
  });

  test("saves both FormData values", async () => {
    const set = vi.fn(async () => {});
    globalThis.game = {
      settings: {
        set,
      },
    };

    await AutomationSettingsForm._onSubmit(
      null,
      null,
      {
        object: {
          elementalTotemAutomation: true,
          demonAutomation: false,
          mageBrillianceAutomation: true,
          evokersLegacyAutomation: true,
          warStompAutomation: true,
          eyeBeamAutomation: true,
          serenityAutomation: true,
          demonHunterInitiationAutomation: true,
        },
      },
    );

    expect(set).toHaveBeenCalledTimes(8);
    expect(set).toHaveBeenCalledWith(
      MODULE_ID,
      AUTOMATION_SETTING_KEYS.ELEMENTAL_TOTEMS,
      true,
    );
    expect(set).toHaveBeenCalledWith(
      MODULE_ID,
      AUTOMATION_SETTING_KEYS.DEMONS,
      false,
    );
    expect(set).toHaveBeenCalledWith(
      MODULE_ID,
      AUTOMATION_SETTING_KEYS.MAGES_BRILLIANCE,
      true,
    );
    expect(set).toHaveBeenCalledWith(
      MODULE_ID,
      AUTOMATION_SETTING_KEYS.EVOKERS_LEGACY,
      true,
    );
    expect(set).toHaveBeenCalledWith(
      MODULE_ID,
      AUTOMATION_SETTING_KEYS.WAR_STOMP,
      true,
    );
    expect(set).toHaveBeenCalledWith(
      MODULE_ID,
      AUTOMATION_SETTING_KEYS.EYE_BEAM,
      true,
    );
  });
});
