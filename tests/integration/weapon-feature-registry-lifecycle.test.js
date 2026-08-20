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

const ENTRYPOINT = resolve(
  "foundry",
  "scripts",
  "bane-of-azeroth.js",
);
const WEAPON_FEATURES = resolve(
  "foundry",
  "scripts",
  "weapon-features.js",
);

function read(path) {
  return readFileSync(
    path,
    "utf8",
  );
}

describe("weapon feature registry lifecycle", () => {
  test("centralizes extension of Dragonbane's live registry", () => {
    const source =
      read(WEAPON_FEATURES);

    expect(source).toContain(
      "export function registerWeaponFeatures(",
    );
    expect(source).toContain(
      "Object.assign(",
    );
    expect(source).toContain(
      "WEAPON_FEATURES,",
    );
  });

  test("registers during init and re-asserts during ready", () => {
    const source =
      read(ENTRYPOINT);

    const registrations =
      source.match(
        /registerWeaponFeatures\(\)/g,
      ) ?? [];

    expect(
      registrations.length,
    ).toBeGreaterThanOrEqual(2);

    const initRegistration =
      source.indexOf(
        "if (!registerWeaponFeatures())",
      );
    const readyHook =
      source.indexOf(
        'Hooks.once("ready"',
      );
    const readyRegistration =
      source.indexOf(
        "if (!registerWeaponFeatures())",
        initRegistration + 1,
      );

    expect(
      initRegistration,
    ).toBeGreaterThan(-1);
    expect(
      readyHook,
    ).toBeGreaterThan(
      initRegistration,
    );
    expect(
      readyRegistration,
    ).toBeGreaterThan(
      readyHook,
    );
  });
});
