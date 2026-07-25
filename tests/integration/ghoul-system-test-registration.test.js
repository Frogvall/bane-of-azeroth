import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

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
const VERIFY_GHOUL = resolve(
  "tests",
  "system",
  "macros",
  "verify-ghoul.js",
);

function read(path) {
  return readFileSync(path, "utf-8");
}

function orderedSuiteKeys(source) {
  const match = source.match(
    /const\s+orderedKeys\s*=\s*\[(?<body>[\s\S]*?)\]\s*;/,
  );
  expect(match).not.toBeNull();

  return [
    ...match.groups.body.matchAll(/["']([^"']+)["']/g),
  ].map(result => result[1]);
}

describe("Ghoul system-test registration", () => {
  test("registers the Ghoul macro as a suite member", () => {
    const generator = read(GENERATOR);
    const entry = generator.match(
      /\{\s*"key"\s*:\s*"ghoul"[\s\S]*?\n\s*\},/,
    );

    expect(entry).not.toBeNull();
    expect(entry[0]).toContain(
      '"file": "verify-ghoul.js"',
    );
    expect(entry[0]).toContain(
      '"suiteMember": True',
    );
  });

  test("runs the Ghoul macro from Run All exactly once", () => {
    const keys = orderedSuiteKeys(read(RUN_ALL));

    expect(keys).toContain("ghoul");
    expect(keys.filter(key => key === "ghoul")).toHaveLength(1);
    expect(keys.indexOf("ghoul")).toBeGreaterThan(
      keys.indexOf("common-animal-movement"),
    );
    expect(keys.indexOf("ghoul")).toBeLessThan(
      keys.indexOf("spell-grants"),
    );
  });

  test("covers imported content and controlled attack behavior", () => {
    const macro = read(VERIFY_GHOUL);

    for (const marker of [
      'boaFindWorldActor("actors.summoned-monsters.ghoul")',
      "performControlledMonsterAttack",
      "monsterAttackResourcePayment",
      "Infectious Bite spent 2 WP from the assigned character",
      "Infectious Bite created a WP payment chat message",
      "WP payment chat speaker is the assigned character",
      "Temporary Ghoul WP payment chat message was deleted",
      "Temporary Ghoul WP payer Actor was deleted",
    ]) {
      expect(macro).toContain(marker);
    }
  });
});
