import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const ROOT = process.cwd();
const MODULE = path.join(
  ROOT,
  "foundry",
  "module.json",
);
const COMPATIBILITY = path.join(
  ROOT,
  "foundry",
  "content",
  "compatibility.json",
);
const EXTERNAL_SOURCES = path.join(
  ROOT,
  "foundry",
  "content",
  "references",
  "external-sources.json",
);
const EXTERNAL_REFERENCES = path.join(
  ROOT,
  "foundry",
  "content",
  "references",
  "external-references.json",
);
const INVENTORY = path.join(
  ROOT,
  "generated",
  "reference-inventory.json",
);
const RESOLVER = path.join(
  ROOT,
  "tools",
  "boa-references.py",
);
const INVENTORY_GENERATOR = path.join(
  ROOT,
  "tools",
  "generate-reference-inventory.py",
);
const GENERATOR_CHECKER = path.join(
  ROOT,
  "tools",
  "check-foundry-generators.py",
);
const README = path.join(
  ROOT,
  "README.md",
);

function readJson(file) {
  return JSON.parse(
    fs.readFileSync(
      file,
      "utf8",
    ),
  );
}

describe("0.10.0 reference foundation", () => {
  test("uses one verified environment for the whole module", () => {
    const module = readJson(MODULE);
    const compatibility = readJson(COMPATIBILITY);
    const readme = fs.readFileSync(
      README,
      "utf8",
    );

    expect(module.version).toBe("0.10.0");
    expect(compatibility).toEqual({
      schemaVersion: 1,
      verifiedEnvironment: {
        foundry: "14.365",
        system: {
          id: "dragonbane",
          version: "4.0.1",
        },
        modules: {
          "dragonbane-coreset": {
            version: "2.2",
            required: true,
          },
          "yze-combat": {
            version: "1.7.0",
            required: true,
          },
        },
      },
    });

    expect(readme).toContain(
      "Current Foundry module version:** 0.10.0",
    );
    for (const version of [
      "14.365",
      "4.0.1",
      "2.2",
      "1.7.0",
    ]) {
      expect(readme).toContain(version);
    }
  });

  test("keeps external-source versions out of UUID entries", () => {
    const compatibility = readJson(COMPATIBILITY);
    const sources = readJson(EXTERNAL_SOURCES);
    const references = readJson(EXTERNAL_REFERENCES);

    expect(sources.schemaVersion).toBe(1);
    expect(sources.sources).toEqual({
      "dragonbane-core": {
        packageType: "module",
        packageId: "dragonbane-coreset",
        required: true,
      },
    });
    expect(references.schemaVersion).toBe(1);
    expect(references.references).toEqual({
      "dragonbane-core:journal-page.combat-damage.poison": {
        source: "dragonbane-core",
        uuid:
          "JournalEntry.SbbSMsuvWeo3HaID.JournalEntryPage.6WPxPxUjh4W80RNy#poison",
        documentType: "JournalEntryPage",
      },
    });

    const serializedRegistries = JSON.stringify({
      sources,
      references,
    });
    expect(serializedRegistries).not.toMatch(
      /testedVersion|verifiedVersion/,
    );

    const packageId =
      sources.sources["dragonbane-core"].packageId;
    expect(
      compatibility.verifiedEnvironment.modules,
    ).toHaveProperty(packageId);
  });

  test("provides one resolver for internal and external symbolic references", () => {
    const resolver = fs.readFileSync(
      RESOLVER,
      "utf8",
    );

    for (const marker of [
      "@Ref",
      "@DisplayRef",
      "@UUID",
      "@DisplayTable",
      "internal_references",
      "external_references",
      "validate_reference_sources",
      "resolve_symbolic_references",
    ]) {
      expect(resolver).toContain(marker);
    }

    expect(resolver).toContain(
      "verified versions belong in compatibility.json",
    );
  });

  test("generates a deterministic source-reference inventory", () => {
    const inventory = readJson(INVENTORY);
    const generator = fs.readFileSync(
      INVENTORY_GENERATOR,
      "utf8",
    );
    const checker = fs.readFileSync(
      GENERATOR_CHECKER,
      "utf8",
    );

    expect(inventory.schemaVersion).toBe(1);
    expect(inventory.generatedBy).toBe(
      "tools/generate-reference-inventory.py",
    );
    expect(Array.isArray(inventory.entries)).toBe(true);
    expect(inventory.scanRoots).toContain(
      "tools",
    );
    expect(inventory.scanRoots).not.toContain(
      "foundry/pack-src",
    );
    expect(
      inventory.entries.some(
        entry =>
          entry.kind === "uuid-literal"
          && entry.classification
            === "external-registry",
      ),
    ).toBe(true);
    const sortedEntries = [
      ...inventory.entries,
    ].sort((left, right) => {
      const pathOrder =
        left.path.localeCompare(right.path);
      if (pathOrder !== 0) return pathOrder;

      const lineOrder =
        left.line - right.line;
      if (lineOrder !== 0) return lineOrder;

      const columnOrder =
        left.column - right.column;
      if (columnOrder !== 0) return columnOrder;

      const kindOrder =
        left.kind.localeCompare(right.kind);
      if (kindOrder !== 0) return kindOrder;

      return (left.target ?? "").localeCompare(
        right.target ?? "",
      );
    });

    expect(inventory.entries).toEqual(
      sortedEntries,
    );

    for (const marker of [
      "--check",
      "@UUID",
      "@DisplayTable",
      "@Ref",
      "@DisplayRef",
      "fromUuid",
      "fromUuidSync",
    ]) {
      expect(generator).toContain(marker);
    }

    expect(checker).toContain(
      'glob("generate-*.py")',
    );
    expect(
      path.basename(INVENTORY_GENERATOR),
    ).toMatch(/^generate-.*\.py$/);
  });
});
