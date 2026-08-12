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

const GENERATOR =
  resolve(
    "tools",
    "generate-system-test-macros.py",
  );
const MACRO =
  resolve(
    "tests",
    "system",
    "macros",
    "verify-death-knight-runes.js",
  );

describe(
  "Death Knight Runes system-test registration",
  () => {
    test(
      "registers the dedicated developer Macro with a stable ID",
      () => {
        const generator =
          readFileSync(
            GENERATOR,
            "utf-8",
          );

        for (
          const marker
          of [
            '"key": "death-knight-runes"',
            '"id": "BoaDevRunes00016"',
            '"name": "BOA DEV – Verify Death Knight Runes"',
            '"file": "verify-death-knight-runes.js"',
            '"order": 24',
          ]
        ) {
          expect(
            generator,
          ).toContain(
            marker,
          );
        }

        expect(
          existsSync(
            MACRO,
          ),
        ).toBe(
          true,
        );
      },
    );

    test(
      "keeps the Macro contract explicit about manual and automated rune rules",
      () => {
        const source =
          readFileSync(
            MACRO,
            "utf-8",
          );

        for (
          const marker
          of [
            "Only Unending Thirst is mechanically automated",
            "applyOnlyWhenEquipped",
            "system.movement.value",
            "Fallen Crusader remains a visual/rules reminder",
            "Razorice remains a visual/rules reminder",
            "stretch required to engrave or replace a rune remains manual",
          ]
        ) {
          expect(
            source,
          ).toContain(
            marker,
          );
        }
      },
    );
  },
);
