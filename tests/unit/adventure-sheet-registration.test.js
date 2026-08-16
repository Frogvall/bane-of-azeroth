import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  registerAdventureImporterSheet,
} from "../../foundry/scripts/adventure-import.js";

describe(
  "Bane of Azeroth Adventure sheet registration",
  () => {
    test(
      "registers AdventureImporterV2 under the module scope without making it globally default",
      () => {
        const registerSheet =
          vi.fn();
        class Adventure {}
        class AdventureImporterV2 {}

        const previousDocuments =
          foundry.documents;
        const previousApps =
          foundry.applications.apps;
        const previousSheets =
          foundry.applications.sheets;

        try {
          foundry.documents = {
            Adventure,
          };
          foundry.applications.apps = {
            DocumentSheetConfig: {
              registerSheet,
            },
          };
          foundry.applications.sheets = {
            AdventureImporterV2,
          };

          expect(
            registerAdventureImporterSheet(),
          ).toBe(true);
          expect(
            registerSheet,
          ).toHaveBeenCalledTimes(1);
          expect(
            registerSheet,
          ).toHaveBeenCalledWith(
            Adventure,
            "bane-of-azeroth",
            AdventureImporterV2,
            {
              label:
                "Bane of Azeroth Adventure Importer",
              makeDefault: false,
            },
          );
        } finally {
          foundry.documents =
            previousDocuments;
          foundry.applications.apps =
            previousApps;
          foundry.applications.sheets =
            previousSheets;
        }
      },
    );
  },
);
