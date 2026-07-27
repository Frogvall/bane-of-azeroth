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
} from "../../foundry/scripts/automation-settings.js";

const MODULE_ID = "bane-of-azeroth";

afterEach(() => {
  delete globalThis.game;
});

describe("automation setting reads", () => {
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
        },
      },
    );

    expect(set).toHaveBeenCalledTimes(2);
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
  });
});
