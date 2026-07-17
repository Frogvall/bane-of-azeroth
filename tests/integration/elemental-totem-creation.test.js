import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  executeElementalTotemCreation,
  validateElementalTotemCreationRequest,
} from "../../foundry/scripts/elemental-totems.js";

import {
  makeActor,
  makeCollection,
  makeFlagDocument,
} from "../helpers/documents.js";

const requesterId = "requester";

function validDefinitions() {
  return {
    defaults: {
      auraRange: 10,
      hitPoints: 10,
      armorRating: 2,
      tokenWidth: 0.5,
      tokenHeight: 0.5,
    },
    totems: [
      {
        key: "cleansing",
        name: "Cleansing Totem",
        auraColor: "#38bdf8",
      },
    ],
  };
}

function validPlan(overrides = {}) {
  return {
    sourceMessageId: "message-1",
    actorUuid: "Actor.caster",
    spellUuid: "Actor.caster.Item.elemental-totem",
    sceneId: "scene-1",
    casterTokenId: "caster-token",
    powerLevel: 1,
    criticalEffect: "",
    totemTypes: ["cleansing"],
    reachUpgrades: 0,
    durabilityUpgrades: 0,
    auraRange: 10,
    hitPoints: 10,
    armorRating: 2,
    placementRange: 6,
    ...overrides,
  };
}

class PreviewTokenDocument {
  constructor(data, { parent } = {}) {
    Object.assign(this, data);
    this.parent = parent;
  }

  updateSource(changes) {
    Object.assign(this, changes);
  }

  getCenterPoint() {
    return {
      x: Number(this.x) + 25,
      y: Number(this.y) + 25,
    };
  }
}

function makeEnvironment({
  requesterIsGM = true,
  requesterOwnsActor = true,
  messageAuthorId = requesterId,
  measuredDistance = 0,
  createdActorHasArmor = true,
} = {}) {
  const requester = {
    id: requesterId,
    active: true,
    isGM: requesterIsGM,
  };

  const casterActor = makeActor({
    id: "caster",
    owner: requesterOwnsActor,
  });
  casterActor.uuid = "Actor.caster";

  const casterToken = {
    id: "caster-token",
    actor: casterActor,
    width: 1,
    height: 1,
    getCenterPoint: () => ({ x: 50, y: 50 }),
  };

  const armor = makeFlagDocument({
    id: "armor",
    name: "Totem Armor",
    type: "armor",
    update: vi.fn(async () => undefined),
  });

  const syntheticActor = makeActor({
    id: "synthetic",
    isToken: true,
    items: createdActorHasArmor ? [armor] : [],
  });

  const createdToken = {
    id: "created-token",
    name: "Cleansing Totem",
    actor: syntheticActor,
  };

  const scene = {
    id: "scene-1",
    name: "Test Scene",
    grid: {
      size: 100,
      distance: 10,
    },
    tokens: makeCollection([casterToken]),
    createEmbeddedDocuments: vi.fn(async () => [createdToken]),
    deleteEmbeddedDocuments: vi.fn(async () => undefined),
  };

  const sourceSpell = makeFlagDocument({
    id: "elemental-totem",
    type: "spell",
    system: {
      range: 6,
    },
    flags: {
      "bane-of-azeroth": {
        contentKey: "spells.elemental-totem",
      },
    },
  });

  const sourceMessage = {
    id: "message-1",
    type: "spellTest",
    author: {
      id: messageAuthorId,
    },
    system: {
      toContext: () => ({
        actor: {
          uuid: "Actor.caster",
        },
        spell: sourceSpell,
        success: true,
        criticalEffect: "",
      }),
    },
  };

  const actorTemplate = makeFlagDocument({
    id: "cleansing-template",
    name: "Cleansing Totem",
    type: "npc",
    flags: {
      "bane-of-azeroth": {
        contentKey: "actors.elemental-totems.cleansing",
      },
    },
    getTokenDocument: vi.fn(async data => ({
      toObject: () => ({
        _id: "prototype-token",
        name: "Cleansing Totem",
        actorLink: data.actorLink,
        x: data.x,
        y: data.y,
      }),
    })),
  });

  game.users = makeCollection([requester]);
  game.messages = new Map([[sourceMessage.id, sourceMessage]]);
  game.scenes = makeCollection([scene]);
  game.actors = makeCollection([actorTemplate]);

  globalThis.fromUuid = vi.fn(async () => casterActor);
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => validDefinitions(),
  }));

  foundry.documents = {
    TokenDocument: PreviewTokenDocument,
  };
  foundry.utils.randomID = vi
    .fn()
    .mockReturnValueOnce("cast-id")
    .mockReturnValueOnce("instance-id");

  canvas.scene = scene;
  canvas.grid = {
    measurePath: vi.fn(() => ({
      distance: measuredDistance,
    })),
  };

  return {
    actorTemplate,
    armor,
    casterActor,
    createdToken,
    requester,
    scene,
    sourceMessage,
    syntheticActor,
  };
}

describe("validateElementalTotemCreationRequest", () => {
  beforeEach(() => {
    makeEnvironment();
  });

  test("accepts a valid GM request", async () => {
    const result = await validateElementalTotemCreationRequest(
      validPlan(),
      [{ x: 0, y: 0 }],
      requesterId
    );

    expect(result.scene.id).toBe("scene-1");
    expect(result.actor.id).toBe("caster");
    expect(result.totemActors).toHaveLength(1);
  });

  test("accepts an owning player", async () => {
    makeEnvironment({ requesterIsGM: false, requesterOwnsActor: true });

    await expect(
      validateElementalTotemCreationRequest(
        validPlan(),
        [{ x: 0, y: 0 }],
        requesterId
      )
    ).resolves.toBeDefined();
  });

  test("rejects an unknown requester", async () => {
    await expect(
      validateElementalTotemCreationRequest(
        validPlan(),
        [{ x: 0, y: 0 }],
        "missing-user"
      )
    ).rejects.toThrow(/requesting user could not be found/i);
  });

  test("rejects a requester who did not author the spell message", async () => {
    makeEnvironment({ messageAuthorId: "someone-else" });

    await expect(
      validateElementalTotemCreationRequest(
        validPlan(),
        [{ x: 0, y: 0 }],
        requesterId
      )
    ).rejects.toThrow(/did not create the spell message/i);
  });

  test("rejects a player who does not own the caster", async () => {
    makeEnvironment({
      requesterIsGM: false,
      requesterOwnsActor: false,
    });

    await expect(
      validateElementalTotemCreationRequest(
        validPlan(),
        [{ x: 0, y: 0 }],
        requesterId
      )
    ).rejects.toThrow(/does not own the caster Actor/i);
  });

  test("rejects a manipulated placement range", async () => {
    await expect(
      validateElementalTotemCreationRequest(
        validPlan({ placementRange: 12 }),
        [{ x: 0, y: 0 }],
        requesterId
      )
    ).rejects.toThrow(/placement range is invalid/i);
  });

  test("rejects a mismatched number of positions", async () => {
    await expect(
      validateElementalTotemCreationRequest(
        validPlan(),
        [],
        requesterId
      )
    ).rejects.toThrow(/number of positions/i);
  });

  test.each([
    [{ x: "zero", y: 0 }],
    [{ x: Number.NaN, y: 0 }],
    [{ x: 0, y: Number.POSITIVE_INFINITY }],
  ])("rejects invalid position data %#", async position => {
    await expect(
      validateElementalTotemCreationRequest(
        validPlan(),
        [position],
        requesterId
      )
    ).rejects.toThrow(/position is invalid/i);
  });

  test("rejects a position outside placement range", async () => {
    makeEnvironment({ measuredDistance: 7 });

    await expect(
      validateElementalTotemCreationRequest(
        validPlan(),
        [{ x: 100, y: 100 }],
        requesterId
      )
    ).rejects.toThrow(/outside range/i);
  });

  test("rejects a missing Actor template", async () => {
    makeEnvironment();
    game.actors = makeCollection([]);

    await expect(
      validateElementalTotemCreationRequest(
        validPlan(),
        [{ x: 0, y: 0 }],
        requesterId
      )
    ).rejects.toThrow(/Actor was not found/i);
  });
});

describe("executeElementalTotemCreation", () => {
  test("creates, configures, and marks an unlinked totem token", async () => {
    const environment = makeEnvironment();

    const result = await executeElementalTotemCreation(
      validPlan(),
      [{ x: 100, y: 200 }],
      requesterId
    );

    expect(result).toEqual({
      castId: "cast-id",
      createdTokenIds: ["created-token"],
      failedCleanupScenes: [],
    });

    expect(environment.scene.createEmbeddedDocuments).toHaveBeenCalledOnce();
    const [documentType, tokenData] =
      environment.scene.createEmbeddedDocuments.mock.calls[0];
    expect(documentType).toBe("Token");
    expect(tokenData).toHaveLength(1);
    expect(tokenData[0]).toMatchObject({
      actorLink: false,
      x: 100,
      y: 200,
      flags: {
        "bane-of-azeroth": {
          summonType: "elementalTotem",
          casterActorUuid: "Actor.caster",
          sourceSpell: "spells.elemental-totem",
          sourceMessageId: "message-1",
          castId: "cast-id",
          instanceId: "instance-id",
          totemType: "cleansing",
          auraRange: 10,
        },
      },
    });
    expect(tokenData[0]).not.toHaveProperty("_id");

    expect(environment.syntheticActor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "ownership.default":
          CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
        "system.hitPoints.value": 10,
      })
    );
    expect(environment.armor.update).toHaveBeenCalledWith({
      "system.rating": 2,
      "system.worn": true,
    });
  });

  test("rolls back newly created tokens when configuration fails", async () => {
    const environment = makeEnvironment({
      createdActorHasArmor: false,
    });

    await expect(
      executeElementalTotemCreation(
        validPlan(),
        [{ x: 0, y: 0 }],
        requesterId
      )
    ).rejects.toThrow(/no Totem Armor/i);

    expect(environment.scene.deleteEmbeddedDocuments).toHaveBeenCalledWith(
      "Token",
      ["created-token"]
    );
  });
});
