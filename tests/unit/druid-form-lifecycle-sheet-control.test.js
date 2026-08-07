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

let lifecycle;

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

function element() {
  const classes =
    new Set();

  return {
    children: [],
    classList: {
      add(
        ...names
      ) {
        for (
          const name
          of names
        ) {
          classes.add(
            name,
          );
        }
      },

      contains(
        name,
      ) {
        return classes.has(
          name,
        );
      },
    },

    append(
      child,
    ) {
      this.children.push(
        child,
      );
    },

    appendChild(
      child,
    ) {
      this.children.push(
        child,
      );
    },

    addEventListener:
      vi.fn(),

    remove:
      vi.fn(),

    innerHTML:
      "",
    title:
      "",
    type:
      "",
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
              true,
          ),
      },
    };

    globalThis.CONST = {
      DOCUMENT_OWNERSHIP_LEVELS: {
        OWNER:
          3,
      },
    };

    lifecycle =
      await import(
        "../../foundry/scripts/druid-form-lifecycle.js"
      );
  },
);

afterEach(
  () => {
    delete globalThis.game;
    delete globalThis.CONST;
    delete globalThis.document;
    delete globalThis.HTMLElement;
  },
);

describe(
  "Druid Change Form sheet control",
  () => {
    test(
      "renders Change Form in the shared Druid row before any incarnation is active",
      () => {
        const actor = {
          type:
            "character",
          isOwner:
            true,

          items: [
            new FakeItem(
              "spells.savage-incarnation",
            ),
          ],

          getFlag() {
            return undefined;
          },
        };

        const tabs =
          element();
        const inserted =
          [];

        tabs.parentElement = {
          insertBefore(
            child,
            before,
          ) {
            inserted.push({
              child,
              before,
            });
          },
        };

        const root = {
          querySelector(
            selector,
          ) {
            if (
              selector.includes(
                ".sheet-tabs",
              )
            ) {
              return tabs;
            }

            return null;
          },
        };

        globalThis.document = {
          createElement:
            vi.fn(
              () =>
                element(),
            ),
        };

        expect(
          lifecycle
            .onRenderDruidFormLifecycleActorSheet(
              {
                actor,
              },
              root,
            ),
        ).toBe(
          true,
        );

        expect(
          inserted,
        ).toHaveLength(
          1,
        );

        const controls =
          inserted[
            0
          ].child;

        expect(
          controls
            .classList
            .contains(
              "boa-druid-form-artwork-controls",
            ),
        ).toBe(
          true,
        );

        expect(
          controls.children,
        ).toHaveLength(
          1,
        );

        const button =
          controls.children[
            0
          ];

        expect(
          button
            .classList
            .contains(
              "boa-druid-form-switch-button",
            ),
        ).toBe(
          true,
        );

        expect(
          button.innerHTML,
        ).toContain(
          "Change Form",
        );
      },
    );
  },
);
