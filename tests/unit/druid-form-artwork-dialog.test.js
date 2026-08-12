import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID =
  "bane-of-azeroth";

let druidForms;

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

function actorWith(
  contentKeys,
) {
  return {
    type:
      "character",
    isOwner:
      true,
    items:
      contentKeys.map(
        key =>
          new FakeItem(
            key,
          ),
      ),
    flags: {},
    getFlag() {
      return undefined;
    },
  };
}

beforeEach(
  async () => {
    vi.resetModules();

    globalThis.game = {
      user: {
        id:
          "player",
        isGM:
          false,
      },
      settings: {
        get:
          vi.fn(
            () =>
              false,
          ),
      },
      i18n: {
        localize:
          vi.fn(
            key =>
              key,
          ),
      },
    };

    globalThis.foundry = {
      applications: {
        api: {
          DialogV2: {
            wait:
              vi.fn(
                async () =>
                  null,
              ),
          },
        },
      },
    };

    druidForms =
      await import(
        "../../foundry/scripts/druid-forms.js"
      );
  },
);

afterEach(
  () => {
    delete globalThis.game;
    delete globalThis.foundry;
  },
);

describe(
  "Druid form artwork defaults and editor",
  () => {
    test(
      "maps all seven profiles to their dedicated actor and token defaults",
      () => {
        const definitions =
          druidForms
            .getDruidFormProfileDefinitions();

        const expected = {
          travelPl1: [
            "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl1.webp",
            "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl1-token.webp",
          ],
          travelPl2: [
            "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl2.webp",
            "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl2-token.webp",
          ],
          travelPl3: [
            "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl3.webp",
            "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl3-token.webp",
          ],
          bear: [
            "modules/bane-of-azeroth/assets/actors/druid-forms/bear.webp",
            "modules/bane-of-azeroth/assets/tokens/druid-forms/bear-token.webp",
          ],
          cat: [
            "modules/bane-of-azeroth/assets/actors/druid-forms/cat.webp",
            "modules/bane-of-azeroth/assets/tokens/druid-forms/cat-token.webp",
          ],
          tree: [
            "modules/bane-of-azeroth/assets/actors/druid-forms/tree.webp",
            "modules/bane-of-azeroth/assets/tokens/druid-forms/tree-token.webp",
          ],
          moonkin: [
            "modules/bane-of-azeroth/assets/actors/druid-forms/moonkin.webp",
            "modules/bane-of-azeroth/assets/tokens/druid-forms/moonkin-token.webp",
          ],
        };

        expect(
          Object.fromEntries(
            definitions.map(
              profile => [
                profile.key,
                [
                  profile.defaultPortrait,
                  profile.defaultToken,
                ],
              ],
            ),
          ),
        ).toEqual(
          expected,
        );
      },
    );

    test(
      "renders one tabbed editor with portrait and token previews for owned profiles",
      async () => {
        const actor =
          actorWith([
            "spells.savage-incarnation",
            "spells.feral-incarnation",
          ]);

        await druidForms
          .openDruidFormArtworkDialog(
            actor,
          );

        expect(
          foundry
            .applications
            .api
            .DialogV2
            .wait,
        ).toHaveBeenCalledTimes(
          1,
        );

        const options =
          foundry
            .applications
            .api
            .DialogV2
            .wait
            .mock.calls[
              0
            ][
              0
            ];

        expect(
          options.position?.width,
        ).toBe(
          560,
        );

        const html =
          options.content;

        for (
          const key
          of [
            "travelPl1",
            "travelPl2",
            "travelPl3",
            "bear",
            "cat",
          ]
        ) {
          expect(
            html,
          ).toContain(
            `id="boa-druid-artwork-tab-${key}"`,
          );
          expect(
            html,
          ).toContain(
            `data-profile-key="${key}"`,
          );
        }

        expect(
          html,
        ).not.toContain(
          'data-profile-key="tree"',
        );
        expect(
          html,
        ).not.toContain(
          'data-profile-key="moonkin"',
        );

        expect(
          html.match(
            /class="boa-druid-artwork-preview"/g,
          ),
        ).toHaveLength(
          10,
        );

        expect(
          html.match(
            /<file-picker type="image"/g,
          ),
        ).toHaveLength(
          10,
        );

        expect(
          html.match(
            /class="boa-druid-artwork-panel"/g,
          ),
        ).toHaveLength(
          5,
        );
      },
    );

    test(
      "keeps the editor available when artwork automation is disabled",
      async () => {
        const actor =
          actorWith([
            "spells.savage-incarnation",
          ]);

        game.settings.get =
          vi.fn(
            (
              _moduleId,
              key,
            ) =>
              key ===
                "druidFormArtworkAutomation"
                ? false
                : true,
          );

        await druidForms
          .openDruidFormArtworkDialog(
            actor,
          );

        expect(
          foundry
            .applications
            .api
            .DialogV2
            .wait,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);
