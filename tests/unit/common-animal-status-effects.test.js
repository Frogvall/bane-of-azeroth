import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import {
  applyCommonAnimalAttackStatuses,
  applyCommonAnimalStatusIdsLocally,
  COMMON_ANIMAL_RESTRAIN_STATUS_ID,
  onCommonAnimalStatusSocketMessage,
  requestCommonAnimalStatusApplication,
  statusIdsForCommonAnimalAttackEffects,
} from "../../foundry/scripts/common-animal-status-effects.js";

const MODULE_SOCKET = "module.bane-of-azeroth";

function makeActor({
  canUpdate = true,
  uuid = "Actor.target",
} = {}) {
  return {
    name: "Target",
    uuid,
    canUserModify: vi.fn(() => canUpdate),
    toggleStatusEffect: vi.fn(async () => true),
  };
}

beforeEach(() => {
  CONFIG.statusEffects = [
    {
      id: COMMON_ANIMAL_RESTRAIN_STATUS_ID,
      name: "DoD.conditions.restrained",
    },
  ];
  game.user = {
    active: true,
    id: "originating-user",
    isGM: true,
  };
  game.users = [game.user];
  game.socket.emit = vi.fn();
  game.socket.on = vi.fn();
  foundry.utils.randomID = vi.fn(() => "status-request-id");
  globalThis.fromUuid = vi.fn();
});

describe("Common Animal attack-effect status mapping", () => {
  test("maps only Restrain effects to Dragonbane's restrain status", () => {
    expect(
      statusIdsForCommonAnimalAttackEffects([
        { type: "lethalPoison", potency: 12 },
        { type: "restrain", strength: 10 },
        { type: "restrain", strength: 12 },
        { type: "unknown" },
      ])
    ).toEqual(["restrain"]);
  });

  test("uses active=true so an existing status is never toggled off", async () => {
    const actor = makeActor();

    await applyCommonAnimalStatusIdsLocally(actor, ["restrain"]);

    expect(actor.toggleStatusEffect).toHaveBeenCalledOnce();
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith(
      "restrain",
      { active: true }
    );
  });

  test("ignores attacks without a supported status effect", async () => {
    const actor = makeActor();

    const results = await applyCommonAnimalAttackStatuses({
      effects: [{ type: "lethalPoison", potency: 12 }],
      targets: [actor],
    });

    expect(results).toEqual([]);
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });
});

describe("Common Animal status authority", () => {
  test("applies directly when the current user may update the target", async () => {
    const actor = makeActor({ canUpdate: true });

    const results = await applyCommonAnimalAttackStatuses({
      effects: [{ type: "restrain", strength: 10 }],
      targets: [actor],
    });

    expect(actor.toggleStatusEffect).toHaveBeenCalledWith(
      "restrain",
      { active: true }
    );
    expect(game.socket.emit).not.toHaveBeenCalled();
    expect(results).toEqual([
      {
        targetUuid: "Actor.target",
        statusIds: ["restrain"],
        success: true,
      },
    ]);
  });

  test("delegates a target update to the primary active GM", async () => {
    const actor = makeActor({ canUpdate: false });
    const activeGM = {
      active: true,
      id: "gm-user",
      isGM: true,
    };
    game.user.isGM = false;
    game.users = [game.user, activeGM];

    const pending = requestCommonAnimalStatusApplication(
      actor,
      ["restrain"]
    );
    await Promise.resolve();

    expect(game.socket.emit).toHaveBeenCalledOnce();
    const [channel, request] = game.socket.emit.mock.calls[0];
    expect(channel).toBe(MODULE_SOCKET);
    expect(request).toMatchObject({
      type: "commonAnimalStatusRequest",
      requestId: "status-request-id",
      requesterUserId: "originating-user",
      gmUserId: "gm-user",
      targetUuid: "Actor.target",
      statusIds: ["restrain"],
    });

    onCommonAnimalStatusSocketMessage({
      type: "commonAnimalStatusResult",
      requestId: request.requestId,
      requesterUserId: "originating-user",
      success: true,
      statusIds: ["restrain"],
    });

    await expect(pending).resolves.toEqual(["restrain"]);
    expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
  });

  test("the primary GM resolves the Actor UUID and applies Restrained", async () => {
    const actor = makeActor({ canUpdate: true });
    const requester = {
      active: true,
      id: "player-user",
      isGM: false,
    };
    game.user = {
      active: true,
      id: "gm-user",
      isGM: true,
    };
    game.users = [game.user, requester];
    fromUuid.mockResolvedValue(actor);

    await onCommonAnimalStatusSocketMessage({
      type: "commonAnimalStatusRequest",
      requestId: "request-from-player",
      requesterUserId: "player-user",
      gmUserId: "gm-user",
      targetUuid: "Actor.target",
      statusIds: ["restrain"],
    });

    expect(fromUuid).toHaveBeenCalledWith("Actor.target");
    expect(actor.toggleStatusEffect).toHaveBeenCalledWith(
      "restrain",
      { active: true }
    );
    expect(game.socket.emit).toHaveBeenCalledWith(
      MODULE_SOCKET,
      expect.objectContaining({
        type: "commonAnimalStatusResult",
        requestId: "request-from-player",
        requesterUserId: "player-user",
        success: true,
        statusIds: ["restrain"],
      })
    );
  });
});
