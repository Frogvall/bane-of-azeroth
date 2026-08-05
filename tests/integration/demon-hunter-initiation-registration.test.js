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

const RUNTIME = resolve(
  "foundry",
  "scripts",
  "demon-hunter-initiation.js",
);
const ENTRYPOINT = resolve(
  "foundry",
  "scripts",
  "bane-of-azeroth.js",
);
const AUTOMATION = resolve(
  "foundry",
  "scripts",
  "automation-settings.js",
);
const TEMPLATE = resolve(
  "foundry",
  "templates",
  "automation-settings.hbs",
);
const LANG = resolve(
  "foundry",
  "lang",
  "en.json",
);

describe(
  "Demon Hunter Initiation registration",
  () => {
    test("has a dedicated vision reconciliation runtime", () => {
      expect(
        existsSync(
          RUNTIME,
        ),
      ).toBe(true);

      const source =
        existsSync(
          RUNTIME,
        )
          ? readFileSync(
              RUNTIME,
              "utf8",
            )
          : "";

      for (const marker of [
        "DEMON_HUNTER_INITIATION_CONTENT_KEY",
        "reconcileDemonHunterInitiationActor",
        "onCreateDemonHunterInitiationToken",
        "managedVisionUpdate",
        "originalVisionUpdate",
        '"darkvision"',
        "visionModeDefaults",
        "VISION_DEFAULT_FIELDS",
        "CONFIG?.Canvas",
      ]) {
        expect(source)
          .toContain(
            marker,
          );
      }
    });

    test("registers lifecycle hooks and module API", () => {
      const source =
        readFileSync(
          ENTRYPOINT,
          "utf8",
        );

      expect(source)
        .toContain(
          'from "./demon-hunter-initiation.js"',
        );
      expect(source)
        .toContain(
          "onCreateDemonHunterInitiationItem",
        );
      expect(source)
        .toContain(
          "onDeleteDemonHunterInitiationItem",
        );
      expect(source)
        .toContain(
          "onCreateDemonHunterInitiationToken",
        );
      expect(source)
        .toContain(
          "reconcileDemonHunterInitiationActor,",
        );
      expect(source)
        .toContain(
          "reconcileDemonHunterInitiation,",
        );
    });

    test("registers a default-enabled granular automation setting", () => {
      const source =
        readFileSync(
          AUTOMATION,
          "utf8",
        );

      expect(source)
        .toContain(
          'DEMON_HUNTER_INITIATION: "demonHunterInitiationAutomation"',
        );
      expect(source)
        .toContain(
          "isDemonHunterInitiationAutomationEnabled",
        );

      const template =
        readFileSync(
          TEMPLATE,
          "utf8",
        );

      expect(template)
        .toContain(
          "schema.fields.demonHunterInitiationAutomation",
        );

      const lang =
        JSON.parse(
          readFileSync(
            LANG,
            "utf8",
          ),
        );

      expect(
        lang.BOA.settings
          .automation
          .demonHunterInitiationName,
      ).toBe(
        "Demon Hunter Initiation",
      );
    });
  },
);
