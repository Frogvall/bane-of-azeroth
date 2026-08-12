import {
  describe,
  expect,
  test,
} from "vitest";

import {
  AUTOMATION_SETTING_KEYS,
  isDruidMoonkinSpellCostAutomationEnabled,
} from "../../foundry/scripts/automation-settings.js";

describe("Druid Moonkin spell-cost setting", () => {
  test("is independently default-enabled", () => {
    expect(
      AUTOMATION_SETTING_KEYS.DRUID_MOONKIN_SPELL_COST,
    ).toBe("druidMoonkinSpellCostAutomation");

    expect(
      isDruidMoonkinSpellCostAutomationEnabled(null),
    ).toBe(true);
  });
});
