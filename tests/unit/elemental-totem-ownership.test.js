import {
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import {
  getElementalTotemOwnerUserIds,
} from "../../foundry/scripts/elemental-totems/creation.js";

describe("getElementalTotemOwnerUserIds", () => {
  beforeEach(() => {
    game.users = [
      { id: "owner", isGM: false },
      { id: "observer", isGM: false },
      { id: "gm", isGM: true },
    ];
  });

  test("returns non-GM owners of the caster Actor", () => {
    const casterActor = {
      testUserPermission(user, level) {
        expect(level).toBe(
          CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
        );
        return (
          user.id === "owner"
          || user.id === "gm"
        );
      },
    };

    expect(
      getElementalTotemOwnerUserIds(casterActor)
    ).toEqual(["owner"]);
  });

  test("returns an empty list without player owners", () => {
    const casterActor = {
      testUserPermission() {
        return false;
      },
    };

    expect(
      getElementalTotemOwnerUserIds(casterActor)
    ).toEqual([]);
  });
});
