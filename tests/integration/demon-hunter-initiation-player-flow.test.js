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

const RUNTIME = resolve(
  "foundry",
  "scripts",
  "demon-hunter-initiation.js",
);

const ENTRYPOINT = resolve(
  "foundry",
  "scripts",
  "bane-of-azeroth.js",
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

function read(
  path,
) {
  return readFileSync(
    path,
    "utf8",
  );
}

describe(
  "Demon Hunter Initiation real-Player flow",
  () => {
    test("routes non-primary clients through the primary GM", () => {
      const runtime =
        read(
          RUNTIME,
        );

      for (const marker of [
        "registerDemonHunterInitiationSocket",
        "requestDemonHunterInitiationReconcile",
        "executeDemonHunterInitiationReconcileRequest",
        "demonHunterInitiationReconcileRequest",
        "demonHunterInitiationReconcileResult",
        "getPrimaryActiveGMUser",
        "isPrimaryActiveGM",
        "testUserPermission",
        "requester.active !== true",
      ]) {
        expect(
          runtime,
        ).toContain(
          marker,
        );
      }

      const entrypoint =
        read(
          ENTRYPOINT,
        );

      expect(
        entrypoint,
      ).toContain(
        "registerDemonHunterInitiationSocket();",
      );

      expect(
        entrypoint,
      ).toContain(
        "requestDemonHunterInitiationReconcile,",
      );
    });

    test("prepares and restores the dedicated Player-flow setting and source fixture", () => {
      const prep =
        read(
          PREP,
        );

      for (const marker of [
        "heroic-class-ability.demon-hunter.demon-hunter-initiation",
        "demonHunterInitiationSourceItemId",
        "demonHunterInitiationSourceActorId",
        "originalDemonHunterInitiationAutomationSetting",
        '"demonHunterInitiationAutomation"',
      ]) {
        expect(
          prep,
        ).toContain(
          marker,
        );
      }

      const cleanup =
        read(
          CLEANUP,
        );

      for (const marker of [
        "originalDemonHunterInitiationAutomationSetting",
        '"demonHunterInitiationAutomation"',
        "Restored Demon Hunter Initiation automation",
      ]) {
        expect(
          cleanup,
        ).toContain(
          marker,
        );
      }
    });

    test("runs assignment and removal from a genuine Player context", () => {
      const player =
        read(
          PLAYER,
        );

      for (const marker of [
        "requestDemonHunterInitiationReconcile",
        "Player can request Demon Hunter Initiation reconciliation through the primary GM",
        "Real Player adds Demon Hunter Initiation and receives Darkvision through the active GM",
        "Real Player removes Demon Hunter Initiation and restores the complete sight baseline",
        "isUnlimitedDemonHunterDarkvision",
        "sameDemonHunterSight",
        "createEmbeddedDocuments",
        "deleteEmbeddedDocuments",
        "boaWaitFor",
      ]) {
        expect(
          player,
        ).toContain(
          marker,
        );
      }
    });
  },
);
