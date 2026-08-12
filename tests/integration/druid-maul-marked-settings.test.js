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
  return readFileSync(
    resolve(path),
    "utf-8",
  );
}

test("Maul Marked has an independent enabled-by-default world setting", () => {
  const registered = new Map();
  const settings = {
    register: vi.fn(
      (moduleId, key, definition) => {
        if (moduleId === MODULE_ID) {
          registered.set(key, definition);
        }
      },
    ),
    registerMenu: vi.fn(),
  };

  registerAutomationSettings(settings);

  expect(
    AUTOMATION_SETTING_KEYS.DRUID_MAUL_MARKED,
  ).toBe("druidMaulMarkedAutomation");
  expect(
    registered.get(
      AUTOMATION_SETTING_KEYS.DRUID_MAUL_MARKED,
    ),
  ).toEqual(
    expect.objectContaining({
      scope: "world",
      config: false,
      type: Boolean,
      default: true,
    }),
  );
});

test("Automation Settings exposes Maul Marked", () => {
  const template = read(
    "foundry/templates/automation-settings.hbs",
  );
  const lang = JSON.parse(
    read("foundry/lang/en.json"),
  );

  expect(template).toContain(
    "schema.fields.druidMaulMarkedAutomation",
  );
  expect(
    lang.BOA.settings.automation
      .druidMaulMarkedName,
  ).toBe("Druid Maul — Marked");
  expect(
    lang.BOA.statuses.marked,
  ).toBe("Marked");
});
