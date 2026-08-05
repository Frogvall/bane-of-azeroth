import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  executeDemonHunterInitiationReconcileRequest,
} from "../../foundry/scripts/demon-hunter-initiation.js";

function collection(
  entries,
) {
  return new Map(
    entries.map(
      value => [
        value.id,
        value,
      ],
    ),
  );
}

describe(
  "Demon Hunter Initiation GM authority",
  () => {
    test("allows an active Player Owner to request reconciliation", async () => {
      const requester = {
        id:
          "player",
        active:
          true,
        isGM:
          false,
      };

      const actor = {
        id:
          "actor",
        testUserPermission:
          vi.fn(
            (
              user,
              level,
            ) =>
              user ===
                requester &&
              level ===
                3,
          ),
      };

      const reconcileActor =
        vi.fn(
          async () =>
            true,
        );

      await expect(
        executeDemonHunterInitiationReconcileRequest(
          {
            requesterUserId:
              requester.id,
            actorId:
              actor.id,
          },
          {
            users:
              collection([
                requester,
              ]),
            actors:
              collection([
                actor,
              ]),
            reconcileActor,
            ownerLevel:
              3,
          },
        ),
      ).resolves.toEqual({
        actorId:
          actor.id,
      });

      expect(
        actor.testUserPermission,
      ).toHaveBeenCalledWith(
        requester,
        3,
      );

      expect(
        reconcileActor,
      ).toHaveBeenCalledTimes(
        1,
      );

      expect(
        reconcileActor,
      ).toHaveBeenCalledWith(
        actor,
      );
    });

    test("rejects a Player who does not own the Actor", async () => {
      const requester = {
        id:
          "player",
        active:
          true,
        isGM:
          false,
      };

      const actor = {
        id:
          "actor",
        testUserPermission:
          vi.fn(
            () =>
              false,
          ),
      };

      const reconcileActor =
        vi.fn();

      await expect(
        executeDemonHunterInitiationReconcileRequest(
          {
            requesterUserId:
              requester.id,
            actorId:
              actor.id,
          },
          {
            users:
              collection([
                requester,
              ]),
            actors:
              collection([
                actor,
              ]),
            reconcileActor,
            ownerLevel:
              3,
          },
        ),
      ).rejects.toThrow(
        "does not own",
      );

      expect(
        reconcileActor,
      ).not.toHaveBeenCalled();
    });

    test("rejects an inactive requester before reconciliation", async () => {
      const requester = {
        id:
          "player",
        active:
          false,
        isGM:
          false,
      };

      const actor = {
        id:
          "actor",
        testUserPermission:
          vi.fn(
            () =>
              true,
          ),
      };

      const reconcileActor =
        vi.fn();

      await expect(
        executeDemonHunterInitiationReconcileRequest(
          {
            requesterUserId:
              requester.id,
            actorId:
              actor.id,
          },
          {
            users:
              collection([
                requester,
              ]),
            actors:
              collection([
                actor,
              ]),
            reconcileActor,
            ownerLevel:
              3,
          },
        ),
      ).rejects.toThrow(
        "not active",
      );

      expect(
        reconcileActor,
      ).not.toHaveBeenCalled();
    });

    test("allows an active GM without Actor ownership", async () => {
      const requester = {
        id:
          "gm",
        active:
          true,
        isGM:
          true,
      };

      const actor = {
        id:
          "actor",
        testUserPermission:
          vi.fn(
            () =>
              false,
          ),
      };

      const reconcileActor =
        vi.fn(
          async () =>
            true,
        );

      await expect(
        executeDemonHunterInitiationReconcileRequest(
          {
            requesterUserId:
              requester.id,
            actorId:
              actor.id,
          },
          {
            users:
              collection([
                requester,
              ]),
            actors:
              collection([
                actor,
              ]),
            reconcileActor,
            ownerLevel:
              3,
          },
        ),
      ).resolves.toEqual({
        actorId:
          actor.id,
      });

      expect(
        reconcileActor,
      ).toHaveBeenCalledWith(
        actor,
      );
    });
  },
);
