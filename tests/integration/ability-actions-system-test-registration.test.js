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
import {
  systemTestSuiteKeys,
} from "../helpers/system-test-suite.js";

const GENERATOR = resolve(
  "tools",
  "generate-system-test-macros.py",
);

const RUN_ALL = resolve(
  "tests",
  "system",
  "macros",
  "run-all.js",
);

const MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-ability-actions.js",
);

describe(
  "Ability-action system-test registration",
  () => {
    test("registers the combined system Macro", () => {
      const generator =
        readFileSync(
          GENERATOR,
          "utf8",
        );

      expect(generator)
        .toContain(
          '"key": "ability-actions"',
        );

      expect(generator)
        .toContain(
          '"file": "verify-ability-actions.js"',
        );
    });

    test("includes ability actions in Run All", () => {
      const keys =
        systemTestSuiteKeys();

      expect(
        keys.filter(
          candidate =>
            candidate === "ability-actions",
        ),
      ).toHaveLength(1);
    });

    test("keeps both rule contracts in the Macro source", () => {
      const source =
        readFileSync(
          MACRO,
          "utf8",
        );

      expect(source)
        .toContain(
          "War Stomp is represented as a managed BRAWLING attack",
        );

      expect(source)
        .toContain(
          "Eye Beam is automatic 2D8 magical damage rather than a weapon test",
        );
      expect(source)
        .toContain(
          "Managed Eye Beam appears under Weapons with range 20 and 2D8",
        );
    });
  },
);
