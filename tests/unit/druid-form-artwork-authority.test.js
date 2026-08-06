import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

let module = null;

beforeEach(async () => {
  vi.resetModules();
  globalThis.game = {
    user: null,
  };
  module = await import(
    "../../foundry/scripts/druid-forms.js"
  );
});

afterEach(() => {
  delete globalThis.game;
  delete globalThis.CONST;
});

function requireApi(name) {
  expect(module?.[name]).toBeTypeOf("function");
  return module[name];
}

describe("Druid form artwork GM authority", () => {
  test("accepts an active owner request and dispatches apply", async () => {
    const requester = {
      id: "player",
      active: true,
      isGM: false,
    };
    const actor = {
      id: "actor",
      testUserPermission: vi.fn(() => true),
    };
    const apply = vi.fn(async () => true);

    const result = await requireApi(
      "executeDruidFormArtworkRequest",
    )(
      {
        requesterUserId: requester.id,
        actorId: actor.id,
        action: "apply",
        profileKey: "travelPl1",
      },
      {
        users: new Map([[requester.id, requester]]),
        actors: new Map([[actor.id, actor]]),
        applyArtwork: apply,
        restoreArtwork: vi.fn(),
        ownerLevel: 3,
      },
    );

    expect(apply).toHaveBeenCalledWith(
      actor,
      "travelPl1",
      expect.objectContaining({
        bypassAuthority: true,
      }),
    );
    expect(result).toMatchObject({
      actorId: actor.id,
      action: "apply",
      result: true,
    });
  });

  test("rejects inactive or non-owning requesters", async () => {
    const execute = requireApi(
      "executeDruidFormArtworkRequest",
    );
    const actor = {
      id: "actor",
      testUserPermission: vi.fn(() => false),
    };

    await expect(
      execute(
        {
          requesterUserId: "inactive",
          actorId: actor.id,
          action: "restore",
        },
        {
          users: new Map([
            [
              "inactive",
              {
                id: "inactive",
                active: false,
                isGM: false,
              },
            ],
          ]),
          actors: new Map([[actor.id, actor]]),
          ownerLevel: 3,
        },
      ),
    ).rejects.toThrow(/not active/i);

    await expect(
      execute(
        {
          requesterUserId: "player",
          actorId: actor.id,
          action: "restore",
        },
        {
          users: new Map([
            [
              "player",
              {
                id: "player",
                active: true,
                isGM: false,
              },
            ],
          ]),
          actors: new Map([[actor.id, actor]]),
          ownerLevel: 3,
        },
      ),
    ).rejects.toThrow(/does not own/i);
  });
});
