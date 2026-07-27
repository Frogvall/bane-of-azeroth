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

const MAIN = resolve(
  "foundry",
  "scripts",
  "bane-of-azeroth.js",
);
const BARREL = resolve(
  "foundry",
  "scripts",
  "warlock-demons.js",
);
const MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-warlock-demons.js",
);

function read(path) {
  return readFileSync(path, "utf-8");
}

describe("Warlock demon automation system-test coverage", () => {
  test("registers dialog, socket, and lifecycle hooks", () => {
    const main = read(MAIN);

    expect(main).toContain(
      "onCreateWarlockDemonChatMessage",
    );
    expect(main).toContain(
      "onUpdateWarlockDemonCaster",
    );
    expect(main).toContain(
      "registerWarlockDemonSocket",
    );
  });

  test("exports the setting-aware creation lifecycle", () => {
    const barrel = read(BARREL);

    for (const marker of [
      "executeWarlockDemonPlan",
      "executeWarlockDemonCreation",
      "deletePreviousWarlockDemons",
      "deleteWarlockDemonsForCaster",
      "collectWarlockDemonPosition",
      "requestWarlockDemonCreation",
    ]) {
      expect(barrel).toContain(marker);
    }
  });

  test("Foundry Macro toggles and restores the real setting", () => {
    const macro = read(MACRO);

    for (const marker of [
      '"demonAutomation"',
      "Warlock demon automation was disabled",
      "Disabled demon automation skipped placement and creation",
      "Enabled demon automation reached placement and creation",
      "warlockDemonManualPlacement",
      "Warlock demon automation setting was restored",
    ]) {
      expect(macro).toContain(marker);
    }
  });
});
