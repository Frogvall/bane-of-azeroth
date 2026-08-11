import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  actorHasSpell,
  grantSpellForAbility,
  loadSpellGrantDefinitions,
  reconcileSpellGrantsForActor,
  removeSpellForAbility,
  resolveGrantedSpellContentKey,
  resolveGrantedSpellUuid,
} from "../../foundry/scripts/spell-grants.js";

import {
  makeAbility,
  makeActor,
  makeFlagDocument,
  makeSpell,
} from "../helpers/documents.js";

const MAGES_BRILLIANCE_CONTENT_KEY =
  "heroic-class-ability.mage.mages-brilliance";
const SENSE_MAGIC_UUID = "Item.RPnxXYVb8z7EG5Wl";

function makeMageBrilliance(actor) {
  return makeFlagDocument({
    id: "mages-brilliance",
    name: "Mage's Brilliance",
    type: "ability",
    parent: actor,
    flags: {
      "bane-of-azeroth": {
        contentKey: MAGES_BRILLIANCE_CONTENT_KEY,
        grantsSpellUuid: SENSE_MAGIC_UUID,
      },
    },
  });
}

function makeSenseMagicSource() {
  return makeFlagDocument({
    id: "sense-magic-source",
    name: "Sense Magic",
    type: "spell",
    system: {
      memorized: false,
    },
    flags: {},
    toObject: vi.fn(() => ({
      _id: "sense-magic-source",
      folder: "dragonbane-core",
      ownership: {
        default: 0,
      },
      name: "Sense Magic",
      type: "spell",
      system: {
        memorized: false,
      },
      flags: {},
    })),
  });
}

function makeManagedSenseMagic({
  id = "managed-sense-magic",
} = {}) {
  return makeFlagDocument({
    id,
    name: "Sense Magic",
    type: "spell",
    flags: {
      "bane-of-azeroth": {
        autoGranted: true,
        grantedByAbility:
          MAGES_BRILLIANCE_CONTENT_KEY,
        sourceUuid: SENSE_MAGIC_UUID,
      },
    },
  });
}

function makeAutoGrantedSpell({
  id = "granted-spell",
  sourceSpell = "spells.shadowform",
  memorized = true,
} = {}) {
  return makeFlagDocument({
    id,
    name: "Granted Spell",
    type: "spell",
    system: {
      memorized,
    },
    flags: {
      "bane-of-azeroth": {
        autoGranted: true,
        sourceSpell,
      },
    },
  });
}

describe("spell grant definitions", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  test("prefers a direct grantsSpell flag", () => {
    const ability = makeAbility({
      grantsSpell: "spells.elemental-totem",
    });

    expect(resolveGrantedSpellContentKey(ability)).toBe(
      "spells.elemental-totem"
    );
  });

  test("loads a fallback relation from structured content", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        classes: [
          {
            key: "priest",
            abilities: [
              {
                key: "darkness",
                grantsSpell: "shadowform",
              },
            ],
          },
        ],
      }),
    });

    await loadSpellGrantDefinitions();

    const ability = makeAbility({
      contentKey: "heroic-class-ability.priest.darkness",
      grantsSpell: "",
    });

    expect(resolveGrantedSpellContentKey(ability)).toBe(
      "spells.shadowform"
    );
  });

  test(
    "loads a symbolic external spell grant fallback from structured content",
    async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          classes: [
            {
              key: "mage",
              abilities: [
                {
                  key: "mages-brilliance",
                  grantsExternalSpell:
                    "dragonbane-core:spell.sense-magic",
                },
              ],
            },
          ],
        }),
      });

      await loadSpellGrantDefinitions();
      const ability = makeFlagDocument({
        id: "mages-brilliance-symbolic-fallback",
        name: "Mage's Brilliance",
        type: "ability",
        flags: {
          "bane-of-azeroth": {
            contentKey:
              MAGES_BRILLIANCE_CONTENT_KEY,
          },
        },
      });

      expect(resolveGrantedSpellUuid(ability)).toBe(
        SENSE_MAGIC_UUID,
      );
    },
  );

  test("rejects a failed definition request", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
    });

    await expect(loadSpellGrantDefinitions()).rejects.toThrow(
      /500 Server Error/
    );
  });

  test("rejects content without a classes array", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await expect(loadSpellGrantDefinitions()).rejects.toThrow(
      /classes array/i
    );
  });
});

describe("Actor spell detection", () => {
  test("recognizes a manual spell by content key", () => {
    const actor = makeActor({
      items: [
        makeSpell({
          contentKey: "spells.shadowform",
        }),
      ],
    });

    expect(actorHasSpell(actor, "spells.shadowform")).toBe(true);
  });

  test("recognizes an automatically granted spell by source flag", () => {
    const actor = makeActor({
      items: [
        makeAutoGrantedSpell(),
      ],
    });

    expect(actorHasSpell(actor, "spells.shadowform")).toBe(true);
  });

  test("ignores unrelated Items", () => {
    const actor = makeActor({
      items: [
        makeSpell({
          contentKey: "spells.elemental-totem",
        }),
      ],
    });

    expect(actorHasSpell(actor, "spells.shadowform")).toBe(false);
  });
});

describe("grantSpellForAbility", () => {
  beforeEach(() => {
    game.items = [];
    globalThis.fromUuid = vi.fn();
  });

  afterEach(() => {
    delete globalThis.fromUuid;
  });

  test("creates one prepared, traceable spell", async () => {
    const actor = makeActor();
    const ability = makeAbility({ actor });
    actor.items = [ability];

    const sourceSpell = makeSpell({
      id: "world-spell",
      contentKey: "spells.shadowform",
    });
    game.items = [sourceSpell];

    await grantSpellForAbility(ability);

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledOnce();
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith(
      "Item",
      [
        expect.objectContaining({
          name: "Spell",
          type: "spell",
          system: expect.objectContaining({
            memorized: true,
          }),
          flags: expect.objectContaining({
            "bane-of-azeroth": expect.objectContaining({
              autoGranted: true,
              grantedByAbility:
                "heroic-class-ability.priest.darkness",
              sourceSpell: "spells.shadowform",
            }),
          }),
        }),
      ]
    );

    const created = actor.createEmbeddedDocuments.mock.calls[0][1][0];
    expect(created).not.toHaveProperty("_id");
    expect(created).not.toHaveProperty("folder");
    expect(created).not.toHaveProperty("ownership");
  });

  test("does not duplicate a manually added spell", async () => {
    const actor = makeActor();
    const ability = makeAbility({ actor });
    actor.items = [
      ability,
      makeSpell({
        contentKey: "spells.shadowform",
      }),
    ];
    game.items = [makeSpell()];

    await grantSpellForAbility(ability);

    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("does not duplicate an automatically granted spell", async () => {
    const actor = makeActor();
    const ability = makeAbility({ actor });
    actor.items = [
      ability,
      makeAutoGrantedSpell(),
    ];
    game.items = [makeSpell()];

    await grantSpellForAbility(ability);

    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("warns and does not create when the world spell is missing", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const actor = makeActor({ name: "Test Actor" });
    const ability = makeAbility({ actor });
    actor.items = [ability];

    await grantSpellForAbility(ability);

    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith(
      expect.stringMatching(/source spell was not found/i)
    );
  });

  test("ignores non-Actor parents and non-ability Items", async () => {
    const actor = makeActor();
    const wrongParent = makeAbility({ actor: { documentName: "Item" } });
    const wrongType = makeAbility({ actor });
    wrongType.type = "spell";

    await grantSpellForAbility(wrongParent);
    await grantSpellForAbility(wrongType);

    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("grants an external spell by UUID with provenance", async () => {
    const actor = makeActor();
    const ability = makeMageBrilliance(actor);
    const sourceSpell = makeSenseMagicSource();
    actor.items = [ability];
    globalThis.fromUuid.mockResolvedValue(sourceSpell);

    await grantSpellForAbility(ability);

    expect(globalThis.fromUuid).toHaveBeenCalledWith(
      SENSE_MAGIC_UUID,
    );
    expect(
      actor.createEmbeddedDocuments,
    ).toHaveBeenCalledOnce();
    expect(
      actor.createEmbeddedDocuments,
    ).toHaveBeenCalledWith(
      "Item",
      [
        expect.objectContaining({
          name: "Sense Magic",
          type: "spell",
          flags: expect.objectContaining({
            "bane-of-azeroth":
              expect.objectContaining({
                autoGranted: true,
                grantedByAbility:
                  MAGES_BRILLIANCE_CONTENT_KEY,
                sourceUuid: SENSE_MAGIC_UUID,
              }),
          }),
        }),
      ],
    );
  });

  test("does not duplicate a manually added external spell", async () => {
    const actor = makeActor();
    const ability = makeMageBrilliance(actor);
    const sourceSpell = makeSenseMagicSource();
    const manualSenseMagic = makeFlagDocument({
      id: "manual-sense-magic",
      name: "Sense Magic",
      type: "spell",
      flags: {},
    });
    actor.items = [
      ability,
      manualSenseMagic,
    ];
    globalThis.fromUuid.mockResolvedValue(sourceSpell);

    await grantSpellForAbility(ability);

    expect(globalThis.fromUuid).toHaveBeenCalledWith(
      SENSE_MAGIC_UUID,
    );
    expect(
      actor.createEmbeddedDocuments,
    ).not.toHaveBeenCalled();
  });
});

describe("removeSpellForAbility", () => {
  test("removes the automatically granted spell after the final ability", async () => {
    const actor = makeActor();
    const removedAbility = makeAbility({ actor });
    actor.items = [
      makeAutoGrantedSpell({ id: "spell-to-delete" }),
    ];

    await removeSpellForAbility(removedAbility);

    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith(
      "Item",
      ["spell-to-delete"]
    );
  });

  test("keeps the spell while another ability grants it", async () => {
    const actor = makeActor();
    const removedAbility = makeAbility({ actor, id: "removed" });
    const remainingAbility = makeAbility({ actor, id: "remaining" });
    actor.items = [
      remainingAbility,
      makeAutoGrantedSpell(),
    ];

    await removeSpellForAbility(removedAbility);

    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("never removes a manually added spell", async () => {
    const actor = makeActor();
    const removedAbility = makeAbility({ actor });
    actor.items = [
      makeSpell({
        id: "manual-spell",
        contentKey: "spells.shadowform",
      }),
    ];

    await removeSpellForAbility(removedAbility);

    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  test("removes only the managed external spell for Mage's Brilliance", async () => {
    const actor = makeActor();
    const removedAbility =
      makeMageBrilliance(actor);
    actor.items = [
      makeManagedSenseMagic({
        id: "managed-sense-magic",
      }),
      makeFlagDocument({
        id: "manual-sense-magic",
        name: "Sense Magic",
        type: "spell",
        flags: {},
      }),
    ];

    await removeSpellForAbility(
      removedAbility,
    );

    expect(
      actor.deleteEmbeddedDocuments,
    ).toHaveBeenCalledWith(
      "Item",
      ["managed-sense-magic"],
    );
  });
});

describe("reconcileSpellGrantsForActor", () => {
  test("restores prepared state without duplicating the spell", async () => {
    const actor = makeActor();
    const ability = makeAbility({ actor });
    const grantedSpell = makeAutoGrantedSpell({
      memorized: false,
    });
    actor.items = [ability, grantedSpell];

    await reconcileSpellGrantsForActor(actor);

    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledWith(
      "Item",
      [
        {
          _id: "granted-spell",
          "system.memorized": true,
        },
      ]
    );
  });
});
