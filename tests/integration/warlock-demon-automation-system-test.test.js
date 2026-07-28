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
  test("registers dialog, sockets, and shared rest lifecycle", () => {
    const main = read(MAIN);

    for (const marker of [
      "onCreateWarlockDemonChatMessage",
      "registerWarlockDemonSocket",
      "registerSummonDurationLifecycleSocket",
      "patchSummonRestLifecycle",
      "patchVoidwalkerSuffering",
      "registerVoidwalkerSufferingSocket",
    ]) {
      expect(main).toContain(marker);
    }
    expect(main).not.toContain(
      "onUpdateWarlockDemonCaster",
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


  test("Foundry Macro verifies Imp and Sayaad defense banes", () => {
    const barrel = read(BARREL);
    const macro = read(MACRO);

    for (const marker of [
      "applyWarlockDemonDefenseBane",
      "getWarlockDemonDefenseBane",
    ]) {
      expect(barrel).toContain(marker);
    }

    for (const marker of [
      "Phase Shift defense bane is offered for melee and ranged attacks",
      "Seductive defense bane is offered only for melee attacks",
      "Other Warlock demons do not add advisory defense banes",
      "Warlock demon defense bane is inserted exactly once",
      "Dragonbane no-banes-and-boons mode suppresses the defense bane",
    ]) {
      expect(macro).toContain(marker);
    }
  });


  test("Foundry Macro verifies the shared Stretch and Shift lifecycle", () => {
    const macro = read(MACRO);

    for (const marker of [
      "deleteSummonsExpiredByRest",
      "isSummonExpiredByRest",
      "isSummonRestLifecyclePatched",
      "Shared summon duration rules distinguish Stretch and Shift",
      "Dragonbane Stretch and Shift methods use the shared summon lifecycle",
      "Stretch cleanup selects only the caster's duration-tagged Totems",
      "Shift cleanup selects the caster's Totems and Warlock demon",
    ]) {
      expect(macro).toContain(marker);
    }
  });


  test("Foundry Macro defines the red Voidwalker Suffering contract", () => {
    const macro = read(MACRO);

    for (const marker of [
      "warlock-demons/suffering.js",
      "findEligibleVoidwalkerForSuffering",
      "splitVoidwalkerSufferingDamage",
      "Suffering splits 5 final damage into 3 damage for each creature",
      "Suffering rounds each half up for the smallest positive damage",
      "Suffering selects a linked Voidwalker at no more than 10 meters",
      "Suffering ignores distant, other-caster, wrong-demon, and manual Tokens",
      "Voidwalker Suffering runtime checks complete",
    ]) {
      expect(macro).toContain(marker);
    }
  });

});
