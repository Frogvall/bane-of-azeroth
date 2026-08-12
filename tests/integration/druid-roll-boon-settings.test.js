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
  registerAutomationSettings,
} from "../../foundry/scripts/automation-settings.js";

const MODULE_ID = "bane-of-azeroth";

function read(path) {
  return readFileSync(resolve(path), "utf-8");
}

describe("Druid roll-boon settings", () => {
  test("Cat and Moonkin boon settings are independent world settings enabled by default", () => {
    const registered = new Map();
    const settings = {
      register: vi.fn((moduleId, key, definition) => {
        if (moduleId === MODULE_ID) {
          registered.set(key, definition);
        }
      }),
      registerMenu: vi.fn(),
    };

    expect(registerAutomationSettings(settings)).toBe(true);

    for (const key of [
      AUTOMATION_SETTING_KEYS.DRUID_CAT_SNEAKING,
      AUTOMATION_SETTING_KEYS.DRUID_MOONKIN_SPELLCASTING_BOON,
    ]) {
      expect(registered.get(key)).toEqual(
        expect.objectContaining({
          scope: "world",
          config: false,
          type: Boolean,
          default: true,
        }),
      );
    }
  });

  test("Automation Settings UI exposes both roll-boon toggles", () => {
    const template = read(
      "foundry/templates/automation-settings.hbs",
    );
    const lang = JSON.parse(read("foundry/lang/en.json"));

    expect(template).toContain(
      "schema.fields.druidCatSneakingAutomation",
    );
    expect(template).toContain(
      "schema.fields.druidMoonkinSpellcastingBoonAutomation",
    );
    expect(
      lang.BOA.settings.automation.druidCatSneakingName,
    ).toBe("Druid Cat Sneaking");
    expect(
      lang.BOA.settings.automation.druidMoonkinSpellcastingBoonName,
    ).toBe("Druid Moonkin Spellcasting Boon");
  });
});
