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

describe("automation settings form", () => {
  test("reads both current world values", () => {
    globalThis.game = {
      settings: {
        get: vi.fn((_moduleId, key) => (
          key ===
            AUTOMATION_SETTING_KEYS.ELEMENTAL_TOTEMS
        )),
      },
    };

    const form = new AutomationSettingsForm();

    expect(form.getData()).toEqual({
      elementalTotemAutomation: true,
      demonAutomation: false,
    });
  });

  test("saves both checkboxes", async () => {
    const set = vi.fn(async () => {});
    globalThis.game = {
      settings: {
        set,
      },
    };

    const form = new AutomationSettingsForm();
    await form._updateObject(null, {
      elementalTotemAutomation: true,
    });

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
