import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  DEMON_HUNTER_INITIATION_CONTENT_KEY,
  actorSceneTokens,
  isDemonHunterInitiationAbility,
  onCreateDemonHunterInitiationToken,
  reconcileDemonHunterInitiationActor,
} from "../../foundry/scripts/demon-hunter-initiation.js";

const MODULE_ID =
  "bane-of-azeroth";

function flagsDocument(
  base = {},
) {
  return {
    flags: {},
    ...base,
    getFlag(moduleId, key) {
      return (
        this.flags?.[
          moduleId
        ]?.[key]
      );
    },
    async setFlag(
      moduleId,
      key,
      value,
    ) {
      this.flags[
        moduleId
      ] ??= {};
      this.flags[
        moduleId
      ][key] = value;
    },
    async unsetFlag(
      moduleId,
      key,
    ) {
      delete this.flags?.[
        moduleId
      ]?.[key];
    },
  };
}

function initiation() {
  return flagsDocument({
    type:
      "ability",
    name:
      "Demon Hunter Initiation",
    flags: {
      [MODULE_ID]: {
        contentKey:
          DEMON_HUNTER_INITIATION_CONTENT_KEY,
      },
    },
  });
}

function actor({
  withInitiation = true,
  enabled = false,
  range = 7,
  visionMode = "basic",
  attenuation = 0.1,
  saturation = 0.25,
  brightness = 0,
  contrast = 0,
  color = null,
} = {}) {
  const result = flagsDocument({
    id:
      "actor",
    type:
      "character",
    items:
      withInitiation
        ? [initiation()]
        : [],
    prototypeToken: {
      sight: {
        enabled,
        range,
        visionMode,
        attenuation,
        saturation,
        brightness,
        contrast,
        color,
        angle:
          270,
      },
    },
    async update(update) {
      if (
        Object.hasOwn(
          update,
          "prototypeToken.sight.enabled",
        )
      ) {
        this.prototypeToken
          .sight.enabled =
          update[
            "prototypeToken.sight.enabled"
          ];
      }

      if (
        Object.hasOwn(
          update,
          "prototypeToken.sight.visionMode",
        )
      ) {
        this.prototypeToken
          .sight.visionMode =
          update[
            "prototypeToken.sight.visionMode"
          ];
      }

      for (const field of [
        "color",
        "saturation",
        "contrast",
        "attenuation",
        "brightness",
      ]) {
        const key =
          `prototypeToken.sight.${field}`;

        if (
          Object.hasOwn(
            update,
            key,
          )
        ) {
          this.prototypeToken
            .sight[field] =
            update[key];
        }
      }

      if (
        Object.hasOwn(
          update,
          "prototypeToken.sight.range",
        )
      ) {
        const range =
          update[
            "prototypeToken.sight.range"
          ];

        this.prototypeToken
          .sight.range =
          range === null
            ? Number.POSITIVE_INFINITY
            : range;
      }
    },
  });

  for (const item of result.items) {
    item.parent =
      result;
  }

  return result;
}

function token(
  testActor,
  {
    enabled = false,
    range = 5,
    visionMode = "basic",
    attenuation = 0.1,
    saturation = 0.4,
    brightness = 0,
    contrast = 0,
    color = null,
  } = {},
) {
  return flagsDocument({
    actorId:
      testActor.id,
    actor:
      testActor,
    sight: {
      enabled,
      range,
      visionMode,
      attenuation,
      saturation,
      brightness,
      contrast,
      color,
      angle:
        180,
    },
    async update(update) {
      if (
        Object.hasOwn(
          update,
          "sight.enabled",
        )
      ) {
        this.sight.enabled =
          update[
            "sight.enabled"
          ];
      }

      if (
        Object.hasOwn(
          update,
          "sight.visionMode",
        )
      ) {
        this.sight.visionMode =
          update[
            "sight.visionMode"
          ];
      }

      for (const field of [
        "color",
        "saturation",
        "contrast",
        "attenuation",
        "brightness",
      ]) {
        const key =
          `sight.${field}`;

        if (
          Object.hasOwn(
            update,
            key,
          )
        ) {
          this.sight[field] =
            update[key];
        }
      }

      if (
        Object.hasOwn(
          update,
          "sight.range",
        )
      ) {
        const range =
          update[
            "sight.range"
          ];

        this.sight.range =
          range === null
            ? Number.POSITIVE_INFINITY
            : range;
      }
    },
  });
}

function settings(
  enabled = true,
) {
  return {
    get:
      vi.fn(
        () =>
          enabled,
      ),
  };
}

beforeEach(() => {
  globalThis.CONFIG = {
    Canvas: {
      visionModes: {
        darkvision: {
          vision: {
            defaults: {
              attenuation:
                0,
              saturation:
                0,
              brightness:
                0,
              contrast:
                0,
              color:
                null,
            },
          },
        },
      },
    },
  };
});

afterEach(() => {
  delete globalThis.game;
  delete globalThis.CONFIG;
});

describe(
  "Demon Hunter Initiation automation",
  () => {
    test("recognizes only the canonical heroic ability content key", () => {
      expect(
        isDemonHunterInitiationAbility(
          initiation(),
        ),
      ).toBe(true);

      expect(
        isDemonHunterInitiationAbility({
          type:
            "ability",
          name:
            "Demon Hunter Initiation",
          flags: {},
        }),
      ).toBe(false);
    });

    test("makes prototype and existing token sight unlimited in darkness while preserving other vision settings", async () => {
      const testActor =
        actor();
      const sceneToken =
        token(
          testActor,
        );
      const scenes = [
        {
          tokens: [
            sceneToken,
          ],
        },
      ];

      await reconcileDemonHunterInitiationActor(
        testActor,
        {
          settings:
            settings(true),
          scenes,
        },
      );

      expect(
        testActor.prototypeToken
          .sight,
      ).toEqual(
        expect.objectContaining({
          enabled:
            true,
          range:
            Number.POSITIVE_INFINITY,
          visionMode:
            "darkvision",
          attenuation:
            0,
          saturation:
            0,
          angle:
            270,
        }),
      );

      expect(
        sceneToken.sight,
      ).toEqual(
        expect.objectContaining({
          enabled:
            true,
          range:
            Number.POSITIVE_INFINITY,
          visionMode:
            "darkvision",
          attenuation:
            0,
          saturation:
            0,
          angle:
            180,
        }),
      );
    });

    test("restores exact prototype and token baselines when Initiation disappears", async () => {
      const testActor =
        actor({
          enabled:
            false,
          range:
            9,
          attenuation:
            0.37,
          saturation:
            0.62,
        });
      const sceneToken =
        token(
          testActor,
          {
            enabled:
              true,
            range:
              13,
            attenuation:
              0.44,
            saturation:
              0.71,
          },
        );
      const scenes = [
        {
          tokens: [
            sceneToken,
          ],
        },
      ];

      await reconcileDemonHunterInitiationActor(
        testActor,
        {
          settings:
            settings(true),
          scenes,
        },
      );

      testActor.items = [];

      await reconcileDemonHunterInitiationActor(
        testActor,
        {
          settings:
            settings(true),
          scenes,
        },
      );

      expect(
        testActor.prototypeToken
          .sight.enabled,
      ).toBe(false);
      expect(
        testActor.prototypeToken
          .sight.range,
      ).toBe(9);

      expect(
        testActor.prototypeToken
          .sight.visionMode,
      ).toBe("basic");

      expect(
        testActor.prototypeToken
          .sight.attenuation,
      ).toBe(0.37);

      expect(
        testActor.prototypeToken
          .sight.saturation,
      ).toBe(0.62);

      expect(
        sceneToken.sight.enabled,
      ).toBe(true);
      expect(
        sceneToken.sight.range,
      ).toBe(13);

      expect(
        sceneToken.sight.visionMode,
      ).toBe("basic");

      expect(
        sceneToken.sight.attenuation,
      ).toBe(0.44);

      expect(
        sceneToken.sight.saturation,
      ).toBe(0.71);
    });

    test("does not overwrite a manual token-vision change made after automation applied", async () => {
      const testActor =
        actor();
      const sceneToken =
        token(
          testActor,
        );
      const scenes = [
        {
          tokens: [
            sceneToken,
          ],
        },
      ];

      await reconcileDemonHunterInitiationActor(
        testActor,
        {
          settings:
            settings(true),
          scenes,
        },
      );

      sceneToken.sight.range =
        22;
      testActor.items = [];

      await reconcileDemonHunterInitiationActor(
        testActor,
        {
          settings:
            settings(true),
          scenes,
        },
      );

      expect(
        sceneToken.sight.range,
      ).toBe(22);

      expect(
        sceneToken.getFlag(
          MODULE_ID,
          "demonHunterInitiationManagedTokenVision",
        ),
      ).toBeUndefined();
    });

    test("applies vision to a token created after the actor already has Initiation", async () => {
      const testActor =
        actor();
      const sceneToken =
        token(
          testActor,
        );

      globalThis.game = {
        settings:
          settings(true),
        scenes: [
          {
            tokens: [
              sceneToken,
            ],
          },
        ],
      };

      await onCreateDemonHunterInitiationToken(
        sceneToken,
      );

      expect(
        sceneToken.sight.enabled,
      ).toBe(true);
      expect(
        sceneToken.sight.range,
      ).toBe(
        Number.POSITIVE_INFINITY,
      );

      expect(
        sceneToken.sight.visionMode,
      ).toBe("darkvision");

      expect(
        sceneToken.sight.attenuation,
      ).toBe(0);

      expect(
        sceneToken.sight.saturation,
      ).toBe(0);
    });

    test("disabling automation restores the prototype baseline", async () => {
      const testActor =
        actor({
          range:
            11,
        });

      await reconcileDemonHunterInitiationActor(
        testActor,
        {
          settings:
            settings(true),
          scenes: [],
        },
      );

      expect(
        testActor.prototypeToken
          .sight.range,
      ).toBe(
        Number.POSITIVE_INFINITY,
      );

      expect(
        testActor.prototypeToken
          .sight.visionMode,
      ).toBe("darkvision");

      await reconcileDemonHunterInitiationActor(
        testActor,
        {
          settings:
            settings(false),
          scenes: [],
        },
      );

      expect(
        testActor.prototypeToken
          .sight.range,
      ).toBe(11);

      expect(
        testActor.prototypeToken
          .sight.visionMode,
      ).toBe("basic");

      expect(
        testActor.prototypeToken
          .sight.attenuation,
      ).toBe(0.1);

      expect(
        testActor.prototypeToken
          .sight.saturation,
      ).toBe(0.25);
    });

    test("collects matching actor tokens from all supplied scenes", () => {
      const testActor =
        actor();
      const first =
        token(
          testActor,
        );
      const second =
        token(
          testActor,
        );

      expect(
        actorSceneTokens(
          testActor,
          [
            {
              tokens: [
                first,
              ],
            },
            {
              tokens: [
                second,
                {
                  actorId:
                    "other",
                },
              ],
            },
          ],
        ),
      ).toEqual([
        first,
        second,
      ]);
    });
  },
);
