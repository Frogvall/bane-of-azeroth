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

const ADVENTURE_ROOT =
  resolve(
    "foundry",
    "pack-src",
    "bane-of-azeroth",
    "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  );

function read(path) {
  return readFileSync(
    resolve(path),
    "utf-8",
  );
}

function readJson(path) {
  return JSON.parse(
    read(path),
  );
}

describe(
  "Macro folder separation",
  () => {
    test(
      "player convenience Macros live in a blue Bane of Azeroth Adventure folder",
      () => {
        const adventure =
          readJson(
            resolve(
              ADVENTURE_ROOT,
              "_Adventure.json",
            ),
          );

        const folderPath =
          adventure.folders.find(
            path =>
              path ===
                "Macro/Bane_of_Azeroth_BoAMacros0000001/_Folder.json",
          );

        expect(folderPath).toBeTruthy();

        const folder =
          readJson(
            resolve(
              ADVENTURE_ROOT,
              folderPath,
            ),
          );

        expect(folder).toMatchObject({
          type: "Macro",
          folder: null,
          name: "Bane of Azeroth",
          color: "#0000ff",
          _id: "BoAMacros0000001",
        });

        expect(adventure.macros).toHaveLength(2);

        for (const macroPath of adventure.macros) {
          expect(
            macroPath.startsWith(
              "Macro/Bane_of_Azeroth_BoAMacros0000001/",
            ),
          ).toBe(true);

          const macro =
            readJson(
              resolve(
                ADVENTURE_ROOT,
                macroPath,
              ),
            );

          expect(macro.folder).toBe(
            "BoAMacros0000001",
          );
        }
      },
    );

    test(
      "developer system-test Macros use their own root folder and retain legacy cleanup",
      () => {
        const source =
          read(
            "tests/system/runtime/import-system-test-macros.js",
          );

        expect(source).toContain(
          'const TEST_FOLDER_NAME = "Bane of Azeroth - System Tests";',
        );
        expect(source).toContain(
          'const LEGACY_ROOT_FOLDER_NAME = "Bane of Azeroth";',
        );
        expect(source).toContain(
          'const LEGACY_TEST_FOLDER_NAME = "System Tests";',
        );
        expect(source).toContain(
          "cleanupLegacyMacroFolders",
        );
        expect(source).toMatch(
          /ensureMacroFolder\(\s*TEST_FOLDER_NAME,\s*null,\s*"#1f5fbf"/,
        );
      },
    );
  },
);
