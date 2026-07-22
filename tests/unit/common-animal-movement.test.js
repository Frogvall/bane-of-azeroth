import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import * as movement from "../../foundry/scripts/common-animal-movement.js";

const MODULE_ID = "bane-of-azeroth";

const resolveMovementRate =
  movement.resolveCommonAnimalMovementRate;
const synchronizeMovement =
  movement.synchronizeCommonAnimalTokenMovement;
const onUpdateMovementToken =
  movement.onUpdateCommonAnimalMovementToken;

function makeToken({
  actorLink = false,
  movementRates = {
    base: 2,
    fly: 14,
  },
  movementValue = 2,
} = {}) {
  const actor = {
    isToken: !actorLink,
    system: {
      movement: {
        value: movementValue,
      },
    },
    getFlag: vi.fn(
      (moduleId, key) => {
        if (
          moduleId === MODULE_ID &&
          key === "movementRates"
        ) {
          return movementRates;
        }

        return undefined;
      }
    ),
    update: vi.fn(
      async changes => {
        const value =
          changes[
            "system.movement.value"
          ];

        if (value != null) {
          actor.system.movement.value =
            value;
        }

        return actor;
      }
    ),
  };

  return {
    actorLink,
    actor,
    movementAction: "walk",
  };
}

test("exports the Common Animal movement integration functions", () => {
  expect(resolveMovementRate).toEqual(
    expect.any(Function)
  );
  expect(synchronizeMovement).toEqual(
    expect.any(Function)
  );
  expect(onUpdateMovementToken).toEqual(
    expect.any(Function)
  );
});

describe.skipIf(
  typeof resolveMovementRate !== "function" ||
  typeof synchronizeMovement !== "function" ||
  typeof onUpdateMovementToken !== "function"
)("Common Animal movement integration", () => {
  describe("resolveCommonAnimalMovementRate", () => {
    test("uses base movement for the default action", () => {
      expect(
        resolveMovementRate({
          movementRates: {
            base: 2,
            fly: 14,
          },
          movementAction: "walk",
          defaultAction: "walk",
        })
      ).toBe(2);
    });

    test.each([
      {
        label: "Dragonhawk fly",
        movementRates: {
          base: 2,
          fly: 14,
        },
        movementAction: "fly",
        expected: 14,
      },
      {
        label: "Crocolisk swim",
        movementRates: {
          base: 6,
          swim: 12,
        },
        movementAction: "swim",
        expected: 12,
      },
    ])("uses the alternate rate for $label", ({
      movementRates,
      movementAction,
      expected,
    }) => {
      expect(
        resolveMovementRate({
          movementRates,
          movementAction,
          defaultAction: "walk",
        })
      ).toBe(expected);
    });

    test("falls back to base movement for an unsupported action", () => {
      expect(
        resolveMovementRate({
          movementRates: {
            base: 6,
            swim: 12,
          },
          movementAction: "fly",
          defaultAction: "walk",
        })
      ).toBe(6);
    });

    test.each([
      {
        label: "missing metadata",
        movementRates: null,
      },
      {
        label: "missing base rate",
        movementRates: {
          fly: 14,
        },
      },
      {
        label: "non-numeric base rate",
        movementRates: {
          base: "fast",
          fly: 14,
        },
      },
    ])("returns null for $label", ({
      movementRates,
    }) => {
      expect(
        resolveMovementRate({
          movementRates,
          movementAction: "fly",
          defaultAction: "walk",
        })
      ).toBeNull();
    });
  });

  describe("synchronizeCommonAnimalTokenMovement", () => {
    test("updates an unlinked synthetic Actor to the selected rate", async () => {
      const token = makeToken();

      const changed =
        await synchronizeMovement({
          token,
          movementAction: "fly",
          defaultAction: "walk",
        });

      expect(changed).toBe(true);
      expect(
        token.actor.getFlag
      ).toHaveBeenCalledWith(
        MODULE_ID,
        "movementRates"
      );
      expect(
        token.actor.update
      ).toHaveBeenCalledWith({
        "system.movement.value": 14,
      });
      expect(
        token.actor.system.movement.value
      ).toBe(14);
    });

    test("does not update an Actor already using the selected rate", async () => {
      const token = makeToken({
        movementValue: 14,
      });

      const changed =
        await synchronizeMovement({
          token,
          movementAction: "fly",
          defaultAction: "walk",
        });

      expect(changed).toBe(false);
      expect(
        token.actor.update
      ).not.toHaveBeenCalled();
    });

    test.each([
      {
        label: "linked Token",
        tokenOptions: {
          actorLink: true,
        },
      },
      {
        label: "Actor without movement metadata",
        tokenOptions: {
          movementRates: undefined,
        },
      },
    ])("does not update a $label", async ({
      tokenOptions,
    }) => {
      const token = makeToken(
        tokenOptions
      );

      const changed =
        await synchronizeMovement({
          token,
          movementAction: "fly",
          defaultAction: "walk",
        });

      expect(changed).toBe(false);
      expect(
        token.actor.update
      ).not.toHaveBeenCalled();
    });
  });

  describe("onUpdateCommonAnimalMovementToken", () => {
    beforeEach(() => {
      game.user.id =
        "originating-user";
    });

    test("synchronizes the originating Token when movementAction changes", async () => {
      const token = makeToken();
      const synchronize = vi.fn(
        async () => true
      );

      const result =
        await onUpdateMovementToken(
          token,
          {
            movementAction: "fly",
          },
          {},
          "originating-user",
          {
            currentUserId:
              "originating-user",
            defaultAction: "walk",
            synchronizeMovement:
              synchronize,
          }
        );

      expect(synchronize)
        .toHaveBeenCalledOnce();
      expect(synchronize)
        .toHaveBeenCalledWith({
          token,
          movementAction: "fly",
          defaultAction: "walk",
        });
      expect(result).toBe(true);
    });

    test.each([
      {
        label:
          "update from another client",
        changes: {
          movementAction: "fly",
        },
        userId: "another-user",
      },
      {
        label:
          "update without movementAction",
        changes: {
          x: 100,
        },
        userId: "originating-user",
      },
    ])("ignores an $label", async ({
      changes,
      userId,
    }) => {
      const synchronize = vi.fn(
        async () => true
      );

      const result =
        await onUpdateMovementToken(
          makeToken(),
          changes,
          {},
          userId,
          {
            currentUserId:
              "originating-user",
            defaultAction: "walk",
            synchronizeMovement:
              synchronize,
          }
        );

      expect(synchronize)
        .not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
