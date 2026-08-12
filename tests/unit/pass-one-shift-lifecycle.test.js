import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
let summonLifecycle;
let druidLifecycle;

beforeEach(async () => {
  vi.resetModules();

  globalThis.game = {
    user: null,
    scenes: [],
    settings: {
      get: vi.fn(() => true),
    },
  };

  summonLifecycle = await import(
    "../../foundry/scripts/core/summon-duration-lifecycle.js"
  );
  druidLifecycle = await import(
    "../../foundry/scripts/druid-form-lifecycle.js"
  );
});

afterEach(() => {
  delete globalThis.game;
});

describe(
  "Pass One Shift lifecycle",
  () => {
    test(
      "summons patch restReset as shift cleanup without changing the legacy patch result contract",
      () => {
        class FakeActor {
          async restStretch() {
            return true;
          }

          async restShift() {
            return true;
          }

          async restReset() {
            return true;
          }
        }

        const result =
          summonLifecycle.patchSummonRestLifecycle({
            actorClass: FakeActor,
            requestCleanupFn: vi.fn(
              async () => ({
                deletedCount: 0,
                failedScenes: [],
              }),
            ),
            reportFailureFn: vi.fn(),
          });

        const marker =
          Symbol.for(
            `${MODULE_ID}.summonDurationLifecycle`,
          );

        expect(
          FakeActor.prototype.restReset?.[marker],
        ).toBeTruthy();

        expect(
          Object.hasOwn(
            result,
            "restReset",
          ),
        ).toBe(false);
      },
    );

    test(
      "Druid lifecycle patches restReset as shift expiration without changing the legacy patch result contract",
      () => {
        class FakeActor {
          async restStretch() {
            return true;
          }

          async restShift() {
            return true;
          }

          async restReset() {
            return true;
          }
        }

        const result =
          druidLifecycle.patchDruidFormRestLifecycle({
            actorClass: FakeActor,
          });

        const marker =
          Symbol.for(
            `${MODULE_ID}.druidFormLifecycle.rest`,
          );

        expect(
          FakeActor.prototype.restReset?.[marker],
        ).toBeTruthy();

        expect(
          Object.hasOwn(
            result,
            "restReset",
          ),
        ).toBe(false);
      },
    );
  },
);
