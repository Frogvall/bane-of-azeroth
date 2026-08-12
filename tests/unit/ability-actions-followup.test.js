import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  EYE_BEAM_SOURCE_CONTENT_KEY,
  WAR_STOMP_SOURCE_CONTENT_KEY,
  buildManagedEyeBeamData,
  buildManagedWarStompData,
  isManagedAbilityAction,
  patchWarStompWeaponTest,
  reconcileActorAbilityActions,
} from "../../foundry/scripts/ability-actions.js";

const MODULE_ID =
  "bane-of-azeroth";

const EYE_ICON =
  "modules/bane-of-azeroth/assets/icons/weapons/eye_beam.webp";

function sourceAbility(
  contentKey,
  name,
  id,
) {
  return {
    id,
    uuid:
      `Actor.test.Item.${id}`,
    type:
      "ability",
    name,
    img:
      "icons/svg/aura.svg",
    getFlag(moduleId, key) {
      if (
        moduleId === MODULE_ID &&
        key === "contentKey"
      ) {
        return contentKey;
      }

      return undefined;
    },
  };
}

function managedDocument(
  data,
  id,
  actor,
) {
  return {
    ...data,
    id,
    uuid:
      `Actor.test.Item.${id}`,
    parent:
      actor,
    getFlag(moduleId, key) {
      return (
        this.flags?.[
          moduleId
        ]?.[key]
      );
    },
    async update(update) {
      Object.assign(
        this,
        update,
      );

      if (update.system) {
        this.system = {
          ...this.system,
          ...update.system,
        };
      }
    },
  };
}

function enabledSettings() {
  return {
    get:
      vi.fn(
        () =>
          true,
      ),
  };
}

afterEach(() => {
  delete globalThis.game;
  delete globalThis.ChatMessage;
  delete globalThis.ui;
});

describe(
  "Ability Actions follow-up regressions",
  () => {
    test("repairs an already-existing managed Eye Beam weapon to the current definition", async () => {
      const source =
        sourceAbility(
          EYE_BEAM_SOURCE_CONTENT_KEY,
          "Eye Beam",
          "eye-source",
        );

      const actor = {
        id:
          "actor",
        uuid:
          "Actor.actor",
        type:
          "character",
        documentName:
          "Actor",
        items:
          [],
      };

      const stale =
        managedDocument(
          buildManagedEyeBeamData(
            source,
          ),
          "managed-eye",
          actor,
        );

      stale.img =
        "icons/svg/eye.svg";
      stale.system.range =
        "10";

      actor.items = [
        source,
        stale,
      ];

      actor.createEmbeddedDocuments =
        vi.fn();

      actor.deleteEmbeddedDocuments =
        vi.fn();

      actor.updateEmbeddedDocuments =
        vi.fn(
          async (_type, updates) => {
            for (const update of updates) {
              const item =
                actor.items.find(
                  candidate =>
                    candidate.id ===
                      update._id,
                );

              if (!item) {
                continue;
              }

              if (
                Object.hasOwn(
                  update,
                  "name",
                )
              ) {
                item.name =
                  update.name;
              }

              if (
                Object.hasOwn(
                  update,
                  "img",
                )
              ) {
                item.img =
                  update.img;
              }

              if (update.system) {
                item.system = {
                  ...item.system,
                  ...update.system,
                  skill: {
                    ...item.system?.skill,
                    ...update.system?.skill,
                  },
                  features: [
                    ...(
                      update.system
                        ?.features ??
                      item.system
                        ?.features ??
                      []
                    ),
                  ],
                };
              }

              if (update.flags) {
                item.flags =
                  update.flags;
              }
            }
          },
        );

      await reconcileActorAbilityActions(
        actor,
        {
          settings:
            enabledSettings(),
        },
      );

      expect(
        actor.updateEmbeddedDocuments,
      ).toHaveBeenCalledTimes(1);

      expect(stale.img)
        .toBe(EYE_ICON);

      expect(
        stale.system.range,
      ).toBe("20");

      expect(
        isManagedAbilityAction(
          stale,
          "eye-beam",
        ),
      ).toBe(true);

      expect(
        actor.createEmbeddedDocuments,
      ).not.toHaveBeenCalled();
    });

    test("asks for 3 WP before the initial War Stomp roll and aborts cleanly on rejection", async () => {
      const source =
        sourceAbility(
          WAR_STOMP_SOURCE_CONTENT_KEY,
          "War Stomp",
          "war-source",
        );

      const actor = {
        uuid:
          "Actor.actor",
        name:
          "Tauren",
        system: {
          willPoints: {
            value:
              10,
          },
        },
        update:
          vi.fn(),
      };

      const weapon =
        managedDocument(
          buildManagedWarStompData(
            source,
          ),
          "war",
          actor,
        );

      let nativeRollCalls =
        0;

      class FakeWeaponTest {
        constructor() {
          this.actor =
            actor;
          this.weapon =
            weapon;
          this.isReroll =
            false;
          this.options =
            {};
          this.noBanesBoons =
            false;
          this.dialogData = {
            actions: [],
            boons: [],
            banes: [],
          };
        }

        updateDialogData() {
          return this.dialogData;
        }

        async getRollOptions() {
          return {};
        }

        async roll() {
          nativeRollCalls += 1;

          this.postRollData = {
            success:
              false,
          };

          return {
            id:
              "roll",
          };
        }
      }

      globalThis.game = {
        settings: {
          get:
            vi.fn(
              () =>
                true,
            ),
        },
        i18n: {
          localize:
            key =>
              key,
          format:
            (key) => {
              if (
                key ===
                "BOA.dialog.abilityActions.warStompConfirm"
              ) {
                return (
                  "Spend 3 WP to use War Stomp?"
                );
              }

              return key;
            },
        },
      };

      globalThis.ChatMessage = {
        create:
          vi.fn(),
        getSpeaker:
          vi.fn(
            () => ({}),
          ),
      };

      const confirm =
        vi.fn(
          async options => {
            expect(
              options.content,
            ).toContain(
              "3 WP",
            );

            return false;
          },
        );

      await expect(
        patchWarStompWeaponTest({
          WeaponTestClass:
            FakeWeaponTest,
          confirm,
          resolveDamage:
            vi.fn(),
        }),
      ).resolves.toBe(true);

      const test =
        new FakeWeaponTest();

      await expect(
        test.roll(),
      ).resolves.toBeUndefined();

      expect(confirm)
        .toHaveBeenCalledTimes(1);

      expect(nativeRollCalls)
        .toBe(0);

      expect(actor.update)
        .not.toHaveBeenCalled();
    });
  },
);
