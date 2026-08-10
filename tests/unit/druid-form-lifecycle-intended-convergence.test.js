import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID =
  "bane-of-azeroth";
const ACTOR_BASELINE_FLAG =
  "druidFormArtworkBaseline";
const TOKEN_BASELINE_FLAG =
  "druidFormTokenArtworkBaseline";

let lifecycle;

function makeActor({
  form,
  actorImg,
  prototypeTokenSrc,
  actorBaseline = null,
}) {
  return {
    id:
      "druid-1",
    img:
      actorImg,
    prototypeToken: {
      texture: {
        src:
          prototypeTokenSrc,
      },
    },
    flags: {
      [MODULE_ID]: {
        druidFormState: {
          currentForm:
            form,
          activations: {
            savage: {
              active: true,
              powerLevel: 2,
              duration: "shift",
            },
          },
        },
        [ACTOR_BASELINE_FLAG]:
          actorBaseline,
      },
    },
    getFlag(
      moduleId,
      key,
    ) {
      return (
        this.flags?.[
          moduleId
        ]?.[
          key
        ] ??
        null
      );
    },
  };
}

function makeToken({
  id,
  sceneId,
  actor,
  src,
  baseline = null,
}) {
  return {
    id,
    actorId:
      actor.id,
    actor,
    parent: {
      id:
        sceneId,
    },
    texture: {
      src,
    },
    flags: {
      [MODULE_ID]: {
        [TOKEN_BASELINE_FLAG]:
          baseline,
      },
    },
    getFlag(
      moduleId,
      key,
    ) {
      return (
        this.flags?.[
          moduleId
        ]?.[
          key
        ] ??
        null
      );
    },
  };
}

function makeScene(
  id,
  tokens,
) {
  return {
    id,
    tokens:
      new Map(
        tokens.map(
          token => [
            token.id,
            token,
          ],
        ),
      ),
  };
}

beforeEach(
  async () => {
    vi.resetModules();
    globalThis.Hooks =
      undefined;
    globalThis.canvas =
      undefined;
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
  "Druid intended lifecycle convergence",
  () => {
    test(
      "exports intent capture and target builder helpers",
      () => {
        expect(
          typeof lifecycle
            .captureDruidFormLifecycleIntentSeed,
        ).toBe(
          "function",
        );
        expect(
          typeof lifecycle
            .buildDruidFormLifecycleConvergenceTarget,
        ).toBe(
          "function",
        );
      },
    );

    test(
      "Travel target uses managed applied artwork instead of a stale active Scene Token value",
      () => {
        const travelToken =
          "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl2-token.webp";
        const actor =
          makeActor({
            form:
              "travel",
            actorImg:
              "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl2.webp",
            prototypeTokenSrc:
              travelToken,
            actorBaseline: {
              profileKey:
                "travelPl2",
              actor: {
                original:
                  "Guldis_transparent.png",
                applied:
                  "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl2.webp",
              },
              prototypeToken: {
                original:
                  "Guldis_token.png",
                applied:
                  travelToken,
              },
              tokens: {
                "scene-1": {
                  "token-1": {
                    sceneId:
                      "scene-1",
                    tokenId:
                      "token-1",
                    original:
                      "Guldis_token.png",
                    applied:
                      travelToken,
                  },
                },
              },
            },
          });
        const token =
          makeToken({
            id:
              "token-1",
            sceneId:
              "scene-1",
            actor,
            src:
              "Guldis_token.png",
          });
        const scene =
          makeScene(
            "scene-1",
            [
              token,
            ],
          );
        const before = {
          actorId:
            actor.id,
          actorImg:
            "Guldis_transparent.png",
          prototypeTokenSrc:
            "Guldis_token.png",
          actorArtworkBaseline:
            null,
          tokens: [
            {
              key:
                "scene-1.token-1",
              sceneId:
                "scene-1",
              tokenId:
                "token-1",
              src:
                "Guldis_token.png",
              tokenArtworkBaseline:
                null,
            },
          ],
        };

        const target =
          lifecycle
            .buildDruidFormLifecycleConvergenceTarget(
              actor,
              {
                currentForm:
                  "travel",
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
              },
              {
                before,
                scenes: [
                  scene,
                ],
              },
            );

        expect(
          target.tokens,
        ).toEqual([
          {
            key:
              "scene-1.token-1",
            sceneId:
              "scene-1",
            tokenId:
              "token-1",
            src:
              travelToken,
          },
        ]);
      },
    );

    test(
      "Humanoid target uses captured originals after runtime baselines are cleared and the active token is still Travel",
      () => {
        const travelToken =
          "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl2-token.webp";
        const actor =
          makeActor({
            form:
              "humanoid",
            actorImg:
              "Guldis_transparent.png",
            prototypeTokenSrc:
              "Guldis_token.png",
            actorBaseline:
              null,
          });
        const token =
          makeToken({
            id:
              "token-1",
            sceneId:
              "scene-1",
            actor,
            src:
              travelToken,
          });
        const scene =
          makeScene(
            "scene-1",
            [
              token,
            ],
          );
        const before = {
          actorId:
            actor.id,
          actorImg:
            "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl2.webp",
          prototypeTokenSrc:
            travelToken,
          actorArtworkBaseline: {
            profileKey:
              "travelPl2",
            actor: {
              original:
                "Guldis_transparent.png",
              applied:
                "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl2.webp",
            },
            prototypeToken: {
              original:
                "Guldis_token.png",
              applied:
                travelToken,
            },
            tokens: {
              "scene-1": {
                "token-1": {
                  original:
                    "Guldis_token.png",
                  applied:
                    travelToken,
                },
              },
            },
          },
          tokens: [
            {
              key:
                "scene-1.token-1",
              sceneId:
                "scene-1",
              tokenId:
                "token-1",
              src:
                travelToken,
              tokenArtworkBaseline: {
                original:
                  "Guldis_token.png",
                applied:
                  travelToken,
              },
            },
          ],
        };

        const target =
          lifecycle
            .buildDruidFormLifecycleConvergenceTarget(
              actor,
              {
                currentForm:
                  "humanoid",
                state: {
                  currentForm:
                    "humanoid",
                  activations: {
                    savage: {
                      active: true,
                      powerLevel: 2,
                      duration: "shift",
                    },
                  },
                },
              },
              {
                before,
                scenes: [
                  scene,
                ],
              },
            );

        expect(
          target.actorImg,
        ).toBe(
          "Guldis_transparent.png",
        );
        expect(
          target.prototypeTokenSrc,
        ).toBe(
          "Guldis_token.png",
        );
        expect(
          target.tokens,
        ).toEqual([
          {
            key:
              "scene-1.token-1",
            sceneId:
              "scene-1",
            tokenId:
              "token-1",
            src:
              "Guldis_token.png",
          },
        ]);
      },
    );

    test(
      "Humanoid target preserves each Scene Token own original artwork",
      () => {
        const travelToken =
          "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl2-token.webp";
        const treeToken =
          "modules/bane-of-azeroth/assets/tokens/druid-forms/tree-token.webp";
        const actor =
          makeActor({
            form:
              "humanoid",
            actorImg:
              "Guldis_transparent.png",
            prototypeTokenSrc:
              "Guldis_token.png",
            actorBaseline:
              null,
          });
        const tokenA =
          makeToken({
            id:
              "token-a",
            sceneId:
              "scene-a",
            actor,
            src:
              travelToken,
          });
        const tokenB =
          makeToken({
            id:
              "token-b",
            sceneId:
              "scene-b",
            actor,
            src:
              travelToken,
          });
        const scenes = [
          makeScene(
            "scene-a",
            [
              tokenA,
            ],
          ),
          makeScene(
            "scene-b",
            [
              tokenB,
            ],
          ),
        ];
        const before = {
          actorId:
            actor.id,
          actorImg:
            "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl2.webp",
          prototypeTokenSrc:
            travelToken,
          actorArtworkBaseline: {
            actor: {
              original:
                "Guldis_transparent.png",
              applied:
                "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl2.webp",
            },
            prototypeToken: {
              original:
                "Guldis_token.png",
              applied:
                travelToken,
            },
            tokens: {
              "scene-a": {
                "token-a": {
                  original:
                    "Guldis_token.png",
                  applied:
                    travelToken,
                },
              },
              "scene-b": {
                "token-b": {
                  original:
                    treeToken,
                  applied:
                    travelToken,
                },
              },
            },
          },
          tokens: [
            {
              key:
                "scene-a.token-a",
              sceneId:
                "scene-a",
              tokenId:
                "token-a",
              src:
                travelToken,
              tokenArtworkBaseline: {
                original:
                  "Guldis_token.png",
                applied:
                  travelToken,
              },
            },
            {
              key:
                "scene-b.token-b",
              sceneId:
                "scene-b",
              tokenId:
                "token-b",
              src:
                travelToken,
              tokenArtworkBaseline: {
                original:
                  treeToken,
                applied:
                  travelToken,
              },
            },
          ],
        };

        const target =
          lifecycle
            .buildDruidFormLifecycleConvergenceTarget(
              actor,
              {
                currentForm:
                  "humanoid",
                state: {
                  currentForm:
                    "humanoid",
                  activations: {
                    savage: {
                      active: true,
                      powerLevel: 2,
                      duration: "shift",
                    },
                  },
                },
              },
              {
                before,
                scenes,
              },
            );

        expect(
          target.tokens,
        ).toEqual([
          {
            key:
              "scene-a.token-a",
            sceneId:
              "scene-a",
            tokenId:
              "token-a",
            src:
              "Guldis_token.png",
          },
          {
            key:
              "scene-b.token-b",
            sceneId:
              "scene-b",
            tokenId:
              "token-b",
            src:
              treeToken,
          },
        ]);
      },
    );
  },
);
