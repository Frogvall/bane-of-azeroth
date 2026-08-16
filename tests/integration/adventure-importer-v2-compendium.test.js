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

function read(path) {
  return readFileSync(
    resolve(path),
    "utf8",
  );
}

describe(
  "AdventureImporterV2 compendium integration",
  () => {
    test(
      "selects the BoA-scoped V2 importer for the Adventure document",
      () => {
        const adventure = JSON.parse(
          read(
            "foundry/pack-src/bane-of-azeroth/"
            + "Bane_of_Azeroth_ZoNOXZjdkOjV56e3/"
            + "_Adventure.json",
          ),
        );

        expect(
          adventure.flags?.core?.sheetClass,
        ).toBe(
          "bane-of-azeroth.AdventureImporterV2",
        );
      },
    );

    test(
      "registers the V2 Adventure sheet during module init",
      () => {
        const entrypoint = read(
          "foundry/scripts/bane-of-azeroth.js",
        );

        expect(entrypoint).toContain(
          "registerAdventureImporterSheet();",
        );
      },
    );

    test(
      "rebrands the Adventure sheet-class id for developer packages",
      () => {
        const rebrand = read(
          "tools/rebrand-foundry-package.py",
        );

        expect(rebrand).toContain(
          'f"{CANONICAL_ID}.AdventureImporterV2"',
        );
        expect(rebrand).toContain(
          "Adventure sheet class id was not rebranded.",
        );
      },
    );
  },
);
