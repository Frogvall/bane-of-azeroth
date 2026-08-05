import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  FROSTREAPER_AURA_COLOR,
  FROSTREAPER_CONTENT_KEY,
  createFrostreaperActivationData,
  extractAbilityUseItemId,
  getFrostreaperAuraData,
  isFrostreaperActivationActive,
  onPreCreateFrostreaperChatMessage,
} from "../../foundry/scripts/frostreaper.js";

const MODULE_ID =
  "bane-of-azeroth";

function activation(
  overrides = {},
) {
  return {
    combatId:
      "combat",
    combatantId:
      "death-knight",
    actorId:
      "actor",
    sceneId:
      "scene",
    tokenId:
      "token",
    activationRound:
      4,
    activationTurn:
      1,
    range:
      10,
    ...overrides,
  };
}

function combat(
  {
    round = 4,
    turn = 1,
  } = {},
) {
  return {
    id:
      "combat",
    started:
      true,
    round,
    turn,
    scene: {
      id:
        "scene",
    },
    turns: [
      {
        id:
          "before",
        actorId:
          "before-actor",
        tokenId:
          "before-token",
      },
      {
        id:
          "death-knight",
        actorId:
          "actor",
        tokenId:
          "token",
      },
      {
        id:
          "after",
        actorId:
          "after-actor",
        tokenId:
          "after-token",
      },
    ],
  };
}

function frostreaperItem() {
  return {
    id:
      "frostreaper",
    getFlag:
      vi.fn(
        (
          moduleId,
          key,
        ) =>
          moduleId ===
            MODULE_ID &&
          key ===
            "contentKey"
            ? FROSTREAPER_CONTENT_KEY
            : undefined,
      ),
  };
}

function actorWithFrostreaper() {
  return {
    id:
      "actor",
    items:
      new Map([
        [
          "frostreaper",
          frostreaperItem(),
        ],
      ]),
  };
}

function nativeMessage() {
  return {
    content:
      '<p class="ability-use" data-ability-id="frostreaper">'
      + "<strong>Frostreaper</strong></p>",
    speaker: {
      actor:
        "actor",
      scene:
        "scene",
      token:
        "token",
    },
  };
}

afterEach(() => {
  delete globalThis.game;
});

describe(
  "Frostreaper aura lifecycle",
  () => {
    test("recognizes Dragonbane's native ability-use chat marker", () => {
      expect(
        extractAbilityUseItemId(
          nativeMessage()
            .content,
        ),
      ).toBe(
        "frostreaper",
      );

      expect(
        extractAbilityUseItemId(
          "<p>Frostreaper</p>",
        ),
      ).toBeNull();
    });

    test("builds an activation only for the Frostreaper combatant and token", () => {
      expect(
        createFrostreaperActivationData(
          nativeMessage(),
          {
            actors:
              new Map([
                [
                  "actor",
                  actorWithFrostreaper(),
                ],
              ]),
            combat:
              combat(),
          },
        ),
      ).toEqual(
        activation(),
      );
    });

    test("remains active until the Death Knight's turn in the next round", () => {
      const data =
        activation();

      expect(
        isFrostreaperActivationActive(
          data,
          combat({
            round:
              4,
            turn:
              2,
          }),
        ),
      ).toBe(true);

      expect(
        isFrostreaperActivationActive(
          data,
          combat({
            round:
              5,
            turn:
              0,
          }),
        ),
      ).toBe(true);

      expect(
        isFrostreaperActivationActive(
          data,
          combat({
            round:
              5,
            turn:
              1,
          }),
        ),
      ).toBe(false);

      expect(
        isFrostreaperActivationActive(
          data,
          combat({
            round:
              5,
            turn:
              2,
          }),
        ),
      ).toBe(false);

      expect(
        isFrostreaperActivationActive(
          data,
          combat({
            round:
              6,
            turn:
              0,
          }),
        ),
      ).toBe(false);
    });

    test("derives a light-blue 10 m visual aura from the persisted ChatMessage activation", () => {
      const token = {
        id:
          "token",
        document: {
          id:
            "token",
          parent: {
            id:
              "scene",
          },
        },
        scene: {
          id:
            "scene",
          grid: {
            size:
              100,
            distance:
              2,
          },
        },
      };

      const message = {
        flags: {
          [MODULE_ID]: {
            frostreaperActivation:
              activation(),
          },
        },
      };

      const aura =
        getFrostreaperAuraData(
          token,
          {
            settings: {
              get:
                vi.fn(
                  () =>
                    true,
                ),
            },
            combat:
              combat({
                round:
                  5,
                turn:
                  0,
              }),
            messages: [
              message,
            ],
          },
        );

      expect(
        aura,
      ).toEqual(
        expect.objectContaining({
          color:
            FROSTREAPER_AURA_COLOR,
          range:
            10,
          radius:
            500,
        }),
      );

      expect(
        getFrostreaperAuraData(
          token,
          {
            settings: {
              get:
                vi.fn(
                  () =>
                    false,
                ),
            },
            combat:
              combat({
                round:
                  5,
                turn:
                  0,
              }),
            messages: [
              message,
            ],
          },
        ),
      ).toBeNull();
    });

    test("decorates a successful native Frostreaper ability-use ChatMessage with persisted activation state", () => {
      const message = {
        ...nativeMessage(),
        updateSource:
          vi.fn(),
      };

      globalThis.game = {
        settings: {
          get:
            vi.fn(
              () =>
                true,
            ),
        },
        actors:
          new Map([
            [
              "actor",
              actorWithFrostreaper(),
            ],
          ]),
        combat:
          combat(),
      };

      onPreCreateFrostreaperChatMessage(
        message,
      );

      expect(
        message.updateSource,
      ).toHaveBeenCalledWith({
        "flags.bane-of-azeroth.frostreaperActivation":
          activation(),
      });
    });
  },
);
