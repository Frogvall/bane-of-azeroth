import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const MODULE_ID = "bane-of-azeroth";
const SOURCE_PATH = resolve(
  "foundry",
  "content",
  "summoned-monsters.json",
);
const ADVENTURE_PATH = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "_Adventure.json",
);
const ADVENTURE_ROOT = dirname(ADVENTURE_PATH);
const DEMON_KEYS = ["felhunter", "imp", "sayaad", "voidwalker"];

function readJson(path) {
  expect(existsSync(path)).toBe(true);
  return JSON.parse(readFileSync(path, "utf-8"));
}

function walkJson(root) {
  const values = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) values.push(...walkJson(path));
    else if (entry.isFile() && entry.name.endsWith(".json")) {
      values.push(readJson(path));
    }
  }
  return values;
}

function byContentKey(contentKey) {
  return walkJson(ADVENTURE_ROOT).find(document => (
    document.flags?.[MODULE_ID]?.contentKey === contentKey
  ));
}

describe("Warlock demon command metadata", () => {
  test.each(DEMON_KEYS)("%s uses the shared 2 WP command", key => {
    const source = readJson(SOURCE_PATH);
    const demon = source.monsters.find(monster => monster.key === key);
    expect(demon.monsterControl).toEqual({
      schemaVersion: 1,
      key,
      attackSelection: { mode: "system-default" },
      command: {
        resource: "willPoints",
        amount: 2,
        payer: "assigned-character",
        freeActionWhenPaid: true,
      },
    });
    expect(demon.attackTable.results).toHaveLength(1);
    expect(
      demon.attackTable.results[0].monsterAttack.resourceCost,
    ).toBeUndefined();
  });

  test.each(DEMON_KEYS)("%s generates command Actor flags", key => {
    const actor = byContentKey(`actors.summoned-monsters.${key}`);
    expect(actor).toBeDefined();
    expect(actor.flags[MODULE_ID].monsterControl.command).toEqual({
      resource: "willPoints",
      amount: 2,
      payer: "assigned-character",
      freeActionWhenPaid: true,
    });
  });
});
