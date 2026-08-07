import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
let lifecycle;

class FakeItem {
  constructor(contentKey) {
    this.flags = {
      [MODULE_ID]: {
        contentKey,
      },
    };
  }

  getFlag(moduleId, key) {
    return this.flags?.[moduleId]?.[key];
  }
}

beforeEach(async () => {
  vi.resetModules();

  globalThis.game = {
    user: {
      id: "player",
      isGM: false,
    },
    settings: {
      get:
        vi.fn(() => true),
    },
  };

  lifecycle =
    await import(
      "../../foundry/scripts/druid-form-lifecycle.js"
    );
});

afterEach(() => {
  delete globalThis.game;
  delete globalThis.document;
});

describe(
  "Druid Change Form sheet control",
  () => {
    test(
      "renders an independent Change Form control before any incarnation is active",
      () => {
        const actor = {
          isOwner: true,
          items: [
            new FakeItem(
              "spells.savage-incarnation",
            ),
          ],
          getFlag() {
            return undefined;
          },
        };

        const inserted = [];

        const tabs = {
          parentElement: {
            insertBefore(element) {
              inserted.push(
                element,
              );
            },
          },
        };

        const root = {
          querySelector(selector) {
            if (
              selector ===
                ".boa-druid-form-lifecycle-controls"
            ) {
              return null;
            }

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
          createElement(tag) {
            return {
              tag,
              className: "",
              type: "",
              innerHTML: "",
              title: "",
              children: [],
              addEventListener:
                vi.fn(),
              appendChild(child) {
                this.children.push(
                  child,
                );
              },
              remove:
                vi.fn(),
            };
          },
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

        expect(
          inserted[0].className,
        ).toBe(
          "boa-druid-form-lifecycle-controls",
        );

        expect(
          inserted[0]
            .children[0]
            .innerHTML,
        ).toContain(
          "Change Form",
        );
      },
    );
  },
);
