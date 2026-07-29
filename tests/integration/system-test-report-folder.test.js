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

const LIBRARY = resolve(
  "tests",
  "system",
  "lib",
  "boa-system-test-lib.js",
);

function read(path) {
  return readFileSync(
    path,
    "utf8",
  );
}

describe("system-test report folder", () => {
  test("uses one dedicated flat Journal folder", () => {
    const library = read(LIBRARY);

    expect(library).toContain(
      '"Bane of Azeroth - System Tests"',
    );
    expect(library).toContain(
      "folder: systemTestsFolder.id",
    );
    expect(library).not.toMatch(
      /["']System Tests["']\s*,/,
    );
    expect(library).not.toMatch(
      /["']Bane of Azeroth["']\s*,\s*null/,
    );
  });
});
