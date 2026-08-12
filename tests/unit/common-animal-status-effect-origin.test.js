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
  onCommonAnimalStatusSocketMessage,
  requestCommonAnimalStatusApplication,
} from "../../foundry/scripts/common-animal-status-effects.js";

const MODULE_SOCKET = "module.bane-of-azeroth";

function makeCreatedEffect({
  origin = "Actor.target",
} = {}) {
  const effect = {
    origin,
    update: vi.fn(async changes => {
      Object.assign(effect, changes);
      return effect;
    }),
  };
  return effect;
}

function makeTargetActor({
  canUpdate = true,
  effects = [],
  toggleResult = true,
  uuid = "Actor.target",
} = {}) {
  return {
    name: "Target",
    uuid,
    effects,
    canUserModify: vi.fn(() => canUpdate),
    toggleStatusEffect: vi.fn(async () => toggleResult),
  };
}

function makeSyntheticSourceActor() {
  return {
    name: "Giant Spider",
    uuid: "Scene.scene.Token.spider.Actor.synthetic",
    baseActor: {
      uuid: "Actor.giantSpider",
    },
  };
}

beforeEach(() => {
  CONFIG.statusEffects = [
    {
      id: "restrain",
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
  foundry.utils.randomID = vi.fn(() => "status-source-request");
  globalThis.fromUuid = vi.fn();
});

describe("Common Animal Restrained source", () => {
  test("records the source base Actor on a newly created status", async () => {
    const createdEffect = makeCreatedEffect();
    const target = makeTargetActor({
      toggleResult: createdEffect,
    });
    const sourceActor = makeSyntheticSourceActor();

    await applyCommonAnimalAttackStatuses({
      effects: [
        {
          type: "restrain",
          strength: 10,
        },
      ],
      targets: [target],
      sourceActor,
    });

    expect(target.toggleStatusEffect).toHaveBeenCalledWith(
      "restrain",
      { active: true }
    );
    expect(createdEffect.update).toHaveBeenCalledOnce();
    expect(createdEffect.update).toHaveBeenCalledWith({
      origin: "Actor.giantSpider",
    });
    expect(createdEffect.origin).toBe("Actor.giantSpider");
  });

  test("does not overwrite an already active Restrained source", async () => {
    const existingEffect = makeCreatedEffect({
      origin: "Actor.otherSource",
    });
    const target = makeTargetActor({
      effects: [existingEffect],
      toggleResult: true,
    });

    await applyCommonAnimalStatusIdsLocally(
      target,
      ["restrain"],
      {
        sourceUuid: "Actor.giantSpider",
      }
    );

    expect(target.toggleStatusEffect).toHaveBeenCalledWith(
      "restrain",
      { active: true }
    );
    expect(existingEffect.update).not.toHaveBeenCalled();
    expect(existingEffect.origin).toBe("Actor.otherSource");
  });

  test("includes the source UUID in player-to-GM delegation", async () => {
    const target = makeTargetActor({
      canUpdate: false,
    });
    const activeGM = {
      active: true,
      id: "gm-user",
      isGM: true,
    };
    game.user.isGM = false;
    game.users = [game.user, activeGM];

    const pending = requestCommonAnimalStatusApplication(
      target,
      ["restrain"],
      {
        sourceUuid: "Actor.giantSpider",
      }
    );
    await Promise.resolve();

    const [channel, request] = game.socket.emit.mock.calls[0];
    expect(channel).toBe(MODULE_SOCKET);
    expect(request).toMatchObject({
      type: "commonAnimalStatusRequest",
      targetUuid: "Actor.target",
      sourceUuid: "Actor.giantSpider",
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
  });

  test("the primary GM preserves the delegated source", async () => {
    const createdEffect = makeCreatedEffect();
    const target = makeTargetActor({
      toggleResult: createdEffect,
    });
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
    fromUuid.mockResolvedValue(target);

    await onCommonAnimalStatusSocketMessage({
      type: "commonAnimalStatusRequest",
      requestId: "request-from-player",
      requesterUserId: "player-user",
      gmUserId: "gm-user",
      targetUuid: "Actor.target",
      sourceUuid: "Actor.giantSpider",
      statusIds: ["restrain"],
    });

    expect(createdEffect.update).toHaveBeenCalledWith({
      origin: "Actor.giantSpider",
    });
    expect(game.socket.emit).toHaveBeenCalledWith(
      MODULE_SOCKET,
      expect.objectContaining({
        type: "commonAnimalStatusResult",
        requestId: "request-from-player",
        success: true,
      })
    );
  });
});
