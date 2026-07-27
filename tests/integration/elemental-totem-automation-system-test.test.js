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
} from "vitest";

const DIALOGS = resolve(
  "foundry",
  "scripts",
  "elemental-totems",
  "dialogs.js",
);
const WORKFLOW = resolve(
  "foundry",
  "scripts",
  "elemental-totems",
  "workflow.js",
);
const MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-elemental-totems.js",
);
const RUN_ALL = resolve(
  "tests",
  "system",
  "macros",
  "run-all.js",
);
const GENERATOR = resolve(
  "tools",
  "generate-system-test-macros.py",
);
const LANG = resolve(
  "foundry",
  "lang",
  "en.json",
);

function read(path) {
  return readFileSync(path, "utf-8");
}

describe("Elemental Totem automation system-test coverage", () => {
  test("routes confirmed plans through the setting-aware workflow", () => {
    const dialogs = read(DIALOGS);
    const workflow = read(WORKFLOW);

    expect(dialogs).toContain(
      "executeElementalTotemPlan(plan, definitions)",
    );
    expect(workflow).toContain(
      "isElementalTotemAutomationEnabled(settings)",
    );
    expect(workflow).toContain(
      "elementalTotemManualPlacement",
    );
  });

  test("the Foundry Macro toggles and restores the real world setting", () => {
    const macro = read(MACRO);

    for (const marker of [
      "executeElementalTotemPlan",
      '"elementalTotemAutomation"',
      "Elemental Totem automation was disabled",
      "Disabled automation skipped placement and creation",
      "Enabled automation reached placement and creation",
      "elementalTotemManualPlacement",
      "originalAutomationSetting",
      "Elemental Totem automation setting was restored",
      "Temporary manual Elemental Totem chat message was deleted",
    ]) {
      expect(macro).toContain(marker);
    }
  });

  test("the existing Macro remains registered exactly once in Run All", () => {
    const generator = read(GENERATOR);
    const runAll = read(RUN_ALL);

    expect(
      generator.match(/"key"\s*:\s*"elemental-totems"/g),
    ).toHaveLength(1);
    expect(
      runAll.match(/["']elemental-totems["']/g),
    ).toHaveLength(1);
  });

  test("removes the orphaned custom save localization", () => {
    const lang = JSON.parse(read(LANG));
    expect(lang.BOA.settings.automation.save).toBeUndefined();
  });
});
