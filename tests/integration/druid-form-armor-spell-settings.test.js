import {
  describe,
  expect,
  test,
} from "vitest";

import {
  AUTOMATION_SETTING_KEYS,
  isDruidFormArmorAutomationEnabled,
  isDruidFormSpellRestrictionAutomationEnabled,
} from "../../foundry/scripts/automation-settings.js";

describe(
  "Druid form armor and spell settings",
  () => {
    test(
      "uses independent enabled-by-default setting keys",
      () => {
        expect(
          AUTOMATION_SETTING_KEYS
            .DRUID_FORM_ARMOR,
        ).toBe(
          "druidFormArmorAutomation",
        );
        expect(
          AUTOMATION_SETTING_KEYS
            .DRUID_FORM_SPELL_RESTRICTION,
        ).toBe(
          "druidFormSpellRestrictionAutomation",
        );
        expect(
          isDruidFormArmorAutomationEnabled(
            null,
          ),
        ).toBe(
          true,
        );
        expect(
          isDruidFormSpellRestrictionAutomationEnabled(
            null,
          ),
        ).toBe(
          true,
        );
      },
    );
  },
);
