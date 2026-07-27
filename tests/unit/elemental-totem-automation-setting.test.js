import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  executeElementalTotemPlan,
} from "../../foundry/scripts/elemental-totems.js";

const MODULE_ID = "bane-of-azeroth";
const definitions = {
  totems: [
    {
      key: "flametongue",
      name: "Flametongue Totem",
    },
  ],
};

function plan() {
  return {
    sourceMessageId: "spell-message",
    actorUuid: "Actor.warlock",
    spellUuid: "Actor.warlock.Item.elemental-totem",
    sceneId: "scene-1",
    casterTokenId: "caster-token",
    powerLevel: 2,
    criticalEffect: "",
    totemTypes: ["flametongue"],
    reachUpgrades: 1,
    durabilityUpgrades: 0,
    auraRange: 20,
    hitPoints: 10,
    armorRating: 2,
    placementRange: 6,
  };
}

function i18n() {
  const text = {
    "BOA.dialog.elementalTotem.manualTitle":
      "Elemental Totem",
    "BOA.dialog.elementalTotem.manualAutomationDisabled":
      "Placement and lifecycle automation is disabled. "
      + "Place and manage the selected totem manually.",
    "BOA.dialog.elementalTotem.manualNotification":
      "Elemental Totem automation is disabled.",
    "BOA.dialog.elementalTotem.placementCancelled":
      "Placement cancelled.",
  };

  return {
    localize: vi.fn(key => text[key] ?? key),
    format: vi.fn((key, data) => {
      if (key === "BOA.dialog.elementalTotem.manualPowerLevel") {
        return `Power Level: ${data.powerLevel}`;
      }
      if (key === "BOA.dialog.elementalTotem.manualTotems") {
        return `Totems: ${data.totems}`;
      }
      if (key === "BOA.dialog.elementalTotem.tokensCreated") {
        return `${data.count} token(s) created.`;
      }
      if (key === "BOA.dialog.elementalTotem.cleanupWarning") {
        return `Cleanup failed: ${data.scenes}`;
      }
      return key;
    }),
  };
}

beforeEach(() => {
  globalThis.foundry.utils.escapeHTML = value => String(value);
});

describe("Elemental Totem automation setting", () => {
  test("disabled automation posts instructions without placement or creation", async () => {
    const collectPositionsFn = vi.fn();
    const requestCreationFn = vi.fn();
    const create = vi.fn(async data => ({
      id: "manual-message",
      ...data,
    }));
    const notifications = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const settings = {
      get: vi.fn(() => false),
    };

    const outcome = await executeElementalTotemPlan(
      plan(),
      definitions,
      {
        chatMessageClass: {
          create,
          getSpeaker: vi.fn(() => ({ actor: "warlock" })),
        },
        collectPositionsFn,
        i18n: i18n(),
        messages: new Map([
          [
            "spell-message",
            {
              speaker: {
                actor: "warlock",
                token: "caster-token",
              },
            },
          ],
        ]),
        notifications,
        requestCreationFn,
        settings,
      },
    );

    expect(settings.get).toHaveBeenCalledWith(
      MODULE_ID,
      "elementalTotemAutomation",
    );
    expect(outcome.status).toBe("manual");
    expect(collectPositionsFn).not.toHaveBeenCalled();
    expect(requestCreationFn).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();

    const messageData = create.mock.calls[0][0];
    expect(messageData.speaker).toEqual({
      actor: "warlock",
      token: "caster-token",
    });
    expect(
      messageData.flags[MODULE_ID]
        .elementalTotemManualPlacement,
    ).toEqual({
      schemaVersion: 1,
      actorUuid: "Actor.warlock",
      sourceMessageId: "spell-message",
      powerLevel: 2,
      totemTypes: ["flametongue"],
      automationEnabled: false,
    });
    expect(messageData.content).toContain("Flametongue Totem");
    expect(messageData.content).toContain("Power Level: 2");
    expect(messageData.content).toContain(
      "Placement and lifecycle automation is disabled",
    );
    expect(notifications.info).toHaveBeenCalledOnce();
    expect(notifications.warn).not.toHaveBeenCalled();
  });

  test("enabled automation preserves placement and creation", async () => {
    const positions = [
      {
        totemType: "flametongue",
        x: 100,
        y: 200,
      },
    ];
    const creationResult = {
      createdTokenIds: ["token-1"],
      failedCleanupScenes: [],
    };
    const collectPositionsFn = vi.fn(async () => positions);
    const requestCreationFn = vi.fn(async () => creationResult);
    const chatMessageClass = { create: vi.fn() };
    const notifications = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    const outcome = await executeElementalTotemPlan(
      plan(),
      definitions,
      {
        chatMessageClass,
        collectPositionsFn,
        i18n: i18n(),
        notifications,
        requestCreationFn,
        settings: { get: vi.fn(() => true) },
      },
    );

    expect(outcome).toEqual({
      status: "created",
      message: null,
      positions,
      result: creationResult,
    });
    expect(collectPositionsFn).toHaveBeenCalledWith(
      expect.objectContaining({
        powerLevel: 2,
        totemTypes: ["flametongue"],
      }),
      definitions,
    );
    expect(requestCreationFn).toHaveBeenCalledWith(
      expect.any(Object),
      positions,
    );
    expect(chatMessageClass.create).not.toHaveBeenCalled();
    expect(notifications.info).toHaveBeenCalledWith(
      "1 token(s) created.",
    );
  });

  test("only explicit false disables the workflow", async () => {
    const collectPositionsFn = vi.fn(async () => []);
    const requestCreationFn = vi.fn(async () => ({
      createdTokenIds: [],
      failedCleanupScenes: [],
    }));

    const outcome = await executeElementalTotemPlan(
      plan(),
      definitions,
      {
        collectPositionsFn,
        i18n: i18n(),
        notifications: {
          info: vi.fn(),
          warn: vi.fn(),
        },
        requestCreationFn,
        settings: { get: vi.fn(() => undefined) },
      },
    );

    expect(outcome.status).toBe("created");
    expect(collectPositionsFn).toHaveBeenCalledOnce();
    expect(requestCreationFn).toHaveBeenCalledOnce();
  });
});
