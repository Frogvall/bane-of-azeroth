import {
  afterEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  mayCurrentUserRequestDemonHunterInitiationReconcile,
  needsAutomaticDemonHunterInitiationReconcile,
  requestDemonHunterInitiationReconcile,
} from "../../foundry/scripts/demon-hunter-initiation.js";
import {
  WarlockDemonPlacementRejection,
} from "../../foundry/scripts/warlock-demons/creation.js";
import {
  shouldLogWarlockDemonCreationRequestError,
} from "../../foundry/scripts/warlock-demons/socket.js";

const originalGame =
  globalThis.game;
const originalConst =
  globalThis.CONST;

afterEach(
  () => {
    globalThis.game =
      originalGame;
    globalThis.CONST =
      originalConst;
  },
);

describe(
  "Player workflow false-error policy",
  () => {
    test(
      "automatic Demon Hunter reconciliation skips a non-owner Player",
      () => {
        const player = {
          id: "player",
          isGM: false,
        };
        const actor = {
          id: "actor",
          testUserPermission:
            () => false,
        };

        expect(
          mayCurrentUserRequestDemonHunterInitiationReconcile(
            actor,
            {
              user: player,
              ownerLevel: 3,
            },
          ),
        ).toBe(false);
      },
    );

    test(
      "explicit Demon Hunter authority still rejects a non-owner Player",
      async () => {
        const player = {
          id: "player",
          isGM: false,
        };
        const actor = {
          id: "actor",
          testUserPermission:
            () => false,
        };

        globalThis.CONST = {
          DOCUMENT_OWNERSHIP_LEVELS: {
            OWNER: 3,
          },
        };
        globalThis.game = {
          user: player,
        };

        await expect(
          requestDemonHunterInitiationReconcile(
            actor,
          ),
        ).rejects.toThrow(
          "You do not own this Demon Hunter Initiation Actor.",
        );
      },
    );

    test(
      "automatic Demon Hunter reconciliation remains allowed for owner and GM",
      () => {
        const owner = {
          id: "owner",
          isGM: false,
        };
        const gm = {
          id: "gm",
          isGM: true,
        };
        const actor = {
          id: "actor",
          testUserPermission:
            user =>
              user === owner,
        };

        expect(
          mayCurrentUserRequestDemonHunterInitiationReconcile(
            actor,
            {
              user: owner,
              ownerLevel: 3,
            },
          ),
        ).toBe(true);

        expect(
          mayCurrentUserRequestDemonHunterInitiationReconcile(
            actor,
            {
              user: gm,
              ownerLevel: 3,
            },
          ),
        ).toBe(true);
      },
    );

    test(
      "automatic Demon Hunter hooks ignore an unrelated Player-owned Actor",
      () => {
        const player = {
          id: "player",
          isGM: false,
        };
        const unrelatedActor = {
          id: "stoneskin-totem",
          items: [],
          testUserPermission:
            () => true,
          getFlag:
            () => undefined,
        };

        expect(
          mayCurrentUserRequestDemonHunterInitiationReconcile(
            unrelatedActor,
            {
              user: player,
              ownerLevel: 3,
            },
          ),
        ).toBe(true);

        expect(
          needsAutomaticDemonHunterInitiationReconcile(
            unrelatedActor,
            {
              scenes: [],
            },
          ),
        ).toBe(false);
      },
    );

    test(
      "automatic Demon Hunter hooks retain managed cleanup Actors",
      () => {
        const managedActor = {
          id: "managed-demon-hunter",
          items: [],
          getFlag:
            (_moduleId, key) =>
              key ===
                "demonHunterInitiationManagedPrototypeVision"
                ? true
                : undefined,
        };

        expect(
          needsAutomaticDemonHunterInitiationReconcile(
            managedActor,
            {
              scenes: [],
            },
          ),
        ).toBe(true);
      },
    );

    test(
      "expected Warlock placement rejection is not an internal request error",
      () => {
        expect(
          shouldLogWarlockDemonCreationRequestError(
            new WarlockDemonPlacementRejection(
              "The Warlock demon position is outside range (30 m).",
            ),
          ),
        ).toBe(false);

        expect(
          shouldLogWarlockDemonCreationRequestError(
            new Error(
              "Database update failed.",
            ),
          ),
        ).toBe(true);
      },
    );
  },
);
