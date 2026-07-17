import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const isGitHubActions =
  process.env.GITHUB_ACTIONS === "true";

const sourcePath = fileURLToPath(
  new URL(
    "./foundry/scripts/bane-of-azeroth.js",
    import.meta.url
  )
);

const testExports = [
  "actorHasAmmoPouch",
  "buildElementalTotemPlan",
  "buildTotemOptions",
  "getElementalTotemAuraData",
  "isArmorPiercingRangedWeapon",
  "isScattershotRangedWeapon",
  "shouldStartElementalTotemDialog",
  "configureCreatedElementalTotem",
  "deletePreviousElementalTotems",
  "executeElementalTotemCreation",
  "getElementalTotemPlacementRange",
  "getPrimaryActiveGMUser",
  "loadElementalTotemDefinitions",
  "patchWeaponTests",
  "validateElementalTotemCreationRequest",
  "validateElementalTotemPlanShape",
];

function testOnlyBaneOfAzerothExports() {
  return {
    name: "bane-of-azeroth-test-exports",
    enforce: "pre",

    transform(code, id) {
      const cleanId = id.split("?")[0];
      if (cleanId !== sourcePath) return null;

      const missing = testExports.filter(name => {
        const pattern = new RegExp(
          String.raw`\bfunction\s+${name}\s*\(`
        );
        return !pattern.test(code);
      });

      if (missing.length > 0) {
        throw new Error(
          "The unit-test harness could not find these functions in " +
          `bane-of-azeroth.js: ${missing.join(", ")}`
        );
      }

      return {
        code:
          `${code}\n\n` +
          "export {\n" +
          testExports.map(name => `  ${name},`).join("\n") +
          "\n};\n",
        map: null,
      };
    },
  };
}

function mockPath(relativePath) {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

export default defineConfig({
  plugins: [
    testOnlyBaneOfAzerothExports(),
  ],

  resolve: {
    alias: [
      {
        find:
          "/systems/dragonbane/modules/apps/" +
          "optional-rule-settings.js",
        replacement: mockPath(
          "./tests/mocks/dragonbane/" +
          "optional-rule-settings.js"
        ),
      },
      {
        find:
          "/systems/dragonbane/modules/data/messages/" +
          "roll-damage-message.js",
        replacement: mockPath(
          "./tests/mocks/dragonbane/" +
          "roll-damage-message.js"
        ),
      },
      {
        find:
          "/systems/dragonbane/modules/tests/weapon-test.js",
        replacement: mockPath(
          "./tests/mocks/dragonbane/weapon-test.js"
        ),
      },
      {
        find:
          "/systems/dragonbane/modules/utility.js",
        replacement: mockPath(
          "./tests/mocks/dragonbane/utility.js"
        ),
      },
    ],
  },

  test: {
    environment: "node",
    setupFiles: [
      "./tests/setup-foundry.js",
    ],
    include: [
      "tests/unit/**/*.test.js",
    "tests/integration/**/*.test.js",
    ],
    clearMocks: true,
    restoreMocks: true,

    reporters: isGitHubActions
      ? [
          "default",
          "github-actions",
          "junit",
        ]
      : [
          "default",
        ],

    outputFile: isGitHubActions
      ? {
          junit: "./test-results/junit.xml",
        }
      : undefined,

    coverage: {
      provider: "v8",
      include: [
        "foundry/scripts/**/*.js",
      ],
      reportsDirectory: "./coverage",
      reporter: [
        "text",
        "json-summary",
        "html",
        "lcov",
      ],
      reportOnFailure: true,
      excludeAfterRemap: true,
    },
  },
});
