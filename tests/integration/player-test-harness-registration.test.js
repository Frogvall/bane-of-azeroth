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

  test("prep creates rest lifecycle and demon defense fixtures", () => {
    const source = read(PREP);

    for (const marker of [
      "actors.summoned-monsters.sayaad",
      "actors.elemental-totems.cleansing",
      "createFixtureToken",
      '"phase-shift-target"',
      '"seductive-target"',
      '"stretch-totem"',
      '"stretch-demon"',
      '"shift-totem"',
      '"shift-demon"',
      '"other-caster-control"',
      "shiftActorId",
      "lifecycleSceneId",
      "originalDemonAutomationSetting",
      '"demonAutomation"',
    ]) {
      expect(source).toContain(marker);
    }
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

  test("player Macro verifies defense banes and real Player rest cleanup", () => {
    const source = read(PLAYER);

    for (const marker of [
      "applyWarlockDemonDefenseBane",
      "Real Player receives Phase Shift as a preselected bane against an Imp",
      "Real Player receives Seductive only for a melee attack against a Sayaad",
      "restStretch",
      "restShift",
      "runRestMethod",
      "Real Player Stretch rest removes Totems but keeps Shift-duration demons",
      "Real Player Shift rest removes Totems and Warlock demons across Scenes",
      "otherCasterTotemTokenId",
      "boaWaitFor",
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
      "originalDemonAutomationSetting",
      '"demonAutomation"',
      "Restored Warlock demon automation",
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

  test("prep creates the real-player Voidwalker Suffering fixtures", () => {
    const source = read(PREP);

    for (const marker of [
      "actors.summoned-monsters.voidwalker",
      '"suffering-character"',
      '"suffering-caster-token"',
      '"suffering-voidwalker-token"',
      "sufferingActorId",
      "sufferingActorUuid",
      "sufferingActorTokenId",
      "sufferingVoidwalkerTokenId",
      'demonKey: "voidwalker"',
      'duration: "shift"',
    ]) {
      expect(source).toContain(marker);
    }
  });

  test("player Macro defines the red real-player Suffering scenario", () => {
    const source = read(PLAYER);

    for (const marker of [
      "sufferingActor.applyDamage(finalDamage)",
      "Voidwalker Suffering damage sharing through the active GM",
      "Real Player Suffering splits 5 final damage into 3 HP loss for caster and Voidwalker",
      "Real-player Voidwalker Suffering completed",
      "casterHpLoss: 3",
      "voidwalkerHpLoss: 3",
      "voidwalkerArmor: 6",
    ]) {
      expect(source).toContain(marker);
    }
  });


  test("player Macro expects the formula and Dragonbane-native Voidwalker damage card", () => {
    const source = read(PLAYER);

    for (const marker of [
      "sufferingMessages",
      'data-actor-id="${voidwalkerActor.uuid}"',
      "nativeVoidwalkerDamageMessages",
      "voidwalkerSuffering",
      "Real Player Suffering shows its halving formula and one native Voidwalker damage card",
      "visibleFormula",
    ]) {
      expect(source).toContain(marker);
    }
  });


  test("Player message collection respects GM-authored Suffering cards and cleanup removes them", () => {
    const player = read(PLAYER);
    const cleanup = read(CLEANUP);

    for (const marker of [
      'message.canUserModify(',
      'game.user,',
      '"update"',
      "if (!canUpdate) continue;",
      "return messages;",
    ]) {
      expect(player).toContain(marker);
    }

    for (const marker of [
      "nativeSufferingActorUuids",
      "sufferingVoidwalkerTokenId",
      "isNativeSufferingFixtureMessage",
      'data-actor-id="${actorUuid}"',
      "ChatMessage.deleteDocuments",
    ]) {
      expect(cleanup).toContain(marker);
    }
  });


  test("player Macro waits for the GM-authored native Suffering card to synchronize", () => {
    const source = read(PLAYER);

    for (const marker of [
      "isNativeVoidwalkerDamageMessage",
      "native Voidwalker damage card synchronization",
      "messagesSince(",
      "sufferingMessagesBefore",
      "sufferingMessages = messagesSince(",
      ".some(",
    ]) {
      expect(source).toContain(marker);
    }

    expect(
      source.indexOf(
        "native Voidwalker damage card synchronization",
      ),
    ).toBeLessThan(
      source.indexOf(
        "nativeVoidwalkerDamageMessages",
      ),
    );
  });


  test("player Macro identifies the GM-authored native card by Actor UUID", () => {
    const source = read(PLAYER);

    for (const marker of [
      "isNativeVoidwalkerDamageMessage",
      'class="damage-message',
      'data-actor-id="${voidwalkerActor.uuid}"',
      "native Voidwalker damage card synchronization",
    ]) {
      expect(source).toContain(marker);
    }

    expect(source).not.toContain(
      "const localizedDamageApplied =",
    );
  });


  test("the Player harness verifies real Demonologist creation through the primary GM", () => {
    const prep = read(PREP);
    const player = read(PLAYER);

    for (const marker of [
      '"demon-summoner"',
      '"demon-summoner-token"',
      "summonActorId",
      "summonCasterTokenId",
    ]) {
      expect(prep).toContain(marker);
    }

    for (const removed of [
      "const summonSourceMessage =",
      "summonSourceMessageId:",
      '"demonologist-source-message"',
      "user: user.id",
      '@UUID[${summonAbility.uuid}]',
    ]) {
      expect(prep).not.toContain(removed);
    }

    for (const marker of [
      "buildWarlockDemonPlan",
      "requestWarlockDemonCreation",
      "ChatMessage.create({",
      "summonSourceMessage.update({",
      "source-message fixture",
      '"demonologist-source-message"',
      "Real Player authored the Demonologist source message",
      "summonMessageAuthorId",
      "Primary GM rejects an out-of-range real Player demon placement",
      "Real Player creates an owned Imp through the primary GM socket",
      "A second real Player summon replaces the previous demon",
      "Real Player Shift rest removes the demon created through the GM socket",
      "actorIsSynthetic",
      'duration: "shift"',
    ]) {
      expect(player).toContain(marker);
    }

    expect(player).toMatch(
      /summonType\s*:\s*"warlock-demon"/,
    );
    expect(player).toMatch(
      /DOCUMENT_OWNERSHIP_LEVELS\s*\.\s*OBSERVER/,
    );

    expect(
      player.indexOf(
        '"<p>BOA real-player Demonologist "',
      ),
    ).toBeLessThan(
      player.indexOf(
        "summonSourceMessage.update({",
      ),
    );
    expect(
      player.indexOf(
        "summonSourceMessage.update({",
      ),
    ).toBeLessThan(
      player.indexOf(
        "buildWarlockDemonPlan(",
      ),
    );
  });

  test("real-player Frostreaper coverage and manual aura checks are registered", () => {
    const prep = read(PREP);
    const player = read(PLAYER);
    const cleanup = read(CLEANUP);
    const library = read(LIBRARY);

    for (const marker of [
      "heroic-class-ability.death-knight.frostreaper",
      "Frostreaper",
      "originalFrostreaperAutomationSetting",
      '"frostreaperAutomation"',
    ]) {
      expect(prep).toContain(marker);
    }

    for (const marker of [
      "createFrostreaperActivationData",
      "getFrostreaperAuraData",
      "isFrostreaperActivationActive",
      "Real Player Frostreaper activation identifies the owned Actor and Token",
      "Real Player authors the persisted Frostreaper activation message",
      "Real Player can persist Frostreaper activation state without Token writes",
      "Real Player Frostreaper state produces the expected visual aura data",
      '"player-frostreaper-message"',
      "0x8edbff",
      "500",
    ]) {
      expect(player).toContain(marker);
    }

    for (const marker of [
      "originalFrostreaperAutomationSetting",
      '"frostreaperAutomation"',
      "Restored Frostreaper automation",
    ]) {
      expect(cleanup).toContain(marker);
    }

    for (const marker of [
      "<h2>Frostreaper aura verification</h2>",
      "apparent 10 meter radius",
      "Death Knight's own turn begins in the next round",
      "Repeat a real activation as the prepared owning Player",
      "both the Player client and connected GM client see the same aura",
      "Activating Frostreaper outside combat creates no aura",
      "does not change any creature's movement rate",
      "does not automatically roll or prompt BUSHCRAFT",
    ]) {
      expect(library).toContain(marker);
    }
  });

});
