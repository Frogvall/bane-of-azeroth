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

const processAttackResult =
  attackEffects.processCommonAnimalAttackResult;
const onWeaponTestMessage =
  attackEffects.onCommonAnimalWeaponTestChatMessage;

function makeWeapon({
  name = "Bite",
  effects = [],
} = {}) {
  return makeFlagDocument({
    id: `weapon-${name.toLowerCase()}`,
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
  name = "Test Adventurer"
) {
  return makeActor({
    id: `actor-${name.toLowerCase().replaceAll(" ", "-")}`,
    name,
  });
}

function makeWeaponTestMessage({
  success = true,
  actor = makeActor({
    id: "large-serpent",
    name: "Large Serpent",
  }),
  weapon = makeWeapon(),
  targetActor = makeTarget(),
  type = "weaponTest",
} = {}) {
  return {
    type,
    system: {
      toContext: vi.fn(() => ({
        actor,
        weapon,
        targetActor,
        success,
      })),
    },
  };
}

test("exports the Common Animal attack-result integration functions", () => {
  expect(processAttackResult).toEqual(
    expect.any(Function)
  );
  expect(onWeaponTestMessage).toEqual(
    expect.any(Function)
  );
});

describe.skipIf(
  typeof processAttackResult !== "function"
)("processCommonAnimalAttackResult", () => {
  let createChatMessage;

  beforeEach(() => {
    createChatMessage = vi.fn(
      async data => ({
        id: `message-${createChatMessage.mock.calls.length}`,
        ...data,
      })
    );
  });

  test("creates one informational ChatMessage for a successful supported effect", async () => {
    const attacker = makeActor({
      id: "large-serpent",
      name: "Large Serpent",
    });
    const target = makeTarget();
    const weapon = makeWeapon({
      effects: [
        {
          type: "lethalPoison",
          potency: 15,
          ruleUuid:
            attackEffects.LETHAL_POISON_RULE_UUID,
        },
      ],
    });

    const messages = await processAttackResult({
      successful: true,
      attackerActor: attacker,
      weaponItem: weapon,
      targets: [target],
      createChatMessage,
    });

    expect(messages).toHaveLength(1);
    expect(createChatMessage).toHaveBeenCalledOnce();
    expect(createChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        user: game.user.id,
        content: expect.stringContaining(
          "Lethal Poison"
        ),
      })
    );
    expect(
      createChatMessage.mock.calls[0][0].content
    ).toContain("potency of 15");
    expect(
      createChatMessage.mock.calls[0][0].content
    ).toContain(target.name);
  });

  test("creates one message per target and supported effect", async () => {
    const targets = [
      makeTarget("Test Adventurer"),
      makeTarget("Test Knight"),
    ];
    const weapon = makeWeapon({
      effects: [
        {
          type: "lethalPoison",
          potency: 15,
        },
        {
          type: "constrain",
          strength: 12,
        },
        {
          type: "unknown",
        },
      ],
    });

    const messages = await processAttackResult({
      successful: true,
      attackerActor: makeActor({
        name: "Large Serpent",
      }),
      weaponItem: weapon,
      targets,
      createChatMessage,
    });

    expect(messages).toHaveLength(4);
    expect(createChatMessage).toHaveBeenCalledTimes(4);
    expect(
      createChatMessage.mock.calls.map(
        ([data]) => data.content
      )
    ).toEqual([
      expect.stringContaining("Test Adventurer"),
      expect.stringContaining("Test Adventurer"),
      expect.stringContaining("Test Knight"),
      expect.stringContaining("Test Knight"),
    ]);
  });

  test.each([
    {
      label: "failed attack",
      successful: false,
      targets: [makeTarget()],
      effects: [
        {
          type: "lethalPoison",
          potency: 15,
        },
      ],
    },
    {
      label: "missing targets",
      successful: true,
      targets: [],
      effects: [
        {
          type: "lethalPoison",
          potency: 15,
        },
      ],
    },
    {
      label: "missing effects",
      successful: true,
      targets: [makeTarget()],
      effects: [],
    },
  ])("creates nothing for $label", async ({
    successful,
    targets,
    effects,
  }) => {
    const messages = await processAttackResult({
      successful,
      attackerActor: makeActor({
        name: "Large Serpent",
      }),
      weaponItem: makeWeapon({ effects }),
      targets,
      createChatMessage,
    });

    expect(messages).toEqual([]);
    expect(createChatMessage).not.toHaveBeenCalled();
  });

  test("reads attackEffects through the module flag API", async () => {
    const weapon = makeWeapon({
      effects: [
        {
          type: "constrain",
          strength: 12,
        },
      ],
    });
    const getFlag = vi.spyOn(
      weapon,
      "getFlag"
    );

    await processAttackResult({
      successful: true,
      attackerActor: makeActor({
        name: "Large Serpent",
      }),
      weaponItem: weapon,
      targets: [makeTarget()],
      createChatMessage,
    });

    expect(getFlag).toHaveBeenCalledWith(
      MODULE_ID,
      "attackEffects"
    );
  });
});

describe.skipIf(
  typeof onWeaponTestMessage !== "function"
)("onCommonAnimalWeaponTestChatMessage", () => {
  beforeEach(() => {
    game.user.id = "originating-user";
    game.user.targets = new Set();
  });

  test("normalizes a successful Dragonbane weaponTest message", async () => {
    const message = makeWeaponTestMessage();
    const process = vi.fn(
      async () => []
    );

    await onWeaponTestMessage(
      message,
      {},
      "originating-user",
      {
        processAttackResult: process,
      }
    );

    const context =
      message.system.toContext.mock.results[0].value;

    expect(process).toHaveBeenCalledOnce();
    expect(process).toHaveBeenCalledWith({
      successful: true,
      attackerActor: context.actor,
      weaponItem: context.weapon,
      targets: [context.targetActor],
    });
  });

  test("uses current user targets when Dragonbane has no targetActor", async () => {
    const first = makeTarget("Test Adventurer");
    const second = makeTarget("Test Knight");
    game.user.targets = new Set([
      { actor: first },
      { actor: second },
    ]);
    const message = makeWeaponTestMessage({
      targetActor: null,
    });
    const process = vi.fn(
      async () => []
    );

    await onWeaponTestMessage(
      message,
      {},
      "originating-user",
      {
        processAttackResult: process,
      }
    );

    expect(process).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [first, second],
      })
    );
  });

  test.each([
    {
      label: "another client's message",
      message: makeWeaponTestMessage(),
      userId: "another-user",
    },
    {
      label: "a non-weapon message",
      message: makeWeaponTestMessage({
        type: "skillTest",
      }),
      userId: "originating-user",
    },
  ])("ignores $label", async ({
    message,
    userId,
  }) => {
    const process = vi.fn(
      async () => []
    );

    await onWeaponTestMessage(
      message,
      {},
      userId,
      {
        processAttackResult: process,
      }
    );

    expect(process).not.toHaveBeenCalled();
  });
});
