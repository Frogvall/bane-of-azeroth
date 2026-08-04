import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  EVOKERS_LEGACY_CONTENT_KEY,
  actorHasEvokersLegacy,
  getEvokersLegacySpellCost,
  patchEvokersLegacySpellCost,
} from "../../foundry/scripts/evokers-legacy.js";

const MODULE_ID =
  "bane-of-azeroth";

afterEach(() => {
  delete globalThis.game;
});

function makeAbility() {
  return {
    type: "ability",
    getFlag(moduleId, key) {
      if (
        moduleId === MODULE_ID &&
        key === "contentKey"
      ) {
        return EVOKERS_LEGACY_CONTENT_KEY;
      }

      return undefined;
    },
  };
}

function makeActor({
  hasLegacy = true,
} = {}) {
  const actor = {
    documentName: "Actor",
    items: [],
  };

  if (hasLegacy) {
    actor.items.push(
      makeAbility()
    );
  }

  return actor;
}

function makeSpell(
  actor,
  {
    rank = 1,
  } = {},
) {
  return {
    type: "spell",
    parent: actor,
    system: {
      rank,
    },
  };
}

function settings(enabled) {
  return {
    get: vi.fn(
      (_moduleId, key) => (
        key === "evokersLegacyAutomation"
          ? enabled
          : true
      ),
    ),
  };
}

describe(
  "Evoker's Legacy spell-cost automation",
  () => {
    test("detects the stable Evoker's Legacy content key", () => {
      expect(
        actorHasEvokersLegacy(
          makeActor(),
        ),
      ).toBe(true);

      expect(
        actorHasEvokersLegacy(
          makeActor({
            hasLegacy: false,
          }),
        ),
      ).toBe(false);
    });

    test("returns 2/3/4 WP for power levels 1/2/3", () => {
      const actor = makeActor();
      const spell =
        makeSpell(actor);
      const native =
        vi.fn(
          powerLevel =>
            powerLevel * 2
        );

      expect(
        [1, 2, 3].map(
          powerLevel =>
            getEvokersLegacySpellCost(
              spell,
              powerLevel,
              native,
              settings(true),
            ),
        ),
      ).toEqual([2, 3, 4]);

      expect(native)
        .not
        .toHaveBeenCalled();
    });

    test("preserves native cost when automation is disabled", () => {
      const actor = makeActor();
      const spell =
        makeSpell(actor);
      const native =
        vi.fn(
          powerLevel =>
            powerLevel * 2
        );

      expect(
        getEvokersLegacySpellCost(
          spell,
          2,
          native,
          settings(false),
        ),
      ).toBe(4);

      expect(native)
        .toHaveBeenCalledWith(2);
    });

    test("preserves native cost without Evoker's Legacy", () => {
      const actor = makeActor({
        hasLegacy: false,
      });
      const spell =
        makeSpell(actor);
      const native =
        vi.fn(() => 6);

      expect(
        getEvokersLegacySpellCost(
          spell,
          3,
          native,
          settings(true),
        ),
      ).toBe(6);
    });

    test("does not alter magic tricks or unsupported power levels", () => {
      const actor = makeActor();
      const trick =
        makeSpell(
          actor,
          {
            rank: 0,
          },
        );
      const spell =
        makeSpell(actor);
      const native =
        vi.fn(() => 99);

      expect(
        getEvokersLegacySpellCost(
          trick,
          0,
          native,
          settings(true),
        ),
      ).toBe(99);

      expect(
        getEvokersLegacySpellCost(
          spell,
          4,
          native,
          settings(true),
        ),
      ).toBe(99);
    });

    test("patches Dragonbane getSpellCost once and preserves native fallback", () => {
      class FakeDragonbaneItem {
        getSpellCost(
          powerLevel,
        ) {
          if (
            Number(this.system?.rank) === 0
          ) {
            return 1;
          }

          return powerLevel * 2;
        }
      }

      const actor =
        makeActor();

      const spell =
        new FakeDragonbaneItem();

      spell.type = "spell";
      spell.parent = actor;
      spell.system = {
        rank: 1,
      };
      actor.items.push(spell);

      globalThis.game = {
        settings: settings(true),
      };

      expect(
        patchEvokersLegacySpellCost({
          ItemClass:
            FakeDragonbaneItem,
        }),
      ).toBe(true);

      const firstWrapper =
        FakeDragonbaneItem
          .prototype
          .getSpellCost;

      expect(
        spell.getSpellCost(1),
      ).toBe(2);
      expect(
        spell.getSpellCost(2),
      ).toBe(3);
      expect(
        spell.getSpellCost(3),
      ).toBe(4);

      expect(
        patchEvokersLegacySpellCost({
          ItemClass:
            FakeDragonbaneItem,
        }),
      ).toBe(true);

      expect(
        FakeDragonbaneItem
          .prototype
          .getSpellCost,
      ).toBe(firstWrapper);

      globalThis.game.settings =
        settings(false);

      expect(
        spell.getSpellCost(3),
      ).toBe(6);
    });
  },
);
