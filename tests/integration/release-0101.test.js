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

const README = resolve(
  "README.md",
);
const SYSTEM_MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-assets-and-journals.js",
);

function read(path) {
  return readFileSync(path, "utf8");
}

describe("Foundry Journal release baseline", () => {
  test("keeps the verified compatibility baseline recorded", () => {
    const readme = read(README);

    expect(readme).toContain(
      "| Foundry Virtual Tabletop | 14.365 |",
    );
    expect(readme).toContain(
      "| Dragonbane system | 4.0.1 |",
    );
    expect(readme).toContain(
      "| Dragonbane Core Set | 2.2 |",
    );
  });
test("documents the current Foundry Journal and test workflow in README", () => {
    const readme = read(README);

    for (const marker of [
      "Generated **Character Options** Journal",
      "Generated **Appendices** Journal",
      "deterministic Journal ordering",
      "| Foundry Virtual Tabletop | 14.365 |",
      "| Dragonbane system | 4.0.1 |",
      "| Dragonbane Core Set | 2.2 |",
      "npm run test:coverage",
      "npm run check:generated",
      "BOA DEV – Run All System Tests",
    ]) {
      expect(readme).toContain(marker);
    }
  });

  test("keeps the Appendices runtime contract explicit", () => {
    const macro = read(SYSTEM_MACRO);

    expect(macro).toContain(
      "Appendices has exactly two pages",
    );
    expect(macro).toContain(
      "Appendices page order follows the book",
    );
    expect(macro).toContain(
      "journal-page.appendices.companions",
    );
    expect(macro).toContain(
      "journal-page.appendices.demons",
    );
  });
});
