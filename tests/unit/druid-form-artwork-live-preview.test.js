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
    getFlag() {
      return undefined;
    },
  };
}

function makeControl(
  {
    targetId,
    value,
  },
) {
  const listeners =
    new Map();

  return {
    value,
    dataset: {
      previewTarget:
        targetId,
      initialPreview:
        value,
    },
    addEventListener(
      type,
      callback,
    ) {
      listeners.set(
        type,
        callback,
      );
    },
    querySelector() {
      return null;
    },
    dispatch(
      type,
    ) {
      const callback =
        listeners.get(
          type,
        );

      if (callback) {
        callback();
      }
    },
  };
}

beforeEach(
  async () => {
    vi.resetModules();

    globalThis.game = {
      user: {
        id:
          "player-1",
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
  "Druid artwork live preview",
  () => {
    test(
      "dialog render callback wires preview updates before save",
      async () => {
        const actor =
          actorWith([
            "spells.savage-incarnation",
          ]);

        await druidForms
          .openDruidFormArtworkDialog(
            actor,
          );

        const options =
          foundry
            .applications
            .api
            .DialogV2
            .wait
            .mock.calls[
              0
            ][0];

        expect(
          options.render,
        ).toBeTypeOf(
          "function",
        );

        const portraitPreview =
          {
            src:
              "modules/bane-of-azeroth/assets/actors/druid-forms/travel-pl1.webp",
          };
        const tokenPreview =
          {
            src:
              "modules/bane-of-azeroth/assets/tokens/druid-forms/travel-pl1-token.webp",
          };

        const portraitControl =
          makeControl(
            {
              targetId:
                "boa-druid-artwork-preview-portrait-travelPl1",
              value:
                portraitPreview.src,
            },
          );
        const tokenControl =
          makeControl(
            {
              targetId:
                "boa-druid-artwork-preview-token-travelPl1",
              value:
                tokenPreview.src,
            },
          );

        const root = {
          querySelectorAll:
            vi.fn(
              () => [
                portraitControl,
                tokenControl,
              ],
            ),
          querySelector:
            vi.fn(
              selector => {
                if (
                  selector ===
                    '[id="boa-druid-artwork-preview-portrait-travelPl1"]'
                ) {
                  return portraitPreview;
                }

                if (
                  selector ===
                    '[id="boa-druid-artwork-preview-token-travelPl1"]'
                ) {
                  return tokenPreview;
                }

                return null;
              },
            ),
        };

        options.render(
          null,
          root,
        );

        portraitControl.value =
          "modules/bane-of-azeroth/assets/actors/druid-forms/cat.webp";
        portraitControl.dispatch(
          "change",
        );

        tokenControl.value =
          "modules/bane-of-azeroth/assets/tokens/druid-forms/cat-token.webp";
        tokenControl.dispatch(
          "input",
        );

        await Promise.resolve();
        await Promise.resolve();

        expect(
          portraitPreview.src,
        ).toBe(
          "modules/bane-of-azeroth/assets/actors/druid-forms/cat.webp",
        );
        expect(
          tokenPreview.src,
        ).toBe(
          "modules/bane-of-azeroth/assets/tokens/druid-forms/cat-token.webp",
        );
      },
    );

    test(
      "artwork markup binds each picker to its preview target",
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

        const html =
          foundry
            .applications
            .api
            .DialogV2
            .wait
            .mock.calls[
              0
            ][0]
            .content;

        expect(
          html,
        ).toContain(
          'id="boa-druid-artwork-preview-portrait-travelPl1"',
        );
        expect(
          html,
        ).toContain(
          'data-preview-target="boa-druid-artwork-preview-portrait-travelPl1"',
        );
        expect(
          html,
        ).toContain(
          'id="boa-druid-artwork-preview-token-cat"',
        );
        expect(
          html,
        ).toContain(
          'data-preview-target="boa-druid-artwork-preview-token-cat"',
        );
      },
    );
  },
);
