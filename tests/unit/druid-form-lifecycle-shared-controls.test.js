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

function element(className = "") {
  const classes =
    new Set(
      className
        .split(/\s+/)
        .filter(Boolean),
    );

  return {
    children: [],
    classList: {
      add(...names) {
        names.forEach(
          name =>
            classes.add(name),
        );
      },
      contains(name) {
        return classes.has(name);
      },
    },
    append(child) {
      this.children.push(child);
    },
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener:
      vi.fn(),
    remove:
      vi.fn(),
    innerHTML: "",
    title: "",
    type: "",
  };
}

function actor() {
  return {
    type: "character",
    isOwner: true,
    items: [
      new FakeItem(
        "spells.savage-incarnation",
      ),
    ],
  };
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

  globalThis.CONST = {
    DOCUMENT_OWNERSHIP_LEVELS: {
      OWNER: 3,
    },
  };

  lifecycle =
    await import(
      "../../foundry/scripts/druid-form-lifecycle.js"
    );
});

afterEach(() => {
  delete globalThis.game;
  delete globalThis.CONST;
  delete globalThis.document;
  delete globalThis.HTMLElement;
});

describe(
  "Druid shared sheet controls",
  () => {
    test(
      "Change Form joins an existing Druid Forms row",
      () => {
        const controls =
          element(
            "boa-druid-form-artwork-controls",
          );
        const artworkButton =
          element(
            "boa-druid-form-artwork-button",
          );
        controls.append(
          artworkButton,
        );

        const tabs =
          element(
            "sheet-tabs",
          );
        tabs.parentElement = {
          insertBefore:
            vi.fn(),
        };

        const root = {
          querySelector(selector) {
            if (
              selector ===
                ".boa-druid-form-artwork-controls"
            ) {
              return controls;
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
                actor: actor(),
              },
              root,
            ),
        ).toBe(true);

        expect(
          controls.children,
        ).toHaveLength(2);

        expect(
          controls.children[1]
            .classList
            .contains(
              "boa-druid-form-switch-button",
            ),
        ).toBe(true);

        expect(
          controls.children[1]
            .innerHTML,
        ).toContain(
          "Change Form",
        );
      },
    );

    test(
      "Change Form creates the shared row when its hook runs first",
      () => {
        const tabs =
          element(
            "sheet-tabs",
          );
        const inserted = [];

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
          querySelector(selector) {
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
                actor: actor(),
              },
              root,
            ),
        ).toBe(true);

        expect(
          inserted,
        ).toHaveLength(1);

        const controls =
          inserted[0].child;

        expect(
          controls.classList.contains(
            "boa-druid-form-artwork-controls",
          ),
        ).toBe(true);

        expect(
          controls.children[0]
            .classList
            .contains(
              "boa-druid-form-switch-button",
            ),
        ).toBe(true);
      },
    );
  },
);
