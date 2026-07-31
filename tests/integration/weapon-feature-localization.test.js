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

const LANGUAGE = resolve(
  "foundry",
  "lang",
  "en.json",
);
const CONSTANTS = resolve(
  "foundry",
  "scripts",
  "core",
  "constants.js",
);
const SYSTEM_MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-assets-and-journals.js",
);

const FEATURE_LABELS = {
  freehanded: "Freehanded",
  returning: "Returning",
  ammunition: "Ammunition",
  armorPiercing: "Armor Piercing",
  scattershot: "Scattershot",
};

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

describe("custom weapon-feature localization", () => {
  test("publishes BOA and Dragonbane-compatible labels", () => {
    const language = readJson(LANGUAGE);

    for (
      const [feature, label]
      of Object.entries(FEATURE_LABELS)
    ) {
      expect(
        language.BOA.weaponFeatureTypes[
          feature
        ],
      ).toBe(label);
      expect(
        language.BOA.weaponFeatureTypes[
          `${feature}Tooltip`
        ],
      ).toBe(label);

      expect(
        language.DoD.weaponFeatureTypes[
          feature
        ],
      ).toBe(label);
      expect(
        language.DoD.weaponFeatureTypes[
          `${feature}Tooltip`
        ],
      ).toBe(label);
    }
  });

  test("keeps CONFIG registrations module-owned", () => {
    const constants = read(CONSTANTS);

    for (
      const feature
      of Object.keys(FEATURE_LABELS)
    ) {
      expect(constants).toContain(
        `${feature}: `
        + `"BOA.weaponFeatureTypes.${feature}"`,
      );
    }

    expect(constants).not.toContain(
      'freehanded: '
      + '"DoD.weaponFeatureTypes.freehanded"',
    );
  });

  test("extends Foundry runtime verification", () => {
    const macro = read(SYSTEM_MACRO);

    expect(macro).toContain(
      "Custom weapon features localize in Gear tables",
    );
    expect(macro).toContain(
      "const customWeaponFeatureLabels = {",
    );

    for (
      const [feature, label]
      of Object.entries(FEATURE_LABELS)
    ) {
      expect(macro).toContain(
        `${feature}: "${label}"`,
      );
    }

    for (const namespace of [
      "BOA",
      "DoD",
    ]) {
      expect(macro).toContain(
        `"${namespace}",`,
      );
    }

    expect(macro).toContain(
      "`${namespace}.weaponFeatureTypes.`",
    );
    expect(macro).toContain(
      "+ feature;",
    );
    expect(macro).toContain(
      "game.i18n.localize(key)",
    );
  });
});
