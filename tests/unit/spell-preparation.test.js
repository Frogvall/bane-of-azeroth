import {
  describe,
  expect,
  test,
} from "vitest";

import {
  isAutoGrantedSpell,
  protectAutoGrantedSpellPreparation,
} from "../../foundry/scripts/bane-of-azeroth.js";

function makeItem({
  autoGranted = true,
  type = "spell",
} = {}) {
  return {
    type,

    getFlag(moduleId, key) {
      if (
        moduleId === "bane-of-azeroth" &&
        key === "autoGranted"
      ) {
        return autoGranted;
      }
      return undefined;
    },
  };
}

describe("Automatically granted spells", () => {
  test("recognizes an automatically granted spell", () => {
    expect(
      isAutoGrantedSpell(makeItem())
    ).toBe(true);
  });

  test("rejects manual spells", () => {
    expect(
      isAutoGrantedSpell(
        makeItem({
          autoGranted: false,
        })
      )
    ).toBe(false);
  });

  test("rejects non-spell Items", () => {
    expect(
      isAutoGrantedSpell(
        makeItem({
          type: "ability",
        })
      )
    ).toBe(false);
  });

  test("protects a flat memorized update", () => {
    const changed = {
      "system.memorized": false,
    };

    protectAutoGrantedSpellPreparation(
      makeItem(),
      changed
    );

    expect(
      changed["system.memorized"]
    ).toBe(true);
  });

  test("protects a nested memorized update", () => {
    const changed = {
      system: {
        memorized: false,
      },
    };

    protectAutoGrantedSpellPreparation(
      makeItem(),
      changed
    );

    expect(
      changed.system.memorized
    ).toBe(true);
  });

  test("does not change a manual spell update", () => {
    const changed = {
      "system.memorized": false,
    };

    protectAutoGrantedSpellPreparation(
      makeItem({
        autoGranted: false,
      }),
      changed
    );

    expect(
      changed["system.memorized"]
    ).toBe(false);
  });
});
