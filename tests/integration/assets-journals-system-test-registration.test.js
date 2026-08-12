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
const VERIFY = resolve(
  "tests",
  "system",
  "macros",
  "verify-assets-and-journals.js",
);

function read(path) {
  return readFileSync(path, "utf8");
}

function orderedSuiteKeys() {
  return systemTestSuiteKeys();
}

describe("asset and Journal system-test registration", () => {
  test("registers the Macro as a suite member", () => {
    const generator = read(GENERATOR);
    const entry = generator.match(
      /\{\s*"key"\s*:\s*"assets-journals"[\s\S]*?\n\s*\},/,
    );

    expect(entry).not.toBeNull();
    expect(entry[0]).toContain(
      '"id": "BoaDevAssetsJrnl"',
    );
    expect(entry[0]).toContain(
      '"file": "verify-assets-and-journals.js"',
    );
    expect(entry[0]).toContain(
      '"suiteMember": True',
    );
  });

  test("runs after generated content in Run All exactly once", () => {
    const keys = orderedSuiteKeys();

    expect(
      keys.filter(
        key => key === "assets-journals",
      ),
    ).toHaveLength(1);
    expect(
      keys.indexOf("assets-journals"),
    ).toBeGreaterThan(
      keys.indexOf("generated-content"),
    );
    expect(
      keys.indexOf("assets-journals"),
    ).toBeLessThan(
      keys.indexOf("common-animals"),
    );
  });

  test("covers assets, Journals, and Kin RollTables", () => {
    const macro = read(VERIFY);

    for (const marker of [
      'boaFetchJson("content/kin.json")',
      '"content/heroic-class-abilities.json"',
      '"config/journal-assets.json"',
      'method: "HEAD"',
      'Range: "bytes=0-0"',
      '"journal.player-options"',
      '"journal.credits"',
      '"journal-page.player-options.kin"',
      '"journal-page.player-options.derived-ratings"',
      "DISPLAY_TABLE_PREFIX",
      "SYMBOLIC_DISPLAY_PREFIX",
      "SYMBOLIC_REFERENCE_PREFIX",
      "game.tables",
      "result.documentUuid",
      "await fromUuid(",
      "result.description",
      "document.img !== result.img",
      "modules/bane-of-azeroth/",
      "All manifest, journal, Kin, and class assets are available",
    ]) {
      expect(macro).toContain(marker);
    }
  });
});
