import {
  describe,
  expect,
  test,
} from "vitest";
import {
  existsSync,
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

const RUNTIME = resolve(
  "foundry",
  "scripts",
  "evokers-legacy.js",
);

const ENTRYPOINT = resolve(
  "foundry",
  "scripts",
  "bane-of-azeroth.js",
);

describe(
  "Evoker's Legacy runtime registration",
  () => {
    test("has a dedicated runtime module", () => {
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

      expect(source).toContain(
        "patchEvokersLegacySpellCost",
      );
      expect(source).toContain(
        "getSpellCost",
      );
    });

    test("patches spell cost during module init", () => {
      const source =
        readFileSync(
          ENTRYPOINT,
          "utf8",
        );

      expect(source).toContain(
        'from "./evokers-legacy.js"',
      );
      expect(source).toContain(
        "patchEvokersLegacySpellCost();",
      );
    });
  },
);
