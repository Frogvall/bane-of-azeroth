import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  DEATH_KNIGHT_REBIRTH_CONTENT_KEY,
  DEATH_KNIGHT_RUNE_EFFECT_FLAG,
  buildUnendingThirstEffectData,
  clearDeathKnightRune,
  getDeathKnightRuneDefinitions,
  getDeathKnightRuneEligibleWeapons,
  getDeathKnightRuneState,
  hasDeathKnightsRebirth,
  isDeathKnightRuneEligibleWeapon,
  reconcileDeathKnightRuneActor,
  setDeathKnightRune,
} from "../../foundry/scripts/death-knight-runes.js";

const MODULE_ID =
  "bane-of-azeroth";

class FakeEffect {
  constructor(
    data,
    parent,
  ) {
    Object.assign(
      this,
      structuredClone(
        data,
      ),
    );
    this.parent =
      parent;
    this.id =
      `effect-${Math.random()}`;
  }

  getFlag(
    moduleId,
    key,
  ) {
    return this.flags?.[
      moduleId
    ]?.[key];
  }

  async delete() {
    const index =
      this.parent.effects
        .indexOf(
          this,
        );

    if (
      index >= 0
    ) {
      this.parent.effects.splice(
        index,
        1,
      );
    }
  }
}

class FakeItem {
  constructor({
    id,
    name,
    type,
    contentKey = null,
    range = 2,
    isRangedWeapon = undefined,
    features = [],
    worn = false,
  }) {
    this.id =
      id;
    this.name =
      name;
    this.type =
      type;
    this.flags = {};
    this.system = {
      range,
      features,
      worn,
    };
    this.effects = [];
    this.parent = null;
    this.uuid =
      `Actor.test.Item.${id}`;

    if (
      typeof isRangedWeapon ===
      "boolean"
    ) {
      this.isRangedWeapon =
        isRangedWeapon;
    }

    if (contentKey) {
      this.flags[
        MODULE_ID
      ] = {
        contentKey,
      };
    }
  }

  getFlag(
    moduleId,
    key,
  ) {
    return this.flags?.[
      moduleId
    ]?.[key];
  }

  async createEmbeddedDocuments(
    documentType,
    data,
  ) {
    expect(
      documentType,
    ).toBe(
      "ActiveEffect",
    );

    const effects =
      data.map(
        entry =>
          new FakeEffect(
            entry,
            this,
          ),
      );

    this.effects.push(
      ...effects,
    );

    return effects;
  }
}

class FakeActor {
  constructor(
    items = [],
  ) {
    this.id =
      "actor-test";
    this.type =
      "character";
    this.isOwner =
      true;
    this.flags = {};
    this.items =
      items;

    for (
      const item
      of items
    ) {
      item.parent =
        this;
    }
  }

  getFlag(
    moduleId,
    key,
  ) {
    return this.flags?.[
      moduleId
    ]?.[key];
  }

  async setFlag(
    moduleId,
    key,
    value,
  ) {
    this.flags[
      moduleId
    ] ??= {};

    this.flags[
      moduleId
    ][key] =
      structuredClone(
        value,
      );
  }

  async unsetFlag(
    moduleId,
    key,
  ) {
    if (
      this.flags[
        moduleId
      ]
    ) {
      delete this.flags[
        moduleId
      ][key];
    }
  }
}

function rebirth() {
  return new FakeItem({
    id:
      "rebirth",
    name:
      "Death Knight's Rebirth",
    type:
      "ability",
    contentKey:
      DEATH_KNIGHT_REBIRTH_CONTENT_KEY,
  });
}

function melee(
  id = "melee",
) {
  return new FakeItem({
    id,
    name:
      "Warglaive",
    type:
      "weapon",
    range:
      2,
    isRangedWeapon:
      false,
  });
}

function ranged() {
  return new FakeItem({
    id:
      "ranged",
    name:
      "Bow",
    type:
      "weapon",
    range:
      20,
    isRangedWeapon:
      true,
  });
}

function shield() {
  return new FakeItem({
    id:
      "shield",
    name:
      "Small Shield",
    type:
      "weapon",
    range:
      2,
    isRangedWeapon:
      false,
    features: [
      "bludgeoning",
      "shield",
    ],
  });
}

function unarmed() {
  return new FakeItem({
    id:
      "unarmed",
    name:
      "Unarmed",
    type:
      "weapon",
    range:
      2,
    isRangedWeapon:
      false,
    features: [
      "bludgeoning",
      "unarmed",
    ],
  });
}

function managedEffects(
  actor,
) {
  return actor.items
    .flatMap(
      item =>
        item.effects,
    )
    .filter(
      effect =>
        Boolean(
          effect.getFlag(
            MODULE_ID,
            DEATH_KNIGHT_RUNE_EFFECT_FLAG,
          ),
        ),
    );
}

beforeEach(() => {
  globalThis.CONST = {
    ACTIVE_EFFECT_MODES: {
      ADD:
        2,
    },
  };

  globalThis.game = {
    user: {
      id:
        "player",
      isGM:
        false,
    },
    settings: {
      get: vi.fn(
        () =>
          true,
      ),
    },
  };
});

afterEach(() => {
  delete globalThis.CONST;
  delete globalThis.game;
});

describe(
  "Death Knight runes",
  () => {
    test(
      "defines three visual runes and automates only Unending Thirst",
      () => {
        expect(
          getDeathKnightRuneDefinitions()
            .map(
              rune => ({
                key:
                  rune.key,
                automated:
                  rune.automated,
                icon:
                  rune.icon,
              }),
            ),
        ).toEqual([
          {
            key:
              "fallenCrusader",
            automated:
              false,
            icon:
              expect.stringContaining(
                "/runes/fallen_crusader.webp",
              ),
          },
          {
            key:
              "razorice",
            automated:
              false,
            icon:
              expect.stringContaining(
                "/runes/razorice.webp",
              ),
          },
          {
            key:
              "unendingThirst",
            automated:
              true,
            icon:
              expect.stringContaining(
                "/runes/unending_thirst.webp",
              ),
          },
        ]);
      },
    );

    test(
      "accepts melee weapons and rejects ranged weapons, shields, and Unarmed",
      () => {
        const sword =
          melee();
        const bow =
          ranged();
        const smallShield =
          shield();
        const fists =
          unarmed();

        const actor =
          new FakeActor([
            rebirth(),
            sword,
            bow,
            smallShield,
            fists,
          ]);

        expect(
          hasDeathKnightsRebirth(
            actor,
          ),
        ).toBe(
          true,
        );

        expect(
          isDeathKnightRuneEligibleWeapon(
            sword,
          ),
        ).toBe(
          true,
        );
        expect(
          isDeathKnightRuneEligibleWeapon(
            bow,
          ),
        ).toBe(
          false,
        );
        expect(
          isDeathKnightRuneEligibleWeapon(
            smallShield,
          ),
        ).toBe(
          false,
        );
        expect(
          isDeathKnightRuneEligibleWeapon(
            fists,
          ),
        ).toBe(
          false,
        );

        expect(
          getDeathKnightRuneEligibleWeapons(
            actor,
          ),
        ).toEqual([
          sword,
        ]);
      },
    );

    test(
      "refuses rune assignment to shields and Unarmed through the public API",
      async () => {
        const smallShield =
          shield();
        const fists =
          unarmed();

        const actor =
          new FakeActor([
            rebirth(),
            smallShield,
            fists,
          ]);

        expect(
          await setDeathKnightRune(
            actor,
            "fallenCrusader",
            smallShield.id,
          ),
        ).toBe(
          false,
        );

        expect(
          await setDeathKnightRune(
            actor,
            "razorice",
            fists.id,
          ),
        ).toBe(
          false,
        );

        expect(
          getDeathKnightRuneState(
            actor,
          ),
        ).toBeNull();
      },
    );

    test(
      "builds Unending Thirst with the Foundry V14 / Dragonbane 4.0.1 Active Effect schema",
      () => {
        const weapon =
          melee();

        const data =
          buildUnendingThirstEffectData(
            weapon,
          );

        expect(
          data,
        ).toMatchObject({
          name:
            "Unending Thirst",
          origin:
            weapon.uuid,
          system: {
            applyOnlyWhenEquipped:
              true,
            changes: [{
              key:
                "system.movement.value",
              type:
                "add",
              value:
                "2",
              phase:
                "final",
              priority:
                20,
            }],
          },
          flags: {
            [MODULE_ID]: {
              [
                DEATH_KNIGHT_RUNE_EFFECT_FLAG
              ]: {
                rune:
                  "unendingThirst",
                weaponId:
                  weapon.id,
              },
            },
          },
        });

        expect(
          data.changes,
        ).toBeUndefined();
      },
    );

    test(
      "stores one rune selection and moves Unending Thirst between weapons",
      async () => {
        const first =
          melee(
            "first",
          );
        const second =
          melee(
            "second",
          );

        const actor =
          new FakeActor([
            rebirth(),
            first,
            second,
          ]);

        expect(
          await setDeathKnightRune(
            actor,
            "unendingThirst",
            first.id,
          ),
        ).toBe(
          true,
        );

        expect(
          getDeathKnightRuneState(
            actor,
          ),
        ).toEqual({
          schemaVersion:
            1,
          rune:
            "unendingThirst",
          weaponId:
            first.id,
        });

        expect(
          managedEffects(
            actor,
          ),
        ).toHaveLength(
          1,
        );

        expect(
          first.effects,
        ).toHaveLength(
          1,
        );

        expect(
          await setDeathKnightRune(
            actor,
            "unendingThirst",
            second.id,
          ),
        ).toBe(
          true,
        );

        expect(
          getDeathKnightRuneState(
            actor,
          )?.weaponId,
        ).toBe(
          second.id,
        );

        expect(
          first.effects,
        ).toHaveLength(
          0,
        );

        expect(
          second.effects,
        ).toHaveLength(
          1,
        );

        expect(
          managedEffects(
            actor,
          ),
        ).toHaveLength(
          1,
        );
      },
    );

    test(
      "keeps Fallen Crusader and Razorice visual-only and removes managed movement effects",
      async () => {
        const weapon =
          melee();

        const actor =
          new FakeActor([
            rebirth(),
            weapon,
          ]);

        await setDeathKnightRune(
          actor,
          "unendingThirst",
          weapon.id,
        );

        expect(
          managedEffects(
            actor,
          ),
        ).toHaveLength(
          1,
        );

        await setDeathKnightRune(
          actor,
          "razorice",
          weapon.id,
        );

        expect(
          getDeathKnightRuneState(
            actor,
          )?.rune,
        ).toBe(
          "razorice",
        );

        expect(
          managedEffects(
            actor,
          ),
        ).toHaveLength(
          0,
        );

        await setDeathKnightRune(
          actor,
          "fallenCrusader",
          weapon.id,
        );

        expect(
          getDeathKnightRuneState(
            actor,
          )?.rune,
        ).toBe(
          "fallenCrusader",
        );

        expect(
          managedEffects(
            actor,
          ),
        ).toHaveLength(
          0,
        );
      },
    );

    test(
      "disabling automation preserves the selected rune but removes the managed effect",
      async () => {
        const weapon =
          melee();

        const actor =
          new FakeActor([
            rebirth(),
            weapon,
          ]);

        await setDeathKnightRune(
          actor,
          "unendingThirst",
          weapon.id,
        );

        expect(
          managedEffects(
            actor,
          ),
        ).toHaveLength(
          1,
        );

        globalThis.game
          .settings
          .get
          .mockReturnValue(
            false,
          );

        await reconcileDeathKnightRuneActor(
          actor,
        );

        expect(
          getDeathKnightRuneState(
            actor,
          )?.rune,
        ).toBe(
          "unendingThirst",
        );

        expect(
          managedEffects(
            actor,
          ),
        ).toHaveLength(
          0,
        );

        globalThis.game
          .settings
          .get
          .mockReturnValue(
            true,
          );

        await reconcileDeathKnightRuneActor(
          actor,
        );

        expect(
          managedEffects(
            actor,
          ),
        ).toHaveLength(
          1,
        );
      },
    );

    test(
      "clear removes only the managed rune state and effect",
      async () => {
        const weapon =
          melee();

        const manual =
          new FakeEffect({
            name:
              "Unending Thirst",
            flags: {},
          }, weapon);

        weapon.effects.push(
          manual,
        );

        const actor =
          new FakeActor([
            rebirth(),
            weapon,
          ]);

        await setDeathKnightRune(
          actor,
          "unendingThirst",
          weapon.id,
        );

        expect(
          weapon.effects,
        ).toHaveLength(
          2,
        );

        await clearDeathKnightRune(
          actor,
        );

        expect(
          getDeathKnightRuneState(
            actor,
          ),
        ).toBeNull();

        expect(
          managedEffects(
            actor,
          ),
        ).toHaveLength(
          0,
        );

        expect(
          weapon.effects,
        ).toEqual([
          manual,
        ]);
      },
    );

    test(
      "removing Death Knight's Rebirth clears stale state and managed effect",
      async () => {
        const ability =
          rebirth();
        const weapon =
          melee();

        const actor =
          new FakeActor([
            ability,
            weapon,
          ]);

        await setDeathKnightRune(
          actor,
          "unendingThirst",
          weapon.id,
        );

        actor.items =
          actor.items.filter(
            item =>
              item !==
              ability,
          );

        await reconcileDeathKnightRuneActor(
          actor,
        );

        expect(
          getDeathKnightRuneState(
            actor,
          ),
        ).toBeNull();

        expect(
          managedEffects(
            actor,
          ),
        ).toHaveLength(
          0,
        );
      },
    );
  },
);
