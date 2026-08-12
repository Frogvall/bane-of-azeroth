import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  test,
} from "vitest";

const source =
  readFileSync(
    new URL(
      "../system/macros/verify-demon-hunter-initiation.js",
      import.meta.url,
    ),
    "utf8",
  );

describe(
  "Demon Hunter Initiation system-test cleanup",
  () => {
    test(
      "waits for managed vision bookkeeping before deleting the temporary Scene",
      () => {
        for (const marker of [
          "Removing Initiation clears managed vision bookkeeping",
          "demonHunterInitiationManagedPrototypeVision",
          "demonHunterInitiationOriginalPrototypeVision",
          "demonHunterInitiationManagedTokenVision",
          "demonHunterInitiationOriginalTokenVision",
        ]) {
          expect(source).toContain(marker);
        }

        const settled =
          source.indexOf(
            "Removing Initiation clears managed vision bookkeeping",
          );
        const sceneDelete =
          source.indexOf(
            "await scene.delete();",
          );

        expect(settled).toBeGreaterThan(-1);
        expect(sceneDelete).toBeGreaterThan(settled);
      },
    );
  },
);
