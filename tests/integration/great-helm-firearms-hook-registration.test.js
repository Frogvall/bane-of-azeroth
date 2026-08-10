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

function read(
  path,
) {
  return readFileSync(
    resolve(
      path,
    ),
    "utf-8",
  );
}

describe(
  "Great Helm Firearms hook registration",
  () => {
    test(
      "entrypoint reconciles existing and newly-created Great Helms",
      () => {
        const source =
          read(
            "foundry/scripts/bane-of-azeroth.js",
          );

        expect(
          source,
        ).toContain(
          'from "./great-helm-firearms.js";',
        );
        expect(
          source,
        ).toContain(
          'Hooks.on("createItem", onCreateGreatHelmFirearmsItem);',
        );
        expect(
          source,
        ).toContain(
          "await reconcileGreatHelmFirearms();",
        );
      },
    );

    test(
      "compatibility is data reconciliation rather than roll automation",
      () => {
        const source =
          read(
            "foundry/scripts/great-helm-firearms.js",
          );

        expect(
          source,
        ).toContain(
          '"system.banes"',
        );
        expect(
          source,
        ).toContain(
          '"Firearms"',
        );
        expect(
          source,
        ).not.toContain(
          "DoDWeaponTest",
        );
        expect(
          source,
        ).not.toContain(
          "updateDialogData",
        );
      },
    );
  },
);
