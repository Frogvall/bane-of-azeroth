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

function actorWithState(state) {
  return {
    id: "druid-1",
    flags: {
      [MODULE_ID]: {
        druidFormState: structuredClone(state),
      },
    },
    getFlag(moduleId, key) {
      return this.flags?.[moduleId]?.[key];
    },
    async setFlag(moduleId, key, value) {
      this.flags[moduleId] ??= {};
      this.flags[moduleId][key] = structuredClone(value);
    },
    async unsetFlag(moduleId, key) {
      delete this.flags?.[moduleId]?.[key];
    },
  };
}

beforeEach(async () => {
  vi.resetModules();
  globalThis.game = {
    user: null,
    settings: {
      get: vi.fn(() => true),
    },
  };

  lifecycle = await import(
    "../../foundry/scripts/druid-form-lifecycle.js"
  );
});

afterEach(() => {
  delete globalThis.game;
});

describe(
  "manual Druid incarnation ending",
  () => {
    test(
      "ending the incarnation that owns the current form returns Humanoid and preserves other activations",
      async () => {
        const actor = actorWithState({
          currentForm: "bear",
          activations: {
            savage: {
              active: true,
              powerLevel: 2,
              duration: "shift",
            },
            feral: {
              active: true,
              powerLevel: 3,
              duration: "stretch",
            },
          },
        });

        const restoreArtwork = vi.fn(
          async () => true,
        );

        await lifecycle.endDruidIncarnation(
          actor,
          "feral",
          {
            bypassAuthority: true,
            restoreArtwork,
            applyArtwork: vi.fn(
              async () => true,
            ),
          },
        );

        expect(
          actor.getFlag(
            MODULE_ID,
            "druidFormState",
          ),
        ).toEqual({
          currentForm: "humanoid",
          activations: {
            savage: {
              active: true,
              powerLevel: 2,
              duration: "shift",
            },
          },
        });

        expect(
          restoreArtwork,
        ).toHaveBeenCalledTimes(1);
      },
    );

    test(
      "ending an unrelated incarnation leaves the current form unchanged",
      async () => {
        const actor = actorWithState({
          currentForm: "travel",
          activations: {
            savage: {
              active: true,
              powerLevel: 2,
              duration: "shift",
            },
            feral: {
              active: true,
              powerLevel: 3,
              duration: "stretch",
            },
          },
        });

        await lifecycle.endDruidIncarnation(
          actor,
          "feral",
          {
            bypassAuthority: true,
            restoreArtwork: vi.fn(
              async () => true,
            ),
            applyArtwork: vi.fn(
              async () => true,
            ),
          },
        );

        expect(
          actor.getFlag(
            MODULE_ID,
            "druidFormState",
          ).currentForm,
        ).toBe("travel");
      },
    );
  },
);
