import {
  describe,
  expect,
  test,
} from "vitest";

import {
  AUTOMATION_SETTING_KEYS,
  isDruidFormAttackAutomationEnabled,
  isDruidFormMovementAutomationEnabled,
} from "../../foundry/scripts/automation-settings.js";

describe(
  "Druid form mechanics settings",
  () => {
    test(
      "uses independent enabled-by-default setting keys",
      () => {
        expect(
          AUTOMATION_SETTING_KEYS
            .DRUID_FORM_MOVEMENT,
        ).toBe(
          "druidFormMovementAutomation",
        );
        expect(
          AUTOMATION_SETTING_KEYS
            .DRUID_FORM_ATTACKS,
        ).toBe(
          "druidFormAttackAutomation",
        );
        expect(
          isDruidFormMovementAutomationEnabled(
            null,
          ),
        ).toBe(
          true,
        );
        expect(
          isDruidFormAttackAutomationEnabled(
            null,
          ),
        ).toBe(
          true,
        );
      },
    );
  },
);
