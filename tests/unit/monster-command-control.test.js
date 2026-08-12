import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  getMonsterCommand,
  handleMonsterCommandAttackClick,
  performMonsterCommandAttack,
  promptMonsterCommandAttack,
  shouldBypassMonsterCommandDialog,
} from "../../foundry/scripts/monster-command-control.js";

const MODULE_ID = "bane-of-azeroth";

function flaggedDocument(moduleFlags, extra = {}) {
  return {
    ...extra,
    getFlag: vi.fn((moduleId, key) => (
      moduleId === MODULE_ID ? moduleFlags[key] : undefined
    )),
  };
}

function demonActor(extra = {}) {
  return flaggedDocument(
    {
      monsterControl: {
        schemaVersion: 1,
        key: "imp",
        attackSelection: { mode: "system-default" },
        command: {
          resource: "willPoints",
          amount: 2,
          payer: "assigned-character",
          freeActionWhenPaid: true,
        },
      },
    },
    {
      id: "imp",
      uuid: "Actor.imp",
      name: "Imp",
      type: "monster",
      isOwner: true,
      system: { attackTable: "RollTable.imp" },
      ...extra,
    },
  );
}

function attackResult() {
  return flaggedDocument(
    {
      monsterAttack: {
        schemaVersion: 1,
        key: "firebolt",
      },
    },
    {
      id: "firebolt",
      name: "",
      description: "<b>Firebolt.</b> Hits and inflicts 2D4.",
      range: [1, 1],
    },
  );
}

function table() {
  return { results: [attackResult()] };
}

function character({ wp = 5, isOwner = true } = {}) {
  const actor = {
    id: "warlock",
    uuid: "Actor.warlock",
    name: "Warlock",
    isOwner,
    system: { willPoints: { value: wp } },
    update: vi.fn(async update => {
      actor.system.willPoints.value =
        update["system.willPoints.value"];
    }),
  };
  return actor;
}

function utility({ error = null } = {}) {
  return {
    renderTemplate: vi.fn(async () => "<form></form>"),
    monsterAttack: vi.fn(async () => {
      if (error) throw error;
      return "attack-card";
    }),
  };
}

function dialogChoice(action) {
  return {
    wait: vi.fn(async options => {
      const button = options.buttons.find(item => item.action === action);
      if (!button) return null;
      return button.callback(null, {
        form: {
          elements: {
            selectMonsterAttack: { value: "1" },
          },
        },
      });
    }),
  };
}

beforeEach(() => {
  ui.notifications.warn.mockReset();
  ui.notifications.error.mockReset();
  globalThis.ChatMessage = {
    create: vi.fn(async () => ({
      delete: vi.fn(async () => {}),
    })),
    getSpeaker: vi.fn(() => ({ actor: "warlock" })),
  };
});

describe("monster command metadata", () => {
  test("accepts a valid system-default command", () => {
    expect(getMonsterCommand(demonActor())).toEqual({
      resource: "willPoints",
      amount: 2,
      payer: "assigned-character",
      freeActionWhenPaid: true,
    });
  });

  test("rejects invalid command costs", () => {
    const actor = demonActor();
    actor.getFlag = vi.fn(() => ({
      schemaVersion: 1,
      key: "imp",
      attackSelection: { mode: "system-default" },
      command: {
        resource: "willPoints",
        amount: 0,
        payer: "assigned-character",
        freeActionWhenPaid: true,
      },
    }));
    expect(getMonsterCommand(actor)).toBeNull();
  });
});

describe("monster command dialog", () => {
  test("offers action, WP payment, and cancel", async () => {
    const dialogV2 = {
      wait: vi.fn(async options => {
        expect(options.buttons.map(button => button.action)).toEqual([
          "action",
          "pay",
          "cancel",
        ]);
        expect(
          options.buttons.find(button => button.action === "pay").disabled,
        ).toBe(false);
        return null;
      }),
    };

    await promptMonsterCommandAttack(
      demonActor(),
      table(),
      getMonsterCommand(demonActor()),
      {
        dialogV2,
        user: { isGM: false, character: character() },
        utility: utility(),
      },
    );
  });

  test("disables WP payment when the character has too few WP", async () => {
    const dialogV2 = {
      wait: vi.fn(async options => {
        expect(
          options.buttons.find(button => button.action === "pay").disabled,
        ).toBe(true);
        return null;
      }),
    };

    await promptMonsterCommandAttack(
      demonActor(),
      table(),
      getMonsterCommand(demonActor()),
      {
        dialogV2,
        user: { isGM: false, character: character({ wp: 1 }) },
        utility: utility(),
      },
    );
  });

  test("a GM sees action and cancel but no WP payment", async () => {
    const dialogV2 = {
      wait: vi.fn(async options => {
        expect(options.buttons.map(button => button.action)).toEqual([
          "action",
          "cancel",
        ]);
        return null;
      }),
    };

    await promptMonsterCommandAttack(
      demonActor(),
      table(),
      getMonsterCommand(demonActor()),
      {
        dialogV2,
        user: { isGM: true, character: null },
        utility: utility(),
      },
    );
  });
});

describe("monster command execution", () => {
  test("Use Action attacks without spending WP", async () => {
    const payer = character();
    const runtime = utility();
    const result = await handleMonsterCommandAttackClick(
      demonActor(),
      { shiftKey: false, ctrlKey: false },
      {
        dialogV2: dialogChoice("action"),
        fromUuidSyncFn: () => table(),
        settings: { get: vi.fn(() => true) },
        user: { id: "player", isGM: false, character: payer },
        utility: runtime,
      },
    );

    expect(result).toMatchObject({
      status: "attacked",
      paid: false,
      result: "attack-card",
    });
    expect(payer.update).not.toHaveBeenCalled();
    expect(globalThis.ChatMessage.create).not.toHaveBeenCalled();
  });

  test("Spend 2 WP records payment and attacks", async () => {
    const payer = character();
    const runtime = utility();
    const result = await handleMonsterCommandAttackClick(
      demonActor(),
      { shiftKey: false, ctrlKey: false },
      {
        chatMessageClass: globalThis.ChatMessage,
        dialogV2: dialogChoice("pay"),
        fromUuidSyncFn: () => table(),
        settings: { get: vi.fn(() => true) },
        user: { id: "player", isGM: false, character: payer },
        utility: runtime,
      },
    );

    expect(result).toMatchObject({
      status: "attacked",
      paid: true,
      result: "attack-card",
    });
    expect(payer.update).toHaveBeenCalledWith({
      "system.willPoints.value": 3,
    });
    expect(globalThis.ChatMessage.create).toHaveBeenCalledOnce();
  });

  test("Cancel performs no attack", async () => {
    const runtime = utility();
    const result = await handleMonsterCommandAttackClick(
      demonActor(),
      { shiftKey: false, ctrlKey: false },
      {
        dialogV2: dialogChoice("cancel"),
        fromUuidSyncFn: () => table(),
        settings: { get: vi.fn(() => true) },
        user: { isGM: false, character: character() },
        utility: runtime,
      },
    );

    expect(result).toBeNull();
    expect(runtime.monsterAttack).not.toHaveBeenCalled();
  });

  test("the Dragonbane dialog shortcut assumes action", async () => {
    const payer = character();
    const dialogV2 = { wait: vi.fn() };
    const runtime = utility();
    const result = await handleMonsterCommandAttackClick(
      demonActor(),
      { shiftKey: true, ctrlKey: false },
      {
        dialogV2,
        fromUuidSyncFn: () => table(),
        settings: { get: vi.fn(() => true) },
        user: { isGM: false, character: payer },
        utility: runtime,
      },
    );

    expect(result).toMatchObject({ status: "attacked", paid: false });
    expect(dialogV2.wait).not.toHaveBeenCalled();
    expect(payer.update).not.toHaveBeenCalled();
  });

  test("the inverse Dragonbane preference still treats bypass as action", () => {
    expect(shouldBypassMonsterCommandDialog(
      { shiftKey: false, ctrlKey: false },
      { get: vi.fn(() => false) },
    )).toBe(true);
  });

  test("rolls back payment and chat when Dragonbane throws", async () => {
    const payer = character();
    const message = { delete: vi.fn(async () => {}) };
    globalThis.ChatMessage.create.mockResolvedValueOnce(message);

    await expect(performMonsterCommandAttack(
      {
        actor: demonActor(),
        choice: "pay",
        command: getMonsterCommand(demonActor()),
        table: table(),
        tableResult: attackResult(),
        user: { id: "player", isGM: false, character: payer },
      },
      {
        chatMessageClass: globalThis.ChatMessage,
        utility: utility({ error: new Error("attack failed") }),
      },
    )).rejects.toThrow("attack failed");

    expect(payer.update).toHaveBeenNthCalledWith(1, {
      "system.willPoints.value": 3,
    });
    expect(payer.update).toHaveBeenNthCalledWith(2, {
      "system.willPoints.value": 5,
    });
    expect(message.delete).toHaveBeenCalledOnce();
  });
});
