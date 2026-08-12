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
  "tools/generate-system-test-actors.py";
const RUNTIME =
  "tests/system/runtime/import-system-test-actors.js";
const PACKAGE_SCRIPT =
  "tools/package-foundry.sh";
const RC_WORKFLOW =
  ".github/workflows/release-foundry-rc.yml";
const STABLE_WORKFLOW =
  ".github/workflows/release-foundry.yml";
const MODULE_MANIFEST =
  "foundry/module.json";

function text(path) {
  return existsSync(path)
    ? readFileSync(path, "utf8")
    : "";
}

const actorNames = [
  "BOA TEST – Death Knight",
  "BOA TEST – Demon Hunter",
  "BOA TEST – Druid",
  "BOA TEST – Shaman",
  "BOA TEST – Warlock",
  "BOA TEST – Mage",
  "BOA TEST – Monk",
  "BOA TEST – Evoker",
  "BOA TEST – Shadow Priest",
  "BOA TEST – Tauren",
  "BOA TEST – Hunter",
  "BOA TEST – Target",
];

describe(
  "development-only system-test Actors",
  () => {
    test(
      "generates a stable manual-test Actor roster",
      () => {
        expect(
          existsSync(GENERATOR),
        ).toBe(true);

        const source = text(GENERATOR);
        expect(source).toContain(
          "EXPECTED_ACTOR_COUNT = 12",
        );
        expect(source).toContain(
          '"systemTestActorKey"',
        );
        expect(source).toContain(
          '"fixtureItems"',
        );
        expect(source).toContain(
          '"--check"',
        );

        for (const name of actorNames) {
          expect(source).toContain(name);
        }

        for (const marker of [
          "heroic-class-ability.death-knight.death-knights-rebirth",
          "heroic-class-ability.demon-hunter.demon-hunter-initiation",
          "heroic-class-ability.druid.druidic-awakening",
          "heroic-class-ability.shaman.shamanic-calling",
          "heroic-class-ability.warlock.demonologist",
          "heroic-class-ability.mage.mages-brilliance",
          "heroic-class-ability.monk.monks-serenity",
          "heroic-class-ability.evoker.evokers-legacy",
          "heroic-class-ability.priest.darkness",
          "kin-ability.tauren.war-stomp",
          "heroic-class-ability.hunter.hunters-instincts",
        ]) {
          expect(source).toContain(marker);
        }
      },
    );

    test(
      "auto-imports managed Actors and reconciles only managed fixture Items",
      () => {
        expect(
          existsSync(RUNTIME),
        ).toBe(true);

        const source = text(RUNTIME);
        for (const marker of [
          "bane-of-azeroth.bane-of-azeroth-dev-test-actors",
          "Bane of Azeroth - System Tests",
          "managedSystemTestActor",
          "managedSystemTestActorItem",
          "systemTestActorFixtureItemKey",
          'Hooks.once("ready"',
          'Hooks.on("createItem"',
          'Hooks.on("updateItem"',
          'Hooks.on("deleteItem"',
          '"system.hitPoints.base"',
          '"system.willPoints.base"',
          "Import or reimport",
        ]) {
          expect(source).toContain(marker);
        }

        expect(source).toContain(
          "CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER",
        );
        expect(source).toContain(
          "getFlag(item, MANAGED_ITEM_FLAG) === true",
        );
      },
    );

    test(
      "keeps matching managed fixture Items stable across syncs",
      () => {
        const source = text(RUNTIME);

        for (const marker of [
          "systemTestActorSourceModuleVersion",
          "managedItemsForDescriptor",
          "matchingManagedItems",
          "matchingManagedItems\n          .slice(1)",
          "managedItemUpdateData",
          "await actor.updateEmbeddedDocuments(",
        ]) {
          expect(source).toContain(marker);
        }

        // A matching fixture must no longer be unconditionally
        // deleted and recreated on every synchronization pass.
        expect(source).not.toContain(
          "const existingIds = collectionValues(actor.items)",
        );
      },
    );

    test(
      "packages the Actor pack only in development builds",
      () => {
        const source = text(PACKAGE_SCRIPT);

        for (const marker of [
          'DEV_TEST_ACTOR_PACK_NAME="bane-of-azeroth-dev-test-actors"',
          "tools/generate-system-test-actors.py",
          "import-system-test-actors.js",
          "scripts/boa-dev-system-test-actors.js",
          '"label": "Bane of Azeroth – System Test Actors"',
          '"type": "Actor"',
        ]) {
          expect(source).toContain(marker);
        }

        expect(source).toContain(
          '"${STAGE_DIR}/packs/${DEV_TEST_ACTOR_PACK_NAME}"',
        );
      },
    );

    test(
      "keeps Actor fixtures out of RC and stable packages",
      () => {
        for (const workflow of [
          RC_WORKFLOW,
          STABLE_WORKFLOW,
        ]) {
          const source = text(workflow);
          expect(source).toContain(
            "bane-of-azeroth-dev-test-actors",
          );
          expect(source).toContain(
            "boa-dev-system-test-actors.js",
          );
        }
      },
    );

    test(
      "keeps authoritative source manifest channel-neutral",
      () => {
        const manifest = JSON.parse(
          text(MODULE_MANIFEST),
        );
        expect(
          manifest.packs.map(pack => pack.name),
        ).not.toContain(
          "bane-of-azeroth-dev-test-actors",
        );
        expect(
          manifest.scripts ?? [],
        ).not.toContain(
          "scripts/boa-dev-system-test-actors.js",
        );
      },
    );
  },
);
