import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const CORE = resolve(
  "foundry",
  "scripts",
  "core",
  "token-placement.js",
);
const ADAPTER = resolve(
  "foundry",
  "scripts",
  "elemental-totems",
  "placement.js",
);
const WORKFLOW = resolve(
  "foundry",
  "scripts",
  "elemental-totems",
  "workflow.js",
);
const MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-elemental-totems.js",
);

function read(path) {
  return readFileSync(path, "utf-8");
}

describe("token-placement refactor", () => {
  test("moves canvas interaction into the core module", () => {
    const core = read(CORE);
    for (const marker of [
      "calculateTokenDistance",
      "getTokenPlacementCandidate",
      "drawTokenPlacementPreview",
      "chooseTokenPosition",
      '"pointermove"',
      '"pointerdown"',
      '"contextmenu"',
      '"keydown"',
      "getSnappedPosition",
      "measurePath",
    ]) {
      expect(core).toContain(marker);
    }
  });

  test("keeps Elemental Totem as a thin adapter", () => {
    const adapter = read(ADAPTER);
    expect(adapter).toContain(
      'from "../core/token-placement.js"',
    );
    expect(adapter).toContain("chooseTokenPosition");
    expect(adapter).toContain(
      "calculateElementalTotemDistance =",
    );
    expect(adapter).toContain(
      "BOA.dialog.elementalTotem.placementPrompt",
    );
    expect(adapter).toContain(
      "BOA.dialog.elementalTotem.placementOutOfRange",
    );
    for (const removed of [
      "new PIXI.Graphics",
      'addEventListener("pointermove"',
      'addEventListener("pointerdown"',
      "getCanvasPointFromPointerEvent",
      "drawElementalTotemPlacementPreview",
    ]) {
      expect(adapter).not.toContain(removed);
    }
  });

  test("preserves Totem workflow and Foundry Macro coverage", () => {
    const workflow = read(WORKFLOW);
    const macro = read(MACRO);
    expect(workflow).toContain(
      "collectElementalTotemPositions",
    );
    expect(workflow).toContain(
      "requestElementalTotemCreation",
    );
    for (const marker of [
      "Disabled automation skipped placement and creation",
      "Enabled automation reached placement and creation",
      "Elemental Totem automation setting was restored",
      "Active canvas Scene exists for aura lifecycle checks",
    ]) {
      expect(macro).toContain(marker);
    }
  });
});
