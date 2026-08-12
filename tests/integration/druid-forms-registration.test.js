import {
  existsSync,
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

const ROOT =
  resolve(".");
const RUNTIME =
  resolve(
    ROOT,
    "foundry",
    "scripts",
    "druid-forms.js",
  );
const ENTRYPOINT =
  resolve(
    ROOT,
    "foundry",
    "scripts",
    "bane-of-azeroth.js",
  );
const SETTINGS =
  resolve(
    ROOT,
    "foundry",
    "scripts",
    "automation-settings.js",
  );
const TEMPLATE =
  resolve(
    ROOT,
    "foundry",
    "templates",
    "automation-settings.hbs",
  );
const LANG =
  resolve(
    ROOT,
    "foundry",
    "lang",
    "en.json",
  );

function read(
  path,
) {
  return readFileSync(
    path,
    "utf8",
  );
}

describe(
  "Druid Forms slice 1 registration",
  () => {
    test(
      "ships a focused Druid Forms runtime",
      () => {
        expect(
          existsSync(
            RUNTIME,
          ),
        ).toBe(
          true,
        );
      },
    );

    test(
      "registers an independent enabled-by-default Druid Forms automation setting",
      () => {
        const settings =
          read(
            SETTINGS,
          );
        const template =
          read(
            TEMPLATE,
          );
        const lang =
          JSON.parse(
            read(
              LANG,
            ),
          );

        expect(
          settings,
        ).toContain(
          'DRUID_FORMS: "druidFormsAutomation"',
        );
        expect(
          settings,
        ).toContain(
          "isDruidFormsAutomationEnabled",
        );
        expect(
          template,
        ).toContain(
          "schema.fields.druidFormsAutomation",
        );
        expect(
          lang.BOA.settings
            .automation
            .druidFormsName,
        ).toEqual(
          expect.any(
            String,
          ),
        );
        expect(
          lang.BOA.settings
            .automation
            .druidFormsHint,
        ).toEqual(
          expect.any(
            String,
          ),
        );
      },
    );

    test(
      "exposes the slice 1 Druid Forms API from the module entrypoint",
      () => {
        const entrypoint =
          read(
            ENTRYPOINT,
          );

        expect(
          entrypoint,
        ).toContain(
          'from "./druid-forms.js"',
        );

        for (
          const name
          of [
            "getDruidFormProfileDefinitions",
            "getAvailableDruidFormProfiles",
            "getDruidFormArtwork",
            "setDruidFormArtwork",
            "resetDruidFormArtwork",
            "getDruidFormState",
          ]
        ) {
          expect(
            entrypoint,
          ).toContain(
            name,
          );
        }
      },
    );
  },
);
