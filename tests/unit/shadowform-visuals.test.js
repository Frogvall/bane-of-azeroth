import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID =
  "bane-of-azeroth";
let shadowform;

class FakeColorMatrixFilter {
  constructor() {
    this.matrix = [];
    this.destroy = vi.fn();
  }
}

function settings(
  enabled = true,
) {
  return {
    get: vi.fn(
      (_module, key) =>
        key ===
          "shadowformVisualAutomation"
          ? enabled
          : true,
    ),
  };
}

function makeActor(
  active = false,
) {
  const actor = {
    id: "priest",
    uuid: "Actor.priest",
    type: "character",
    flags: {
      [MODULE_ID]: {},
    },
    sheet: {
      rendered: false,
      render: vi.fn(),
    },
    getFlag(module, key) {
      return this.flags?.[module]?.[key];
    },
    async setFlag(module, key, value) {
      this.flags[module] ??= {};
      this.flags[module][key] =
        structuredClone(value);
      return value;
    },
    async unsetFlag(module, key) {
      delete this.flags?.[module]?.[key];
      return true;
    },
  };

  if (active) {
    actor.flags[
      MODULE_ID
    ].shadowformState = {
      active: true,
      duration: "stretch",
      powerLevel: 2,
    };
  }

  return actor;
}

function makeToken(
  actor,
  filters = [],
) {
  return {
    actor,
    mesh: {
      filters:
        filters.length
          ? filters
          : null,
    },
  };
}

beforeEach(
  async () => {
    vi.resetModules();
    globalThis.PIXI = {
      ColorMatrixFilter:
        FakeColorMatrixFilter,
    };
    globalThis.game = {
      settings:
        settings(),
      actors: [],
    };
    globalThis.canvas = {
      tokens: {
        placeables: [],
      },
    };

    shadowform =
      await import(
        "../../foundry/scripts/shadowform-visuals.js"
      );
  },
);

describe(
  "Shadowform visuals",
  () => {
    test(
      "activation stores Actor state without replacing images",
      async () => {
        const actor =
          makeActor();

        await shadowform
          .activateShadowform(
            actor,
            3,
          );

        expect(
          shadowform
            .getShadowformState(
              actor,
            ),
        ).toEqual({
          active: true,
          duration: "stretch",
          powerLevel: 3,
        });
        expect(actor.img).toBeUndefined();
      },
    );

    test(
      "token treatment preserves unrelated filters and is idempotent",
      () => {
        const actor =
          makeActor(true);
        const unrelated = {
          name: "other",
        };
        const token =
          makeToken(
            actor,
            [unrelated],
          );

        expect(
          shadowform
            .applyShadowformTokenVisual(
              token,
              {
                settings:
                  settings(true),
              },
            ),
        ).toBe(true);

        shadowform
          .applyShadowformTokenVisual(
            token,
            {
              settings:
                settings(true),
            },
          );

        expect(
          token.mesh.filters[0],
        ).toBe(unrelated);
        expect(
          token.mesh.filters.filter(
            shadowform
              .isShadowformFilter,
          ),
        ).toHaveLength(1);
      },
    );

    test(
      "setting off removes only the owned filter",
      () => {
        const actor =
          makeActor(true);
        const unrelated = {
          name: "other",
        };
        const token =
          makeToken(
            actor,
            [unrelated],
          );

        shadowform
          .applyShadowformTokenVisual(
            token,
            {
              settings:
                settings(true),
            },
          );
        shadowform
          .applyShadowformTokenVisual(
            token,
            {
              settings:
                settings(false),
            },
          );

        expect(
          token.mesh.filters,
        ).toEqual([unrelated]);
      },
    );

    test(
      "canvas reconciliation handles all current Scene tokens",
      () => {
        const tokens = [
          makeToken(
            makeActor(true),
          ),
          makeToken(
            makeActor(false),
          ),
        ];

        expect(
          shadowform
            .reconcileShadowformCanvas({
              tokens,
              settings:
                settings(true),
            }),
        ).toEqual({
          checked: 2,
          active: 1,
        });
      },
    );

    test(
      "sheet treatment is a CSS class only",
      () => {
        const actor =
          makeActor(true);
        const classes =
          new Set();
        const root = {
          classList: {
            toggle(name, enabled) {
              if (enabled) {
                classes.add(name);
              } else {
                classes.delete(name);
              }
            },
          },
        };

        shadowform
          .onRenderShadowformActorSheet(
            { actor },
            root,
            {
              settings:
                settings(true),
            },
          );

        expect(
          classes.has(
            "boa-shadowform-active",
          ),
        ).toBe(true);
      },
    );

    test(
      "successful Shadowform spell message activates via contentKey",
      async () => {
        const actor =
          makeActor();
        const spell = {
          flags: {
            [MODULE_ID]: {
              contentKey:
                "spells.shadowform",
            },
          },
        };
        const docs =
          new Map([
            ["Item.shadow", spell],
            ["Actor.priest", actor],
          ]);

        await shadowform
          .onCreateShadowformSpellMessage(
            {
              type: "spellTest",
              user: "player",
              system: {
                success: true,
                spellUuid:
                  "Item.shadow",
                actorUuid:
                  "Actor.priest",
                powerLevel: 2,
              },
            },
            {
              currentUserId:
                "player",
              fromUuidFn:
                async uuid =>
                  docs.get(uuid),
            },
          );

        expect(
          shadowform
            .isShadowformActive(
              actor,
            ),
        ).toBe(true);
      },
    );

    test(
      "Stretch Rest ends Shadowform",
      async () => {
        const actor =
          makeActor(true);

        await shadowform
          .expireShadowformForRest(
            actor,
            "stretch",
          );

        expect(
          shadowform
            .isShadowformActive(
              actor,
            ),
        ).toBe(false);
      },
    );
  },
);
