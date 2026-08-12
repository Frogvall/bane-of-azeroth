import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const LIBRARY = resolve(
  "tests",
  "system",
  "lib",
  "boa-system-test-lib.js",
);
const VERIFY_GHOUL = resolve(
  "tests",
  "system",
  "macros",
  "verify-ghoul.js",
);

function loadColorHelper() {
  const source = readFileSync(LIBRARY, "utf-8");
  return new Function(
    `${source}\nreturn boaColorHex;`,
  )();
}

describe("system-test color normalization", () => {
  test("normalizes strings and Foundry Color-like objects", () => {
    const normalize = loadColorHelper();

    expect(normalize("#0000FF")).toBe("#0000ff");
    expect(normalize({
      css: "#0000FF",
      toJSON: () => "#0000ff",
    })).toBe("#0000ff");
    expect(normalize({
      toString: () => "#0000FF",
      toJSON: () => "#0000ff",
    })).toBe("#0000ff");
    expect(normalize(null)).toBeNull();
    expect(normalize(undefined)).toBeNull();
  });

  test("normalizes both Ghoul root-folder checks", () => {
    const source = readFileSync(VERIFY_GHOUL, "utf-8");

    expect(source).toContain(
      'boaColorHex(actorRoot?.color ?? null)',
    );
    expect(source).toContain(
      'boaColorHex(tableRoot?.color ?? null)',
    );
    expect(source).not.toContain(
      '"Actor Bane of Azeroth folder is blue",\n' +
      '  actorRoot?.color ?? null,',
    );
    expect(source).not.toContain(
      '"Roll Table Bane of Azeroth folder is blue",\n' +
      '  tableRoot?.color ?? null,',
    );
  });
});
