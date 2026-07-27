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

function read(path) {
  return readFileSync(path, "utf-8");
}

function macroEntry(source, key) {
  return source.match(
    new RegExp(
      `\\{\\s*"key"\\s*:\\s*"${key}"[\\s\\S]*?\\n\\s*\\},`,
    ),
  )?.[0] ?? null;
}

function macroIcon(source, key) {
  return macroEntry(source, key)?.match(
    /"img"\s*:\s*"([^"]+)"/,
  )?.[1] ?? null;
}

describe("developer-test Macro icons", () => {
  test("uses valid core icons for player tests", () => {
    const generator = read(GENERATOR);

    expect(
      macroIcon(generator, "player-tests"),
    ).toBe("icons/svg/mystery-man.svg");
    expect(
      macroIcon(generator, "cleanup-player-tests"),
    ).toBe("icons/svg/biohazard.svg");

    expect(generator).not.toContain(
      '"img": "icons/svg/d20-black.svg"',
    );
    expect(generator).not.toContain(
      '"img": "icons/svg/broom.svg"',
    );
  });

  test("separates attack messages from Run All", () => {
    const generator = read(GENERATOR);
    const runAll = macroIcon(generator, "run-all");
    const attacks = macroIcon(
      generator,
      "common-animal-attack-messages",
    );

    expect(runAll).toBe(
      "icons/svg/dice-target.svg",
    );
    expect(attacks).toBe(
      "icons/svg/combat.svg",
    );
    expect(attacks).not.toBe(runAll);
  });
});
