import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  isWarlockDemonPositionEmpty,
} from "../../foundry/scripts/warlock-demons.js";
import {
  getTokenPlacementCandidate,
} from "../../foundry/scripts/core/token-placement.js";

function collection(values) {
  const map = new Map(
    values.map(value => [
      value.id,
      value,
    ]),
  );
  map[Symbol.iterator] =
    function iterator() {
      return map.values();
    };
  return map;
}

describe("Warlock demon empty-space placement", () => {
  test("rejects overlap and accepts touching edges", () => {
    const scene = {
      grid: {
        size: 100,
      },
      tokens: collection([
        {
          id: "occupied",
          x: 100,
          y: 100,
          width: 1,
          height: 1,
        },
      ]),
    };

    expect(
      isWarlockDemonPositionEmpty(
        scene,
        {
          x: 150,
          y: 150,
          width: 50,
          height: 50,
        },
      ),
    ).toBe(false);

    expect(
      isWarlockDemonPositionEmpty(
        scene,
        {
          x: 200,
          y: 100,
          width: 50,
          height: 50,
        },
      ),
    ).toBe(true);
  });

  test("generic placement preserves an extra invalid reason", () => {
    class Point {
      constructor(x, y) {
        this.x = x;
        this.y = y;
      }
    }

    const previewToken = {
      width: 0.5,
      height: 0.5,
      getSize: () => ({
        width: 50,
        height: 50,
      }),
      getSnappedPosition: () => ({
        x: 100,
        y: 100,
      }),
      updateSource: vi.fn(),
      getCenterPoint: () => ({
        x: 125,
        y: 125,
      }),
    };
    const originToken = {
      width: 1,
      height: 1,
      getCenterPoint: () => ({
        x: 0,
        y: 0,
      }),
    };
    const scene = {
      id: "scene-1",
      grid: {
        size: 100,
        distance: 2,
      },
    };
    const canvasInstance = {
      app: {
        canvas: {
          getBoundingClientRect: () => ({
            left: 0,
            top: 0,
            width: 100,
            height: 100,
          }),
        },
        renderer: {
          screen: {
            width: 100,
            height: 100,
          },
        },
      },
      stage: {
        toLocal: value => value,
      },
      scene,
      grid: {
        measurePath: () => ({
          distance: 2,
        }),
      },
      dimensions: {
        sceneRect: {
          contains: () => true,
        },
      },
    };

    const candidate =
      getTokenPlacementCandidate(
        {
          clientX: 50,
          clientY: 50,
        },
        {
          scene,
          originToken,
          previewToken,
          maxDistance: 10,
          validateCandidate: () => ({
            valid: false,
            invalidReason: "occupied",
          }),
          canvasInstance,
          PointClass: Point,
        },
      );

    expect(candidate.valid).toBe(false);
    expect(candidate.invalidReason)
      .toBe("occupied");
  });
});
