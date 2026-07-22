import {
  describe,
  expect,
  test,
} from "vitest";

import {
  LETHAL_POISON_RULE_UUID,
  buildCommonAnimalAttackEffectMessage,
  planCommonAnimalAttackEffectMessages,
} from "../../foundry/scripts/common-animal-attack-effects.js";

const ATTACKER = "Large Serpent";
const TARGET = "Test Adventurer";

describe("Common Animal attack-effect chat content", () => {
  test("uses Dragonbane's lethal-poison journal anchor", () => {
    expect(LETHAL_POISON_RULE_UUID).toBe(
      "JournalEntry.SbbSMsuvWeo3HaID." +
      "JournalEntryPage.6WPxPxUjh4W80RNy#poison"
    );
  });

  test("builds the Large Serpent lethal-poison message", () => {
    const message =
      buildCommonAnimalAttackEffectMessage({
        effect: {
          type: "lethalPoison",
          potency: 15,
          ruleUuid:
            LETHAL_POISON_RULE_UUID,
        },
        attackerName: ATTACKER,
        targetName: TARGET,
      });

    expect(message).toMatchObject({
      effectType: "lethalPoison",
      attackerName: ATTACKER,
      targetName: TARGET,
    });
    expect(message.content).toContain(
      "<strong>Lethal Poison:</strong>"
    );
    expect(message.content).toContain(
      ATTACKER
    );
    expect(message.content).toContain(
      TARGET
    );
    expect(message.content).toContain(
      `@UUID[${LETHAL_POISON_RULE_UUID}]` +
      "{lethal poison}"
    );
    expect(message.content).toContain(
      "potency of 15"
    );
    expect(message.content).toContain(
      "as if the poison had been ingested"
    );
  });

  test("builds the Large Serpent constrain message", () => {
    const message =
      buildCommonAnimalAttackEffectMessage({
        effect: {
          type: "constrain",
          strength: 12,
        },
        attackerName: ATTACKER,
        targetName: TARGET,
      });

    expect(message).toMatchObject({
      effectType: "constrain",
      attackerName: ATTACKER,
      targetName: TARGET,
    });
    expect(message.content).toContain(
      "<strong>Constrain:</strong>"
    );
    expect(message.content).toContain(
      ATTACKER
    );
    expect(message.content).toContain(
      TARGET
    );
    expect(message.content).toContain(
      "unable to move or take actions"
    );
    expect(message.content).toContain(
      "open opposed STR roll against 12"
    );
    expect(message.content).toContain(
      "can still parry"
    );
    expect(message.content).toContain(
      "cannot evade"
    );
  });

  test("does not build a message for an unknown effect", () => {
    expect(
      buildCommonAnimalAttackEffectMessage({
        effect: {
          type: "unknown",
        },
        attackerName: ATTACKER,
        targetName: TARGET,
      })
    ).toBeNull();
  });
});

describe("Common Animal attack-effect message planning", () => {
  const effects = [
    {
      type: "lethalPoison",
      potency: 15,
      ruleUuid:
        LETHAL_POISON_RULE_UUID,
    },
  ];

  test("does not plan messages for a failed attack", () => {
    expect(
      planCommonAnimalAttackEffectMessages({
        successful: false,
        effects,
        attackerName: ATTACKER,
        targetNames: [TARGET],
      })
    ).toEqual([]);
  });

  test("plans one informational message per target and supported effect", () => {
    const messages =
      planCommonAnimalAttackEffectMessages({
        successful: true,
        effects: [
          ...effects,
          {
            type: "constrain",
            strength: 12,
          },
          {
            type: "unknown",
          },
        ],
        attackerName: ATTACKER,
        targetNames: [
          "Test Adventurer",
          "Test Knight",
        ],
      });

    expect(messages).toHaveLength(4);
    expect(
      messages.map(message => [
        message.effectType,
        message.targetName,
      ])
    ).toEqual([
      [
        "lethalPoison",
        "Test Adventurer",
      ],
      [
        "constrain",
        "Test Adventurer",
      ],
      [
        "lethalPoison",
        "Test Knight",
      ],
      [
        "constrain",
        "Test Knight",
      ],
    ]);
  });
});
