import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  AUTOMATION_SETTING_KEYS,
  AutomationSettingsForm,
  registerAutomationSettings,
} from "../../foundry/scripts/automation-settings.js";

const MODULE_ID = "bane-of-azeroth";

describe("automation settings registration", () => {
  test("registers seven hidden world booleans enabled by default", () => {
    const settings = {
      register: vi.fn(),
      registerMenu: vi.fn(),
    };

    expect(
      registerAutomationSettings(settings),
    ).toBe(true);

    expect(settings.register).toHaveBeenCalledTimes(7);
    for (const key of Object.values(
      AUTOMATION_SETTING_KEYS,
    )) {
      expect(settings.register).toHaveBeenCalledWith(
        MODULE_ID,
        key,
        expect.objectContaining({
          scope: "world",
          config: false,
          type: Boolean,
          default: true,
        }),
      );
    }
  });

  test("includes the Evoker's Legacy setting key in the automation schema", () => {
    expect(
      AUTOMATION_SETTING_KEYS.EVOKERS_LEGACY,
    ).toBe("evokersLegacyAutomation");
  });
  test("includes independent War Stomp and Eye Beam setting keys", () => {
    expect(
      AUTOMATION_SETTING_KEYS.WAR_STOMP,
    ).toBe("warStompAutomation");
    expect(
      AUTOMATION_SETTING_KEYS.EYE_BEAM,
    ).toBe("eyeBeamAutomation");
  });
  test("registers a restricted Automation Settings menu", () => {
    const settings = {
      register: vi.fn(),
      registerMenu: vi.fn(),
    };

    registerAutomationSettings(settings);

    expect(settings.registerMenu).toHaveBeenCalledOnce();
    expect(settings.registerMenu).toHaveBeenCalledWith(
      MODULE_ID,
      "automationSettings",
      expect.objectContaining({
        type: AutomationSettingsForm,
        restricted: true,
      }),
    );
  });

  test("the runtime entrypoint registers settings during init", () => {
    const entrypoint = readFileSync(
      resolve(
        "foundry",
        "scripts",
        "bane-of-azeroth.js",
      ),
      "utf-8",
    );

    expect(entrypoint).toContain(
      'from "./automation-settings.js"',
    );
    expect(entrypoint).toContain(
      "registerAutomationSettings();",
    );
  });
});
