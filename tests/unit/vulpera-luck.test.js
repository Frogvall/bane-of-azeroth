import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  VULPERA_LUCK_CAN_PUSH_OPTION,
  VULPERA_LUCK_CHAIN_OPTION,
  VULPERA_LUCK_ROLL_OPTION,
  VULPERA_LUCK_WP_COST,
  actorHasVulperaLuck,
  canUseVulperaLuck,
  patchVulperaLuckRollMetadata,
} from "../../foundry/scripts/vulpera-luck.js";

const MODULE_ID =
  "bane-of-azeroth";

function luckActor({
  wp = 6,
  owner = true,
} = {}) {
  return {
    isOwner: owner,
    system: {
      willPoints: {
        value: wp,
      },
    },
    items: {
      contents: [
        {
          name: "Luck",
          type: "ability",
          system: {
            requirement: "Vulpera",
          },
          flags: {
            [MODULE_ID]: {
              contentKey:
                "ability.luck",
            },
          },
        },
      ],
    },
  };
}

function makeMessage({
  actor = luckActor(),
  type = "skillTest",
  isDemon = false,
  rollOptions = {},
  id = "message-1",
} = {}) {
  return {
    id,
    type,
    system: {
      isDemon,
      toContext:
        () => ({
          actor,
        }),
    },
    rolls: [
      {
        options:
          rollOptions,
      },
    ],
  };
}

beforeEach(() => {
  globalThis.game = {
    settings: {
      get:
        vi.fn(
          () => true,
        ),
    },
    messages: {
      contents: [],
    },
  };
});

describe(
  "Vulpera Luck",
  () => {
    test(
      "recognizes the generated Vulpera Luck ability",
      () => {
        expect(
          actorHasVulperaLuck(
            luckActor(),
          ),
        ).toBe(true);
      },
    );

    test(
      "uses the rules WP cost",
      () => {
        expect(
          VULPERA_LUCK_WP_COST,
        ).toBe(3);
      },
    );

    test(
      "is independent of Push capability",
      () => {
        const message =
          makeMessage({
            rollOptions: {
              [
                VULPERA_LUCK_CAN_PUSH_OPTION
              ]: false,
            },
          });

        globalThis.game
          .messages
          .contents = [
          message,
        ];

        expect(
          canUseVulperaLuck(
            message,
          ),
        ).toBe(true);
      },
    );

    test(
      "blocks demon, consumed Luck, and insufficient WP",
      () => {
        expect(
          canUseVulperaLuck(
            makeMessage({
              isDemon: true,
            }),
          ),
        ).toBe(false);

        expect(
          canUseVulperaLuck(
            makeMessage({
              rollOptions: {
                [
                  VULPERA_LUCK_ROLL_OPTION
                ]: true,
              },
            }),
          ),
        ).toBe(false);

        expect(
          canUseVulperaLuck(
            makeMessage({
              actor:
                luckActor({
                  wp: 2,
                }),
            }),
          ),
        ).toBe(false);
      },
    );

    test(
      "only the newest result in a reroll chain is eligible",
      () => {
        const first =
          makeMessage({
            id: "first",
            rollOptions: {
              [
                VULPERA_LUCK_CHAIN_OPTION
              ]: "chain",
            },
          });
        const second =
          makeMessage({
            id: "second",
            rollOptions: {
              [
                VULPERA_LUCK_CHAIN_OPTION
              ]: "chain",
            },
          });

        globalThis.game
          .messages
          .contents = [
          first,
          second,
        ];

        expect(
          canUseVulperaLuck(
            first,
          ),
        ).toBe(false);
        expect(
          canUseVulperaLuck(
            second,
          ),
        ).toBe(true);
      },
    );

    test(
      "Dragonbane post-roll metadata carries Luck and native Push state",
      async () => {
        class FakeDoDTest {
          async updatePostRollData() {
            this.nativeCalled =
              true;
          }
        }

        expect(
          patchVulperaLuckRollMetadata({
            TestClass:
              FakeDoDTest,
          }),
        ).toBe(true);

        const testObject =
          new FakeDoDTest();

        testObject.options = {
          rerollOptions: {
            [
              VULPERA_LUCK_ROLL_OPTION
            ]: true,
            [
              VULPERA_LUCK_CHAIN_OPTION
            ]: "existing-chain",
          },
        };
        testObject.preRollData = {
          canPush: false,
        };
        testObject.roll = {
          options: {},
        };

        await testObject
          .updatePostRollData();

        expect(
          testObject.nativeCalled,
        ).toBe(true);
        expect(
          testObject
            .roll
            .options[
              VULPERA_LUCK_ROLL_OPTION
            ],
        ).toBe(true);
        expect(
          testObject
            .roll
            .options[
              VULPERA_LUCK_CAN_PUSH_OPTION
            ],
        ).toBe(false);
        expect(
          testObject
            .roll
            .options[
              VULPERA_LUCK_CHAIN_OPTION
            ],
        ).toBe(
          "existing-chain",
        );
      },
    );

    test(
      "metadata patch is idempotent",
      () => {
        class FakeDoDTest {
          async updatePostRollData() {
            return "native";
          }
        }

        expect(
          patchVulperaLuckRollMetadata({
            TestClass:
              FakeDoDTest,
          }),
        ).toBe(true);

        const once =
          FakeDoDTest
            .prototype
            .updatePostRollData;

        expect(
          patchVulperaLuckRollMetadata({
            TestClass:
              FakeDoDTest,
          }),
        ).toBe(true);

        expect(
          FakeDoDTest
            .prototype
            .updatePostRollData,
        ).toBe(once);
      },
    );
  },
);
