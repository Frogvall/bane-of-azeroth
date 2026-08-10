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

function read(path) {
  return readFileSync(
    resolve(path),
    "utf8",
  );
}

function json(path) {
  return JSON.parse(
    read(path),
  );
}

const migratedKeys = [
  "dragonbane-core:heroic-ability.dual-wield",
  "dragonbane-core:heroic-ability.iron-fist",
  "dragonbane-core:heroic-ability.twin-shot",
  "dragonbane-core:journal-page.combat-damage.poison",
  "dragonbane-core:journal-page.common-animals",
  "dragonbane-core:kin-ability.fast-healer",
  "dragonbane-core:kin-ability.hard-to-catch",
  "dragonbane-core:rule.dash",
  "dragonbane-core:rule.death",
  "dragonbane-core:rule.falling",
  "dragonbane-core:rule.find-weak-spot",
  "dragonbane-core:rule.magic-tricks",
  "dragonbane-core:rule.power-from-the-body",
  "dragonbane-core:rule.pushing-your-roll",
  "dragonbane-core:rule.resist-cold",
  "dragonbane-core:rule.sneak-attack",
  "dragonbane-core:spell.sense-magic",
];

describe(
  "0.12.1 external reference cleanup",
  () => {
    test(
      "centralizes all migrated Dragonbane/Core references in the external registry",
      () => {
        const registry =
          json(
            "foundry/config/references/external-references.json",
          );

        expect(
          Object.keys(
            registry.references,
          ).sort(),
        ).toEqual(
          migratedKeys.slice().sort(),
        );
      },
    );

    test(
      "canonical Heroic Class Ability and Kin source uses symbolic external references",
      () => {
        const heroic =
          read(
            "foundry/content/heroic-class-abilities.json",
          );
        const kin =
          read(
            "foundry/content/kin.json",
          );

        expect(heroic).toContain(
          "@Ref[dragonbane-core:spell.sense-magic]",
        );
        expect(heroic).toContain(
          "@Ref[dragonbane-core:rule.resist-cold]",
        );
        expect(heroic).toContain(
          "@Ref[dragonbane-core:heroic-ability.twin-shot]",
        );
        expect(heroic).toContain(
          '"grantsExternalSpell": "dragonbane-core:spell.sense-magic"',
        );

        expect(kin).toContain(
          "@Ref[dragonbane-core:rule.falling]",
        );
        expect(kin).toContain(
          "@Ref[dragonbane-core:rule.magic-tricks]",
        );
        expect(kin).toContain(
          "@Ref[dragonbane-core:kin-ability.fast-healer]",
        );

        expect(heroic).not.toContain(
          "Item.RPnxXYVb8z7EG5Wl",
        );
        expect(kin).not.toContain(
          "JournalEntry.SbbSMsuvWeo3HaID.JournalEntryPage.6WPxPxUjh4W80RNy#falling",
        );
      },
    );

    test(
      "Heroic Class Ability and Kin generation resolves external @Ref through the shared reference helper",
      () => {
        const shared =
          read(
            "tools/boa-references.py",
          );
        const heroic =
          read(
            "tools/generate-heroic-class-abilities.py",
          );
        const kin =
          read(
            "tools/generate-kin.py",
          );

        expect(shared).toContain(
          "def resolve_external_symbolic_references(",
        );

        for (const source of [
          heroic,
          kin,
        ]) {
          expect(source).toContain(
            "load_reference_helpers",
          );
          expect(source).toContain(
            "load_external_reference_targets",
          );
          expect(source).toContain(
            "resolve_external_symbolic_references",
          );
        }
      },
    );

    test(
      "Mage Brilliance consumes the generated Sense Magic external reference",
      () => {
        const source =
          read(
            "foundry/scripts/mage-brilliance.js",
          );

        expect(source).toContain(
          'from "../generated/external-references.js"',
        );
        expect(source).toContain(
          '"dragonbane-core:spell.sense-magic"',
        );
        expect(source).not.toContain(
          '"Item.RPnxXYVb8z7EG5Wl"',
        );
      },
    );

    test(
      "reference inventory rejects registered external UUIDs leaking back into authoritative source",
      () => {
        const source =
          read(
            "tools/generate-reference-inventory.py",
          );

        expect(source).toContain(
          "def load_registered_external_uuids(",
        );
        expect(source).toContain(
          "def assert_no_registered_external_uuid_leaks(",
        );
        expect(source).toContain(
          "Registered external UUID literals leaked into authoritative source",
        );
      },
    );

    test(
      "external UUID system test covers the complete migrated registry",
      () => {
        const source =
          read(
            "tests/system/macros/verify-external-uuids.js",
          );

        expect(source).toContain(
          "Object.keys(references).length",
        );
        expect(source).toMatch(
          /Object\.keys\(references\)\.length,\s*17,/s,
        );
      },
    );
  },
);
