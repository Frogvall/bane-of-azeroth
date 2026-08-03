import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  makeActor,
  makeFlagDocument,
} from "../helpers/documents.js";

const MODULE_ID = "bane-of-azeroth";
const MAGE_CONTENT_KEY =
  "heroic-class-ability.mage.mages-brilliance";
const SENSE_MAGIC_UUID =
  "Item.RPnxXYVb8z7EG5Wl";

async function loadSubject() {
  return import(
    "../../foundry/scripts/mage-brilliance.js"
  );
}

function makeMageAbility(actor) {
  return makeFlagDocument({
    id: "mages-brilliance",
    name: "Mage's Brilliance",
    type: "ability",
    parent: actor,
    flags: {
      [MODULE_ID]: {
        contentKey: MAGE_CONTENT_KEY,
      },
    },
  });
}

function makeSpell({
  actor,
  name = "Sense Magic",
  rank = 0,
  sourceUuid = SENSE_MAGIC_UUID,
  coreSourceId,
} = {}) {
  return makeFlagDocument({
    id: "spell",
    name,
    type: "spell",
    parent: actor,
    system: {
      rank,
    },
    flags: {
      [MODULE_ID]: sourceUuid
        ? {
            sourceUuid,
          }
        : {},
      core: coreSourceId
        ? {
            sourceId: coreSourceId,
          }
        : {},
    },
  });
}

function setAutomation(enabled) {
  globalThis.game.settings.get =
    vi.fn((_moduleId, key) => (
      key === "mageBrillianceAutomation"
        ? enabled
        : true
    ));
}

describe("Mage's Brilliance spell cost automation", () => {
  beforeEach(() => {
    setAutomation(true);
  });

  afterEach(() => {
    delete globalThis.CONFIG.Item;
  });

  test("makes managed Sense Magic free while the ability is present", async () => {
    const {
      getMagesBrillianceSpellCost,
    } = await loadSubject();

    const actor = makeActor();
    actor.items = [
      makeMageAbility(actor),
    ];
    const spell = makeSpell({ actor });
    actor.items.push(spell);

    const original = vi.fn(() => 1);

    expect(
      getMagesBrillianceSpellCost(
        spell,
        0,
        original,
      ),
    ).toBe(0);
    expect(original).not.toHaveBeenCalled();
  });

  test("also applies to a manual Sense Magic without changing ownership", async () => {
    const {
      getMagesBrillianceSpellCost,
    } = await loadSubject();

    const actor = makeActor();
    actor.items = [
      makeMageAbility(actor),
    ];
    const spell = makeSpell({
      actor,
      sourceUuid: null,
    });
    actor.items.push(spell);

    const original = vi.fn(() => 1);

    expect(
      getMagesBrillianceSpellCost(
        spell,
        0,
        original,
      ),
    ).toBe(0);
    expect(original).not.toHaveBeenCalled();
  });

  test("delegates to Dragonbane when automation is disabled", async () => {
    const {
      getMagesBrillianceSpellCost,
    } = await loadSubject();

    setAutomation(false);

    const actor = makeActor();
    actor.items = [
      makeMageAbility(actor),
    ];
    const spell = makeSpell({ actor });
    actor.items.push(spell);

    const original = vi.fn(() => 1);

    expect(
      getMagesBrillianceSpellCost(
        spell,
        0,
        original,
      ),
    ).toBe(1);
    expect(original).toHaveBeenCalledWith(0);
  });

  test("delegates when the Actor does not have Mage's Brilliance", async () => {
    const {
      getMagesBrillianceSpellCost,
    } = await loadSubject();

    const actor = makeActor();
    const spell = makeSpell({ actor });
    actor.items = [spell];

    const original = vi.fn(() => 1);

    expect(
      getMagesBrillianceSpellCost(
        spell,
        0,
        original,
      ),
    ).toBe(1);
    expect(original).toHaveBeenCalledWith(0);
  });

  test("delegates for unrelated spells", async () => {
    const {
      getMagesBrillianceSpellCost,
    } = await loadSubject();

    const actor = makeActor();
    actor.items = [
      makeMageAbility(actor),
    ];
    const spell = makeSpell({
      actor,
      name: "Other Trick",
      sourceUuid: null,
    });
    actor.items.push(spell);

    const original = vi.fn(() => 1);

    expect(
      getMagesBrillianceSpellCost(
        spell,
        0,
        original,
      ),
    ).toBe(1);
    expect(original).toHaveBeenCalledWith(0);
  });

  test("patches Dragonbane getSpellCost once and preserves native behavior", async () => {
    const {
      patchMageBrillianceSpellCost,
    } = await loadSubject();

    class FakeDragonbaneItem {
      getSpellCost(powerLevel) {
        return this.system.rank === 0
          ? 1
          : powerLevel * 2;
      }
    }

    globalThis.CONFIG.Item = {
      documentClass: FakeDragonbaneItem,
    };

    const actor = makeActor();
    actor.items = [
      makeMageAbility(actor),
    ];

    const senseMagic =
      new FakeDragonbaneItem();
    Object.assign(
      senseMagic,
      makeSpell({ actor }),
    );
    actor.items.push(senseMagic);

    const unrelated =
      new FakeDragonbaneItem();
    Object.assign(
      unrelated,
      makeSpell({
        actor,
        name: "Other Spell",
        rank: 2,
        sourceUuid: null,
      }),
    );
    actor.items.push(unrelated);

    expect(
      patchMageBrillianceSpellCost(),
    ).toBe(true);

    const firstWrapper =
      FakeDragonbaneItem.prototype.getSpellCost;

    expect(senseMagic.getSpellCost(0)).toBe(0);
    expect(unrelated.getSpellCost(3)).toBe(6);

    expect(
      patchMageBrillianceSpellCost(),
    ).toBe(true);
    expect(
      FakeDragonbaneItem.prototype.getSpellCost,
    ).toBe(firstWrapper);
  });
});
