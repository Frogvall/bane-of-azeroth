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
let mechanics;

function skill(
  name,
  value,
  skillType =
    "core",
) {
  return {
    type:
      "skill",
    name,
    system: {
      value,
      skillType,
    },
  };
}

function document(
  data,
  id,
) {
  return {
    ...structuredClone(data),
    id,
    getFlag(
      moduleId,
      key,
    ) {
      return this.flags?.[
        moduleId
      ]?.[
        key
      ];
    },
  };
}

function settings({
  movement =
    true,
  attacks =
    true,
} = {}) {
  return {
    get:
      vi.fn(
        (
          _moduleId,
          key,
        ) => {
          if (
            key ===
              "druidFormMovementAutomation"
          ) {
            return movement;
          }
          if (
            key ===
              "druidFormAttackAutomation"
          ) {
            return attacks;
          }
          return true;
        },
      ),
  };
}

function actor({
  state,
  items = [],
  effects = [],
} = {}) {
  let nextId = 1;
  const value = {
    id:
      "actor-1",
    uuid:
      "Actor.actor-1",
    type:
      "character",
    flags: {
      [MODULE_ID]: {
        druidFormState:
          structuredClone(
            state ?? {
              currentForm:
                "humanoid",
              activations: {},
            },
          ),
      },
    },
    items:
      [...items],
    effects:
      [...effects],
    getFlag(
      moduleId,
      key,
    ) {
      return this.flags?.[
        moduleId
      ]?.[
        key
      ];
    },
    async createEmbeddedDocuments(
      type,
      source,
    ) {
      const target =
        type === "Item"
          ? this.items
          : this.effects;
      return source.map(
        data => {
          const created =
            document(
              data,
              `created-${nextId++}`,
            );
          target.push(created);
          return created;
        },
      );
    },
    async deleteEmbeddedDocuments(
      type,
      ids,
    ) {
      const target =
        type === "Item"
          ? this.items
          : this.effects;

      for (
        let index =
          target.length - 1;
        index >= 0;
        index -= 1
      ) {
        if (
          ids.includes(
            target[index].id,
          )
        ) {
          target.splice(
            index,
            1,
          );
        }
      }

      return ids;
    },
  };

  value.items.get =
    id =>
      value.items.find(
        item =>
          item.id === id,
      );

  return value;
}

beforeEach(
  async () => {
    vi.resetModules();

    globalThis.game = {
      user:
        null,
      users:
        [],
      actors:
        [],
      settings:
        settings(),
      i18n: {
        format:
          vi.fn(
            (
              _key,
              data,
            ) =>
              `Only ${data.attack} can be used in this Druid form.`,
          ),
      },
    };

    globalThis.ui = {
      notifications: {
        warn:
          vi.fn(),
      },
    };

    mechanics =
      await import(
        "../../foundry/scripts/druid-form-mechanics.js"
      );
  },
);

afterEach(
  () => {
    delete globalThis.game;
    delete globalThis.ui;
  },
);

describe(
  "Druid form mechanics",
  () => {
    test(
      "chooses the highest Brawling or magic-school value",
      () => {
        const druid =
          actor({
            items: [
              skill(
                "Brawling",
                12,
              ),
              skill(
                "Elementalism",
                14,
                "magic",
              ),
              skill(
                "Mentalism",
                17,
                "magic",
              ),
              skill(
                "Swords",
                18,
              ),
            ],
          });

        expect(
          mechanics
            .getBestDruidNaturalAttackSkill(
              druid,
            ),
        ).toEqual({
          name:
            "Mentalism",
          value:
            17,
        });
      },
    );

    test(
      "uses Brawling as deterministic tie-breaker",
      () => {
        const druid =
          actor({
            items: [
              skill(
                "Elementalism",
                15,
                "magic",
              ),
              skill(
                "Brawling",
                15,
              ),
            ],
          });

        expect(
          mechanics
            .getBestDruidNaturalAttackSkill(
              druid,
            ).name,
        ).toBe(
          "Brawling",
        );
      },
    );

    test(
      "builds Maul and PL2 Shred using the Druid icon and selected skill",
      () => {
        const druid =
          actor({
            items: [
              skill(
                "Mentalism",
                16,
                "magic",
              ),
            ],
          });

        const maul =
          mechanics
            .buildDruidFormAttackData(
              druid,
              "bear",
              3,
            );
        const shred =
          mechanics
            .buildDruidFormAttackData(
              druid,
              "cat",
              2,
            );

        expect(
          maul,
        ).toMatchObject({
          name:
            "Maul",
          type:
            "weapon",
          img:
            mechanics
              .DRUID_FORM_ATTACK_ICON,
          system: {
            damage:
              "D6",
            skill: {
              name:
                "Mentalism",
            },
            features: [
              "unarmed",
            ],
          },
          flags: {
            [MODULE_ID]: {
              contentKey:
                mechanics
                  .MAUL_CONTENT_KEY,
            },
          },
        });

        expect(
          shred,
        ).toMatchObject({
          name:
            "Shred",
          system: {
            damage:
              "3D6",
            skill: {
              name:
                "Mentalism",
            },
          },
          flags: {
            [MODULE_ID]: {
              contentKey:
                mechanics
                  .SHRED_CONTENT_KEY,
            },
          },
        });
      },
    );

    test(
      "builds Travel Movement as final-phase x2 effect",
      () => {
        const druid =
          actor();
        const effect =
          mechanics
            .buildDruidTravelMovementEffectData(
              druid,
            );

        expect(
          effect,
        ).toMatchObject({
          origin:
            druid.uuid,
          system: {
            changes: [{
              key:
                "system.movement.value",
              type:
                "multiply",
              value:
                "2",
              phase:
                "final",
              priority:
                20,
            }],
          },
        });
      },
    );

    test(
      "reconcile creates only managed Maul in Bear Form and preserves manual Maul",
      async () => {
        const manualMaul = {
          id:
            "manual-maul",
          type:
            "weapon",
          name:
            "Maul",
          flags: {},
        };
        const druid =
          actor({
            state: {
              currentForm:
                "bear",
              activations: {
                feral: {
                  active:
                    true,
                  powerLevel:
                    2,
                },
              },
            },
            items: [
              manualMaul,
              skill(
                "Elementalism",
                14,
                "magic",
              ),
            ],
          });

        await mechanics
          .reconcileDruidFormMechanics(
            druid,
            {
              settings:
                settings(),
            },
          );

        expect(
          druid.items.filter(
            item =>
              item.flags?.[
                MODULE_ID
              ]?.contentKey ===
                mechanics
                  .MAUL_CONTENT_KEY,
          ),
        ).toHaveLength(
          1,
        );
        expect(
          druid.items,
        ).toContain(
          manualMaul,
        );
      },
    );

    test(
      "Bear to Cat deletes Maul and creates Shred with the current best skill",
      async () => {
        const druid =
          actor({
            state: {
              currentForm:
                "bear",
              activations: {
                feral: {
                  active:
                    true,
                  powerLevel:
                    1,
                },
              },
            },
            items: [
              skill(
                "Brawling",
                11,
              ),
              skill(
                "Mentalism",
                13,
                "magic",
              ),
            ],
          });

        await mechanics
          .reconcileDruidFormMechanics(
            druid,
            {
              settings:
                settings(),
            },
          );

        druid.flags[
          MODULE_ID
        ].druidFormState = {
          currentForm:
            "cat",
          activations: {
            feral: {
              active:
                true,
              powerLevel:
                3,
            },
          },
        };

        await mechanics
          .reconcileDruidFormMechanics(
            druid,
            {
              settings:
                settings(),
            },
          );

        const managed =
          druid.items.filter(
            item =>
              [
                mechanics
                  .MAUL_CONTENT_KEY,
                mechanics
                  .SHRED_CONTENT_KEY,
              ].includes(
                item.flags?.[
                  MODULE_ID
                ]?.contentKey,
              ),
          );

        expect(
          managed,
        ).toHaveLength(
          1,
        );
        expect(
          managed[0].name,
        ).toBe(
          "Shred",
        );
        expect(
          managed[0].system.damage,
        ).toBe(
          "4D6",
        );
        expect(
          managed[0].system.skill.name,
        ).toBe(
          "Mentalism",
        );
      },
    );

    test(
      "Travel Movement cleans up when its independent setting is disabled",
      async () => {
        const druid =
          actor({
            state: {
              currentForm:
                "travel",
              activations: {
                savage: {
                  active:
                    true,
                  powerLevel:
                    2,
                },
              },
            },
          });

        await mechanics
          .reconcileDruidFormMechanics(
            druid,
            {
              settings:
                settings(),
            },
          );
        expect(
          druid.effects,
        ).toHaveLength(
          1,
        );

        await mechanics
          .reconcileDruidFormMechanics(
            druid,
            {
              settings:
                settings({
                  movement:
                    false,
                }),
            },
          );
        expect(
          druid.effects,
        ).toHaveLength(
          0,
        );
      },
    );

    test(
      "Bear blocks every weapon except managed Maul and attack setting can disable blocking",
      () => {
        const druid =
          actor({
            state: {
              currentForm:
                "bear",
              activations: {
                feral: {
                  active:
                    true,
                  powerLevel:
                    2,
                },
              },
            },
          });
        const maul =
          document(
            mechanics
              .buildDruidFormAttackData(
                druid,
                "bear",
                2,
              ),
            "maul",
          );
        const sword = {
          id:
            "sword",
          type:
            "weapon",
          flags: {},
        };

        expect(
          mechanics
            .isDruidFormWeaponUseAllowed(
              druid,
              maul,
              {
                settings:
                  settings(),
              },
            ),
        ).toBe(
          true,
        );
        expect(
          mechanics
            .isDruidFormWeaponUseAllowed(
              druid,
              sword,
              {
                settings:
                  settings(),
              },
            ),
        ).toBe(
          false,
        );
        expect(
          mechanics
            .isDruidFormWeaponUseAllowed(
              druid,
              sword,
              {
                settings:
                  settings({
                    attacks:
                      false,
                  }),
              },
            ),
        ).toBe(
          true,
        );
      },
    );

    test(
      "patches Dragonbane weapon test and direct sheet damage paths",
      async () => {
        class BaseTest {
          async roll() {
            return "native";
          }
        }
        class WeaponTest
          extends BaseTest {
          constructor(
            druid,
            weapon,
          ) {
            super();
            this.actor =
              druid;
            this.weapon =
              weapon;
          }
        }
        class ActorSheet {
          constructor(
            druid,
          ) {
            this.actor =
              druid;
          }
          async _onDamageRoll() {
            return "native-damage";
          }
        }

        expect(
          await mechanics
            .patchDruidFormWeaponUsage({
              WeaponTestClass:
                WeaponTest,
              ActorSheetClass:
                ActorSheet,
            }),
        ).toEqual({
          weaponTest:
            "patched",
          damageRoll:
            "patched",
        });

        const druid =
          actor({
            state: {
              currentForm:
                "bear",
              activations: {
                feral: {
                  active:
                    true,
                  powerLevel:
                    1,
                },
              },
            },
          });
        const sword = {
          id:
            "sword",
          type:
            "weapon",
          flags: {},
        };
        druid.items.push(
          sword,
        );

        expect(
          await new WeaponTest(
            druid,
            sword,
          ).roll(),
        ).toBe(
          false,
        );

        const event = {
          type:
            "click",
          preventDefault:
            vi.fn(),
          stopImmediatePropagation:
            vi.fn(),
          currentTarget: {
            closest:
              vi.fn(
                () => ({
                  dataset: {
                    itemId:
                      "sword",
                  },
                }),
              ),
          },
        };

        expect(
          await new ActorSheet(
            druid,
          )._onDamageRoll(
            event,
          ),
        ).toBe(
          false,
        );
      },
    );
  },
);
