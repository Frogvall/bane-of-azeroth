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
const PREP = resolve(
  "tests",
  "system",
  "macros",
  "prepare-player-tests.js",
);
const PLAYER = resolve(
  "tests",
  "system",
  "macros",
  "run-player-tests.js",
);
const CLEANUP = resolve(
  "tests",
  "system",
  "macros",
  "cleanup-player-tests.js",
);

function read(path) {
  return readFileSync(path, "utf-8");
}

function generatorEntry(source, key) {
  return source.match(
    new RegExp(
      `\\{\\s*"key"\\s*:\\s*"${key}"[\\s\\S]*?\\n\\s*\\},`,
    ),
  )?.[0] ?? null;
}

describe("real-player test harness registration", () => {
  test("registers three non-suite Macros with deterministic IDs", () => {
    const generator = read(GENERATOR);
    const expected = [
      {
        key: "prepare-player-tests",
        id: "BoaDevPlyPrep001",
        file: "prepare-player-tests.js",
      },
      {
        key: "player-tests",
        id: "BoaDevPlyRun0001",
        file: "run-player-tests.js",
      },
      {
        key: "cleanup-player-tests",
        id: "BoaDevPlyClean01",
        file: "cleanup-player-tests.js",
      },
    ];

    for (const macro of expected) {
      const entry = generatorEntry(generator, macro.key);
      expect(entry).not.toBeNull();
      expect(entry).toContain(`"id": "${macro.id}"`);
      expect(entry).toContain(`"file": "${macro.file}"`);
      expect(entry).toContain('"suiteMember": False');
    }

    expect(
      generatorEntry(generator, "player-tests"),
    ).toContain('"ownershipDefault": 3');
    expect(generator).toContain(
      'macro.get("ownershipDefault", 0)',
    );
  });

  test("does not include the inter-client harness in Run All", () => {
    const runAll = read(RUN_ALL);

    for (const key of [
      "prepare-player-tests",
      "player-tests",
      "cleanup-player-tests",
    ]) {
      expect(runAll).not.toMatch(
        new RegExp(`["']${key}["']`),
      );
    }
  });

  test("prep creates a Player, owned fixtures, abilities, password, and hotbar Macro", () => {
    const source = read(PREP);

    for (const marker of [
      "CONST.USER_ROLES.PLAYER",
      "password",
      "Shamanic Calling",
      "Summon Ghoul",
      "Demonologist",
      "spells.elemental-totem",
      "actors.summoned-monsters.imp",
      "playerMacroId",
      '"hotbar.1"',
      "scene.activate()",
      "whisper: gmIds",
      "playerTestSession",
      "playerTestFixture",
    ]) {
      expect(source).toContain(marker);
    }
  });

  test("player Macro verifies real Player ownership and command payment", () => {
    const source = read(PLAYER);

    for (const marker of [
      "game.user.isGM",
      "CONST.USER_ROLES.PLAYER",
      "game.user.character",
      "testUserPermission",
      "At least one GM client is connected",
      "performMonsterCommandAttack",
      "monsterCommandResourcePayment",
      "player-authored WP message",
      "playerTestReport",
      "whisper: recipients",
    ]) {
      expect(source).toContain(marker);
    }
  });

  test("cleanup refuses active players and removes all session fixtures", () => {
    const source = read(CLEANUP);

    for (const marker of [
      "activeFixtureUsers",
      "Log the incognito player client out",
      "ChatMessage.deleteDocuments",
      "Macro.deleteDocuments",
      "Scene.deleteDocuments",
      "Actor.deleteDocuments",
      "User.deleteDocuments",
      "originalAutomationSetting",
      "previousActiveSceneId",
      "All player-test fixtures were removed",
    ]) {
      expect(source).toContain(marker);
    }
  });

  test("all three Macros use the same session schema and flags", () => {
    for (const source of [
      read(PREP),
      read(PLAYER),
      read(CLEANUP),
    ]) {
      expect(source).toContain('"playerTestSession"');
      expect(source).toContain('"playerTestFixture"');
      expect(source).toContain('"playerTestSessionId"');
    }
  });
});
