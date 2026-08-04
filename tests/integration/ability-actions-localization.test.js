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

const LANG = resolve(
  "foundry",
  "lang",
  "en.json",
);

describe(
  "Ability-action localization",
  () => {
    test("provides settings and runtime copy for both abilities", () => {
      const lang =
        JSON.parse(
          readFileSync(
            LANG,
            "utf8",
          ),
        );

      const settings =
        lang.BOA.settings.automation;

      expect(
        settings.groupKinAbilities,
      ).toBe("Kin Abilities");

      expect(
        settings.warStompName,
      ).toBe("War Stomp");

      expect(
        settings.eyeBeamName,
      ).toBe("Eye Beam");

      const dialog =
        lang.BOA.dialog.abilityActions;

      expect(
        dialog.eyeBeamConfirm,
      ).toContain("3 WP");

      expect(
        dialog.eyeBeamConfirm,
      ).toContain("2D8");

      expect(
        dialog.warStompResolveHint,
      ).toContain("defense");
    });
  },
);
