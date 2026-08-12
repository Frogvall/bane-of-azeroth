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
      "../system/macros/verify-serenity.js",
      import.meta.url,
    ),
    "utf8",
  );

describe(
  "Monk's Serenity system-test cleanup",
  () => {
    test(
      "settles managed flags before deleting the fixture Actor",
      () => {
        for (const marker of [
          "const cleanupFlagsSettled =",
          "serenityManagedUnarmed",
          "serenityOriginalUnarmedDamage",
          "serenityManagedIronFist",
          "serenityOriginalIronFistDescription",
          "Serenity managed-flag cleanup",
          "cleanupWorked && cleanupFlagsSettled",
        ]) {
          expect(source).toContain(marker);
        }

        const settled =
          source.indexOf(
            "Serenity managed-flag cleanup",
          );
        const actorDelete =
          source.indexOf(
            "await actor.delete();",
          );

        expect(settled).toBeGreaterThan(-1);
        expect(actorDelete).toBeGreaterThan(settled);
      },
    );
  },
);
