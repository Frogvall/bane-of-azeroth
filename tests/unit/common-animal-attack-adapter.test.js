import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import * as attackEffects from "../../foundry/scripts/common-animal-attack-effects.js";
import {
  makeActor,
  makeFlagDocument,
} from "../helpers/documents.js";

const MODULE_ID = "bane-of-azeroth";

const onRollDamageMessage =
  attackEffects.onCommonAnimalRollDamageChatMessage;

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

function makeWeapon({
  name = "Bite",
  effects = [],
} = {}) {
  return makeFlagDocument({
    id: `weapon-${
      name.toLowerCase()
    }`,
    name,
    type: "weapon",
    flags: {
      [MODULE_ID]: {
        attackEffects: effects,
      },
    },
  });
}

function makeTarget(
  name = "Test"
) {
  return makeActor({
    id: `actor-${
      name.toLowerCase()
        .replaceAll(" ", "-")
    }`,
    name,
  });
}

function makeRollDamageMessage({
  actor = makeActor({
    id: "large-serpent",
    name: "Large Serpent",
  }),
  weapon = makeWeapon({
    effects: [
      {
        type: "lethalPoison",
        potency: 15,
        ruleUuid:
          attackEffects
            .LETHAL_POISON_RULE_UUID,
      },
    ],
  }),
  targetActor = makeTarget(),
  type = "rollDamage",
  content = DAMAGE_CONTENT,
} = {}) {
  const message = {
    id: "roll-damage-message",
    type,
    content,
    speaker: {
      alias: actor.name,
    },
    system: {
      toContext: vi.fn(() => ({
        actor,
        weapon,
        targetActor,
      })),
    },
    update: vi.fn(
      async changes => {
        Object.assign(
          message,
          changes
        );
        return message;
      }
    ),
  };

  return message;
}

test("exports the rollDamage ChatMessage handler", () => {
  expect(onRollDamageMessage).toEqual(
    expect.any(Function)
  );
});

describe.skipIf(
  typeof onRollDamageMessage !== "function"
)("onCommonAnimalRollDamageChatMessage", () => {
  beforeEach(() => {
    game.user.id =
      "originating-user";
  });

  test("enriches the same targeted Bite damage card", async () => {
    const message =
      makeRollDamageMessage();

    const result =
      await onRollDamageMessage(
        message,
        {},
        "originating-user"
      );

    expect(message.update)
      .toHaveBeenCalledOnce();
    expect(message.update)
      .toHaveBeenCalledWith({
        content:
          expect.stringContaining(
            "Large Serpent exposes Test"
          ),
      });
    expect(message.content).toContain(
      "Large Serpent inflicts 11 points Damage"
    );
    expect(message.content).toContain(
      "Large Serpent exposes Test"
    );
    expect(message.content).toContain(
      "potency of 15"
    );
    expect(message.content).toContain(
      '<div class="dice-formula">2d6</div>'
    );
    expect(message.content).toContain(
      '<button data-action="dealDamage">'
    );
    expect(message.speaker.alias).toBe(
      "Large Serpent"
    );
    expect(result).toBe(message);
  });

  test("enriches untargeted damage with the target placeholder", async () => {
    const message =
      makeRollDamageMessage({
        targetActor: null,
        content: DAMAGE_CONTENT
          .replace(
            " on Test",
            ""
          ),
      });

    await onRollDamageMessage(
      message,
      {},
      "originating-user"
    );

    expect(message.content).toContain(
      "Large Serpent exposes the target"
    );
    expect(message.update)
      .toHaveBeenCalledOnce();
  });

  test("enriches Constriction in the same damage card", async () => {
    const message =
      makeRollDamageMessage({
        weapon: makeWeapon({
          name: "Constriction",
          effects: [
            {
              type: "restrain",
              strength: 12,
            },
          ],
        }),
        content: DAMAGE_CONTENT
          .replace(
            "Bite",
            "Constriction"
          ),
      });

    await onRollDamageMessage(
      message,
      {},
      "originating-user"
    );

    expect(message.content).toContain(
      "Large Serpent restrains Test"
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

  test.each([
    {
      label:
        "another client's message",
      message:
        makeRollDamageMessage(),
      userId: "another-user",
    },
    {
      label:
        "a non-rollDamage message",
      message:
        makeRollDamageMessage({
          type: "weaponTest",
        }),
      userId: "originating-user",
    },
    {
      label:
        "a weapon without attack effects",
      message:
        makeRollDamageMessage({
          weapon: makeWeapon({
            effects: [],
          }),
        }),
      userId: "originating-user",
    },
  ])("does not update $label", async ({
    message,
    userId,
  }) => {
    const originalContent =
      message.content;

    const result =
      await onRollDamageMessage(
        message,
        {},
        userId
      );

    expect(message.update)
      .not.toHaveBeenCalled();
    expect(message.content)
      .toBe(originalContent);
    expect(result).toBe(message);
  });

  test("does not enrich the same damage card twice", async () => {
    const message =
      makeRollDamageMessage();

    await onRollDamageMessage(
      message,
      {},
      "originating-user"
    );
    await onRollDamageMessage(
      message,
      {},
      "originating-user"
    );

    expect(message.update)
      .toHaveBeenCalledOnce();
    expect(
      message.content.match(
        /exposes Test/g
      )
    ).toHaveLength(1);
  });

  test("reads weapon effects through the module flag API", async () => {
    const weapon = makeWeapon({
      effects: [
        {
          type: "lethalPoison",
          potency: 15,
        },
      ],
    });
    const getFlag = vi.spyOn(
      weapon,
      "getFlag"
    );
    const message =
      makeRollDamageMessage({
        weapon,
      });

    await onRollDamageMessage(
      message,
      {},
      "originating-user"
    );

    expect(getFlag).toHaveBeenCalledWith(
      MODULE_ID,
      "attackEffects"
    );
  });
});
