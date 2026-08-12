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

function settings({
  armor =
    true,
  spellRestriction =
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
              "druidFormArmorAutomation"
          ) {
            return armor;
          }
          if (
            key ===
              "druidFormSpellRestrictionAutomation"
          ) {
            return spellRestriction;
          }
          return true;
        },
      ),
  };
}

function managedDocument(
  source,
  id,
) {
  return {
    ...structuredClone(
      source,
    ),
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

function actor({
  form =
    "humanoid",
  activations = {},
  items = [],
} = {}) {
  let nextId =
    1;

  const result = {
    id:
      "druid",
    uuid:
      "Actor.druid",
    type:
      "character",
    flags: {
      [MODULE_ID]: {
        druidFormState: {
          currentForm:
            form,
          activations:
            structuredClone(
              activations,
            ),
        },
      },
    },
    items:
      [...items],
    effects:
      [],
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
      ][
        key
      ] =
        structuredClone(
          value,
        );
      return value;
    },
    async unsetFlag(
      moduleId,
      key,
    ) {
      delete this.flags?.[
        moduleId
      ]?.[
        key
      ];
      return true;
    },
    async createEmbeddedDocuments(
      type,
      documents,
    ) {
      const target =
        type ===
          "Item"
          ? this.items
          : this.effects;
      return documents.map(
        source => {
          const created =
            managedDocument(
              source,
              `created-${nextId++}`,
            );
          target.push(
            created,
          );
          return created;
        },
      );
    },
    async deleteEmbeddedDocuments(
      type,
      ids,
    ) {
      const target =
        type ===
          "Item"
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
            target[
              index
            ].id,
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
    async updateEmbeddedDocuments(
      type,
      updates,
    ) {
      if (
        type !==
          "Item"
      ) {
        return [];
      }

      for (
        const update
        of updates
      ) {
        const item =
          this.items.find(
            candidate =>
              candidate.id ===
                update._id,
          );
        if (!item) {
          continue;
        }

        for (
          const [
            key,
            value,
          ]
          of Object.entries(
            update,
          )
        ) {
          if (
            key ===
              "_id"
          ) {
            continue;
          }
          if (
            key.startsWith(
              "system.",
            )
          ) {
            item.system[
              key.slice(
                7,
              )
            ] =
              value;
          }
        }
      }

      return updates;
    },
  };

  result.items.get =
    id =>
      result.items.find(
        item =>
          item.id ===
            id,
      );

  return result;
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
        localize:
          vi.fn(
            key =>
              key,
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
  "Druid form armor and spell restrictions",
  () => {
    test(
      "builds Ironfur at 3 x PL and Barkskin at 2 x PL",
      () => {
        expect(
          mechanics
            .buildDruidFormArmorData(
              "bear",
              2,
            ),
        ).toMatchObject({
          name:
            "Ironfur",
          type:
            "armor",
          system: {
            worn:
              true,
            weight:
              0,
            rating:
              6,
          },
          flags: {
            [MODULE_ID]: {
              contentKey:
                "druid-form-armor.ironfur",
            },
          },
        });

        expect(
          mechanics
            .buildDruidFormArmorData(
              "tree",
              3,
            ),
        ).toMatchObject({
          name:
            "Barkskin",
          type:
            "armor",
          system: {
            worn:
              true,
            rating:
              6,
          },
          flags: {
            [MODULE_ID]: {
              contentKey:
                "druid-form-armor.barkskin",
            },
          },
        });
      },
    );

    test(
      "Bear suppresses armor and helmet, then Humanoid restores them",
      async () => {
        const studded = {
          id:
            "studded",
          type:
            "armor",
          system: {
            worn:
              true,
            rating:
              2,
          },
          flags: {},
        };
        const helm = {
          id:
            "helm",
          type:
            "helmet",
          system: {
            worn:
              true,
            rating:
              2,
          },
          flags: {},
        };
        const druid =
          actor({
            form:
              "bear",
            activations: {
              feral: {
                active:
                  true,
                powerLevel:
                  2,
              },
            },
            items: [
              studded,
              helm,
            ],
          });

        await mechanics
          .reconcileDruidFormArmor(
            druid,
            undefined,
            {
              settings:
                settings(),
            },
          );

        expect(
          studded.system.worn,
        ).toBe(
          false,
        );
        expect(
          helm.system.worn,
        ).toBe(
          false,
        );
        expect(
          druid.items.find(
            item =>
              item.flags?.[
                MODULE_ID
              ]?.contentKey ===
                "druid-form-armor.ironfur",
          ),
        ).toMatchObject({
          name:
            "Ironfur",
          system: {
            worn:
              true,
            rating:
              6,
          },
        });

        druid.flags[
          MODULE_ID
        ].druidFormState = {
          currentForm:
            "humanoid",
          activations: {},
        };

        await mechanics
          .reconcileDruidFormArmor(
            druid,
            undefined,
            {
              settings:
                settings(),
            },
          );

        expect(
          studded.system.worn,
        ).toBe(
          true,
        );
        expect(
          helm.system.worn,
        ).toBe(
          true,
        );
        expect(
          druid.items.some(
            item =>
              item.flags?.[
                MODULE_ID
              ]?.contentKey ===
                "druid-form-armor.ironfur",
          ),
        ).toBe(
          false,
        );
      },
    );

    test(
      "Tree uses Barkskin while Cat Travel and Moonkin use no replacement armor",
      async () => {
        const tree =
          actor({
            form:
              "tree",
            activations: {
              harmony: {
                active:
                  true,
                powerLevel:
                  2,
              },
            },
          });

        await mechanics
          .reconcileDruidFormArmor(
            tree,
            undefined,
            {
              settings:
                settings(),
            },
          );

        expect(
          tree.items.find(
            item =>
              item.flags?.[
                MODULE_ID
              ]?.contentKey ===
                "druid-form-armor.barkskin",
          )?.system?.rating,
        ).toBe(
          4,
        );

        for (
          const form
          of [
            "cat",
            "travel",
            "moonkin",
          ]
        ) {
          const wornArmor = {
            id:
              `armor-${form}`,
            type:
              "armor",
            system: {
              worn:
                true,
              rating:
                2,
            },
            flags: {},
          };
          const druid =
            actor({
              form,
              items: [
                wornArmor,
              ],
            });

          await mechanics
            .reconcileDruidFormArmor(
              druid,
              undefined,
              {
                settings:
                  settings(),
              },
            );

          expect(
            wornArmor.system.worn,
          ).toBe(
            false,
          );
          expect(
            druid.items.some(
              item =>
                [
                  "druid-form-armor.ironfur",
                  "druid-form-armor.barkskin",
                ].includes(
                  item.flags?.[
                    MODULE_ID
                  ]?.contentKey,
                ),
            ),
          ).toBe(
            false,
          );
        }
      },
    );

    test(
      "preUpdate guard prevents re-equipping humanoid armor while shifted",
      () => {
        const druid =
          actor({
            form:
              "tree",
          });
        const armor = {
          type:
            "armor",
          parent:
            druid,
          system: {
            worn:
              false,
          },
          flags: {},
        };

        expect(
          mechanics
            .onPreUpdateDruidFormArmorItem(
              armor,
              {
                system: {
                  worn:
                    true,
                },
              },
              {
                settings:
                  settings(),
              },
            ),
        ).toBe(
          false,
        );
        expect(
          globalThis.ui
            .notifications
            .warn,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    test(
      "Travel Bear and Cat permit Word alone and block Word plus Gesture",
      () => {
        const word = {
          system: {
            requirement:
              "Word",
          },
        };
        const fireball = {
          system: {
            requirement:
              "Word, gesture",
          },
        };

        for (
          const form
          of [
            "travel",
            "bear",
            "cat",
          ]
        ) {
          const druid =
            actor({
              form,
            });
          expect(
            mechanics
              .isDruidFormSpellAllowed(
                druid,
                word,
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
              .isDruidFormSpellAllowed(
                druid,
                fireball,
                {
                  settings:
                    settings(),
                },
              ),
          ).toBe(
            false,
          );
        }
      },
    );

    test(
      "Tree Moonkin and Humanoid do not apply the Word-only restriction",
      () => {
        const fireball = {
          system: {
            requirement:
              "Word, gesture",
          },
        };

        for (
          const form
          of [
            "tree",
            "moonkin",
            "humanoid",
          ]
        ) {
          expect(
            mechanics
              .isDruidFormSpellAllowed(
                actor({
                  form,
                }),
                fireball,
                {
                  settings:
                    settings(),
                },
              ),
          ).toBe(
            true,
          );
        }
      },
    );

    test(
      "Dragonbane SpellTest is cancelled before native getRollOptions",
      async () => {
        class WeaponTest {
          async roll() {
            return "native";
          }
        }
        class ActorSheet {
          async _onDamageRoll() {
            return "native";
          }
        }
        class SpellTest {
          constructor(
            druid,
            spell,
          ) {
            this.actor =
              druid;
            this.spell =
              spell;
          }
          async getRollOptions() {
            return {
              cancelled:
                false,
            };
          }
        }

        const result =
          await mechanics
            .patchDruidFormWeaponUsage({
              WeaponTestClass:
                WeaponTest,
              ActorSheetClass:
                ActorSheet,
              SpellTestClass:
                SpellTest,
            });

        expect(
          result.spellTest,
        ).toBe(
          "patched",
        );

        const fireball = {
          system: {
            requirement:
              "Word, gesture",
          },
        };

        expect(
          await new SpellTest(
            actor({
              form:
                "bear",
            }),
            fireball,
          ).getRollOptions(),
        ).toEqual({
          cancelled:
            true,
        });
      },
    );
  },
);
