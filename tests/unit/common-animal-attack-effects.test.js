import {
  describe,
  expect,
  test,
  beforeEach,
  vi,
} from "vitest";

import * as attackEffects from "../../foundry/scripts/common-animal-attack-effects.js";

const buildEffectText =
  attackEffects.buildCommonAnimalAttackEffectText;
const appendEffectsToDamageContent =
  attackEffects.appendCommonAnimalAttackEffectsToDamageContent;

const ATTACKER = "Large Serpent";
const TARGET = "Test";

const DAMAGE_CONTENT = [
  "<p><strong>",
  "Large Serpent inflicts 11 points Damage ",
  "on Test using Bite.",
  "</strong></p>",
  '<div class="dice-roll">',
  '<div class="dice-formula">2d6</div>',
  '<div class="dice-total">11</div>',
  "</div>",
  '<button data-action="dealDamage">',
  "Deal damage",
  "</button>",
].join("");

const POISON_EFFECT = {
  type: "lethalPoison",
  potency: 15,
  ruleUuid:
    attackEffects.LETHAL_POISON_RULE_UUID,
};

const RESTRAIN_EFFECT = {
  type: "restrain",
  strength: 12,
};

test("uses Dragonbane's lethal-poison journal anchor", () => {
  expect(
    attackEffects.LETHAL_POISON_RULE_UUID
  ).toBe(
    "JournalEntry.SbbSMsuvWeo3HaID." +
    "JournalEntryPage.6WPxPxUjh4W80RNy#poison"
  );
});

test("exports damage-card effect text helpers", () => {
  expect(buildEffectText).toEqual(
    expect.any(Function)
  );
  expect(
    appendEffectsToDamageContent
  ).toEqual(expect.any(Function));
});

describe.skipIf(
  typeof buildEffectText !== "function" ||
  typeof appendEffectsToDamageContent !==
    "function"
)("Common Animal rollDamage effect text", () => {
  test("builds targeted lethal-poison text without a separate heading", () => {
    const text = buildEffectText({
      effect: POISON_EFFECT,
      attackerName: ATTACKER,
      targetName: TARGET,
    });

    expect(text).toBe(
      `${ATTACKER} exposes ${TARGET} to ` +
      `@UUID[${
        attackEffects.LETHAL_POISON_RULE_UUID
      }]{lethal poison} with a potency of 15, ` +
      "as if the poison had been ingested."
    );
    expect(text).not.toContain(
      "Lethal Poison:"
    );
    expect(text).not.toContain("<p>");
  });

  test("uses the target placeholder for untargeted poison damage", () => {
    const text = buildEffectText({
      effect: POISON_EFFECT,
      attackerName: ATTACKER,
      targetName: null,
    });

    expect(text).toContain(
      `${ATTACKER} exposes the target`
    );
    expect(text).toContain(
      "potency of 15"
    );
  });

  test("builds targeted restrain text", () => {
    const text = buildEffectText({
      effect: RESTRAIN_EFFECT,
      attackerName: ATTACKER,
      targetName: TARGET,
    });

    expect(text).toBe(
      `${ATTACKER} restrains ${TARGET}. ` +
      `${TARGET} is unable to move or take actions ` +
      "other than trying to escape with an open " +
      "opposed STR roll against 12. " +
      `${TARGET} can still parry while restrained, ` +
      "but cannot evade."
    );
  });

  test("appends effect text inside the existing damage paragraph", () => {
    const content =
      appendEffectsToDamageContent({
        content: DAMAGE_CONTENT,
        effects: [POISON_EFFECT],
        attackerName: ATTACKER,
        targetName: TARGET,
      });

    expect(content).toContain(
      "using Bite.</strong> " +
      `${ATTACKER} exposes ${TARGET}`
    );
    expect(content.indexOf(
      `${ATTACKER} exposes ${TARGET}`
    )).toBeLessThan(
      content.indexOf(
        '<div class="dice-roll">'
      )
    );
    expect(content).toContain(
      '<div class="dice-formula">2d6</div>'
    );
    expect(content).toContain(
      '<div class="dice-total">11</div>'
    );
    expect(content).toContain(
      '<button data-action="dealDamage">'
    );
  });

  test("appends supported effects once and in source order", () => {
    const once =
      appendEffectsToDamageContent({
        content: DAMAGE_CONTENT,
        effects: [
          POISON_EFFECT,
          {
            type: "unknown",
          },
          RESTRAIN_EFFECT,
        ],
        attackerName: ATTACKER,
        targetName: TARGET,
      });
    const twice =
      appendEffectsToDamageContent({
        content: once,
        effects: [
          POISON_EFFECT,
          RESTRAIN_EFFECT,
        ],
        attackerName: ATTACKER,
        targetName: TARGET,
      });

    expect(
      once.indexOf("exposes Test")
    ).toBeLessThan(
      once.indexOf("restrains Test")
    );
    expect(twice).toBe(once);
    expect(
      twice.match(/exposes Test/g)
    ).toHaveLength(1);
    expect(
      twice.match(/restrains Test/g)
    ).toHaveLength(1);
  });

  test("leaves damage content unchanged when no supported effect exists", () => {
    expect(
      appendEffectsToDamageContent({
        content: DAMAGE_CONTENT,
        effects: [
          {
            type: "unknown",
          },
        ],
        attackerName: ATTACKER,
        targetName: TARGET,
      })
    ).toBe(DAMAGE_CONTENT);
  });
});

describe("Common Animal rollDamage Restrained status", () => {
  beforeEach(() => {
    game.user.id = "originating-user";
  });

  test("applies Restrained from a targeted Constriction damage card", async () => {
    const targetActor = {
      name: TARGET,
      uuid: "Actor.target",
    };
    const weapon = {
      getFlag(moduleId, key) {
        if (
          moduleId === "bane-of-azeroth" &&
          key === "attackEffects"
        ) {
          return [RESTRAIN_EFFECT];
        }
        return undefined;
      },
    };
    const context = {
      actor: { name: ATTACKER },
      targetActor,
      weapon,
    };
    const message = {
      type: "rollDamage",
      content: DAMAGE_CONTENT,
      system: {
        toContext: vi.fn(() => context),
      },
      update: vi.fn(async changes => {
        Object.assign(message, changes);
        return message;
      }),
    };
    const applyAttackStatuses = vi.fn(async () => []);

    await attackEffects.onCommonAnimalRollDamageChatMessage(
      message,
      {},
      "originating-user",
      { applyAttackStatuses }
    );

    expect(applyAttackStatuses).toHaveBeenCalledOnce();
    expect(applyAttackStatuses).toHaveBeenCalledWith({
      effects: [RESTRAIN_EFFECT],
      targets: [targetActor],
    });
  });
});
