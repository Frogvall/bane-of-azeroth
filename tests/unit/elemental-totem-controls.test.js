import {
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import {
  protectElementalTotemMovement,
} from "../../foundry/scripts/elemental-totems.js";

function makeUsers(users) {
  const collection = [...users];
  collection.get = id => (
    collection.find(user => user.id === id) ?? null
  );
  return collection;
}

function makeToken(summonType = "elementalTotem") {
  return {
    flags: {
      "bane-of-azeroth": {
        summonType,
      },
    },
  };
}

describe("protectElementalTotemMovement", () => {
  beforeEach(() => {
    game.users = makeUsers([
      { id: "player", isGM: false },
      { id: "gm", isGM: true },
    ]);
  });

  test("blocks player movement", () => {
    expect(
      protectElementalTotemMovement(
        makeToken(),
        { x: 100, y: 200 },
        {},
        "player"
      )
    ).toBe(false);
  });

  test("allows GM movement", () => {
    expect(
      protectElementalTotemMovement(
        makeToken(),
        { x: 100 },
        {},
        "gm"
      )
    ).toBeUndefined();
  });

  test("allows non-position updates", () => {
    expect(
      protectElementalTotemMovement(
        makeToken(),
        { hidden: true },
        {},
        "player"
      )
    ).toBeUndefined();
  });

  test("does not affect ordinary tokens", () => {
    expect(
      protectElementalTotemMovement(
        makeToken("ordinaryToken"),
        { x: 100 },
        {},
        "player"
      )
    ).toBeUndefined();
  });
});
