import { vi } from "vitest";

export function makeCollection(entries = []) {
  const collection = [...entries];
  collection.get = id => collection.find(entry => entry.id === id);
  return collection;
}

export function makeFlagDocument({
  id = "document",
  name = "Document",
  type = "item",
  flags = {},
  ...rest
} = {}) {
  return {
    id,
    name,
    type,
    ...rest,

    getFlag(moduleId, key) {
      return flags[moduleId]?.[key];
    },
  };
}

export function makeActor({
  id = "actor",
  name = "Actor",
  items = [],
  isToken = false,
  owner = true,
} = {}) {
  return {
    id,
    name,
    items,
    isToken,
    documentName: "Actor",
    createEmbeddedDocuments: vi.fn(async () => []),
    deleteEmbeddedDocuments: vi.fn(async () => []),
    updateEmbeddedDocuments: vi.fn(async () => []),
    update: vi.fn(async () => undefined),
    testUserPermission: vi.fn(() => owner),
  };
}

export function makeSpell({
  id = "spell",
  contentKey = "spells.shadowform",
  memorized = false,
  data = {},
} = {}) {
  const flags = {
    "bane-of-azeroth": {
      contentKey,
    },
  };

  return makeFlagDocument({
    id,
    name: "Spell",
    type: "spell",
    flags,
    system: {
      memorized,
    },
    toObject: vi.fn(() => structuredClone({
      _id: id,
      folder: "folder-id",
      ownership: {
        default: 3,
      },
      name: "Spell",
      type: "spell",
      system: {
        memorized,
      },
      flags,
      ...data,
    })),
  });
}

export function makeAbility({
  id = "ability",
  actor = null,
  contentKey = "heroic-class-ability.priest.darkness",
  grantsSpell = "spells.shadowform",
} = {}) {
  return makeFlagDocument({
    id,
    name: "Ability",
    type: "ability",
    parent: actor,
    flags: {
      "bane-of-azeroth": {
        contentKey,
        grantsSpell,
      },
    },
  });
}
