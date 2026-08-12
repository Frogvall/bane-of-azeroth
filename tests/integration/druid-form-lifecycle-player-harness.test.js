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

function macro(
  name,
) {
  return readFileSync(
    resolve(
      "tests",
      "system",
      "macros",
      name,
    ),
    "utf8",
  );
}

describe(
  "Druid lifecycle real-Player harness",
  () => {
    test(
      "prepare, player run, and cleanup carry Druid lifecycle fixtures and settings",
      () => {
        const prepare =
          macro(
            "prepare-player-tests.js",
          );
        const run =
          macro(
            "run-player-tests.js",
          );
        const cleanup =
          macro(
            "cleanup-player-tests.js",
          );

        expect(
          prepare,
        ).toContain(
          "druidSavageItemId",
        );
        expect(
          prepare,
        ).toContain(
          "originalDruidFormsAutomationSetting",
        );
        expect(
          run,
        ).toContain(
          "Real Player can activate Savage Incarnation through GM authority",
        );
        expect(
          run,
        ).toContain(
          "Real Player free-action form change spends exactly 1 WP",
        );
        expect(
          cleanup,
        ).toContain(
          "originalDruidFormsAutomationSetting",
        );
      },
    );
  },
);
