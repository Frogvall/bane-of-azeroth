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
  buildManagedWarStompData,
  collectWarStompTargets,
  getAbilityActionDefinition,
  isManagedAbilityAction,
  planEyeBeamAction,
  reconcileActorAbilityActions,
} from "../../foundry/scripts/ability-actions.js";

const MODULE_ID =
  "bane-of-azeroth";

function ability(
  contentKey,
  {
    name = "Ability",
    id = "ability-id",
  } = {},
) {
  return {
    id,
    type: "ability",
    name,
    img: "icons/svg/aura.svg",
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

function fakeActor({
  sourceItems = [],
  embeddedItems = [],
} = {}) {
  const items =
    [...sourceItems, ...embeddedItems];

  const actor = {
    type: "character",
    documentName: "Actor",
    items,
    createEmbeddedDocuments:
      vi.fn(
        async (_type, docs) => {
          const created =
            docs.map(
              (doc, index) => ({
                ...doc,
                id:
                  `managed-${actor.items.length}-${index}`,
                parent: actor,
                getFlag(moduleId, key) {
                  return (
                    this.flags?.[
                      moduleId
                    ]?.[key]
                  );
                },
              }),
            );

          actor.items.push(
            ...created,
          );
          return created;
        },
      ),
    deleteEmbeddedDocuments:
      vi.fn(
        async (_type, ids) => {
          actor.items =
            actor.items.filter(
              item =>
                !ids.includes(
                  item.id,
                ),
            );
        },
      ),
  };

  return actor;
}

afterEach(() => {
  delete globalThis.game;
});

describe(
  "War Stomp and Eye Beam ability actions",
  () => {
    test("defines the exact rule contracts", () => {
      expect(
        getAbilityActionDefinition(
          "war-stomp",
        ),
      ).toEqual(
        expect.objectContaining({
          kind: "weapon",
          sourceContentKey:
            WAR_STOMP_SOURCE_CONTENT_KEY,
          wpCost: 3,
          skill: "Brawling",
          damage: "D6",
          range: 2,
          mandatoryBanes: 1,
          damageBonus: false,
          canParry: false,
        }),
      );

      expect(
        planEyeBeamAction(),
      ).toEqual({
        kind: "ability",
        sourceContentKey:
          EYE_BEAM_SOURCE_CONTENT_KEY,
        wpCost: 3,
        maxRange: 20,
        damage: "2D8",
        automaticHit: true,
        canParry: false,
        magical: true,
        usesWeaponTest: false,
        manualDamageRoll: true,
      });
    });

    test("builds a managed War Stomp weapon without inventing extra damage semantics", () => {
      const source =
        ability(
          WAR_STOMP_SOURCE_CONTENT_KEY,
          {
            name: "War Stomp",
          },
        );

      const data =
        buildManagedWarStompData(
          source,
        );

      expect(data).toEqual(
        expect.objectContaining({
          name: "War Stomp",
          type: "weapon",
          system:
            expect.objectContaining({
              worn: true,
              range: "2",
              damage: "D6",
              skill: {
                name: "Brawling",
              },
              features:
                expect.arrayContaining([
                  "unarmed",
                  "noDamageBonus",
                  "noparry",
                ]),
            }),
        }),
      );

      expect(
        data.flags[
          MODULE_ID
        ],
      ).toEqual(
        expect.objectContaining({
          managedAbilityAction: true,
          abilityActionKey:
            "war-stomp",
          sourceAbilityContentKey:
            WAR_STOMP_SOURCE_CONTENT_KEY,
        }),
      );

      expect(
        data.system.features,
      ).not.toContain(
        "enchanted1",
      );
    });

    test("reconciles managed War Stomp and Eye Beam actions and preserves manual same-name items", async () => {
      const source =
        ability(
          WAR_STOMP_SOURCE_CONTENT_KEY,
          {
            name: "War Stomp",
          },
        );

      const manual = {
        id: "manual-war-stomp",
        name: "War Stomp",
        type: "weapon",
        getFlag: vi.fn(
          () => undefined,
        ),
      };

      const actor =
        fakeActor({
          sourceItems: [
            source,
            ability(
              EYE_BEAM_SOURCE_CONTENT_KEY,
              {
                name:
                  "Eye Beam",
                id: "eye",
              },
            ),
          ],
          embeddedItems: [
            manual,
          ],
        });

      await reconcileActorAbilityActions(
        actor,
        {
          settings:
            settings(),
        },
      );

      expect(
        actor.createEmbeddedDocuments,
      ).toHaveBeenCalledTimes(2);

      const managed =
        actor.items.filter(
          item =>
            isManagedAbilityAction(
              item,
              "war-stomp",
            ),
        );

      expect(managed)
        .toHaveLength(1);

      expect(
        actor.items,
      ).toContain(manual);

      expect(
        actor.items.some(
          item =>
            isManagedAbilityAction(
              item,
              "eye-beam",
            ),
        ),
      ).toBe(true);

      await reconcileActorAbilityActions(
        actor,
        {
          settings:
            settings({
              war: false,
            }),
        },
      );

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
        actor.items.some(
          item =>
            isManagedAbilityAction(
              item,
              "eye-beam",
            ),
        ),
      ).toBe(true);

      expect(
        actor.items,
      ).toContain(manual);
    });

    test("collects all other visible creatures within two meters", () => {
      const source = {
        id: "source",
        actor: {
          id: "self",
        },
        document: {
          id: "source-doc",
        },
      };

      function target(
        id,
        distance,
        {
          hidden = false,
        } = {},
      ) {
        return {
          id,
          actor: {
            id,
          },
          document: {
            id,
            hidden,
            distance,
          },
        };
      }

      const nearA =
        target("a", 1);
      const nearB =
        target("b", 2);
      const far =
        target("far", 3);
      const hidden =
        target(
          "hidden",
          1,
          {
            hidden: true,
          },
        );

      const result =
        collectWarStompTargets(
          source,
          [
            source,
            nearA,
            nearB,
            far,
            hidden,
          ],
          {
            measureDistance:
              (_from, to) =>
                to.distance,
          },
        );

      expect(result)
        .toEqual([
          nearA,
          nearB,
        ]);
    });
  },
);
