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
const LIBRARY = resolve(
  "tests",
  "system",
  "lib",
  "boa-system-test-lib.js",
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

  test("prep creates the Player fixtures and posts credentials after its report", () => {
    const source = read(PREP);

    for (const marker of [
      "CONST.USER_ROLES.PLAYER",
      "password",
      "Shamanic Calling",
      "Raise Ghoul",
      "Demonologist",
      "spells.elemental-totem",
      "actors.summoned-monsters.imp",
      "playerMacroId",
      '"hotbar.1"',
      "scene.activate()",
      "credentialMessageData",
      "boaResultHtml(prepareResult)",
      "ChatMessage.create(credentialMessageData)",
      "createChatMessage: false",
      "playerTestStageResult",
    ]) {
      expect(source).toContain(marker);
    }

    expect(source).toMatch(
      /content:\s*boaResultHtml\(prepareResult\)[\s\S]*?ChatMessage\.create\(credentialMessageData\)/,
    );
  });

  test("player Macro stores its complete structured stage result", () => {
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
      "playerTestStageResult",
      'stage: "player"',
      "result,",
      "whisper: recipients",
      "BOA Player Tests Complete",
      "NEEDS ATTENTION",
      "BOA DEV – Cleanup Player Tests",
      'kind: "player-summary"',
      "whisper: gmIds",
    ]) {
      expect(source).toContain(marker);
    }
  });

  test("removes manual setup already handled by the player harness", () => {
    const library = read(LIBRARY);
    const runAll = read(RUN_ALL);
    const player = read(PLAYER);

    for (const removed of [
      "Place a character token with the",
      "Ensure the character has enough Willpower Points",
      "Keep a game master connected throughout player tests",
    ]) {
      expect(library).not.toContain(removed);
    }

    for (const retained of [
      "BOA DEV – Prepare Player Tests",
      "The real-player harness now verifies",
      "Using the prepared Player Test session",
      "sheet, drag, and real Elemental",
      "Totem socket interactions need manual verification",
    ]) {
      expect(library).toContain(retained);
    }

    expect(runAll).toContain(
      "a real Elemental Totem cast through the ",
    );
    expect(runAll).toContain(
      "player–GM socket remain manual.",
    );
    expect(player).toContain(
      "A real successful Elemental Totem spell roll",
    );
  });

  test("cleanup disconnects active fixtures before deleting them", () => {
    const source = read(CLEANUP);

    for (const marker of [
      "activeFixtureUsers",
      "CONST.USER_ROLES.NONE",
      "boaWaitFor",
      "temporary Player User to disconnect",
      "Disconnected active Player User",
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

    expect(source).not.toContain(
      "Log the incognito player client out",
    );
  });

  test("cleanup creates the same Journal-style report as Run All", () => {
    const source = read(CLEANUP);

    for (const marker of [
      "playerTestStageResult",
      "Missing Prepare Player Tests result",
      "Missing Run Player Tests result",
      "boaCreateSystemTestReport",
      "boaSystemTestTotals",
      "BOA DEV – Player Test Harness",
      "Dated Journal player-test report was created",
      "Open the complete player-test report",
      "report?.sheet?.render(true)",
    ]) {
      expect(source).toContain(marker);
    }
  });

  test("all three Macros use the same session and stage-result flags", () => {
    for (const source of [
      read(PREP),
      read(PLAYER),
      read(CLEANUP),
    ]) {
      expect(source).toContain('"playerTestSession"');
      expect(source).toContain('"playerTestFixture"');
      expect(source).toContain('"playerTestSessionId"');
      expect(source).toContain('"playerTestStageResult"');
    }
  });
});
