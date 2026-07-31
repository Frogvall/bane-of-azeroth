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

const MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-common-animal-attack-messages.js",
);

function read(path) {
  return readFileSync(path, "utf8");
}

describe("Common Animal attack-message system-test timing", () => {
  test("waits for semantic damage-card enrichment", () => {
    const macro = read(MACRO);

    expect(macro).toContain(
      "expectedEffectText",
    );
    expect(macro).toContain(
      ".includes(expectedEffectText)",
    );
    expect(macro).toContain(
      "}, 3000)",
    );
    expect(macro).not.toContain(
      "current.content !== "
        + "messageData.content",
    );
  });

  test("supplies the expected sentence for every damage scenario", () => {
    const macro = read(MACRO);

    for (const marker of [
      "`${serpent.name} exposes "
        + "${target.name}`",
      "`${serpent.name} exposes "
        + "the target`",
      "`${serpent.name} restrains "
        + "${target.name}`",
    ]) {
      expect(macro).toContain(marker);
    }
  });
});
