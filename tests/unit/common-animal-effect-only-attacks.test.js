import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  isCommonAnimalEffectOnlyWeapon,
  onCreateCommonAnimalEffectOnlyWeaponTestMessage,
  onPreCreateCommonAnimalEffectOnlyWeaponTestMessage,
  onRenderCommonAnimalEffectOnlyActorSheet,
  onUpdateCommonAnimalEffectOnlyWeaponTestMessage,
  removeCommonAnimalEffectOnlyDamageButton,
  removeEmptyDamageParenthesesAfterWeaponElement,
} from "../../foundry/scripts/common-animal-effect-only-attacks.js";

const MODULE_ID = "bane-of-azeroth";

function makeWeapon({
  effectOnly = true,
  damage = "",
  effects = [
    {
      type: "constrain",
      strength: 10,
    },
  ],
} = {}) {
  return {
    id: "7f3911408969d5d6",
    name: "Web Spray",
    type: "weapon",
    system: {
      damage,
    },
    getFlag(moduleId, key) {
      if (moduleId !== MODULE_ID) {
        return undefined;
      }

      if (key === "effectOnly") {
        return effectOnly;
      }

      if (key === "attackEffects") {
        return effects;
      }

      return undefined;
    },
  };
}

function makeMessage({
  success = true,
  type = "weaponTest",
  content = [
    "<p><strong>",
    "Giant Spider succeeds using Web Spray on Test.",
    "</strong></p>",
    '<button data-action="critical">',
    "Critical Hit",
    "</button>",
  ].join(""),
  weapon = makeWeapon(),
} = {}) {
  const context = {
    success,
    actor: {
      name: "Giant Spider",
    },
    targetActor: {
      name: "Test",
    },
    weapon,
  };
  const message = {
    type,
    content,
    system: {
      isDamaging: true,
      toContext: vi.fn(
        () => context
      ),
    },
    updateSource: vi.fn(
      changes => {
        Object.assign(
          message.system,
          changes.system ?? {}
        );
      }
    ),
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

describe("Common Animal effect-only weapon classification", () => {
  test("requires the explicit flag, empty damage, and attack effects", () => {
    expect(
      isCommonAnimalEffectOnlyWeapon(
        makeWeapon()
      )
    ).toBe(true);
    expect(
      isCommonAnimalEffectOnlyWeapon(
        makeWeapon({
          effectOnly: false,
        })
      )
    ).toBe(false);
    expect(
      isCommonAnimalEffectOnlyWeapon(
        makeWeapon({
          damage: "D4",
        })
      )
    ).toBe(false);
    expect(
      isCommonAnimalEffectOnlyWeapon(
        makeWeapon({
          effects: [],
        })
      )
    ).toBe(false);
  });
});

describe("Common Animal effect-only weaponTest messages", () => {
  beforeEach(() => {
    game.user.id = "originating-user";
  });

  test("marks Web Spray as non-damaging before message creation", () => {
    const message = makeMessage();

    onPreCreateCommonAnimalEffectOnlyWeaponTestMessage(
      message,
      {
        type: "weaponTest",
      },
      {},
      "originating-user"
    );

    expect(
      message.updateSource
    ).toHaveBeenCalledWith({
      system: {
        isDamaging: false,
      },
    });
    expect(
      message.system.isDamaging
    ).toBe(false);
  });

  test("automatically enriches a successful Web Spray card", async () => {
    const message = makeMessage({
      content: [
        "<p><strong>",
        "Giant Spider succeeds using Web Spray on Test.",
        "</strong></p>",
        '<button class="chat-button weapon-roll" ',
        'data-action="rollWeaponDamage">',
        "Roll Damage",
        "</button>",
      ].join(""),
    });

    await onCreateCommonAnimalEffectOnlyWeaponTestMessage(
      message,
      {},
      "originating-user"
    );

    expect(
      message.update
    ).toHaveBeenCalledOnce();
    expect(message.content).toContain(
      "Giant Spider constrains Test"
    );
    expect(message.content).toContain(
      "open opposed STR roll against 10"
    );
    expect(message.content).not.toContain(
      "rollWeaponDamage"
    );
    expect(message.content).not.toContain(
      "Roll Damage"
    );
  });

  test("preserves the Critical Hit button on a dragon result", async () => {
    const message = makeMessage();

    await onCreateCommonAnimalEffectOnlyWeaponTestMessage(
      message,
      {},
      "originating-user"
    );

    expect(message.content).toContain(
      "Critical Hit"
    );
    expect(message.content).toContain(
      'data-action="critical"'
    );
  });

  test("removes only Dragonbane's weapon-damage action button", () => {
    const content = [
      "<p>Result</p>",
      '<button data-action="rollWeaponDamage">',
      "Roll Damage",
      "</button>",
      '<button data-action="other">',
      "Other",
      "</button>",
    ].join("");

    expect(
      removeCommonAnimalEffectOnlyDamageButton(
        content
      )
    ).not.toContain(
      "rollWeaponDamage"
    );
    expect(
      removeCommonAnimalEffectOnlyDamageButton(
        content
      )
    ).toContain(
      'data-action="other"'
    );
  });

  test.each([
    {
      label: "failed attack",
      message: makeMessage({
        success: false,
      }),
      userId: "originating-user",
    },
    {
      label: "another client",
      message: makeMessage(),
      userId: "another-user",
    },
    {
      label: "damaging attack",
      message: makeMessage({
        weapon: makeWeapon({
          effectOnly: false,
          damage: "D4",
        }),
      }),
      userId: "originating-user",
    },
  ])("does not enrich $label", async ({
    message,
    userId,
  }) => {
    await onCreateCommonAnimalEffectOnlyWeaponTestMessage(
      message,
      {},
      userId
    );

    expect(
      message.update
    ).not.toHaveBeenCalled();
  });

  test("restores the effect after Dragonbane rebuilds a critical card", async () => {
    const message = makeMessage({
      content: [
        "<p><strong>",
        "Giant Spider succeeds with a Dragon using Web Spray on Test.",
        "</strong></p>",
        "<p>Critical Hit: Extra Attack</p>",
      ].join(""),
    });

    await onUpdateCommonAnimalEffectOnlyWeaponTestMessage(
      message,
      {
        system: {
          criticalEffect:
            "extraAttack",
        },
      },
      {},
      "originating-user"
    );

    expect(message.content).toContain(
      "Critical Hit: Extra Attack"
    );
    expect(message.content).toContain(
      "Giant Spider constrains Test"
    );
  });

  test("does not duplicate the effect during recursive message updates", async () => {
    const message = makeMessage();

    await onCreateCommonAnimalEffectOnlyWeaponTestMessage(
      message,
      {},
      "originating-user"
    );
    await onUpdateCommonAnimalEffectOnlyWeaponTestMessage(
      message,
      {
        content: message.content,
      },
      {},
      "originating-user"
    );

    expect(
      message.update
    ).toHaveBeenCalledOnce();
    expect(
      message.content.match(
        /Giant Spider constrains Test/g
      )
    ).toHaveLength(1);
  });
});

describe("Common Animal effect-only NPC sheet presentation", () => {
  test("removes only an empty damage parenthesis text node", () => {
    const textNode = {
      nodeType: 3,
      textContent: " (), ",
      nextSibling: null,
    };
    const element = {
      nextSibling: textNode,
    };

    expect(
      removeEmptyDamageParenthesesAfterWeaponElement(
        element
      )
    ).toBe(true);
    expect(
      textNode.textContent
    ).toBe(", ");
  });

  test("leaves a real damage formula untouched", () => {
    const textNode = {
      nodeType: 3,
      textContent: " (D4), ",
      nextSibling: null,
    };

    expect(
      removeEmptyDamageParenthesesAfterWeaponElement({
        nextSibling: textNode,
      })
    ).toBe(false);
    expect(
      textNode.textContent
    ).toBe(" (D4), ");
  });

  test("cleans the rendered Web Spray summary for an NPC", () => {
    const textNode = {
      nodeType: 3,
      textContent: " ()",
      nextSibling: null,
    };
    const link = {
      nextSibling: textNode,
      matches: vi.fn(
        selector =>
          selector === "a"
      ),
    };
    const root = {
      querySelectorAll: vi.fn(
        () => [link]
      ),
    };
    const actor = {
      type: "npc",
      items: [
        makeWeapon(),
      ],
    };

    expect(
      onRenderCommonAnimalEffectOnlyActorSheet(
        {
          actor,
        },
        root
      )
    ).toBe(1);
    expect(
      textNode.textContent
    ).toBe("");
  });
});
