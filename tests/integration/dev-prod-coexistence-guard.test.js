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
    "utf8",
  );
}

describe(
  "development / production coexistence guard",
  () => {
    test(
      "production manifest declares development as a known conflict",
      () => {
        const manifest =
          JSON.parse(
            read(
              "foundry/module.json",
            ),
          );

        expect(
          manifest
            .relationships
            ?.conflicts,
        ).toContainEqual({
          id:
            "bane-of-azeroth-dev",
          type:
            "module",
        });
      },
    );

    test(
      "delivery manifest flips only the BoA package conflict while preserving unrelated conflicts",
      () => {
        const packaging =
          read(
            "tools/package-foundry.sh",
          );

        expect(
          packaging,
        ).toContain(
          '--arg productionModuleId "$PRODUCTION_MODULE_ID"',
        );
        expect(
          packaging,
        ).toContain(
          '--arg developmentModuleId "$DEVELOPMENT_MODULE_ID"',
        );
        expect(
          packaging,
        ).toContain(
          "map(select(.id != $productionModuleId and .id != $developmentModuleId))",
        );
        expect(
          packaging,
        ).toContain(
          "if $moduleId == $developmentModuleId",
        );
        expect(
          packaging,
        ).toContain(
          "then $productionModuleId",
        );
      },
    );

    test(
      "entrypoint guards init before runtime registration and ready before reconciliation",
      () => {
        const source =
          read(
            "foundry/scripts/bane-of-azeroth.js",
          );

        expect(
          source,
        ).toContain(
          'from "./package-identity.js";',
        );

        const init =
          source.indexOf(
            'Hooks.once("init"',
          );
        const claim =
          source.indexOf(
            "if (!claimPackageRuntime()) return;",
            init,
          );
        const settings =
          source.indexOf(
            "registerAutomationSettings",
            claim,
          );

        expect(
          init,
        ).toBeGreaterThanOrEqual(
          0,
        );
        expect(
          claim,
        ).toBeGreaterThan(
          init,
        );
        expect(
          settings,
        ).toBeGreaterThan(
          claim,
        );

        const ready =
          source.indexOf(
            'Hooks.once("ready"',
          );
        const readyGuard =
          source.indexOf(
            "if (!shouldActivatePackageRuntime()) return;",
            ready,
          );
        const warning =
          source.indexOf(
            "notifyPackageConflictIfNeeded();",
            readyGuard,
          );

        expect(
          readyGuard,
        ).toBeGreaterThan(
          ready,
        );
        expect(
          warning,
        ).toBeGreaterThan(
          readyGuard,
        );
      },
    );

    test(
      "package identity system test treats development as authoritative instead of requiring production disabled",
      () => {
        const source =
          read(
            "tests/system/macros/verify-package-identity.js",
          );

        expect(
          source,
        ).toContain(
          'Symbol.for("bane-of-azeroth.active-runtime")',
        );
        expect(
          source,
        ).toContain(
          "Development runtime is authoritative",
        );
        expect(
          source,
        ).not.toContain(
          "Production and development packages are not both active",
        );
      },
    );
  },
);
