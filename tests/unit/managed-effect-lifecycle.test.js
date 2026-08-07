import {
  beforeEach,
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
let lifecycle;

function makeActor() {
  return {
    id: "actor-1",
    uuid: "Actor.actor-1",
    isOwner: true,
    flags: {
      [MODULE_ID]: {
        druidFormState: {
          currentForm: "humanoid",
          activations: {},
        },
      },
    },
    items: [],
    getFlag(moduleId, key) {
      return this.flags?.[moduleId]?.[key];
    },
  };
}

beforeEach(async () => {
  vi.resetModules();
  globalThis.game = {
    user: null,
    scenes: [],
    settings: {
      get: vi.fn(() => true),
    },
  };

  lifecycle = await import(
    "../../foundry/scripts/managed-effect-lifecycle.js"
  );
});

afterEach(() => {
  delete globalThis.game;
});

describe(
  "manual managed-effect lifecycle",
  () => {
    test(
      "lists and deletes only the selected summon owned by the Actor",
      async () => {
        const actor = makeActor();
        const deleteEmbeddedDocuments = vi.fn(
          async (_type, ids) => ids,
        );

        const scene = {
          id: "scene-1",
          deleteEmbeddedDocuments,
          tokens: [
            {
              id: "owned",
              name: "Voidwalker",
              flags: {
                [MODULE_ID]: {
                  summonType: "warlock-demon",
                  duration: "shift",
                  casterActorUuid: actor.uuid,
                },
              },
            },
            {
              id: "other",
              name: "Imp",
              flags: {
                [MODULE_ID]: {
                  summonType: "warlock-demon",
                  duration: "shift",
                  casterActorUuid: "Actor.other",
                },
              },
            },
          ],
        };

        globalThis.game.scenes = [scene];

        const active =
          lifecycle.getManagedEffectsForActor(
            actor,
          );

        expect(
          active.map(effect => effect.id),
        ).toEqual([
          "summon:scene-1:owned",
        ]);

        await lifecycle.endManagedEffect(
          actor,
          active[0].id,
          {
            bypassAuthority: true,
          },
        );

        expect(
          deleteEmbeddedDocuments,
        ).toHaveBeenCalledWith(
          "Token",
          ["owned"],
        );
      },
    );
  },
);
