import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  deletePreviousWarlockDemons,
  deleteWarlockDemonsForCaster,
  getWarlockDemonOwnerUserIds,
} from "../../foundry/scripts/warlock-demons.js";

function collection(values) {
  const map = new Map(
    values.map(value => [
      value.id,
      value,
    ]),
  );
  map.find = predicate =>
    values.find(predicate);
  map.filter = predicate =>
    values.filter(predicate);
  map.map = callback =>
    values.map(callback);
  map[Symbol.iterator] =
    function iterator() {
      return map.values();
    };
  return map;
}

describe("Warlock demon summoning lifecycle", () => {
  test("propagates caster ownership to non-GM owners", () => {
    const owner = {
      id: "owner",
      isGM: false,
    };
    const observer = {
      id: "observer",
      isGM: false,
    };
    const gm = {
      id: "gm",
      isGM: true,
    };
    game.users = collection([
      owner,
      observer,
      gm,
    ]);

    const caster = {
      testUserPermission: vi.fn(
        user => user.id === "owner",
      ),
    };

    expect(
      getWarlockDemonOwnerUserIds(caster),
    ).toEqual(["owner"]);
  });

  test("recast removes only previous demons for the same caster", async () => {
    const scene = {
      id: "scene",
      name: "Scene",
      tokens: collection([
        {
          id: "old",
          flags: {
            "bane-of-azeroth": {
              summonType: "warlock-demon",
              casterActorUuid: "Actor.caster",
              summonId: "old-summon",
            },
          },
        },
        {
          id: "current",
          flags: {
            "bane-of-azeroth": {
              summonType: "warlock-demon",
              casterActorUuid: "Actor.caster",
              summonId: "current-summon",
            },
          },
        },
        {
          id: "other",
          flags: {
            "bane-of-azeroth": {
              summonType: "warlock-demon",
              casterActorUuid: "Actor.other",
              summonId: "old-summon",
            },
          },
        },
      ]),
      deleteEmbeddedDocuments:
        vi.fn(async () => undefined),
    };
    game.scenes = collection([scene]);

    await deletePreviousWarlockDemons(
      "Actor.caster",
      "current-summon",
    );

    expect(
      scene.deleteEmbeddedDocuments,
    ).toHaveBeenCalledWith(
      "Token",
      ["old"],
    );
  });

  test("shift cleanup removes every demon for the caster", async () => {
    const scene = {
      id: "scene",
      name: "Scene",
      tokens: collection([
        {
          id: "first",
          flags: {
            "bane-of-azeroth": {
              summonType: "warlock-demon",
              casterActorUuid: "Actor.caster",
            },
          },
        },
        {
          id: "second",
          flags: {
            "bane-of-azeroth": {
              summonType: "warlock-demon",
              casterActorUuid: "Actor.caster",
            },
          },
        },
      ]),
      deleteEmbeddedDocuments:
        vi.fn(async () => undefined),
    };
    game.scenes = collection([scene]);

    await expect(
      deleteWarlockDemonsForCaster(
        "Actor.caster",
      ),
    ).resolves.toEqual({
      deletedCount: 2,
      failedScenes: [],
    });
  });

});
