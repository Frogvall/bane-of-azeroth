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
  fileURLToPath,
} from "node:url";

const ENTRYPOINT = fileURLToPath(
  new URL(
    "../../foundry/scripts/bane-of-azeroth.js",
    import.meta.url,
  ),
);
const RUNTIME = fileURLToPath(
  new URL(
    "../../foundry/scripts/mage-brilliance.js",
    import.meta.url,
  ),
);

describe("Mage's Brilliance spell cost registration", () => {
  test("has a dedicated runtime module", () => {
    expect(existsSync(RUNTIME)).toBe(true);

    const source = existsSync(RUNTIME)
      ? readFileSync(RUNTIME, "utf8")
      : "";

    expect(source).toContain(
      "patchMageBrillianceSpellCost",
    );
    expect(source).toContain(
      "getSpellCost",
    );
    expect(source).toContain(
      "isLegacyDragonbaneMagicTrickHandler",
    );
    expect(source).toContain(
      "castLegacyFreeSenseMagicTrick",
    );
    expect(source).toContain(
      "registerMageBrillianceLegacyMagicTrickAdapter",
    );
  });

  test("patches spell cost during module init", () => {
    const source =
      readFileSync(ENTRYPOINT, "utf8");

    expect(source).toContain(
      'from "./mage-brilliance.js"',
    );
    expect(source).toContain(
      "patchMageBrillianceSpellCost();",
    );
    expect(source).toContain(
      "registerMageBrillianceLegacyMagicTrickAdapter();",
    );
  });
});
