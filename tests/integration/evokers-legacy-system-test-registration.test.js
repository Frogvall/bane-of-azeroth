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
  "verify-evokers-legacy.js",
);

describe(
  "Evoker's Legacy system-test registration",
  () => {
    test("registers the dedicated Macro in the generator", () => {
      const source =
        readFileSync(
          GENERATOR,
          "utf8",
        );

      expect(source).toContain(
        '"key": "evokers-legacy"',
      );
      expect(source).toContain(
        '"file": "verify-evokers-legacy.js"',
      );
    });

    test("includes Evoker's Legacy in Run All", () => {
      const source =
        readFileSync(
          RUN_ALL,
          "utf8",
        );

      expect(source).toContain(
        '"evokers-legacy"',
      );
    });

    test("keeps a source Macro contract", () => {
      const source =
        readFileSync(
          MACRO,
          "utf8",
        );

      expect(source).toContain(
        "Evoker's Legacy reduces spell costs to 2/3/4 WP",
      );
      expect(source).toContain(
        "Dragonbane PL2 spell payment actually spends 3 WP",
      );
    });
  },
);
