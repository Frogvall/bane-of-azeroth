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
  constructor() {
    this.flags = {
      [MODULE_ID]: {
        contentKey:
          "spells.savage-incarnation",
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

function makeActor(
  {
    withSpell = true,
  } = {},
) {
  return {
    id: "actor-1",
    type: "character",
    isOwner: true,
    items:
      withSpell
        ? [new FakeItem()]
        : [],
    flags: {},
    getFlag() {
      return undefined;
    },
  };
}

function makeElement(
  tagName,
) {
  const listeners =
    new Map();

  return {
    tagName,
    type: "",
    innerHTML: "",
    parentElement: null,
    children: [],
    classList: {
      values:
        new Set(),
      add(
        ...names
      ) {
        for (
          const name
          of names
        ) {
          this.values.add(
            name,
          );
        }
      },
      contains(
        name,
      ) {
        return this.values.has(
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
      child.parentElement =
        this;
    },
    remove:
      vi.fn(),
    addEventListener(
      type,
      callback,
    ) {
      listeners.set(
        type,
        callback,
      );
    },
    async click() {
      const callback =
        listeners.get(
          "click",
        );

      expect(
        callback,
      ).toBeTypeOf(
        "function",
      );

      callback({
        preventDefault:
          vi.fn(),
        stopPropagation:
          vi.fn(),
      });

      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

function makeSheetRoot() {
  const tabs =
    makeElement(
      "nav",
    );

  const parent = {
    insertBefore:
      vi.fn(
        (
          node,
          reference,
        ) => {
          node.parentElement =
            parent;
        },
      ),
  };

  tabs.parentElement =
    parent;

  let controls =
    null;

  return {
    tabs,
    parent,
    setControls(
      value,
    ) {
      controls =
        value;
    },
    querySelector(
      selector,
    ) {
      if (
        selector ===
          ".boa-druid-form-artwork-controls"
      ) {
        return controls;
      }

      if (
        selector.includes(
          ".sheet-tabs",
        ) ||
        selector.includes(
          "nav.tabs",
        )
      ) {
        return tabs;
      }

      return null;
    },
  };
}

beforeEach(
  async () => {
    vi.resetModules();

    globalThis.game = {
      user: {
        id: "player-1",
        isGM: false,
      },
      settings: {
        get:
          vi.fn(
            (
              _moduleId,
              key,
            ) => {
              if (
                key ===
                  "druidFormsAutomation" ||
                key ===
                  "druidFormArtworkAutomation"
              ) {
                return false;
              }

              return true;
            },
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
    delete globalThis.document;
    delete globalThis.HTMLElement;
  },
);

describe(
  "Druid form artwork sheet UI repair",
  () => {
    test(
      "places a clickable control row immediately before the primary tabs even when both automations are disabled",
      async () => {
        const actor =
          makeActor();
        const root =
          makeSheetRoot();

        globalThis.document = {
          createElement:
            vi.fn(
              tagName => {
                const element =
                  makeElement(
                    tagName,
                  );

                if (
                  tagName ===
                    "div"
                ) {
                  const originalAdd =
                    element.classList.add
                      .bind(
                        element.classList,
                      );

                  element.classList.add =
                    (
                      ...names
                    ) => {
                      originalAdd(
                        ...names,
                      );

                      if (
                        names.includes(
                          "boa-druid-form-artwork-controls",
                        )
                      ) {
                        root.setControls(
                          element,
                        );
                      }
                    };
                }

                return element;
              },
            ),
        };

        expect(
          druidForms
            .onRenderDruidFormArtworkActorSheet(
              {
                actor,
              },
              root,
            ),
        ).toBe(
          true,
        );

        expect(
          root.parent.insertBefore,
        ).toHaveBeenCalledTimes(
          1,
        );

        const [
          controls,
          reference,
        ] =
          root.parent.insertBefore
            .mock.calls[
              0
            ];

        expect(
          reference,
        ).toBe(
          root.tabs,
        );
        expect(
          controls.classList
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
          button.classList
            .contains(
              "boa-druid-form-artwork-button",
            ),
        ).toBe(
          true,
        );

        await button.click();

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

    test(
      "keeps artwork configuration available while artwork automation is disabled",
      async () => {
        const actor =
          makeActor();

        expect(
          await druidForms
            .openDruidFormArtworkDialog(
              actor,
            ),
        ).toBe(
          false,
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

    test(
      "does not add controls when the Actor owns no incarnation spell",
      () => {
        const actor =
          makeActor({
            withSpell:
              false,
          });
        const root =
          makeSheetRoot();

        globalThis.document = {
          createElement:
            vi.fn(
              makeElement,
            ),
        };

        expect(
          druidForms
            .onRenderDruidFormArtworkActorSheet(
              {
                actor,
              },
              root,
            ),
        ).toBe(
          false,
        );

        expect(
          root.parent.insertBefore,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
