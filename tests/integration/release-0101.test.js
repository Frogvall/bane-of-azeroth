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

const MODULE = resolve(
  "foundry",
  "module.json",
);
const CHANGELOG = resolve(
  "foundry",
  "CHANGELOG.md",
);
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

function readJson(path) {
  return JSON.parse(read(path));
}

function sectionBetween(
  value,
  start,
  end,
) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(
    end,
    startIndex + start.length,
  );

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return value.slice(
    startIndex + start.length,
    endIndex,
  );
}

describe("0.10.1 release closure", () => {
  test("keeps 0.10.1 release metadata recorded", () => {
    const readme = read(README);
    const changelog = read(CHANGELOG);

    expect(readme).toContain(
      "| Foundry Virtual Tabletop | 14.365 |",
    );
    expect(readme).toContain(
      "| Dragonbane system | 4.0.1 |",
    );
    expect(changelog).toContain(
      "## [0.10.1] - 2026-08-02",
    );
  });

  test("records the complete 0.10.1 Journal slice", () => {
    const changelog = read(CHANGELOG);
    const release = sectionBetween(
      changelog,
      "## [0.10.1] - 2026-08-02",
      "## [0.10.0]",
    );


    for (const marker of [
      "Heroic Class Abilities",
      "Gear",
      "Spells",
      "Appendices",
      "Companions",
      "Demons",
      "deterministic manual sorting",
      "BOA DEV – Verify Assets and Journals",
    ]) {
      expect(release).toContain(marker);
    }
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
