import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  dirname,
  relative,
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
const GENERATOR_NAME = "tools/generate-summoned-monsters.py";
const CONTENT_SOURCE = resolve(
  "foundry",
  "content",
  "summoned-monsters.json",
);
const GENERATOR = resolve(
  "tools",
  "generate-summoned-monsters.py",
);
const WORKFLOW = resolve(
  ".github",
  "workflows",
  "build-foundry.yml",
);
const GENERATOR_CHECKER = resolve(
  "tools",
  "check-foundry-generators.py",
);
const ADVENTURE_SOURCE = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "_Adventure.json",
);
const ADVENTURE_DIRECTORY = dirname(ADVENTURE_SOURCE);
const ID_PATTERN = /^[A-Za-z0-9]{16}$/;

function requireJson(path) {
  expect(existsSync(path)).toBe(true);
  return JSON.parse(readFileSync(path, "utf-8"));
}

function walkJsonFiles(root) {
  if (!existsSync(root)) {
    return [];
  }
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsonFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(path);
    }
  }
  return files.sort();
}

function documentEntries() {
  return walkJsonFiles(ADVENTURE_DIRECTORY).map(path => ({
    document: JSON.parse(readFileSync(path, "utf-8")),
    path,
  }));
}

function moduleFlags(document) {
  return document?.flags?.[MODULE_ID] ?? {};
}

function entryByContentKey(contentKey) {
  return documentEntries().find(
    ({ document }) => moduleFlags(document).contentKey === contentKey,
  );
}

function folderById(folderId) {
  return documentEntries().find(
    ({ document, path }) => (
      path.endsWith("_Folder.json") && document._id === folderId
    ),
  );
}

function collectIds(source) {
  const ids = [source.actorRoot?.id];
  for (const folder of Object.values(source.actorFolders ?? {})) {
    ids.push(folder?.id);
  }
  for (const folder of Object.values(source.tableFolders ?? {})) {
    ids.push(folder?.id);
  }
  for (const monster of source.monsters ?? []) {
    ids.push(monster?.id, monster?.attackTable?.id);
    for (const result of monster?.attackTable?.results ?? []) {
      ids.push(result?.id);
    }
  }
  return ids;
}

describe("Summoned monster source contract", () => {
  test("defines Ghoul and Warlock demon content with deterministic IDs", () => {
    const source = requireJson(CONTENT_SOURCE);
    expect(source.schemaVersion).toBe(1);
    expect(source.expectedCount).toBe(5);
    expect(source.actorRoot).toMatchObject({
      id: "BoAActors7pQ2mX9",
      name: "Bane of Azeroth",
      color: "#0000ff",
    });
    expect(source.actorFolders.undead).toMatchObject({
      name: "Undead",
      color: null,
    });
    expect(source.tableFolders.root).toMatchObject({
      name: "Bane of Azeroth",
      color: "#0000ff",
    });
    expect(source.tableFolders.monsterAttacks).toMatchObject({
      name: "Monster Attacks",
      color: null,
    });
    expect(source.monsters).toHaveLength(5);
    expect(source.monsters[0]).toMatchObject({
      key: "ghoul",
      name: "Ghoul",
      category: "undead",
      summonType: "ghoul",
      image: "modules/bane-of-azeroth/assets/actors/undead/ghoul.webp",
      tokenImage: "modules/bane-of-azeroth/assets/tokens/undead/ghoul-token.webp",
      movement: 8,
      hitPoints: 10,
      armor: 0,
      ferocity: 1,
      size: "normal",
      attackTable: {
        name: "Monster Attacks – Ghoul",
        formula: "1d2",
      },
    });

    const ids = collectIds(source);
    for (const id of ids) {
      expect(id).toMatch(ID_PATTERN);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("ships Ghoul portrait and token artwork", () => {
    const portrait = resolve(
      "foundry",
      "assets",
      "actors",
      "undead",
      "ghoul.webp",
    );
    const token = resolve(
      "foundry",
      "assets",
      "tokens",
      "undead",
      "ghoul-token.webp",
    );

    expect(existsSync(portrait)).toBe(true);
    expect(existsSync(token)).toBe(true);
    expect(statSync(portrait).isFile()).toBe(true);
    expect(statSync(token).isFile()).toBe(true);
    expect(statSync(portrait).size).toBeGreaterThan(0);
    expect(statSync(token).size).toBeGreaterThan(0);
  });

  test("is covered by the central GitHub Actions generator check", () => {
    expect(existsSync(GENERATOR)).toBe(true);
    expect(
      statSync(GENERATOR).isFile()
    ).toBe(true);
    expect(
      existsSync(GENERATOR_CHECKER)
    ).toBe(true);
    expect(
      statSync(GENERATOR_CHECKER).isFile()
    ).toBe(true);

    const workflow = readFileSync(
      WORKFLOW,
      "utf-8",
    );
    const checker = readFileSync(
      GENERATOR_CHECKER,
      "utf-8",
    );

    expect(workflow).toContain(
      "python3 tools/check-foundry-generators.py",
    );
    expect(checker).toContain(
      'glob("generate-*.py")',
    );
    expect(checker).toContain(
      '"--check"',
    );
    expect(GENERATOR_NAME).toMatch(
      /^tools\/generate-.+\.py$/,
    );
  });
});

describe("Generated Ghoul content", () => {
  test("uses the requested Actor and Roll Table folder hierarchy", () => {
    const source = requireJson(CONTENT_SOURCE);
    const actorRoot = folderById(source.actorRoot.id);
    const undead = entryByContentKey("actors.folder.undead");
    const tableRoot = entryByContentKey("tables.folder.bane-of-azeroth");
    const monsterAttacks = entryByContentKey(
      "tables.folder.monster-attacks",
    );

    expect(actorRoot).toBeDefined();
    expect(actorRoot.document).toMatchObject({
      type: "Actor",
      folder: null,
      name: "Bane of Azeroth",
      color: "#0000ff",
    });
    expect(undead).toBeDefined();
    expect(undead.document).toMatchObject({
      type: "Actor",
      folder: source.actorRoot.id,
      name: "Undead",
      color: null,
    });
    expect(tableRoot).toBeDefined();
    expect(tableRoot.document).toMatchObject({
      type: "RollTable",
      folder: null,
      name: "Bane of Azeroth",
      color: "#0000ff",
    });
    expect(monsterAttacks).toBeDefined();
    expect(monsterAttacks.document).toMatchObject({
      type: "RollTable",
      folder: source.tableFolders.root.id,
      name: "Monster Attacks",
      color: null,
    });
  });

  test("generates the Ghoul as a core-style monster Actor", () => {
    const source = requireJson(CONTENT_SOURCE);
    const ghoulSource = source.monsters[0];
    const entry = entryByContentKey("actors.summoned-monsters.ghoul");
    expect(entry).toBeDefined();
    const actor = entry.document;

    expect(actor).toMatchObject({
      _id: ghoulSource.id,
      folder: source.actorFolders.undead.id,
      name: "Ghoul",
      type: "monster",
      img: "modules/bane-of-azeroth/assets/actors/undead/ghoul.webp",
      system: {
        description: "",
        movement: { base: 8, value: 8 },
        hitPoints: { base: 10, max: 10, value: 10 },
        armor: 0,
        ferocity: { base: 1, value: 1 },
        size: "normal",
        attackTable: `RollTable.${ghoulSource.attackTable.id}`,
        previousMonsterAttack: "",
      },
      prototypeToken: {
        texture: {
          src: "modules/bane-of-azeroth/assets/tokens/undead/ghoul-token.webp",
        },
        actorLink: false,
        disposition: 1,
        lockRotation: true,
        width: 1,
        height: 1,
        bar1: { attribute: "hitPoints" },
      },
      items: [],
      effects: [],
      ownership: { default: 0 },
    });
    expect(moduleFlags(actor)).toMatchObject({
      generatedBy: GENERATOR_NAME,
      contentKey: "actors.summoned-monsters.ghoul",
      summonType: "ghoul",
    });
    expect(actor.prototypeToken.flags[MODULE_ID]).toMatchObject({
      summonType: "ghoul",
      sourceActorContentKey: "actors.summoned-monsters.ghoul",
    });

    const traits = String(actor.system.traits ?? "");
    for (const snippet of [
      "Cannot Heal",
      "cannot heal HP",
      "Resistance",
      "piercing damage is halved",
      "Immunity",
      "immune to fear and PERSUASION",
      "Vulnerable Neck",
      "immediately severs its head",
    ]) {
      expect(traits).toContain(snippet);
    }
  });

  test("generates a flat Monster Attacks table with both attacks", () => {
    const source = requireJson(CONTENT_SOURCE);
    const ghoulSource = source.monsters[0];
    const entry = entryByContentKey("tables.monster-attacks.ghoul");
    expect(entry).toBeDefined();
    const table = entry.document;

    expect(table).toMatchObject({
      _id: ghoulSource.attackTable.id,
      name: "Monster Attacks – Ghoul",
      folder: source.tableFolders.monsterAttacks.id,
      formula: "1d2",
      replacement: true,
      displayRoll: false,
      img: "systems/dragonbane/art/icons/monster-attack.webp",
      ownership: { default: 0 },
    });
    expect(moduleFlags(table)).toMatchObject({
      generatedBy: GENERATOR_NAME,
      contentKey: "tables.monster-attacks.ghoul",
    });
    expect(table.results).toHaveLength(2);
    expect(table.results.map(result => result.range)).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(table.results[0].description).toContain("<b>Claws.</b>");
    expect(table.results[0].description).toContain("[[/damage D6]]");
    expect(table.results[0].description).toContain("slashing damage");
    expect(table.results[1].description).toContain(
      "<b>Infectious Bite.</b>",
    );
    expect(table.results[1].description).toContain("[[/damage 2D6]]");
    expect(table.results[1].description).toContain("piercing damage");
    expect(table.results[1].description).toContain(
      "bane on its next attack or spell roll",
    );
    expect(table.results[1].description).toContain(
      "Costs 2 WP, paid by the Death Knight",
    );
  });

  test("includes every generated document in the Adventure", () => {
    const adventure = requireJson(ADVENTURE_SOURCE);
    const requiredEntries = [
      entryByContentKey("actors.folder.undead"),
      entryByContentKey("actors.summoned-monsters.ghoul"),
      entryByContentKey("tables.folder.bane-of-azeroth"),
      entryByContentKey("tables.folder.monster-attacks"),
      entryByContentKey("tables.monster-attacks.ghoul"),
    ];
    for (const entry of requiredEntries) {
      expect(entry).toBeDefined();
      const path = relative(ADVENTURE_DIRECTORY, entry.path)
        .replaceAll("\\", "/");
      if (entry.document.type === "Actor") {
        if (entry.path.endsWith("_Folder.json")) {
          expect(adventure.folders).toContain(path);
        } else {
          expect(adventure.actors).toContain(path);
        }
      } else if (entry.document.type === "RollTable") {
        if (entry.path.endsWith("_Folder.json")) {
          expect(adventure.folders).toContain(path);
        } else {
          expect(adventure.tables).toContain(path);
        }
      }
    }
  });
});

describe("Generated Ghoul monster attack control metadata", () => {
  test("declares manual-only attack selection and versioned attack policies", () => {
    const source = requireJson(CONTENT_SOURCE);
    const ghoul = source.monsters.find(monster => monster.key === "ghoul");
    expect(ghoul.monsterControl).toEqual({
      schemaVersion: 1,
      key: "ghoul",
      attackSelection: {
        mode: "manual",
        fallbackAttackKey: "claws",
      },
    });
    expect(ghoul.attackTable.results).toMatchObject([
      {
        name: "Claws",
        monsterAttack: {
          schemaVersion: 1,
          key: "claws",
        },
      },
      {
        name: "Infectious Bite",
        monsterAttack: {
          schemaVersion: 1,
          key: "infectious-bite",
          resourceCost: {
            resource: "willPoints",
            amount: 2,
            payer: "assigned-character",
            prompt: true,
            allowUnpaid: true,
          },
        },
      },
    ]);
  });

  test("generates the policies as Foundry flags", () => {
    const actorEntry = entryByContentKey("actors.summoned-monsters.ghoul");
    const tableEntry = entryByContentKey("tables.monster-attacks.ghoul");
    expect(moduleFlags(actorEntry.document).monsterControl).toEqual({
      schemaVersion: 1,
      key: "ghoul",
      attackSelection: {
        mode: "manual",
        fallbackAttackKey: "claws",
      },
    });
    expect(tableEntry.document.results.map(result => ({
      name: result.name,
      metadata: result.flags?.[MODULE_ID]?.monsterAttack,
    }))).toEqual([
      {
        name: "",
        metadata: {
          schemaVersion: 1,
          key: "claws",
        },
      },
      {
        name: "",
        metadata: {
          schemaVersion: 1,
          key: "infectious-bite",
          resourceCost: {
            resource: "willPoints",
            amount: 2,
            payer: "assigned-character",
            prompt: true,
            allowUnpaid: true,
          },
        },
      },
    ]);
  });
});

