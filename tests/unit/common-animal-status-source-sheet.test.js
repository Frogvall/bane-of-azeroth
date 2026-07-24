import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import {
  commonAnimalRestrainedSourceName,
  onRenderCommonAnimalRestrainedSource,
} from "../../foundry/scripts/common-animal-status-effects.js";

function makeEffect({
  origin = "Actor.giantSpider",
  statuses = new Set(["restrain"]),
  uuid = "Actor.target.ActiveEffect.restrained",
} = {}) {
  return {
    origin,
    statuses,
    uuid,
  };
}

function makeTarget(effect) {
  return {
    name: "Wind Serpent",
    type: "npc",
    uuid: "Actor.target",
    effects: [effect],
  };
}

beforeEach(() => {
  game.actors = new Map();
  globalThis.fromUuidSync = vi.fn(uuid => {
    if (uuid !== "Actor.giantSpider") {
      return null;
    }
    return {
      name: "Giant Spider",
      uuid,
    };
  });
});

describe("Common Animal Restrained Source presentation", () => {
  test("resolves the attacking Actor from the status origin", () => {
    const effect = makeEffect();
    const target = makeTarget(effect);

    expect(
      commonAnimalRestrainedSourceName(effect, target)
    ).toBe("Giant Spider");
  });

  test("does not rewrite an ordinary target-owned status", () => {
    const effect = makeEffect({
      origin: "Actor.target",
    });
    const target = makeTarget(effect);

    expect(
      commonAnimalRestrainedSourceName(effect, target)
    ).toBeNull();
  });

  test("replaces Dragonbane's target name in the Source cell", () => {
    const effect = makeEffect();
    const target = makeTarget(effect);
    const createdElements = [];
    const sourceCell = {
      ownerDocument: {
        createElement: vi.fn(() => {
          const element = {
            className: "",
            textContent: "",
          };
          createdElements.push(element);
          return element;
        }),
      },
      replaceChildren: vi.fn(),
    };
    const row = {
      dataset: {
        effectUuid: effect.uuid,
      },
      querySelectorAll: vi.fn(selector =>
        selector === "td.text-data"
          ? [{}, sourceCell]
          : []
      ),
    };
    const root = {
      querySelectorAll: vi.fn(selector =>
        selector === "tr.effect[data-effect-uuid]"
          ? [row]
          : []
      ),
    };

    expect(
      onRenderCommonAnimalRestrainedSource(
        { actor: target },
        root
      )
    ).toBe(1);
    expect(sourceCell.replaceChildren).toHaveBeenCalledOnce();
    expect(createdElements[0]).toMatchObject({
      className: "boa-common-animal-status-source",
      textContent: "Giant Spider",
    });
  });
});
