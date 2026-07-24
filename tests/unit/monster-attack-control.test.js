import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  getMonsterAttackMetadata,
  getMonsterControl,
  getOrderedMonsterAttacks,
  isManualOnlyMonster,
  onRenderControlledMonsterSheet,
  performControlledMonsterAttack,
  promptMonsterAttackResourceCost,
  promptMonsterAttackSelection,
} from "../../foundry/scripts/monster-attack-control.js";

const MODULE_ID = "bane-of-azeroth";

function flaggedDocument(moduleFlags, extra = {}) {
  return {
    ...extra,
    getFlag: vi.fn((moduleId, key) => (
      moduleId === MODULE_ID ? moduleFlags[key] : undefined
    )),
  };
}

function attackResult({ id, name, key, resourceCost, range }) {
  return flaggedDocument(
    {
      monsterAttack: {
        schemaVersion: 1,
        key,
        ...(resourceCost ? { resourceCost } : {}),
      },
    },
    { id, name, range },
  );
}

function ghoulActor(extra = {}) {
  return flaggedDocument(
    {
      monsterControl: {
        schemaVersion: 1,
        key: "ghoul",
        attackSelection: "manual-only",
      },
    },
    {
      id: "ghoul-actor",
      uuid: "Actor.ghoul-actor",
      name: "Ghoul",
      type: "monster",
      isOwner: true,
      system: { attackTable: "RollTable.ghoul-attacks" },
      ...extra,
    },
  );
}

const claws = () => attackResult({
  id: "claws",
  name: "Claws",
  key: "claws",
  range: [1, 1],
});

const bite = () => attackResult({
  id: "bite",
  name: "Infectious Bite",
  key: "infectious-bite",
  range: [2, 2],
  resourceCost: {
    resource: "willPoints",
    amount: 2,
    payer: "assigned-character",
    prompt: true,
    allowUnpaid: true,
  },
});

function assignedCharacter({ wp = 5, isOwner = true } = {}) {
  const actor = {
    name: "Death Knight",
    isOwner,
    system: { willPoints: { value: wp } },
    update: vi.fn(async update => {
      actor.system.willPoints.value = update["system.willPoints.value"];
    }),
  };
  return actor;
}

beforeEach(() => {
  ui.notifications.warn.mockReset();
  ui.notifications.error.mockReset();
});

describe("monster attack metadata", () => {
  test("reads versioned actor and attack metadata", () => {
    const actor = ghoulActor();
    const result = bite();
    expect(getMonsterControl(actor)).toMatchObject({
      schemaVersion: 1,
      key: "ghoul",
      attackSelection: "manual-only",
    });
    expect(getMonsterAttackMetadata(result)).toMatchObject({
      schemaVersion: 1,
      key: "infectious-bite",
      resourceCost: { amount: 2 },
    });
    expect(isManualOnlyMonster(actor)).toBe(true);
  });

  test("rejects unsupported metadata versions", () => {
    const actor = flaggedDocument({
      monsterControl: {
        schemaVersion: 2,
        key: "ghoul",
        attackSelection: "manual-only",
      },
    });
    expect(getMonsterControl(actor)).toBeNull();
    expect(isManualOnlyMonster(actor)).toBe(false);
  });

  test("orders only flagged attacks by table range", () => {
    const unflagged = { id: "other", range: [1, 1] };
    const table = { results: [bite(), unflagged, claws()] };
    expect(getOrderedMonsterAttacks(table).map(result => result.id)).toEqual([
      "claws",
      "bite",
    ]);
  });
});

describe("manual-only attack selection", () => {
  test("offers only named attacks and Cancel, never Random", async () => {
    const dialogV2 = { wait: vi.fn(async config => {
      expect(config.buttons.map(button => button.label)).toEqual([
        "Claws",
        "Infectious Bite",
        "BOA.dialog.monsterAttackCancel",
      ]);
      expect(config.buttons.map(button => button.label)).not.toContain("Random");
      return "bite";
    }) };
    const selected = await promptMonsterAttackSelection(
      ghoulActor(),
      { results: [claws(), bite()] },
      { dialogV2 },
    );
    expect(selected.id).toBe("bite");
  });

  test("closing or cancelling the selection returns no attack", async () => {
    const dialogV2 = { wait: vi.fn(async () => null) };
    await expect(promptMonsterAttackSelection(
      ghoulActor(),
      { results: [claws(), bite()] },
      { dialogV2 },
    )).resolves.toBeNull();
  });
});

describe("assigned-character WP payment", () => {
  test("Yes spends 2 WP and performs Infectious Bite", async () => {
    const payer = assignedCharacter({ wp: 5 });
    const utility = { monsterAttack: vi.fn(async () => "attack-card") };
    const dialogV2 = { wait: vi.fn(async () => "pay") };
    const result = await performControlledMonsterAttack(
      {
        actor: ghoulActor(),
        table: {},
        tableResult: bite(),
        user: { isGM: false, character: payer },
      },
      { dialogV2, utility },
    );
    expect(payer.update).toHaveBeenCalledWith({
      "system.willPoints.value": 3,
    });
    expect(utility.monsterAttack).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ status: "attacked", paid: true });
  });

  test("No performs the attack without spending WP", async () => {
    const payer = assignedCharacter({ wp: 5 });
    const utility = { monsterAttack: vi.fn(async () => "attack-card") };
    const dialogV2 = { wait: vi.fn(async () => "unpaid") };
    const result = await performControlledMonsterAttack(
      {
        actor: ghoulActor(),
        table: {},
        tableResult: bite(),
        user: { isGM: false, character: payer },
      },
      { dialogV2, utility },
    );
    expect(payer.update).not.toHaveBeenCalled();
    expect(utility.monsterAttack).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ status: "attacked", paid: false });
  });

  test("Cancel stops the attack", async () => {
    const payer = assignedCharacter({ wp: 5 });
    const utility = { monsterAttack: vi.fn() };
    const dialogV2 = { wait: vi.fn(async () => null) };
    const result = await performControlledMonsterAttack(
      {
        actor: ghoulActor(),
        table: {},
        tableResult: bite(),
        user: { isGM: false, character: payer },
      },
      { dialogV2, utility },
    );
    expect(payer.update).not.toHaveBeenCalled();
    expect(utility.monsterAttack).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "cancelled", paid: false });
  });

  test("the Yes button is disabled when the character lacks 2 WP", async () => {
    const dialogV2 = { wait: vi.fn(async config => {
      expect(config.buttons.find(button => button.action === "pay").disabled)
        .toBe(true);
      expect(config.buttons.find(button => button.action === "unpaid").disabled)
        .toBe(false);
      return "unpaid";
    }) };
    await promptMonsterAttackResourceCost(
      {
        attackName: "Infectious Bite",
        character: assignedCharacter({ wp: 1 }),
        resourceCost: bite().getFlag(MODULE_ID, "monsterAttack").resourceCost,
      },
      { dialogV2 },
    );
  });

  test("a GM performs Infectious Bite without a WP prompt", async () => {
    const utility = { monsterAttack: vi.fn(async () => "attack-card") };
    const dialogV2 = { wait: vi.fn() };
    await performControlledMonsterAttack(
      {
        actor: ghoulActor(),
        table: {},
        tableResult: bite(),
        user: { isGM: true, character: null },
      },
      { dialogV2, utility },
    );
    expect(dialogV2.wait).not.toHaveBeenCalled();
    expect(utility.monsterAttack).toHaveBeenCalledOnce();
  });

  test("Claws never prompts for WP", async () => {
    const payer = assignedCharacter({ wp: 5 });
    const utility = { monsterAttack: vi.fn(async () => "attack-card") };
    const dialogV2 = { wait: vi.fn() };
    await performControlledMonsterAttack(
      {
        actor: ghoulActor(),
        table: {},
        tableResult: claws(),
        user: { isGM: false, character: payer },
      },
      { dialogV2, utility },
    );
    expect(dialogV2.wait).not.toHaveBeenCalled();
    expect(payer.update).not.toHaveBeenCalled();
    expect(utility.monsterAttack).toHaveBeenCalledOnce();
  });

  test("a missing assigned character warns and continues unpaid", async () => {
    const utility = { monsterAttack: vi.fn(async () => "attack-card") };
    await performControlledMonsterAttack(
      {
        actor: ghoulActor(),
        table: {},
        tableResult: bite(),
        user: { isGM: false, character: null },
      },
      { dialogV2: { wait: vi.fn() }, utility },
    );
    expect(ui.notifications.warn).toHaveBeenCalledOnce();
    expect(utility.monsterAttack).toHaveBeenCalledOnce();
  });

  test("refunds WP if Dragonbane's attack call throws", async () => {
    const payer = assignedCharacter({ wp: 5 });
    const utility = { monsterAttack: vi.fn(async () => {
      throw new Error("boom");
    }) };
    await expect(performControlledMonsterAttack(
      {
        actor: ghoulActor(),
        table: {},
        tableResult: bite(),
        user: { isGM: false, character: payer },
      },
      { dialogV2: { wait: vi.fn(async () => "pay") }, utility },
    )).rejects.toThrow("boom");
    expect(payer.update).toHaveBeenNthCalledWith(1, {
      "system.willPoints.value": 3,
    });
    expect(payer.update).toHaveBeenNthCalledWith(2, {
      "system.willPoints.value": 5,
    });
  });
});

describe("monster sheet integration", () => {
  test("attaches a capture listener only to owned manual-only monsters", () => {
    const button = { addEventListener: vi.fn() };
    const html = { querySelectorAll: vi.fn(() => [button]) };
    onRenderControlledMonsterSheet({ actor: ghoulActor() }, html);
    expect(button.addEventListener).toHaveBeenCalledWith(
      "click",
      expect.any(Function),
      { capture: true },
    );
  });

  test("does not intercept an ordinary monster", () => {
    const button = { addEventListener: vi.fn() };
    const html = { querySelectorAll: vi.fn(() => [button]) };
    const actor = flaggedDocument({}, {
      type: "monster",
      isOwner: true,
    });
    onRenderControlledMonsterSheet({ actor }, html);
    expect(button.addEventListener).not.toHaveBeenCalled();
  });
});
