import { describe, expect, test } from "vitest";
import {
  getDruidFormSwitchOptions,
} from "../../foundry/scripts/druid-form-lifecycle.js";

const MODULE_ID = "bane-of-azeroth";

describe("Druid form PL presentation", () => {
  test("shows the PL of the supplying incarnation", () => {
    const actor = {
      type: "character",
      flags: {
        [MODULE_ID]: {
          druidFormState: {
            currentForm: "bear",
            activations: {
              savage: { active: true, powerLevel: 1 },
              feral: { active: true, powerLevel: 2 },
              harmony: { active: true, powerLevel: 3 },
              stars: { active: true, powerLevel: 1 },
            },
          },
        },
      },
      getFlag(moduleId, key) {
        return this.flags?.[moduleId]?.[key];
      },
    };

    const options = Object.fromEntries(
      getDruidFormSwitchOptions(actor)
        .map(option => [option.form, option]),
    );

    expect(options.humanoid.displayLabel).toBe("Humanoid");
    expect(options.travel.displayLabel).toBe("Travel Form — PL1");
    expect(options.bear.displayLabel).toBe("Bear Form — PL2");
    expect(options.cat.displayLabel).toBe("Cat Form — PL2");
    expect(options.tree.displayLabel).toBe("Tree Form — PL3");
    expect(options.moonkin.displayLabel).toBe("Moonkin Form — PL1");
  });
});
