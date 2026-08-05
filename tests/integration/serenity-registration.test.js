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
  "serenity.js",
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
  "Monk's Serenity registration",
  () => {
    test("has a dedicated Serenity runtime", () => {
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
        "SERENITY_CONTENT_KEY",
        "reconcileSerenityActor",
        "onCreateSerenityItem",
        "onDeleteSerenityItem",
        "onRenderSerenityActorSheet",
      ]) {
        expect(source)
          .toContain(
            marker,
          );
      }
    });

    test("registers Serenity lifecycle and API", () => {
      const source =
        readFileSync(
          ENTRYPOINT,
          "utf8",
        );

      expect(source)
        .toContain(
          'from "./serenity.js"',
        );

      expect(source)
        .toContain(
          "onCreateSerenityItem",
        );

      expect(source)
        .toContain(
          "onDeleteSerenityItem",
        );

      expect(source)
        .toContain(
          "onRenderSerenityActorSheet",
        );

      expect(source)
        .toContain(
          "reconcileSerenityActor,",
        );

      expect(source)
        .toContain(
          "reconcileSerenity,",
        );
    });

    test("registers one default-enabled Serenity automation setting", () => {
      const source =
        readFileSync(
          AUTOMATION,
          "utf8",
        );

      expect(source)
        .toContain(
          'SERENITY: "serenityAutomation"',
        );

      expect(source)
        .toContain(
          "isSerenityAutomationEnabled",
        );

      expect(source)
        .toContain(
          "AUTOMATION_SETTING_KEYS.SERENITY",
        );

      const template =
        readFileSync(
          TEMPLATE,
          "utf8",
        );

      expect(template)
        .toContain(
          "schema.fields.serenityAutomation",
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
          .serenityName,
      ).toBe(
        "Monk's Serenity",
      );
    });
  },
);
