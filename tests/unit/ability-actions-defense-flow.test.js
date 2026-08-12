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
  createAbilityActionResolutionMessages,
  getAbilityActionDefinition,
  rollAbilityActionResolutionDamage,
  useEyeBeamAction,
} from "../../foundry/scripts/ability-actions.js";

const MODULE_ID =
  "bane-of-azeroth";

const WAR_ICON =
  "modules/bane-of-azeroth/assets/icons/weapons/war_stomp.webp";

const EYE_ICON =
  "modules/bane-of-azeroth/assets/icons/weapons/eye_beam.webp";

function sourceAbility(
  contentKey,
  name,
) {
  return {
    id:
      name.toLowerCase(),
    uuid:
      `Actor.test.Item.${name.toLowerCase()}`,
    type:
      "ability",
    name,
    img:
      "modules/bane-of-azeroth/assets/icons/classes/generic.webp",
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

afterEach(() => {
  delete globalThis.game;
  delete globalThis.ChatMessage;
  delete globalThis.ui;
});

describe(
  "War Stomp and Eye Beam manual damage timing",
  () => {
    test("uses dedicated icons only on managed Weapon entries", () => {
      const warSource =
        sourceAbility(
          WAR_STOMP_SOURCE_CONTENT_KEY,
          "War Stomp",
        );

      const eyeSource =
        sourceAbility(
          EYE_BEAM_SOURCE_CONTENT_KEY,
          "Eye Beam",
        );

      expect(
        buildManagedWarStompData(
          warSource,
        ).img,
      ).toBe(WAR_ICON);

      expect(
        buildManagedEyeBeamData(
          eyeSource,
        ).img,
      ).toBe(EYE_ICON);

      expect(warSource.img)
        .not
        .toBe(WAR_ICON);

      expect(eyeSource.img)
        .not
        .toBe(EYE_ICON);
    });

    test("declares manual damage timing without implementing defense state", () => {
      expect(
        getAbilityActionDefinition(
          "war-stomp",
        ),
      ).toEqual(
        expect.objectContaining({
          manualDamageRoll:
            true,
        }),
      );

      expect(
        getAbilityActionDefinition(
          "eye-beam",
        ),
      ).toEqual(
        expect.objectContaining({
          automaticHit:
            true,
          canParry:
            false,
          manualDamageRoll:
            true,
        }),
      );

      expect(
        getAbilityActionDefinition(
          "war-stomp",
        ),
      ).not.toHaveProperty(
        "canEvade",
      );

      expect(
        getAbilityActionDefinition(
          "eye-beam",
        ),
      ).not.toHaveProperty(
        "canEvade",
      );
    });

    test("creates one hit/result card per target without rolling damage", async () => {
      const actor = {
        uuid:
          "Actor.attacker",
        name:
          "Attacker",
      };

      const weapon = {
        uuid:
          "Actor.attacker.Item.war",
        name:
          "War Stomp",
      };

      const targets = [
        {
          uuid:
            "Actor.one",
          name:
            "One",
        },
        {
          uuid:
            "Actor.two",
          name:
            "Two",
        },
      ];

      const createMessage =
        vi.fn(
          async data => ({
            ...data,
          }),
        );

      const inflictDamageMessage =
        vi.fn();

      const result =
        await createAbilityActionResolutionMessages(
          actor,
          weapon,
          {
            actionKey:
              "war-stomp",
            damage:
              "D6",
            targetActors:
              targets,
            createMessage,
            inflictDamageMessage,
          },
        );

      expect(result)
        .toHaveLength(2);

      expect(createMessage)
        .toHaveBeenCalledTimes(2);

      expect(
        inflictDamageMessage,
      ).not.toHaveBeenCalled();

      for (
        const [
          data,
        ] of createMessage.mock.calls
      ) {
        expect(data.content)
          .toContain(
            "data-action=\"boaRollAbilityActionDamage\"",
          );

        expect(data.content)
          .toContain(
            "weapon-roll",
          );

        expect(data.content)
          .toContain(
            "succeeded",
          );

        expect(data.content)
          .not
          .toContain(
            "EVADE",
          );
      }
    });

    test("Eye Beam result says automatic hit but still waits for Roll Damage", async () => {
      const actor = {
        uuid:
          "Actor.attacker",
      };

      const weapon = {
        uuid:
          "Actor.attacker.Item.eye",
        name:
          "Eye Beam",
      };

      const target = {
        uuid:
          "Actor.target",
        name:
          "Target",
      };

      const createMessage =
        vi.fn(
          async data => ({
            ...data,
          }),
        );

      const inflictDamageMessage =
        vi.fn();

      await createAbilityActionResolutionMessages(
        actor,
        weapon,
        {
          actionKey:
            "eye-beam",
          automaticHit:
            true,
          damage:
            "2D8",
          magical:
            true,
          targetActors: [
            target,
          ],
          createMessage,
          inflictDamageMessage,
        },
      );

      expect(
        inflictDamageMessage,
      ).not.toHaveBeenCalled();

      const [
        messageData,
      ] =
        createMessage.mock.calls[0];

      expect(
        messageData.content,
      ).toContain(
        "hits automatically",
      );

      expect(
        messageData.content,
      ).toContain(
        "2D8 magical damage",
      );

      expect(
        messageData.content,
      ).toContain(
        "data-action=\"boaRollAbilityActionDamage\"",
      );

      expect(
        messageData.content,
      ).not.toContain(
        "EVADE",
      );
    });

    test("rolls damage only after the result-card button is used", async () => {
      const actor = {
        uuid:
          "Actor.attacker",
      };

      const weapon = {
        uuid:
          "Actor.attacker.Item.eye",
      };

      const target = {
        uuid:
          "Actor.target",
      };

      const pending = {
        actorUuid:
          actor.uuid,
        weaponUuid:
          weapon.uuid,
        targetActorUuid:
          target.uuid,
        actionKey:
          "eye-beam",
        damage:
          "2D8",
        magical:
          true,
        doubleWeaponDamage:
          false,
      };

      const message = {
        getFlag:
          vi.fn(
            () =>
              pending,
          ),
      };

      const documents =
        new Map([
          [
            actor.uuid,
            actor,
          ],
          [
            weapon.uuid,
            weapon,
          ],
          [
            target.uuid,
            target,
          ],
        ]);

      const inflictDamageMessage =
        vi.fn(
          async () =>
            undefined,
        );

      await expect(
        rollAbilityActionResolutionDamage(
          message,
          {
            resolveDocument:
              uuid =>
                documents.get(
                  uuid,
                ) ??
                null,
            inflictDamageMessage,
          },
        ),
      ).resolves.toBe(true);

      expect(
        inflictDamageMessage,
      ).toHaveBeenCalledTimes(1);

      expect(
        inflictDamageMessage,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          actor,
          weapon,
          target,
          damage:
            "2D8",
        }),
      );
    });

    test("Eye Beam activation spends WP and creates a result card without rolling damage", async () => {
      const actor = {
        uuid:
          "Actor.attacker",
        name:
          "Demon Hunter",
        system: {
          willPoints: {
            value:
              10,
          },
        },
        update:
          vi.fn(
            async update => {
              actor.system
                .willPoints
                .value =
                update[
                  "system.willPoints.value"
                ];
            },
          ),
        items: {
          filter:
            () =>
              [],
        },
      };

      const eyeBeam = {
        uuid:
          "Actor.attacker.Item.eye",
        name:
          "Eye Beam",
        type:
          "weapon",
        flags: {
          [MODULE_ID]: {
            managedAbilityAction:
              true,
            abilityActionKey:
              "eye-beam",
          },
        },
        getFlag(moduleId, key) {
          return (
            this.flags?.[
              moduleId
            ]?.[key]
          );
        },
      };

      const target = {
        name:
          "Target",
        actor: {
          uuid:
            "Actor.target",
          name:
            "Target",
        },
      };

      globalThis.game = {
        user: {
          id:
            "user",
          targets:
            new Set([
              target,
            ]),
        },
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
            key =>
              key,
        },
      };

      globalThis.ChatMessage = {
        create:
          vi.fn(
            async () =>
              undefined,
          ),
        getSpeaker:
          vi.fn(
            () => ({
              actor:
                actor.uuid,
            }),
          ),
      };

      const createResolutionMessages =
        vi.fn(
          async () =>
            [target.actor],
        );

      const inflictDamageMessage =
        vi.fn();

      await expect(
        useEyeBeamAction(
          actor,
          eyeBeam,
          {
            target,
            sourceToken: {
              id:
                "source",
            },
            confirm:
              vi.fn(
                async () =>
                  true,
              ),
            measureDistance:
              () =>
                10,
            createResolutionMessages,
            inflictDamageMessage,
          },
        ),
      ).resolves.toBe(true);

      expect(
        actor.system
          .willPoints
          .value,
      ).toBe(7);

      expect(
        createResolutionMessages,
      ).toHaveBeenCalledTimes(1);

      expect(
        inflictDamageMessage,
      ).not.toHaveBeenCalled();
    });
  },
);
