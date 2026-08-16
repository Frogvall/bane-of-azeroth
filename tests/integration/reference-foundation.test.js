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
  "config",
  "compatibility.json",
);
const EXTERNAL_SOURCES = path.join(
  ROOT,
  "foundry",
  "config",
  "references",
  "external-sources.json",
);
const EXTERNAL_REFERENCES = path.join(
  ROOT,
  "foundry",
  "config",
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

const SEMVER_PATTERN =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function currentReadmeModuleVersion(readme) {
  const matches = [
    ...readme.matchAll(
      /^> \*\*Current Foundry module version:\*\*\s+(\S+)\s*$/gm,
    ),
  ];

  expect(matches).toHaveLength(1);

  return matches[0][1];
}

describe("reference foundation", () => {
  test("keeps module.json and README versions synchronized", () => {
    const module = readJson(MODULE);
    const readme = fs.readFileSync(
      README,
      "utf8",
    );

    expect(module.version).toMatch(
      SEMVER_PATTERN,
    );
    expect(
      currentReadmeModuleVersion(readme),
    ).toBe(module.version);
  });

  test("uses one verified environment for the whole module", () => {
    const compatibility = readJson(COMPATIBILITY);
    const module = readJson(MODULE);
    const readme = fs.readFileSync(
      README,
      "utf8",
    );

    const dragonbaneSystem =
      module.relationships.systems.find(
        system =>
          system.id ===
          "dragonbane",
      );
    const verifiedDragonbaneVersion =
      dragonbaneSystem
        ?.compatibility
        ?.verified;

    expect(
      verifiedDragonbaneVersion,
    ).toMatch(
      /^\d+(?:\.\d+){1,2}$/,
    );

    expect(compatibility).toEqual({
      schemaVersion: 1,
      verifiedEnvironment: {
        foundry: "14.365",
        system: {
          id: "dragonbane",
          version:
            verifiedDragonbaneVersion,
        },
        modules: {
          "dragonbane-coreset": {
            version: "2.2",
            required: true,
          },
          "yze-combat": {
            version: "1.7.0",
            required: false,
          },
        },
      },
    });

    for (const version of [
      "14.365",
      verifiedDragonbaneVersion,
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
    const externalEntries = Object.entries(
      references.references,
    );
    expect(externalEntries).toHaveLength(17);
    for (const [key, reference] of externalEntries) {
      expect(key).toMatch(
        /^dragonbane-core:/,
      );
      expect(
        sources.sources,
      ).toHaveProperty(
        reference.source,
      );
      expect(reference.uuid).toEqual(
        expect.any(String),
      );
      expect(reference.uuid.length).toBeGreaterThan(0);
      expect(
        reference.documentType,
      ).toEqual(
        expect.any(String),
      );
      expect(reference).not.toHaveProperty(
        "testedVersion",
      );
      expect(reference).not.toHaveProperty(
        "verifiedVersion",
      );
    }

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
