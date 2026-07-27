import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const GENERATOR = resolve("tools", "generate-system-test-macros.py");
const RUN_ALL = resolve("tests", "system", "macros", "run-all.js");
const VERIFY = resolve(
  "tests",
  "system",
  "macros",
  "verify-warlock-demons.js",
);

function read(path) {
  return readFileSync(path, "utf-8");
}

function orderedSuiteKeys(source) {
  const match = source.match(
    /const\s+orderedKeys\s*=\s*\[(?<body>[\s\S]*?)\]\s*;/,
  );
  expect(match).not.toBeNull();
  return [...match.groups.body.matchAll(/["']([^"']+)["']/g)]
    .map(result => result[1]);
}

describe("Warlock demon system-test registration", () => {
  test("registers the Macro as a suite member", () => {
    const generator = read(GENERATOR);
    const entry = generator.match(
      /\{\s*"key"\s*:\s*"warlock-demons"[\s\S]*?\n\s*\},/,
    );
    expect(entry).not.toBeNull();
    expect(entry[0]).toContain('"id": "BoaDevDemons0001"');
    expect(entry[0]).toContain(
      '"name": "BOA DEV – Verify Warlock Demons"',
    );
    expect(entry[0]).toContain(
      '"file": "verify-warlock-demons.js"',
    );
    expect(entry[0]).toContain('"suiteMember": True');
  });

  test("runs the Macro from Run All exactly once", () => {
    const keys = orderedSuiteKeys(read(RUN_ALL));
    expect(keys).toContain("warlock-demons");
    expect(keys.filter(key => key === "warlock-demons"))
      .toHaveLength(1);
    expect(keys.indexOf("warlock-demons"))
      .toBeGreaterThan(keys.indexOf("ghoul"));
    expect(keys.indexOf("warlock-demons"))
      .toBeLessThan(keys.indexOf("spell-grants"));
  });

  test("covers imported content and command runtime behavior", () => {
    const macro = read(VERIFY);
    for (const marker of [
      "actors.summoned-monsters.${expected.key}",
      'key: "felhunter"',
      'key: "imp"',
      'key: "sayaad"',
      'key: "voidwalker"',
      "handleMonsterCommandAttackClick",
      "performMonsterCommandAttack",
      "Dragonbane dialog shortcut assumes Use Action",
      "Imp command spent 2 WP from the assigned character",
      "monsterCommandResourcePayment",
      "Imp command created a WP payment chat message",
      "WP payment chat speaker is the assigned character",
      "Temporary Warlock demon WP payment chat message was deleted",
      "Temporary Warlock demon WP payer Actor was deleted",
    ]) {
      expect(macro).toContain(marker);
    }
  });
});
