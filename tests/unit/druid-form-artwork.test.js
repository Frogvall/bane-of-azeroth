import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
const SAVAGE = "spells.savage-incarnation";
let druidForms = null;

class FakeItem {
  constructor(contentKey) {
    this.flags = {
      [MODULE_ID]: {
        contentKey,
      },
    };
  }

  getFlag(moduleId, key) {
    return this.flags?.[moduleId]?.[key];
  }
}

class FakeToken {
  constructor(id, actorId, texture, sceneId) {
    this.id = id;
    this.actorId = actorId;
    this.texture = {
      src: texture,
    };
    this.parent = {
      id: sceneId,
    };
    this.update = vi.fn(async changes => {
      if (Object.hasOwn(changes, "texture.src")) {
        this.texture.src = changes["texture.src"];
      }
    });
  }
}

class FakeActor {
  constructor() {
    this.id = "actor-1";
    this.type = "character";
    this.img = "worlds/test/humanoid.webp";
    this.prototypeToken = {
      texture: {
        src: "worlds/test/humanoid-token.webp",
      },
    };
    this.flags = {};
    this.items = [
      new FakeItem(SAVAGE),
    ];
    this.isOwner = true;
    this.update = vi.fn(async changes => {
      if (Object.hasOwn(changes, "img")) {
        this.img = changes.img;
      }
      if (Object.hasOwn(changes, "prototypeToken.texture.src")) {
        this.prototypeToken.texture.src =
          changes["prototypeToken.texture.src"];
      }
    });
  }

  getFlag(moduleId, key) {
    return this.flags?.[moduleId]?.[key];
  }

  async setFlag(moduleId, key, value) {
    this.flags[moduleId] ??= {};
    this.flags[moduleId][key] = structuredClone(value);
    return value;
  }

  async unsetFlag(moduleId, key) {
    if (this.flags[moduleId]) {
      delete this.flags[moduleId][key];
    }
  }

  testUserPermission() {
    return true;
  }
}

function scene(id, tokens) {
  return {
    id,
    tokens,
  };
}

function requireApi(name) {
  expect(druidForms?.[name]).toBeTypeOf("function");
  return druidForms[name];
}

beforeEach(async () => {
  vi.resetModules();
  globalThis.game = {
    user: null,
    settings: {
      get: vi.fn(() => true),
    },
    scenes: [],
  };
  druidForms = await import(
    "../../foundry/scripts/druid-forms.js"
  );
});

afterEach(() => {
  delete globalThis.game;
  delete globalThis.ui;
  delete globalThis.foundry;
  delete globalThis.CONST;
});

describe("Druid form artwork switching", () => {
  test("captures Actor, prototype, and per-scene-token baselines before applying a form", async () => {
    const actor = new FakeActor();
    const tokenA = new FakeToken(
      "token-a",
      actor.id,
      "worlds/test/token-a-original.webp",
      "scene-a",
    );
    const tokenB = new FakeToken(
      "token-b",
      actor.id,
      "worlds/test/token-b-original.webp",
      "scene-b",
    );
    game.scenes = [
      scene("scene-a", [tokenA]),
      scene("scene-b", [tokenB]),
    ];

    await druidForms.setDruidFormArtwork(
      actor,
      "travelPl1",
      {
        portrait: "worlds/test/travel-portrait.webp",
        token: "worlds/test/travel-token.webp",
      },
    );

    expect(
      await requireApi("applyDruidFormArtwork")(
        actor,
        "travelPl1",
      ),
    ).toBe(true);

    expect(actor.img).toBe("worlds/test/travel-portrait.webp");
    expect(actor.prototypeToken.texture.src).toBe(
      "worlds/test/travel-token.webp",
    );
    expect(tokenA.texture.src).toBe("worlds/test/travel-token.webp");
    expect(tokenB.texture.src).toBe("worlds/test/travel-token.webp");

    const baseline = actor.getFlag(
      MODULE_ID,
      "druidFormArtworkBaseline",
    );
    expect(baseline).toMatchObject({
      profileKey: "travelPl1",
      actor: {
        original: "worlds/test/humanoid.webp",
        applied: "worlds/test/travel-portrait.webp",
      },
      prototypeToken: {
        original: "worlds/test/humanoid-token.webp",
        applied: "worlds/test/travel-token.webp",
      },
    });
    expect(
      Object.values(baseline.tokens).map(value => value.original),
    ).toEqual(
      expect.arrayContaining([
        "worlds/test/token-a-original.webp",
        "worlds/test/token-b-original.webp",
      ]),
    );
  });

  test("switching profiles keeps the original humanoid baseline", async () => {
    const actor = new FakeActor();
    await druidForms.setDruidFormArtwork(
      actor,
      "travelPl1",
      {
        portrait: "worlds/test/travel-one.webp",
        token: "worlds/test/travel-one-token.webp",
      },
    );
    await druidForms.setDruidFormArtwork(
      actor,
      "travelPl2",
      {
        portrait: "worlds/test/travel-two.webp",
        token: "worlds/test/travel-two-token.webp",
      },
    );

    const apply = requireApi("applyDruidFormArtwork");
    await apply(actor, "travelPl1");
    await apply(actor, "travelPl2");

    const baseline = actor.getFlag(
      MODULE_ID,
      "druidFormArtworkBaseline",
    );
    expect(baseline.actor.original).toBe(
      "worlds/test/humanoid.webp",
    );
    expect(baseline.prototypeToken.original).toBe(
      "worlds/test/humanoid-token.webp",
    );
    expect(baseline.profileKey).toBe("travelPl2");
  });

  test("restore returns managed artwork exactly to the original humanoid baseline", async () => {
    const actor = new FakeActor();
    await druidForms.setDruidFormArtwork(
      actor,
      "travelPl1",
      {
        portrait: "worlds/test/travel.webp",
        token: "worlds/test/travel-token.webp",
      },
    );
    await requireApi("applyDruidFormArtwork")(
      actor,
      "travelPl1",
    );

    expect(
      await requireApi("restoreDruidHumanoidArtwork")(actor),
    ).toBe(true);
    expect(actor.img).toBe("worlds/test/humanoid.webp");
    expect(actor.prototypeToken.texture.src).toBe(
      "worlds/test/humanoid-token.webp",
    );
    expect(
      actor.getFlag(MODULE_ID, "druidFormArtworkBaseline"),
    ).toBeUndefined();
  });

  test("restore preserves manual artwork changes made while transformed", async () => {
    const actor = new FakeActor();
    const token = new FakeToken(
      "token-a",
      actor.id,
      "worlds/test/token-original.webp",
      "scene-a",
    );
    game.scenes = [scene("scene-a", [token])];

    await druidForms.setDruidFormArtwork(
      actor,
      "travelPl1",
      {
        portrait: "worlds/test/travel.webp",
        token: "worlds/test/travel-token.webp",
      },
    );
    await requireApi("applyDruidFormArtwork")(
      actor,
      "travelPl1",
    );

    actor.img = "worlds/test/manual-portrait.webp";
    token.texture.src = "worlds/test/manual-token.webp";

    await requireApi("restoreDruidHumanoidArtwork")(actor);

    expect(actor.img).toBe("worlds/test/manual-portrait.webp");
    expect(token.texture.src).toBe("worlds/test/manual-token.webp");
    expect(actor.prototypeToken.texture.src).toBe(
      "worlds/test/humanoid-token.webp",
    );
  });

  test("a newly created scene token inherits the active form while retaining its own baseline", async () => {
    const actor = new FakeActor();
    await druidForms.setDruidFormArtwork(
      actor,
      "travelPl1",
      {
        portrait: "worlds/test/travel.webp",
        token: "worlds/test/travel-token.webp",
      },
    );
    await requireApi("applyDruidFormArtwork")(
      actor,
      "travelPl1",
    );

    const token = new FakeToken(
      "token-new",
      actor.id,
      "worlds/test/new-token-original.webp",
      "scene-new",
    );
    token.actor = actor;
    game.scenes = [scene("scene-new", [token])];

    expect(
      await requireApi("onCreateDruidFormArtworkToken")(token),
    ).toBe(true);
    expect(token.texture.src).toBe("worlds/test/travel-token.webp");

    const baseline = actor.getFlag(
      MODULE_ID,
      "druidFormArtworkBaseline",
    );
    expect(Object.values(baseline.tokens)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tokenId: "token-new",
          original: "worlds/test/new-token-original.webp",
          applied: "worlds/test/travel-token.webp",
        }),
      ]),
    );
  });

  test("explicitly disabling artwork automation prevents new form artwork application", async () => {
    const actor = new FakeActor();
    game.settings.get = vi.fn((_moduleId, key) => (
      key === "druidFormArtworkAutomation"
        ? false
        : true
    ));

    await druidForms.setDruidFormArtwork(
      actor,
      "travelPl1",
      {
        portrait: "worlds/test/travel.webp",
      },
    );

    expect(
      await requireApi("applyDruidFormArtwork")(
        actor,
        "travelPl1",
      ),
    ).toBe(false);
    expect(actor.img).toBe("worlds/test/humanoid.webp");
  });
});
