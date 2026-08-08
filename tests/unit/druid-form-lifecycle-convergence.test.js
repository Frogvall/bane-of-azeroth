import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID =
  "bane-of-azeroth";

let lifecycle;

function makeActor() {
  return {
    id:
      "druid-1",
    img:
      "icons/svg/mystery-man.svg",
    prototypeToken: {
      texture: {
        src:
          "icons/svg/mystery-man.svg",
      },
    },
    flags: {
      [MODULE_ID]: {
        druidFormState: {
          currentForm:
            "humanoid",
          activations: {},
        },
      },
    },
    getFlag(
      moduleId,
      key,
    ) {
      return this.flags?.[
        moduleId
      ]?.[
        key
      ];
    },
  };
}

function setTravelState(
  actor,
  token,
) {
  actor.flags[
    MODULE_ID
  ].druidFormState = {
    currentForm:
      "travel",
    activations: {
      savage: {
        active: true,
        powerLevel: 2,
        duration: "shift",
      },
    },
  };
  actor.img =
    "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl2.webp";
  actor.prototypeToken
    .texture
    .src =
      "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl2-token.webp";
  token.texture.src =
    "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl2-token.webp";
}

beforeEach(
  async () => {
    vi.resetModules();
    globalThis.game = {
      actors:
        new Map(),
      scenes: [],
      user:
        null,
      settings: {
        get:
          vi.fn(
            () => true,
          ),
      },
    };

    lifecycle =
      await import(
        "../../foundry/scripts/druid-form-lifecycle.js"
      );
  },
);

describe(
  "Druid Player lifecycle convergence",
  () => {
    test(
      "exports a requester-side convergence wait",
      () => {
        expect(
          typeof lifecycle
            .waitForDruidFormLifecycleConvergence,
        ).toBe(
          "function",
        );
      },
    );

    test(
      "waits until Player Actor, prototype Token, and required Scene Token reach the GM snapshot",
      async () => {
        const actor =
          makeActor();
        const token = {
          id:
            "token-1",
          actorId:
            actor.id,
          parent: {
            id:
              "scene-1",
          },
          texture: {
            src:
              "icons/svg/mystery-man.svg",
          },
        };
        const scene = {
          id:
            "scene-1",
          tokens:
            new Map([
              [
                token.id,
                token,
              ],
            ]),
        };
        const actors =
          new Map([
            [
              actor.id,
              actor,
            ],
          ]);
        const scenes = [
          scene,
        ];
        let clock =
          0;
        let sleeps =
          0;

        const convergence = {
          actorId:
            actor.id,
          state: {
            currentForm:
              "travel",
            activations: {
              savage: {
                active: true,
                powerLevel: 2,
                duration: "shift",
              },
            },
          },
          actorImg:
            "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl2.webp",
          prototypeTokenSrc:
            "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl2-token.webp",
          tokens: [
            {
              key:
                "scene-1.token-1",
              sceneId:
                "scene-1",
              tokenId:
                "token-1",
              src:
                "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl2-token.webp",
            },
          ],
        };

        const result =
          await lifecycle
            .waitForDruidFormLifecycleConvergence(
              convergence,
              {
                actors,
                scenes,
                requiredTokenKeys: [
                  "scene-1.token-1",
                ],
                timeoutMs: 20,
                intervalMs: 1,
                nowFn:
                  () => clock,
                sleepFn:
                  async delay => {
                    sleeps += 1;
                    clock +=
                      delay;
                    if (
                      sleeps ===
                        1
                    ) {
                      setTravelState(
                        actor,
                        token,
                      );
                    }
                  },
              },
            );

        expect(
          sleeps,
        ).toBeGreaterThan(
          0,
        );
        expect(
          result.matches,
        ).toBe(
          true,
        );
        expect(
          result.tokenChecks,
        ).toEqual([
          {
            key:
              "scene-1.token-1",
            expected:
              "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl2-token.webp",
            actual:
              "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl2-token.webp",
            matches: true,
          },
        ]);
      },
    );

    test(
      "rejects instead of acknowledging while a required Player Scene Token is stale",
      async () => {
        const actor =
          makeActor();
        const token = {
          id:
            "token-1",
          actorId:
            actor.id,
          parent: {
            id:
              "scene-1",
          },
          texture: {
            src:
              "icons/svg/mystery-man.svg",
          },
        };
        const scene = {
          id:
            "scene-1",
          tokens:
            new Map([
              [
                token.id,
                token,
              ],
            ]),
        };
        const actors =
          new Map([
            [
              actor.id,
              actor,
            ],
          ]);
        let clock =
          0;

        setTravelState(
          actor,
          token,
        );
        token.texture.src =
          "icons/svg/mystery-man.svg";

        const convergence = {
          actorId:
            actor.id,
          state: {
            currentForm:
              "travel",
            activations: {
              savage: {
                active: true,
                powerLevel: 2,
                duration: "shift",
              },
            },
          },
          actorImg:
            actor.img,
          prototypeTokenSrc:
            actor.prototypeToken
              .texture
              .src,
          tokens: [
            {
              key:
                "scene-1.token-1",
              sceneId:
                "scene-1",
              tokenId:
                "token-1",
              src:
                "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl2-token.webp",
            },
          ],
        };

        await expect(
          lifecycle
            .waitForDruidFormLifecycleConvergence(
              convergence,
              {
                actors,
                scenes: [
                  scene,
                ],
                requiredTokenKeys: [
                  "scene-1.token-1",
                ],
                timeoutMs: 3,
                intervalMs: 1,
                nowFn:
                  () => clock,
                sleepFn:
                  async delay => {
                    clock +=
                      delay;
                  },
              },
            ),
        ).rejects.toThrow(
          /did not converge/i,
        );
      },
    );
  },
);
