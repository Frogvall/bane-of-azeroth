import {
  existsSync,
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  test,
} from "vitest";

const GENERATOR =
  "tools/generate-system-test-macros.py";
const LIB =
  "tests/system/lib/boa-system-test-lib.js";

const MACROS = [
  "tests/system/macros/verify-system-test-actors.js",
  "tests/system/macros/verify-weapon-features.js",
  "tests/system/macros/verify-great-helm-firearms.js",
];

function text(path) {
  return existsSync(path)
    ? readFileSync(path, "utf8")
    : "";
}

describe(
  "0.12.9 system-test harness cleanup",
  () => {
    test(
      "registers the new automated Run All coverage",
      () => {
        const generator = text(GENERATOR);

        for (const marker of [
          '"key": "system-test-actors"',
          '"file": "verify-system-test-actors.js"',
          '"suiteOrder": 23',
          '"key": "weapon-features"',
          '"file": "verify-weapon-features.js"',
          '"suiteOrder": 24',
          '"key": "great-helm-firearms"',
          '"file": "verify-great-helm-firearms.js"',
          '"suiteOrder": 25',
        ]) {
          expect(generator).toContain(marker);
        }

        for (const macro of MACROS) {
          expect(
            existsSync(macro),
            macro,
          ).toBe(true);
        }
      },
    );

    test(
      "automates shared Actor fixture and summon-ownership checks",
      () => {
        const source = text(MACROS[0]);

        for (const marker of [
          "managedSystemTestActor",
          "DOCUMENT_OWNERSHIP_LEVELS.OBSERVER",
          "Elementalism",
          "Animism",
          "Mentalism",
          "getElementalTotemOwnerUserIds",
          "gives no Player ownership to summoned Totems",
        ]) {
          expect(source).toContain(marker);
        }
      },
    );

    test(
      "covers real Foundry runtime integration for Weapon Features and Great Helm",
      () => {
        const weapon = text(MACROS[1]);
        const helm = text(MACROS[2]);

        for (const marker of [
          "patchWeaponTests",
          "__baneOfAzerothPatched",
          "isScattershotRangedWeapon",
          "actorHasAmmoPouch",
          "armorPiercing",
        ]) {
          expect(weapon).toContain(marker);
        }

        for (const marker of [
          "reconcileGreatHelmFirearms",
          "getGreatHelmFirearmsCandidates",
          "GREAT_HELM_CANONICAL_BANES",
          "GREAT_HELM_FIREARMS_BANE",
        ]) {
          expect(helm).toContain(marker);
        }
      },
    );

    test(
      "keeps exactly fifteen genuinely manual checks",
      () => {
        const source = text(LIB);
        const manualStart = source.indexOf(
          "function boaBuildManualChecklistHtml()",
        );
        const manualEnd = source.indexOf(
          "function boaBuildEnvironmentHtml(environment)",
        );
        expect(manualStart).toBeGreaterThanOrEqual(0);
        expect(manualEnd).toBeGreaterThan(manualStart);

        const manual = source.slice(
          manualStart,
          manualEnd,
        );
        const checkboxCount =
          (
            manual.match(
              /<li>\[ \]/g,
            ) ?? []
          ).length;

        expect(checkboxCount).toBe(15);

        for (const retained of [
          "<h2>Druid Forms</h2>",
          "<h2>Shadowform</h2>",
          "<h2>Mage's Brilliance</h2>",
          "<h2>Warlock Demon summoning</h2>",
          "real Elemental Totem cast through the connected GM",
          "Critical Hit dialog offers Extra Attack",
          "browser consoles contain no unexpected Bane of Azeroth",
        ]) {
          expect(manual).toContain(retained);
        }

        for (const automatedOrRcOnly of [
          "Clean-world Adventure import succeeds from the packaged prerelease module",
          "A grid position displayed as 6 meters is accepted",
          "With Unending Thirst selected, the character gains exactly +2 Movement",
          "A failed Web Spray attack adds no Restrain text",
          "The tested Foundry version is recorded correctly",
          "The tested Dragonbane version is recorded correctly",
        ]) {
          expect(manual).not.toContain(
            automatedOrRcOnly,
          );
        }
      },
    );
  },
);
