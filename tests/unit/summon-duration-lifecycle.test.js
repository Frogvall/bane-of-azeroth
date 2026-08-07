import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  deleteSummonsExpiredByRest,
  executeSummonDurationCleanupRequest,
  isSummonExpiredByRest,
  isSummonRestLifecyclePatched,
  patchSummonRestLifecycle,
} from "../../foundry/scripts/core/summon-duration-lifecycle.js";

const MODULE_ID = "bane-of-azeroth";

function collection(values) {
  const map = new Map(
    values.map(value => [
      value.id,
      value,
    ]),
  );
  map.filter = predicate =>
    values.filter(predicate);
  map.find = predicate =>
    values.find(predicate);
  map[Symbol.iterator] =
    function iterator() {
      return map.values();
    };
  return map;
}

function summonToken({
  casterActorUuid = "Actor.caster",
  duration,
  id,
  summonType,
}) {
  return {
    id,
    flags: {
      [MODULE_ID]: {
        casterActorUuid,
        duration,
        summonType,
      },
    },
  };
}

function makeScene(
  name,
  tokens,
  {
    fail = false,
  } = {},
) {
  return {
    id: name.toLowerCase(),
    name,
    tokens,
    deleteEmbeddedDocuments: vi.fn(
      async () => {
        if (fail) {
          throw new Error(
            `${name} deletion failed`,
          );
        }
      },
    ),
  };
}

describe("shared summon duration rules", () => {
  test.each([
    ["stretch", "stretch", true],
    ["shift", "stretch", false],
    ["stretch", "shift", true],
    ["shift", "shift", true],
    ["other", "shift", false],
  ])(
    "%s expires on %s: %s",
    (duration, restType, expected) => {
      expect(
        isSummonExpiredByRest(
          duration,
          restType,
        ),
      ).toBe(expected);
    },
  );

  test("Stretch removes only matching Totems across all Scenes", async () => {
    const first = makeScene(
      "First",
      [
        summonToken({
          id: "totem-first",
          summonType: "elementalTotem",
          duration: "stretch",
        }),
        summonToken({
          id: "demon-first",
          summonType: "warlock-demon",
          duration: "shift",
        }),
        summonToken({
          id: "legacy-totem",
          summonType: "elementalTotem",
          duration: undefined,
        }),
        summonToken({
          id: "other-caster",
          casterActorUuid: "Actor.other",
          summonType: "elementalTotem",
          duration: "stretch",
        }),
      ],
    );
    const second = makeScene(
      "Second",
      [
        summonToken({
          id: "totem-second",
          summonType: "elementalTotem",
          duration: "stretch",
        }),
      ],
    );

    await expect(
      deleteSummonsExpiredByRest(
        "Actor.caster",
        "stretch",
        {
          scenes: [
            first,
            second,
          ],
        },
      ),
    ).resolves.toEqual({
      deletedCount: 2,
      failedScenes: [],
    });

    expect(
      first.deleteEmbeddedDocuments,
    ).toHaveBeenCalledWith(
      "Token",
      ["totem-first"],
    );
    expect(
      second.deleteEmbeddedDocuments,
    ).toHaveBeenCalledWith(
      "Token",
      ["totem-second"],
    );
  });

  test("Shift removes matching Totems and Warlock demons", async () => {
    const scene = makeScene(
      "Shift",
      [
        summonToken({
          id: "totem",
          summonType: "elementalTotem",
          duration: "stretch",
        }),
        summonToken({
          id: "demon",
          summonType: "warlock-demon",
          duration: "shift",
        }),
        summonToken({
          id: "invalid-pair",
          summonType: "warlock-demon",
          duration: "stretch",
        }),
      ],
    );

    await expect(
      deleteSummonsExpiredByRest(
        "Actor.caster",
        "shift",
        { scenes: [scene] },
      ),
    ).resolves.toEqual({
      deletedCount: 2,
      failedScenes: [],
    });

    expect(
      scene.deleteEmbeddedDocuments,
    ).toHaveBeenCalledWith(
      "Token",
      [
        "totem",
        "demon",
      ],
    );
  });

  test("continues after a Scene cleanup failure", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const failed = makeScene(
        "Failed",
        [
          summonToken({
            id: "failed-totem",
            summonType: "elementalTotem",
            duration: "stretch",
          }),
        ],
        { fail: true },
      );
      const healthy = makeScene(
        "Healthy",
        [
          summonToken({
            id: "healthy-totem",
            summonType: "elementalTotem",
            duration: "stretch",
          }),
        ],
      );

      await expect(
        deleteSummonsExpiredByRest(
          "Actor.caster",
          "stretch",
          {
            scenes: [
              failed,
              healthy,
            ],
          },
        ),
      ).resolves.toEqual({
        deletedCount: 1,
        failedScenes: ["Failed"],
      });

      expect(
        healthy.deleteEmbeddedDocuments,
      ).toHaveBeenCalledOnce();
      expect(
        consoleError,
      ).toHaveBeenCalledOnce();
      expect(
        consoleError,
      ).toHaveBeenCalledWith(
        "bane-of-azeroth | Could not remove "
          + "expired summons from Failed.",
        expect.objectContaining({
          message: "Failed deletion failed",
        }),
      );
    } finally {
      consoleError.mockRestore();
    }
});
});

describe("Dragonbane rest integration", () => {
  test("runs cleanup after successful Stretch and Shift methods", async () => {
    const events = [];
    const requestCleanupFn = vi.fn(
      async (_actor, restType) => {
        events.push(`cleanup-${restType}`);
        return {
          deletedCount: 0,
          failedScenes: [],
        };
      },
    );

    class TestActor {
      constructor() {
        this.uuid = "Actor.test";
      }

      async restStretch() {
        events.push("original-stretch");
        return "stretch-result";
      }

      async restShift() {
        events.push("original-shift");
        return "shift-result";
      }

      async restReset() {
        return true;
      }
    }

    expect(
      patchSummonRestLifecycle({
        actorClass: TestActor,
        requestCleanupFn,
      }),
    ).toEqual({
      restStretch: "patched",
      restShift: "patched",
    });
    expect(
      isSummonRestLifecyclePatched(
        TestActor,
      ),
    ).toBe(true);

    const actor = new TestActor();
    await expect(
      actor.restStretch(),
    ).resolves.toBe("stretch-result");
    await expect(
      actor.restShift(),
    ).resolves.toBe("shift-result");

    expect(events).toEqual([
      "original-stretch",
      "cleanup-stretch",
      "original-shift",
      "cleanup-shift",
    ]);

    expect(
      patchSummonRestLifecycle({
        actorClass: TestActor,
        requestCleanupFn,
      }),
    ).toEqual({
      restStretch: "already-patched",
      restShift: "already-patched",
    });
  });

  test("does not clean up when the original rest rejects", async () => {
    const requestCleanupFn = vi.fn();

    class TestActor {
      async restStretch() {
        throw new Error("rest failed");
      }

      async restShift() {
        return undefined;
      }

      async restReset() {
        return true;
      }
    }

    patchSummonRestLifecycle({
      actorClass: TestActor,
      requestCleanupFn,
    });

    await expect(
      new TestActor().restStretch(),
    ).rejects.toThrow("rest failed");
    expect(
      requestCleanupFn,
    ).not.toHaveBeenCalled();
  });

  test("reports cleanup failure without failing the completed rest", async () => {
    const reportFailureFn = vi.fn();

    class TestActor {
      constructor() {
        this.uuid = "Actor.test";
      }

      async restStretch() {
        return "completed";
      }

      async restShift() {
        return undefined;
      }

      async restReset() {
        return true;
      }
    }

    patchSummonRestLifecycle({
      actorClass: TestActor,
      requestCleanupFn: vi.fn(
        async () => {
          throw new Error(
            "cleanup failed",
          );
        },
      ),
      reportFailureFn,
    });

    await expect(
      new TestActor().restStretch(),
    ).resolves.toBe("completed");
    expect(
      reportFailureFn,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "cleanup failed",
      }),
      expect.objectContaining({
        uuid: "Actor.test",
      }),
      "stretch",
    );
  });
});

describe("GM cleanup request validation", () => {
  test("allows a player who owns the resting Actor", async () => {
    const player = {
      id: "player",
      isGM: false,
    };
    const actor = {
      documentName: "Actor",
      uuid: "Actor.caster",
      testUserPermission: vi.fn(
        user => user.id === player.id,
      ),
    };
    const scene = makeScene(
      "Owned",
      [
        summonToken({
          id: "owned-totem",
          summonType: "elementalTotem",
          duration: "stretch",
        }),
      ],
    );

    await expect(
      executeSummonDurationCleanupRequest(
        {
          actorUuid: actor.uuid,
          restType: "stretch",
        },
        player.id,
        {
          fromUuidFn: async () => actor,
          scenes: [scene],
          users: collection([player]),
        },
      ),
    ).resolves.toEqual({
      deletedCount: 1,
      failedScenes: [],
    });
  });

  test("rejects a player who does not own the resting Actor", async () => {
    const player = {
      id: "player",
      isGM: false,
    };
    const actor = {
      documentName: "Actor",
      uuid: "Actor.caster",
      testUserPermission: vi.fn(
        () => false,
      ),
    };

    await expect(
      executeSummonDurationCleanupRequest(
        {
          actorUuid: actor.uuid,
          restType: "shift",
        },
        player.id,
        {
          fromUuidFn: async () => actor,
          scenes: [],
          users: collection([player]),
        },
      ),
    ).rejects.toThrow(
      /does not own the resting Actor/i,
    );
  });
});
