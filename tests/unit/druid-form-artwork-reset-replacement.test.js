import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
const SAVAGE = "spells.savage-incarnation";
let druidForms;

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

class MergingFlagActor {
  constructor() {
    this.type = "character";
    this.isOwner = true;
    this.flags = {};
    this.items = [
      new FakeItem(SAVAGE),
    ];
  }

  getFlag(moduleId, key) {
    return this.flags?.[moduleId]?.[key];
  }

  async setFlag(moduleId, key, value) {
    this.flags[moduleId] ??= {};
    const previous =
      this.flags[moduleId][key];

    this.flags[moduleId][key] =
      (
        previous &&
        typeof previous === "object" &&
        value &&
        typeof value === "object"
      )
        ? {
            ...structuredClone(previous),
            ...structuredClone(value),
          }
        : structuredClone(value);

    return value;
  }

  async unsetFlag(moduleId, key) {
    delete this.flags?.[moduleId]?.[key];
  }
}

beforeEach(async () => {
  vi.resetModules();

  globalThis.game = {
    user: null,
    settings: {
      get:
        vi.fn(() => true),
    },
    scenes: [],
  };

  druidForms =
    await import(
      "../../foundry/scripts/druid-forms.js"
    );
});

afterEach(() => {
  delete globalThis.game;
});

describe(
  "Druid artwork flag replacement",
  () => {
    test(
      "reset removes one profile despite Foundry-style nested merging",
      async () => {
        const actor =
          new MergingFlagActor();

        await druidForms.setDruidFormArtwork(
          actor,
          "travelPl1",
          {
            portrait:
              "worlds/test/one.webp",
            token:
              "worlds/test/one-token.webp",
          },
        );

        await druidForms.setDruidFormArtwork(
          actor,
          "travelPl2",
          {
            portrait:
              "worlds/test/two.webp",
            token:
              "worlds/test/two-token.webp",
          },
        );

        await druidForms.resetDruidFormArtwork(
          actor,
          "travelPl1",
        );

        const first =
          druidForms.getDruidFormArtwork(
            actor,
            "travelPl1",
          );
        const second =
          druidForms.getDruidFormArtwork(
            actor,
            "travelPl2",
          );

        expect(
          first.portraitIsCustom,
        ).toBe(false);
        expect(
          first.tokenIsCustom,
        ).toBe(false);
        expect(
          second.portrait,
        ).toBe(
          "worlds/test/two.webp",
        );
        expect(
          second.token,
        ).toBe(
          "worlds/test/two-token.webp",
        );
      },
    );
  },
);
