import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  drawElementalTotemAura,
  onDeleteElementalTotemAura,
  onUpdateElementalTotemAura,
} from "../../foundry/scripts/elemental-totems/aura.js";

const OriginalGraphics = globalThis.PIXI.Graphics;
const OriginalRequestAnimationFrame =
  globalThis.requestAnimationFrame;
const OriginalCanvasScene = globalThis.canvas.scene;

class FoundryCompatibleGraphics {
  constructor() {
    this.destroyed = false;
    this._eventMode = "auto";
    this._interactive = false;
  }

  get eventMode() {
    return this._eventMode;
  }

  set eventMode(value) {
    this._eventMode = value;
  }

  get interactive() {
    return this._interactive;
  }

  set interactive(value) {
    this._interactive = Boolean(value);

    /*
     * Foundry's compatibility property maps the legacy
     * interactive value back onto eventMode.
     */
    this._eventMode = value ? "static" : "auto";
  }

  lineStyle() {
    return this;
  }

  beginFill() {
    return this;
  }

  drawCircle() {
    return this;
  }

  endFill() {
    return this;
  }

  destroy() {
    this.destroyed = true;
  }
}

function makeAuraToken({
  sceneId = "scene-1",
} = {}) {
  const children = [];
  const scene = {
    id: sceneId,
    grid: {
      distance: 2,
      size: 100,
    },
  };

  const document = {
    flags: {
      "bane-of-azeroth": {
        auraAlpha: 0.2,
        auraColor: "#00ff00",
        auraRange: 6,
        summonType: "elementalTotem",
      },
    },
    object: null,
    parent: scene,
  };

  const token = {
    addChildAt: vi.fn((graphics, index) => {
      children.splice(index, 0, graphics);
      return graphics;
    }),
    destroyed: false,
    document,
    h: 50,
    scene,
    w: 50,
  };

  document.object = token;

  return {
    children,
    document,
    scene,
    token,
  };
}

describe("Elemental Totem aura lifecycle", () => {
  beforeEach(() => {
    globalThis.PIXI.Graphics =
      FoundryCompatibleGraphics;
    globalThis.requestAnimationFrame =
      vi.fn(callback => {
        callback();
        return 1;
      });
    globalThis.canvas.scene = null;
  });

  afterEach(() => {
    globalThis.PIXI.Graphics = OriginalGraphics;
    globalThis.requestAnimationFrame =
      OriginalRequestAnimationFrame;
    globalThis.canvas.scene = OriginalCanvasScene;
  });

  test("leaves aura graphics fully non-interactive", () => {
    const {
      children,
      scene,
      token,
    } = makeAuraToken();
    canvas.scene = scene;

    drawElementalTotemAura(token);

    expect(children[0]).toMatchObject({
      eventMode: "none",
      interactive: false,
    });
  });

  test("redraws after an active-scene token update", () => {
    const {
      children,
      document,
      scene,
      token,
    } = makeAuraToken();
    canvas.scene = scene;

    drawElementalTotemAura(token);
    const firstGraphics = children[0];

    onUpdateElementalTotemAura(
      document,
      {
        x: 100,
      },
      {},
      "test-user"
    );

    expect(requestAnimationFrame)
      .toHaveBeenCalledOnce();
    expect(firstGraphics.destroyed).toBe(true);
    expect(children[0]).not.toBe(firstGraphics);
    expect(children[0].destroyed).toBe(false);
  });

  test("does not redraw an inactive-scene token", () => {
    const {
      children,
      document,
      scene,
      token,
    } = makeAuraToken();
    canvas.scene = scene;

    drawElementalTotemAura(token);
    const firstGraphics = children[0];

    requestAnimationFrame.mockClear();
    canvas.scene = {
      id: "different-scene",
    };

    onUpdateElementalTotemAura(
      document,
      {
        x: 100,
      },
      {},
      "test-user"
    );

    expect(requestAnimationFrame)
      .not.toHaveBeenCalled();
    expect(firstGraphics.destroyed).toBe(false);
  });

  test("destroys aura graphics when deleted", () => {
    const {
      children,
      document,
      scene,
      token,
    } = makeAuraToken();
    canvas.scene = scene;

    drawElementalTotemAura(token);
    const graphics = children[0];

    onDeleteElementalTotemAura(
      document,
      {},
      "test-user"
    );

    expect(graphics.destroyed).toBe(true);
  });
});
