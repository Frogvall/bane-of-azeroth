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

const LANG = resolve(
  "foundry",
  "lang",
  "en.json",
);

describe(
  "Ability Actions follow-up API and localization",
  () => {
    test("exposes the deferred-damage helpers used by the system Macro", () => {
      const source =
        readFileSync(
          ENTRYPOINT,
          "utf8",
        );

      const apiStart =
        source.indexOf(
          "boaModule.api = {",
        );

      expect(apiStart)
        .toBeGreaterThanOrEqual(0);

      const apiEnd =
        source.indexOf(
          "};",
          apiStart,
        );

      const apiBlock =
        source.slice(
          apiStart,
          apiEnd,
        );

      expect(apiBlock)
        .toContain(
          "createAbilityActionResolutionMessages",
        );

      expect(apiBlock)
        .toContain(
          "rollAbilityActionResolutionDamage",
        );
    });

    test("provides a localized War Stomp 3 WP confirmation", () => {
      const lang =
        JSON.parse(
          readFileSync(
            LANG,
            "utf8",
          ),
        );

      expect(
        lang.BOA.dialog
          .abilityActions
          .warStompConfirm,
      ).toContain("3 WP");

      expect(
        lang.BOA.dialog
          .abilityActions
          .warStompConfirm,
      ).toContain("War Stomp");
    });
  },
);
