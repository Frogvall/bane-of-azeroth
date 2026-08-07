import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
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

function makeFlagDocument() {
  return {
    flags: {},
    getFlag(moduleId, key) {
      return this.flags?.[moduleId]?.[key];
    },
    async setFlag(moduleId, key, value) {
      this.flags[moduleId] ??= {};
      this.flags[moduleId][key] =
        structuredClone(value);
      return value;
    },
    async unsetFlag(moduleId, key) {
      delete this.flags?.[moduleId]?.[key];
    },
  };
}

function makeActor() {
  return {
    ...makeFlagDocument(),
    id: "druid-actor",
    type: "character",
    isOwner: true,
    img: "worlds/test/humanoid.webp",
    prototypeToken: {
      texture: {
        src:
          "worlds/test/humanoid-token.webp",
      },
    },
    items: [
      new FakeItem(
        "spells.savage-incarnation",
      ),
    ],
    async update(changes) {
      if (
        Object.hasOwn(
          changes,
          "img",
        )
      ) {
        this.img =
          changes.img;
      }

      if (
        Object.hasOwn(
          changes,
          "prototypeToken.texture.src",
        )
      ) {
        this.prototypeToken.texture.src =
          changes[
            "prototypeToken.texture.src"
          ];
      }
    },
  };
}

function makeToken(actor) {
  return {
    ...makeFlagDocument(),
    id: "token-1",
    actorId: actor.id,
    actor,
    parent: {
      id: "scene-1",
    },
    texture: {
      src:
        "worlds/test/placed-humanoid-token.webp",
    },
    async update(changes) {
      if (
        Object.hasOwn(
          changes,
          "texture.src",
        )
      ) {
        this.texture.src =
          changes[
            "texture.src"
          ];
      }
    },
  };
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
  "Druid placed-token local artwork baseline",
  () => {
    test(
      "apply then restore returns a placed token to its own humanoid artwork",
      async () => {
        const actor =
          makeActor();
        const token =
          makeToken(actor);
        const scene = {
          id: "scene-1",
          tokens: [
            token,
          ],
        };

        globalThis.game.scenes = [
          scene,
        ];

        await druidForms
          .setDruidFormArtwork(
            actor,
            "travelPl1",
            {
              portrait:
                "worlds/test/travel.webp",
              token:
                "worlds/test/travel-token.webp",
            },
          );

        await druidForms
          .applyDruidFormArtwork(
            actor,
            "travelPl1",
            {
              bypassAuthority:
                true,
              bypassSetting:
                true,
              scenes: [
                scene,
              ],
            },
          );

        expect(
          token.texture.src,
        ).toBe(
          "worlds/test/travel-token.webp",
        );

        expect(
          token.getFlag(
            MODULE_ID,
            "druidFormTokenArtworkBaseline",
          ),
        ).toEqual({
          original:
            "worlds/test/placed-humanoid-token.webp",
          applied:
            "worlds/test/travel-token.webp",
        });

        await druidForms
          .restoreDruidHumanoidArtwork(
            actor,
            {
              bypassAuthority:
                true,
              scenes: [
                scene,
              ],
            },
          );

        expect(
          token.texture.src,
        ).toBe(
          "worlds/test/placed-humanoid-token.webp",
        );

        expect(
          token.getFlag(
            MODULE_ID,
            "druidFormTokenArtworkBaseline",
          ),
        ).toBeUndefined();
      },
    );
  },
);
