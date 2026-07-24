import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  configureMonsterAttackDialog,
  getFallbackMonsterAttack,
  getMonsterAttackMetadata,
  getMonsterAttackSelection,
  getMonsterControl,
  getOrderedMonsterAttacks,
  handleControlledMonsterAttackClick,
  isManualOnlyMonster,
  onRenderControlledMonsterSheet,
  performControlledMonsterAttack,
  promptMonsterAttackResourceCost,
  promptMonsterAttackSelection,
  shouldUseFallbackMonsterAttack,
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

function attackResult({ id, name = "", description, key, resourceCost, range }) {
  return flaggedDocument(
    {
      monsterAttack: {
        schemaVersion: 1,
        key,
        ...(resourceCost ? { resourceCost } : {}),
      },
    },
    { id, name, description, range },
  );
}

function ghoulActor(extra = {}) {
  return flaggedDocument(
    {
      monsterControl: {
        schemaVersion: 1,
        key: "ghoul",
        attackSelection: {
          mode: "manual",
          fallbackAttackKey: "claws",
        },
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
  description: "<b>Claws.</b> Hits automatically and inflicts D6.",
  key: "claws",
  range: [1, 1],
});

const bite = () => attackResult({
  id: "bite",
  description: "<b>Infectious Bite.</b> Hits automatically and inflicts 2D6.",
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

function settingsWithDialogDefault(value) {
  return {
    get: vi.fn((namespace, key) => {
      expect(namespace).toBe("dragonbane");
      expect(key).toBe("monsterAttackDialogIsDefault");
      return value;
    }),
  };
}

beforeEach(() => {
  ui.notifications.warn.mockReset();
  ui.notifications.error.mockReset();
  CONFIG.DoD ??= {};
  CONFIG.DoD.TextEditor ??= {};
  CONFIG.DoD.TextEditor.enrichHTML = vi.fn(async value => value);
});

describe("monster attack metadata", () => {
  test("reads versioned actor and attack metadata", () => {
    const actor = ghoulActor();
    const result = bite();
    expect(getMonsterControl(actor)).toMatchObject({
      schemaVersion: 1,
      key: "ghoul",
    });
    expect(getMonsterAttackSelection(actor)).toEqual({
      mode: "manual",
      fallbackAttackKey: "claws",
    });
    expect(getMonsterAttackMetadata(result)).toMatchObject({
      schemaVersion: 1,
      key: "infectious-bite",
      resourceCost: { amount: 2 },
    });
    expect(isManualOnlyMonster(actor)).toBe(true);
  });

  test("rejects non-object attack-selection metadata", () => {
    const actor = flaggedDocument({
      monsterControl: {
        schemaVersion: 1,
        key: "ghoul",
        attackSelection: "manual",
      },
    });
    expect(getMonsterControl(actor)).toBeNull();
    expect(getMonsterAttackSelection(actor)).toBeNull();
    expect(isManualOnlyMonster(actor)).toBe(false);
  });

  test("rejects unsupported metadata versions", () => {
    const actor = flaggedDocument({
      monsterControl: {
        schemaVersion: 2,
        key: "ghoul",
        attackSelection: {
          mode: "manual",
          fallbackAttackKey: "claws",
        },
      },
    });
    expect(getMonsterControl(actor)).toBeNull();
    expect(isManualOnlyMonster(actor)).toBe(false);
  });

  test("orders only flagged attacks and resolves the configured fallback", () => {
    const unflagged = { id: "other", range: [1, 1] };
    const table = { results: [bite(), unflagged, claws()] };
    expect(getOrderedMonsterAttacks(table).map(result => result.id)).toEqual([
      "claws",
      "bite",
    ]);
    expect(getFallbackMonsterAttack(ghoulActor(), table)?.id).toBe("claws");
  });
});

describe("native Dragonbane attack selection", () => {
  test("uses Dragonbane's template, removes Random, and defaults to Claws", async () => {
    const randomOption = { value: "0", remove: vi.fn() };
    const clawsOption = { value: "1", remove: vi.fn() };
    let changeListener;
    const selectEl = {
      value: "0",
      options: [randomOption, clawsOption, { value: "2", remove: vi.fn() }],
      addEventListener: vi.fn((name, listener) => {
        expect(name).toBe("change");
        changeListener = listener;
      }),
    };
    const description = { innerHTML: "" };
    const dialog = {
      element: {
        querySelector: vi.fn(selector => (
          selector.startsWith("select") ? selectEl : description
        )),
      },
    };
    const utility = {
      renderTemplate: vi.fn(async (template, data) => {
        expect(template).toBe(
          "systems/dragonbane/templates/partials/monster-attack-dialog.hbs",
        );
        expect(data.attacks.map(attack => attack.name)).toEqual([
          "Claws.",
          "Infectious Bite.",
        ]);
        expect(data.attacks[0].description.trim()).toBe(
          "Hits automatically and inflicts D6.",
        );
        return "<form class='DoD dialog'>native-template</form>";
      }),
    };
    const dialogV2 = {
      wait: vi.fn(async config => {
        expect(config.window.title).toBe(
          "DoD.ui.dialog.monsterAttackTitle",
        );
        expect(config.content).toContain("native-template");
        expect(config.buttons).toHaveLength(1);
        expect(config.buttons[0].label).toBe("Confirm");
        config.render({}, dialog);
        expect(randomOption.remove).toHaveBeenCalledOnce();
        expect(selectEl.value).toBe("1");
        expect(description.innerHTML).toContain("inflicts D6");
        selectEl.value = "2";
        changeListener();
        expect(description.innerHTML).toContain("inflicts 2D6");
        return config.buttons[0].callback(null, {
          form: { elements: { selectMonsterAttack: { value: "2" } } },
        });
      }),
    };

    const selected = await promptMonsterAttackSelection(
      ghoulActor(),
      { results: [claws(), bite()] },
      { dialogV2, utility },
    );
    expect(selected.id).toBe("bite");
  });

  test("a Random or invalid confirmation defensively resolves to Claws", async () => {
    const utility = { renderTemplate: vi.fn(async () => "native") };
    const dialogV2 = { wait: vi.fn(async () => "0") };
    const selected = await promptMonsterAttackSelection(
      ghoulActor(),
      { results: [claws(), bite()] },
      { dialogV2, utility },
    );
    expect(selected.id).toBe("claws");
  });

  test("closing the native dialog cancels the attack", async () => {
    const utility = { renderTemplate: vi.fn(async () => "native") };
    const dialogV2 = { wait: vi.fn(async () => null) };
    await expect(promptMonsterAttackSelection(
      ghoulActor(),
      { results: [claws(), bite()] },
      { dialogV2, utility },
    )).resolves.toBeNull();
  });

  test("normal random-attack shortcuts are mapped to the fallback", () => {
    const defaultDialog = settingsWithDialogDefault(true);
    expect(shouldUseFallbackMonsterAttack(
      { shiftKey: true, ctrlKey: false },
      defaultDialog,
    )).toBe(true);
    expect(shouldUseFallbackMonsterAttack(
      { shiftKey: false, ctrlKey: false },
      defaultDialog,
    )).toBe(false);

    const defaultRandom = settingsWithDialogDefault(false);
    expect(shouldUseFallbackMonsterAttack(
      { shiftKey: false, ctrlKey: false },
      defaultRandom,
    )).toBe(true);
    expect(shouldUseFallbackMonsterAttack(
      { shiftKey: true, ctrlKey: false },
      defaultRandom,
    )).toBe(false);
  });

  test("a bypassed attack calls Dragonbane with Claws, never a random draw", async () => {
    const table = { results: [claws(), bite()] };
    const utility = {
      monsterAttack: vi.fn(async () => "attack-card"),
      renderTemplate: vi.fn(),
    };
    await handleControlledMonsterAttackClick(
      ghoulActor(),
      { shiftKey: true, ctrlKey: false },
      {
        dialogV2: { wait: vi.fn() },
        fromUuidSyncFn: vi.fn(() => table),
        settings: settingsWithDialogDefault(true),
        user: { isGM: true },
        utility,
      },
    );
    expect(utility.renderTemplate).not.toHaveBeenCalled();
    expect(utility.monsterAttack).toHaveBeenCalledWith(
      expect.anything(),
      table,
      expect.objectContaining({ id: "claws" }),
    );
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
  test("attaches a capture listener only to owned manual monsters", () => {
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