import {
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  calculateTokenDistance,
  chooseTokenPosition,
  drawTokenPlacementPreview,
  getTokenPlacementCandidate,
} from "../../foundry/scripts/core/token-placement.js";

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

function fakeToken(center, width = 1, height = 1) {
  return {
    width,
    height,
    getCenterPoint: vi.fn(() => ({ ...center })),
  };
}

function event(overrides = {}) {
  return {
    button: 0,
    clientX: 60,
    clientY: 40,
    key: "",
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    ...overrides,
  };
}

function harness(distance = 4, inside = true) {
  const viewListeners = new Map();
  const windowListeners = new Map();
  const graphics = {
    beginFill: vi.fn(),
    clear: vi.fn(),
    destroy: vi.fn(),
    drawRect: vi.fn(),
    endFill: vi.fn(),
    lineStyle: vi.fn(),
  };
  const view = {
    style: { cursor: "default" },
    getBoundingClientRect: () => ({
      left: 10,
      top: 20,
      width: 100,
      height: 100,
    }),
    addEventListener: vi.fn((type, fn) => {
      viewListeners.set(type, fn);
    }),
    removeEventListener: vi.fn(type => {
      viewListeners.delete(type);
    }),
  };
  const windowInstance = {
    addEventListener: vi.fn((type, fn) => {
      windowListeners.set(type, fn);
    }),
    removeEventListener: vi.fn(type => {
      windowListeners.delete(type);
    }),
  };
  const scene = {
    id: "scene",
    grid: { size: 100, distance: 2 },
  };
  const originToken = fakeToken({ x: 100, y: 100 });
  const previewToken = {
    width: 0.5,
    height: 0.5,
    getSize: vi.fn(() => ({ width: 50, height: 50 })),
    getSnappedPosition: vi.fn(() => ({ x: 200, y: 300 })),
    updateSource: vi.fn(),
    getCenterPoint: vi.fn(() => ({ x: 225, y: 325 })),
  };
  const canvasInstance = {
    app: {
      canvas: view,
      renderer: { screen: { width: 100, height: 100 } },
    },
    dimensions: {
      sceneRect: { contains: vi.fn(() => inside) },
    },
    grid: {
      measurePath: vi.fn(() => ({ distance })),
    },
    scene,
    stage: {
      addChild: vi.fn(),
      toLocal: vi.fn(value => value),
    },
  };
  class Graphics {
    constructor() {
      return graphics;
    }
  }
  return {
    canvasInstance,
    Graphics,
    graphics,
    originToken,
    previewToken,
    scene,
    view,
    viewListeners,
    windowInstance,
    windowListeners,
  };
}

describe("generic token distance", () => {
  test("measures token edges on the active scene", () => {
    const scene = {
      id: "scene",
      grid: { size: 100, distance: 2 },
    };
    const canvasInstance = {
      scene: { id: "scene" },
      grid: {
        measurePath: vi.fn(() => ({ distance: 7.6 })),
      },
    };

    expect(
      calculateTokenDistance(
        scene,
        fakeToken({ x: 100, y: 100 }, 2, 2),
        fakeToken({ x: 400, y: 100 }, 2, 2),
        { canvasInstance },
      ),
    ).toBe(8);
    expect(canvasInstance.grid.measurePath).toHaveBeenCalledWith([
      { x: 150, y: 100 },
      { x: 350, y: 100 },
    ]);
  });

  test("falls back to grid-scaled Euclidean distance", () => {
    const scene = {
      id: "scene",
      grid: { size: 100, distance: 2 },
    };
    expect(
      calculateTokenDistance(
        scene,
        fakeToken({ x: 0, y: 0 }),
        fakeToken({ x: 300, y: 400 }),
        { canvasInstance: { scene: { id: "other" } } },
      ),
    ).toBe(10);
  });
});

describe("generic token candidate and preview", () => {
  test("centers, snaps, updates, measures, and validates", () => {
    const h = harness();
    const candidate = getTokenPlacementCandidate(event(), {
      scene: h.scene,
      originToken: h.originToken,
      previewToken: h.previewToken,
      maxDistance: 6,
      canvasInstance: h.canvasInstance,
      PointClass: Point,
    });

    expect(h.previewToken.getSnappedPosition).toHaveBeenCalledWith({
      x: 25,
      y: -5,
      width: 0.5,
      height: 0.5,
    });
    expect(h.previewToken.updateSource).toHaveBeenCalledWith({
      x: 200,
      y: 300,
    });
    expect(candidate).toEqual({
      x: 200,
      y: 300,
      width: 50,
      height: 50,
      distance: 4,
      valid: true,
    });
  });

  test("uses the valid color and red when invalid", () => {
    const graphics = {
      beginFill: vi.fn(),
      clear: vi.fn(),
      drawRect: vi.fn(),
      endFill: vi.fn(),
      lineStyle: vi.fn(),
    };
    const candidate = {
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      valid: true,
    };
    drawTokenPlacementPreview(graphics, candidate, "#12ab34");
    expect(graphics.lineStyle).toHaveBeenCalledWith(
      2,
      0x12ab34,
      0.95,
    );

    drawTokenPlacementPreview(
      graphics,
      { ...candidate, valid: false },
      "#12ab34",
    );
    expect(graphics.lineStyle).toHaveBeenLastCalledWith(
      2,
      0xff0000,
      0.95,
    );
  });
});

describe("generic pointer placement", () => {
  test("confirms a valid click and cleans listeners, cursor, and graphics", async () => {
    const h = harness();
    const onPrompt = vi.fn();
    const pending = chooseTokenPosition({
      scene: h.scene,
      originToken: h.originToken,
      previewToken: h.previewToken,
      maxDistance: 6,
      validColor: "#12ab34",
      onPrompt,
      canvasInstance: h.canvasInstance,
      windowInstance: h.windowInstance,
      GraphicsClass: h.Graphics,
      PointClass: Point,
    });

    expect(onPrompt).toHaveBeenCalledOnce();
    expect(h.view.style.cursor).toBe("crosshair");
    h.viewListeners.get("pointerdown")(event());

    await expect(pending).resolves.toEqual({ x: 200, y: 300 });
    expect(h.graphics.destroy).toHaveBeenCalledOnce();
    expect(h.view.style.cursor).toBe("default");
    expect(h.viewListeners.size).toBe(0);
    expect(h.windowListeners.size).toBe(0);
  });

  test("warns on invalid placement, then cancels on Escape", async () => {
    const h = harness(8);
    const onInvalid = vi.fn();
    const pending = chooseTokenPosition({
      scene: h.scene,
      originToken: h.originToken,
      previewToken: h.previewToken,
      maxDistance: 6,
      validColor: "#12ab34",
      onInvalid,
      canvasInstance: h.canvasInstance,
      windowInstance: h.windowInstance,
      GraphicsClass: h.Graphics,
      PointClass: Point,
    });

    h.viewListeners.get("pointerdown")(event());
    expect(onInvalid).toHaveBeenCalledWith(
      expect.objectContaining({ distance: 8, valid: false }),
    );
    expect(h.graphics.destroy).not.toHaveBeenCalled();

    h.windowListeners.get("keydown")(event({ key: "Escape" }));
    await expect(pending).resolves.toBeNull();
    expect(h.graphics.destroy).toHaveBeenCalledOnce();
  });

  test("cancels on right click or active-scene change", async () => {
    const right = harness();
    const rightPending = chooseTokenPosition({
      scene: right.scene,
      originToken: right.originToken,
      previewToken: right.previewToken,
      maxDistance: 6,
      validColor: "#12ab34",
      canvasInstance: right.canvasInstance,
      windowInstance: right.windowInstance,
      GraphicsClass: right.Graphics,
      PointClass: Point,
    });
    right.viewListeners.get("contextmenu")(event({ button: 2 }));
    await expect(rightPending).resolves.toBeNull();

    const changed = harness();
    const changedPending = chooseTokenPosition({
      scene: changed.scene,
      originToken: changed.originToken,
      previewToken: changed.previewToken,
      maxDistance: 6,
      validColor: "#12ab34",
      canvasInstance: changed.canvasInstance,
      windowInstance: changed.windowInstance,
      GraphicsClass: changed.Graphics,
      PointClass: Point,
    });
    changed.canvasInstance.scene = { id: "other" };
    changed.viewListeners.get("pointermove")(event());
    await expect(changedPending).resolves.toBeNull();
  });
});
