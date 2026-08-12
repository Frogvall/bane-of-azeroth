import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const repoRoot =
  path.resolve(
    import.meta.dirname,
    "..",
    "..",
  );

function readRepoText(...parts) {
  return fs.readFileSync(
    path.join(repoRoot, ...parts),
    "utf8",
  );
}

describe(
  "runtime console policy",
  () => {
    const entrypoint =
      readRepoText(
        "foundry",
        "scripts",
        "bane-of-azeroth.js",
      );
    const totemDialogs =
      readRepoText(
        "foundry",
        "scripts",
        "elemental-totems",
        "dialogs.js",
      );

    test(
      "does not log routine successful weapon-feature initialization",
      () => {
        expect(
          entrypoint,
        ).not.toContain(
          "Registered custom weapon features, Armor Piercing, and Scattershot.",
        );
      },
    );

    test(
      "does not dump successful Elemental Totem creation state",
      () => {
        expect(
          totemDialogs,
        ).not.toContain(
          "Elemental Totems created.",
        );
      },
    );

    test(
      "keeps real weapon-feature initialization failures visible",
      () => {
        expect(
          entrypoint,
        ).toContain(
          "Dragonbane weapon features were not available during init.",
        );
        expect(
          entrypoint,
        ).toContain(
          "console.error(",
        );
      },
    );

    test(
      "keeps real Elemental Totem workflow failures visible",
      () => {
        expect(
          totemDialogs,
        ).toContain(
          "Elemental Totem dialog flow failed.",
        );
        expect(
          totemDialogs,
        ).toContain(
          "ui.notifications.error(",
        );
      },
    );
  },
);
