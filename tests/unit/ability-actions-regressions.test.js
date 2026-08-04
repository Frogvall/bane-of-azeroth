import {
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
  confirmEyeBeamUse,
  isManagedAbilityAction,
  normalizeWarStompDialogData,
  normalizeWarStompRollOptions,
  patchAbilityActionWeaponSlots,
  reconcileActorAbilityActions,
  resolvePendingWarStompCritical,
} from "../../foundry/scripts/ability-actions.js";

const MODULE_ID =
  "bane-of-azeroth";

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
      `modules/bane-of-azeroth/assets/${id}.webp`,
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
  };
}

function makeActor({
  sourceItems = [],
  managedItems = [],
} = {}) {
  const actor = {
    id:
      "actor",
    uuid:
      "Actor.actor",
    name:
      "Regression Actor",
    type:
      "character",
    documentName:
      "Actor",
    items:
      [],
  };

  actor.items.push(
    ...sourceItems,
    ...managedItems.map(
      (item, index) =>
        managedDocument(
          item,
          item.id ??
            `managed-${index}`,
          actor,
        ),
    ),
  );

  actor.createEmbeddedDocuments =
    vi.fn(
      async (_type, docs) => {
        await Promise.resolve();

        const created =
          docs.map(
            (doc, index) =>
              managedDocument(
                doc,
                `created-${actor.items.length}-${index}`,
                actor,
              ),
          );

        actor.items.push(
          ...created,
        );

        return created;
      },
    );

  actor.deleteEmbeddedDocuments =
    vi.fn(
      async (_type, ids) => {
        await Promise.resolve();

        for (const id of ids) {
          if (
            !actor.items.some(
              item =>
                item.id === id,
            )
          ) {
            throw new Error(
              `Item "${id}" does not exist!`,
            );
          }
        }

        actor.items =
          actor.items.filter(
            item =>
              !ids.includes(
                item.id,
              ),
          );
      },
    );

  return actor;
}

function settings({
  war = true,
  eye = true,
} = {}) {
  return {
    get: vi.fn(
      (_moduleId, key) => {
        if (
          key === "warStompAutomation"
        ) {
          return war;
        }

        if (
          key === "eyeBeamAutomation"
        ) {
          return eye;
        }

        return true;
      },
    ),
  };
}

describe(
  "Ability-action manual regression fixes",
  () => {
    test("shows Eye Beam as a managed Weapon while preserving auto-hit semantics", () => {
      const source =
        sourceAbility(
          EYE_BEAM_SOURCE_CONTENT_KEY,
          "Eye Beam",
          "eye-beam",
        );

      const item =
        buildManagedEyeBeamData(
          source,
        );

      expect(item).toEqual(
        expect.objectContaining({
          name:
            "Eye Beam",
          type:
            "weapon",
          img:
            "modules/bane-of-azeroth/assets/icons/weapons/eye_beam.webp",
          system:
            expect.objectContaining({
              worn:
                true,
              range:
                "20",
              damage:
                "2D8",
              skill: {
                name:
                  "",
              },
              features:
                expect.arrayContaining([
                  "noDamageBonus",
                  "noparry",
                ]),
            }),
        }),
      );

      expect(
        item.system.features,
      ).not.toContain(
        "unarmed",
      );

      expect(
        item.flags[
          MODULE_ID
        ],
      ).toEqual(
        expect.objectContaining({
          managedAbilityAction:
            true,
          abilityActionKey:
            "eye-beam",
          sourceAbilityContentKey:
            EYE_BEAM_SOURCE_CONTENT_KEY,
        }),
      );
    });

    test("does not make the virtual Eye Beam action consume a physical weapon slot", async () => {
      class FakeActor {
        getEquippedWeapons() {
          return this.weapons;
        }

        canEquipWeapon() {
          return (
            this.getEquippedWeapons()
              .filter(
                weapon =>
                  !weapon.hasWeaponFeature(
                    "unarmed",
                  ),
              )
              .length < 3
          );
        }
      }

      class FakeActorSheet {
        _prepareItems(context) {
          context.canEquipWeapon =
            context.equippedWeapons
              .filter(
                weapon =>
                  !weapon.hasWeaponFeature(
                    "unarmed",
                  ),
              )
              .length < 3;
        }
      }

      function physicalWeapon(id) {
        return {
          id,
          hasWeaponFeature:
            () =>
              false,
          flags: {},
        };
      }

      const eyeSource =
        sourceAbility(
          EYE_BEAM_SOURCE_CONTENT_KEY,
          "Eye Beam",
          "eye-beam",
        );

      const eyeBeam =
        managedDocument(
          buildManagedEyeBeamData(
            eyeSource,
          ),
          "eye",
          null,
        );

      eyeBeam.hasWeaponFeature =
        feature =>
          eyeBeam.system.features.includes(
            feature,
          );

      const physical = [
        physicalWeapon("one"),
        physicalWeapon("two"),
      ];

      const actor =
        new FakeActor();

      actor.weapons = [
        ...physical,
        eyeBeam,
      ];

      await expect(
        patchAbilityActionWeaponSlots({
          ActorClass:
            FakeActor,
          ActorSheetClass:
            FakeActorSheet,
        }),
      ).resolves.toBe(true);

      expect(
        actor.canEquipWeapon(),
      ).toBe(true);

      const context = {
        equippedWeapons: [
          ...physical,
          eyeBeam,
        ],
      };

      new FakeActorSheet()
        ._prepareItems(
          context,
        );

      expect(
        context.canEquipWeapon,
      ).toBe(true);

      actor.weapons.push(
        physicalWeapon(
          "three",
        ),
      );

      expect(
        actor.canEquipWeapon(),
      ).toBe(false);
    });

    test("reduces the War Stomp dialog to boons/banes and the normal attack", () => {
      const source =
        sourceAbility(
          WAR_STOMP_SOURCE_CONTENT_KEY,
          "War Stomp",
          "war-stomp",
        );

      const test = {
        weapon:
          buildManagedWarStompData(
            source,
          ),
        options: {},
        noBanesBoons:
          false,
        dialogData: {
          actions: [
            { id: "normal" },
            { id: "topple" },
            { id: "disarm" },
          ],
          boons: [],
          banes: [],
          extraDamage:
            "D6",
          enchantedWeapon:
            3,
        },
      };

      expect(
        normalizeWarStompDialogData(
          test,
        ),
      ).toBe(true);

      expect(
        test.dialogData.actions,
      ).toEqual([]);

      expect(
        test.dialogData.extraDamage,
      ).toBe("");

      expect(
        test.options,
      ).toEqual(
        expect.objectContaining({
          action:
            "normal",
          extraDamage:
            "",
          enchantedWeapon:
            0,
        }),
      );

      expect(
        test.dialogData.banes,
      ).toContainEqual({
        source:
          "War Stomp",
        value:
          true,
      });
    });

    test("keeps the War Stomp bane mandatory even if its visible checkbox is cleared", () => {
      const normalized =
        normalizeWarStompRollOptions({
          banes: [],
          boons: [
            "Helpful Boon",
          ],
          extraBanes:
            2,
          extraBoons:
            0,
          action:
            "topple",
          extraDamage:
            "D8",
          enchantedWeapon:
            2,
        });

      expect(normalized).toEqual(
        expect.objectContaining({
          banes: [
            "War Stomp",
          ],
          boons: [
            "Helpful Boon",
          ],
          extraBanes:
            2,
          action:
            "normal",
          extraDamage:
            "",
          enchantedWeapon:
            0,
        }),
      );

      expect(
        normalizeWarStompRollOptions({
          banes: [
            "War Stomp",
          ],
        }).banes,
      ).toEqual([
        "War Stomp",
      ]);
    });

    test("preserves DialogV2 method binding for Eye Beam confirmation", async () => {
      const DialogV2 = {
        marker:
          "bound",
        async confirm(options) {
          expect(this)
            .toBe(DialogV2);

          expect(options.content)
            .toBe("confirm");

          return true;
        },
      };

      await expect(
        confirmEyeBeamUse(
          {
            content:
              "confirm",
          },
          DialogV2,
        ),
      ).resolves.toBe(true);
    });

    test("serializes concurrent reconciliation so the same managed item is not deleted twice", async () => {
      const source =
        sourceAbility(
          WAR_STOMP_SOURCE_CONTENT_KEY,
          "War Stomp",
          "war-stomp",
        );

      const managed =
        buildManagedWarStompData(
          source,
        );

      managed.id =
        "managed-war-stomp";

      const actor =
        makeActor({
          sourceItems: [
            source,
          ],
          managedItems: [
            managed,
          ],
        });

      await expect(
        Promise.all([
          reconcileActorAbilityActions(
            actor,
            {
              settings:
                settings({
                  war:
                    false,
                }),
            },
          ),
          reconcileActorAbilityActions(
            actor,
            {
              settings:
                settings({
                  war:
                    false,
                }),
            },
          ),
        ]),
      ).resolves.toEqual([
        true,
        true,
      ]);

      expect(
        actor.items.some(
          item =>
            isManagedAbilityAction(
              item,
              "war-stomp",
            ),
        ),
      ).toBe(false);

      expect(
        actor.deleteEmbeddedDocuments,
      ).toHaveBeenCalledTimes(1);
    });

    test("creates exactly one managed action per ability under concurrent reconciliation", async () => {
      const war =
        sourceAbility(
          WAR_STOMP_SOURCE_CONTENT_KEY,
          "War Stomp",
          "war-stomp",
        );

      const eye =
        sourceAbility(
          EYE_BEAM_SOURCE_CONTENT_KEY,
          "Eye Beam",
          "eye-beam",
        );

      const actor =
        makeActor({
          sourceItems: [
            war,
            eye,
          ],
        });

      await Promise.all([
        reconcileActorAbilityActions(
          actor,
          {
            settings:
              settings(),
          },
        ),
        reconcileActorAbilityActions(
          actor,
          {
            settings:
              settings(),
          },
        ),
      ]);

      expect(
        actor.items.filter(
          item =>
            isManagedAbilityAction(
              item,
              "war-stomp",
            ),
        ),
      ).toHaveLength(1);

      expect(
        actor.items.filter(
          item =>
            isManagedAbilityAction(
              item,
              "eye-beam",
            ),
        ),
      ).toHaveLength(1);
    });

    test("waits for the Dragonbane critical choice before creating War Stomp damage cards", async () => {
      const source =
        sourceAbility(
          WAR_STOMP_SOURCE_CONTENT_KEY,
          "War Stomp",
          "war-stomp",
        );

      const actor = {
        uuid:
          "Actor.actor",
      };

      const weapon =
        managedDocument(
          buildManagedWarStompData(
            source,
          ),
          "war-stomp",
          actor,
        );

      const target = {
        uuid:
          "Actor.target",
      };

      const pending = {
        actorUuid:
          actor.uuid,
        weaponUuid:
          weapon.uuid,
        targetActorUuids: [
          target.uuid,
        ],
      };

      const context = {
        actor,
        weapon,
        criticalEffect:
          "",
      };

      const message = {
        getFlag:
          vi.fn(
            () =>
              pending,
          ),
        unsetFlag:
          vi.fn(
            async () =>
              undefined,
          ),
        system: {
          toContext:
            () =>
              context,
        },
      };

      const resolveDamage =
        vi.fn(
          async () =>
            undefined,
        );

      const documents =
        new Map([
          [actor.uuid, actor],
          [weapon.uuid, weapon],
          [target.uuid, target],
        ]);

      const resolveDocument =
        uuid =>
          documents.get(
            uuid,
          ) ??
          null;

      await expect(
        resolvePendingWarStompCritical(
          message,
          {
            resolveDamage,
            resolveDocument,
          },
        ),
      ).resolves.toBe(false);

      expect(resolveDamage)
        .not
        .toHaveBeenCalled();

      expect(
        message.unsetFlag,
      ).not.toHaveBeenCalled();

      context.criticalEffect =
        "doubleWeaponDamage";

      await expect(
        resolvePendingWarStompCritical(
          message,
          {
            resolveDamage,
            resolveDocument,
          },
        ),
      ).resolves.toBe(true);

      expect(
        message.unsetFlag,
      ).toHaveBeenCalledTimes(1);

      expect(resolveDamage)
        .toHaveBeenCalledWith(
          actor,
          weapon,
          {
            targetActors: [
              target,
            ],
            doubleWeaponDamage:
              true,
          },
        );
    });
  },
);
