import {
  beforeAll,
  describe,
  expect,
  test,
} from "vitest";

const MODULE_ID =
  "bane-of-azeroth";

const CONTENT_KEYS = {
  savage:
    "spells.savage-incarnation",
  feral:
    "spells.feral-incarnation",
  harmony:
    "spells.incarnation-of-harmony",
  stars:
    "spells.incarnation-of-the-stars",
};

let druidForms = null;
let importError = null;

beforeAll(async () => {
  try {
    druidForms = await import(
      "../../foundry/scripts/druid-forms.js"
    );
  } catch (error) {
    importError = error;
  }
});

class FakeItem {
  constructor(
    contentKey,
  ) {
    this.flags = {
      [MODULE_ID]: {
        contentKey,
      },
    };
  }

  getFlag(
    moduleId,
    key,
  ) {
    return this.flags?.[
      moduleId
    ]?.[
      key
    ];
  }
}

class FakeActor {
  constructor(
    contentKeys = [],
  ) {
    this.flags = {};
    this.items =
      contentKeys.map(
        contentKey =>
          new FakeItem(
            contentKey,
          ),
      );
  }

  getFlag(
    moduleId,
    key,
  ) {
    return this.flags?.[
      moduleId
    ]?.[
      key
    ];
  }

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
    ][
      key
    ] =
      structuredClone(
        value,
      );

    return value;
  }

  async unsetFlag(
    moduleId,
    key,
  ) {
    if (
      this.flags[
        moduleId
      ]
    ) {
      delete this.flags[
        moduleId
      ][
        key
      ];
    }
  }
}

function api(
  name,
) {
  expect(
    importError,
    importError?.stack ??
      importError?.message,
  ).toBeNull();

  expect(
    druidForms?.[
      name
    ],
  ).toBeTypeOf(
    "function",
  );

  return druidForms[
    name
  ];
}

describe(
  "Druid Forms slice 1 foundation",
  () => {
    test(
      "ships the Druid Forms runtime",
      () => {
        expect(
          importError,
          importError?.stack ??
            importError?.message,
        ).toBeNull();
      },
    );

    test(
      "defines the seven artwork profiles with separate defaults",
      () => {
        const getDefinitions =
          api(
            "getDruidFormProfileDefinitions",
          );

        const definitions =
          getDefinitions();

        expect(
          definitions.map(
            profile => ({
              key:
                profile.key,
              spellContentKey:
                profile.spellContentKey,
              powerLevel:
                profile.powerLevel ??
                null,
              form:
                profile.form,
            }),
          ),
        ).toEqual([
          {
            key:
              "travelPl1",
            spellContentKey:
              CONTENT_KEYS.savage,
            powerLevel:
              1,
            form:
              "travel",
          },
          {
            key:
              "travelPl2",
            spellContentKey:
              CONTENT_KEYS.savage,
            powerLevel:
              2,
            form:
              "travel",
          },
          {
            key:
              "travelPl3",
            spellContentKey:
              CONTENT_KEYS.savage,
            powerLevel:
              3,
            form:
              "travel",
          },
          {
            key:
              "bear",
            spellContentKey:
              CONTENT_KEYS.feral,
            powerLevel:
              null,
            form:
              "bear",
          },
          {
            key:
              "cat",
            spellContentKey:
              CONTENT_KEYS.feral,
            powerLevel:
              null,
            form:
              "cat",
          },
          {
            key:
              "tree",
            spellContentKey:
              CONTENT_KEYS.harmony,
            powerLevel:
              null,
            form:
              "tree",
          },
          {
            key:
              "moonkin",
            spellContentKey:
              CONTENT_KEYS.stars,
            powerLevel:
              null,
            form:
              "moonkin",
          },
        ]);

        expect(
          definitions,
        ).toHaveLength(
          7,
        );

        for (
          const profile
          of definitions
        ) {
          expect(
            profile.defaultPortrait,
            profile.key,
          ).toEqual(
            expect.any(
              String,
            ),
          );
          expect(
            profile.defaultPortrait
              .length,
            profile.key,
          ).toBeGreaterThan(
            0,
          );

          expect(
            profile.defaultToken,
            profile.key,
          ).toEqual(
            expect.any(
              String,
            ),
          );
          expect(
            profile.defaultToken
              .length,
            profile.key,
          ).toBeGreaterThan(
            0,
          );
        }

        expect(
          definitions.some(
            profile =>
              profile.key ===
                "humanoid" ||
              profile.form ===
                "humanoid",
          ),
        ).toBe(
          false,
        );
      },
    );

    test(
      "exposes artwork profiles only for incarnation spells the Actor owns",
      () => {
        const getAvailable =
          api(
            "getAvailableDruidFormProfiles",
          );

        const savage =
          new FakeActor([
            CONTENT_KEYS.savage,
          ]);

        expect(
          getAvailable(
            savage,
          ).map(
            profile =>
              profile.key,
          ),
        ).toEqual([
          "travelPl1",
          "travelPl2",
          "travelPl3",
        ]);

        const savageAndFeral =
          new FakeActor([
            CONTENT_KEYS.savage,
            CONTENT_KEYS.feral,
          ]);

        expect(
          getAvailable(
            savageAndFeral,
          ).map(
            profile =>
              profile.key,
          ),
        ).toEqual([
          "travelPl1",
          "travelPl2",
          "travelPl3",
          "bear",
          "cat",
        ]);

        expect(
          getAvailable(
            new FakeActor(),
          ),
        ).toEqual([]);
      },
    );

    test(
      "stores portrait and token overrides independently for an owned profile",
      async () => {
        const setArtwork =
          api(
            "setDruidFormArtwork",
          );
        const getArtwork =
          api(
            "getDruidFormArtwork",
          );

        const actor =
          new FakeActor([
            CONTENT_KEYS.savage,
          ]);

        const changed =
          await setArtwork(
            actor,
            "travelPl2",
            {
              portrait:
                "worlds/test/travel-pl2-portrait.webp",
              token:
                "worlds/test/travel-pl2-token.webp",
            },
          );

        expect(
          changed,
        ).toBe(
          true,
        );

        expect(
          getArtwork(
            actor,
            "travelPl2",
          ),
        ).toMatchObject({
          portrait:
            "worlds/test/travel-pl2-portrait.webp",
          token:
            "worlds/test/travel-pl2-token.webp",
          portraitIsCustom:
            true,
          tokenIsCustom:
            true,
        });
      },
    );

    test(
      "rejects configuration for forms whose incarnation spell is not owned",
      async () => {
        const setArtwork =
          api(
            "setDruidFormArtwork",
          );

        const actor =
          new FakeActor([
            CONTENT_KEYS.savage,
          ]);

        expect(
          await setArtwork(
            actor,
            "bear",
            {
              portrait:
                "worlds/test/bear.webp",
            },
          ),
        ).toBe(
          false,
        );
      },
    );

    test(
      "supports a token fallback to the custom portrait without requiring two custom files",
      async () => {
        const setArtwork =
          api(
            "setDruidFormArtwork",
          );
        const getArtwork =
          api(
            "getDruidFormArtwork",
          );

        const actor =
          new FakeActor([
            CONTENT_KEYS.feral,
          ]);

        await setArtwork(
          actor,
          "cat",
          {
            portrait:
              "worlds/test/cat.webp",
          },
        );

        expect(
          getArtwork(
            actor,
            "cat",
          ),
        ).toMatchObject({
          portrait:
            "worlds/test/cat.webp",
          token:
            "worlds/test/cat.webp",
          portraitIsCustom:
            true,
          tokenIsCustom:
            false,
        });
      },
    );

    test(
      "reset removes custom overrides and resolves the profile defaults again",
      async () => {
        const setArtwork =
          api(
            "setDruidFormArtwork",
          );
        const resetArtwork =
          api(
            "resetDruidFormArtwork",
          );
        const getArtwork =
          api(
            "getDruidFormArtwork",
          );

        const actor =
          new FakeActor([
            CONTENT_KEYS.harmony,
          ]);

        await setArtwork(
          actor,
          "tree",
          {
            portrait:
              "worlds/test/tree-portrait.webp",
            token:
              "worlds/test/tree-token.webp",
          },
        );

        await resetArtwork(
          actor,
          "tree",
        );

        const artwork =
          getArtwork(
            actor,
            "tree",
          );

        expect(
          artwork.portraitIsCustom,
        ).toBe(
          false,
        );
        expect(
          artwork.tokenIsCustom,
        ).toBe(
          false,
        );
        expect(
          artwork.portrait,
        ).toEqual(
          expect.any(
            String,
          ),
        );
        expect(
          artwork.token,
        ).toEqual(
          expect.any(
            String,
          ),
        );
        expect(
          artwork.portrait.length,
        ).toBeGreaterThan(
          0,
        );
        expect(
          artwork.token.length,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    test(
      "defaults runtime form state to humanoid without active incarnations",
      () => {
        const getState =
          api(
            "getDruidFormState",
          );

        expect(
          getState(
            new FakeActor([
              CONTENT_KEYS.stars,
            ]),
          ),
        ).toEqual({
          currentForm:
            "humanoid",
          activations:
            {},
        });
      },
    );
  },
);
