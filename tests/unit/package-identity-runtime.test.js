import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

let identity;

function modules({
  productionActive =
    false,
  developmentActive =
    false,
} = {}) {
  return new Map([
    [
      "bane-of-azeroth",
      {
        id:
          "bane-of-azeroth",
        title:
          "Bane of Azeroth",
        active:
          productionActive,
      },
    ],
    [
      "bane-of-azeroth-dev",
      {
        id:
          "bane-of-azeroth-dev",
        title:
          "Bane of Azeroth - Development",
        active:
          developmentActive,
      },
    ],
  ]);
}

beforeEach(
  async () => {
    vi.resetModules();

    globalThis.game = {
      modules:
        modules(),
    };
    globalThis.ui = {
      notifications: {
        warn:
          vi.fn(),
      },
    };

    identity =
      await import(
        "../../foundry/scripts/package-identity.js"
      );
  },
);

describe(
  "package coexistence runtime guard",
  () => {
    test(
      "production runs normally without active development",
      () => {
        expect(
          identity
            .shouldActivatePackageRuntime({
              moduleId:
                "bane-of-azeroth",
              modules:
                modules({
                  productionActive:
                    true,
                }),
            }),
        ).toBe(
          true,
        );
      },
    );

    test(
      "production becomes inert whenever development is active",
      () => {
        expect(
          identity
            .shouldActivatePackageRuntime({
              moduleId:
                "bane-of-azeroth",
              modules:
                modules({
                  productionActive:
                    true,
                  developmentActive:
                    true,
                }),
            }),
        ).toBe(
          false,
        );
      },
    );

    test(
      "development wins regardless of hook execution order",
      () => {
        const active =
          modules({
            productionActive:
              true,
            developmentActive:
              true,
          });

        expect(
          identity
            .claimPackageRuntime({
              moduleId:
                "bane-of-azeroth",
              modules:
                active,
            }),
        ).toBe(
          false,
        );

        expect(
          identity
            .claimPackageRuntime({
              moduleId:
                "bane-of-azeroth-dev",
              modules:
                active,
            }),
        ).toBe(
          true,
        );

        expect(
          identity
            .getClaimedPackageRuntimeId(),
        ).toBe(
          "bane-of-azeroth-dev",
        );
      },
    );

    test(
      "development warns only once when both packages are active",
      () => {
        const active =
          modules({
            productionActive:
              true,
            developmentActive:
              true,
          });
        const notifications = {
          warn:
            vi.fn(),
        };
        const consoleApi = {
          warn:
            vi.fn(),
        };

        expect(
          identity
            .notifyPackageConflictIfNeeded({
              moduleId:
                "bane-of-azeroth-dev",
              modules:
                active,
              notifications,
              consoleApi,
            }),
        ).toBe(
          true,
        );

        expect(
          identity
            .notifyPackageConflictIfNeeded({
              moduleId:
                "bane-of-azeroth-dev",
              modules:
                active,
              notifications,
              consoleApi,
            }),
        ).toBe(
          false,
        );

        expect(
          notifications.warn,
        ).toHaveBeenCalledTimes(
          1,
        );
        expect(
          consoleApi.warn,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);
