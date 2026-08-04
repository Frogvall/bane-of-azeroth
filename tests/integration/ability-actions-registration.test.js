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
  "ability-actions.js",
);

const ENTRYPOINT = resolve(
  "foundry",
  "scripts",
  "bane-of-azeroth.js",
);

describe(
  "Ability-action runtime registration",
  () => {
    test("has a dedicated shared runtime", () => {
      expect(
        existsSync(RUNTIME),
      ).toBe(true);

      const source =
        existsSync(RUNTIME)
          ? readFileSync(
              RUNTIME,
              "utf8",
            )
          : "";

      for (const marker of [
        "WAR_STOMP_SOURCE_CONTENT_KEY",
        "EYE_BEAM_SOURCE_CONTENT_KEY",
        "reconcileActorAbilityActions",
        "patchWarStompWeaponTest",
        "useEyeBeamAction",
      ]) {
        expect(source)
          .toContain(marker);
      }
    });

    test("registers lifecycle, actor-sheet, and ready-time behavior", () => {
      const source =
        readFileSync(
          ENTRYPOINT,
          "utf8",
        );

      expect(source).toContain(
        'from "./ability-actions.js"',
      );
      expect(source).toContain(
        "onCreateAbilityActionItem",
      );
      expect(source).toContain(
        "onDeleteAbilityActionItem",
      );
      expect(source).toContain(
        "onRenderAbilityActionActorSheet",
      );
      expect(source).toContain(
        "patchWarStompWeaponTest",
      );
      expect(source).toContain(
        "reconcileAbilityActions",
      );
      expect(source).toContain(
        "onAbilityActionDamageClick",
      );
    });

    test("exposes the reconciliation and planning API", () => {
      const source =
        readFileSync(
          ENTRYPOINT,
          "utf8",
        );

      expect(source).toContain(
        "reconcileActorAbilityActions,",
      );
      expect(source).toContain(
        "getAbilityActionDefinition,",
      );
      expect(source).toContain(
        "planEyeBeamAction,",
      );
    });
  },
);
