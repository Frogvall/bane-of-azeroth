import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  executeWarlockDemonPlan,
} from "../../foundry/scripts/warlock-demons.js";

const MODULE_ID = "bane-of-azeroth";

function plan() {
  return {
    sourceMessageId: "message-1",
    actorUuid: "Actor.warlock",
    abilityUuid:
      "Actor.warlock.Item.demonologist",
    sceneId: "scene-1",
    casterTokenId: "caster-token",
    demonKey: "imp",
    placementRange: 10,
    duration: "shift",
  };
}

function i18n() {
  return {
    localize: vi.fn(key => {
      const values = {
        "BOA.dialog.warlockDemon.manualTitle":
          "Demonologist",
        "BOA.dialog.warlockDemon.manualAutomationDisabled":
          "Placement and lifecycle automation is disabled.",
        "BOA.dialog.warlockDemon.manualNotification":
          "Demon automation is disabled.",
        "BOA.dialog.warlockDemon.placementCancelled":
          "Placement cancelled.",
      };
      return values[key] ?? key;
    }),
    format: vi.fn((key, data) => {
      if (
        key
        === "BOA.dialog.warlockDemon.manualDemon"
      ) {
        return `Demon: ${data.demon}`;
      }
      if (
        key
        === "BOA.dialog.warlockDemon.manualDuration"
      ) {
        return `Duration: ${data.duration}`;
      }
      if (
        key
        === "BOA.dialog.warlockDemon.tokenCreated"
      ) {
        return `${data.name} summoned.`;
      }
      if (
        key
        === "BOA.dialog.warlockDemon.cleanupWarning"
      ) {
        return `Cleanup failed: ${data.scenes}`;
      }
      return key;
    }),
  };
}

describe("Warlock demon automation setting", () => {
  test("disabled mode posts instructions and skips all automation", async () => {
    const collectPositionFn = vi.fn();
    const requestCreationFn = vi.fn();
    const create = vi.fn(
      async data => ({
        id: "manual-message",
        ...data,
      }),
    );

    const outcome =
      await executeWarlockDemonPlan(
        plan(),
        {
          chatMessageClass: {
            create,
            getSpeaker: vi.fn(),
          },
          collectPositionFn,
          i18n: i18n(),
          messages: new Map([
            [
              "message-1",
              {
                speaker: {
                  actor: "warlock",
                  token: "caster-token",
                },
              },
            ],
          ]),
          notifications: {
            info: vi.fn(),
            warn: vi.fn(),
          },
          requestCreationFn,
          settings: {
            get: vi.fn(() => false),
          },
        },
      );

    expect(outcome.status).toBe("manual");
    expect(collectPositionFn).not.toHaveBeenCalled();
    expect(requestCreationFn).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();

    const data = create.mock.calls[0][0];
    expect(data.content).toContain("Imp");
    expect(data.content).toContain("shift");
    expect(
      data.flags[MODULE_ID]
        .warlockDemonManualPlacement,
    ).toEqual({
      schemaVersion: 1,
      actorUuid: "Actor.warlock",
      sourceMessageId: "message-1",
      demonKey: "imp",
      duration: "shift",
      automationEnabled: false,
    });
  });

  test("enabled mode preserves placement and creation", async () => {
    const position = {
      x: 100,
      y: 200,
    };
    const result = {
      summonId: "summon-1",
      createdTokenId: "token-1",
      failedCleanupScenes: [],
    };
    const collectPositionFn = vi.fn(
      async () => position,
    );
    const requestCreationFn = vi.fn(
      async () => result,
    );

    const outcome =
      await executeWarlockDemonPlan(
        plan(),
        {
          collectPositionFn,
          i18n: i18n(),
          notifications: {
            info: vi.fn(),
            warn: vi.fn(),
          },
          requestCreationFn,
          settings: {
            get: vi.fn(() => true),
          },
        },
      );

    expect(outcome).toEqual({
      status: "created",
      message: null,
      position,
      result,
    });
    expect(collectPositionFn)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          demonKey: "imp",
        }),
      );
    expect(requestCreationFn)
      .toHaveBeenCalledWith(
        expect.any(Object),
        position,
      );
  });

  test("only explicit false disables automation", async () => {
    const collectPositionFn = vi.fn(
      async () => ({
        x: 0,
        y: 0,
      }),
    );
    const requestCreationFn = vi.fn(
      async () => ({
        createdTokenId: "token",
        failedCleanupScenes: [],
      }),
    );

    const outcome =
      await executeWarlockDemonPlan(
        plan(),
        {
          collectPositionFn,
          i18n: i18n(),
          notifications: {
            info: vi.fn(),
            warn: vi.fn(),
          },
          requestCreationFn,
          settings: {
            get: vi.fn(() => undefined),
          },
        },
      );

    expect(outcome.status).toBe("created");
    expect(collectPositionFn).toHaveBeenCalledOnce();
    expect(requestCreationFn).toHaveBeenCalledOnce();
  });
});
