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

const REFERENCES = resolve(
  "foundry",
  "config",
  "references",
  "external-references.json",
);
const GENERATED_RUNTIME = resolve(
  "foundry",
  "generated",
  "external-references.js",
);
const RUNTIME_EFFECTS = resolve(
  "foundry",
  "scripts",
  "common-animal-attack-effects.js",
);
const HUNTER_GENERATOR = resolve(
  "tools",
  "generate-hunter-companions.py",
);
const SYSTEM_GENERATOR = resolve(
  "tools",
  "generate-system-test-macros.py",
);
const UUID_MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-external-uuids.js",
);
const COMMON_ANIMALS_MACRO = resolve(
  "tests",
  "system",
  "macros",
  "verify-common-animals.js",
);
const RUN_ALL = resolve(
  "tests",
  "system",
  "macros",
  "run-all.js",
);
const COMPATIBILITY = resolve(
  "foundry",
  "config",
  "compatibility.json",
);
const EXTERNAL_SOURCES = resolve(
  "foundry",
  "config",
  "references",
  "external-sources.json",
);

const REFERENCE_KEY =
  "dragonbane-core:"
  + "journal-page.combat-damage.poison";
const REFERENCE_UUID =
  "JournalEntry.SbbSMsuvWeo3HaID."
  + "JournalEntryPage.6WPxPxUjh4W80RNy#poison";

function read(path) {
  return readFileSync(
    path,
    "utf8",
  );
}

function readJson(path) {
  return JSON.parse(
    read(path),
  );
}

function generatorEntry(
  source,
  key,
) {
  return source.match(
    new RegExp(
      `\\{\\s*"key"\\s*:\\s*"${key}"[\\s\\S]*?\\n\\s*\\},`,
    ),
  )?.[0] ?? null;
}

describe("external UUID system verification", () => {
  test("registers the Dragonbane Core poison rule once", () => {
    const source = readJson(
      REFERENCES,
    );

    expect(source).toEqual({
      schemaVersion: 1,
      references: {
        [REFERENCE_KEY]: {
          source: "dragonbane-core",
          uuid: REFERENCE_UUID,
          documentType:
            "JournalEntryPage",
        },
      },
    });
  });

  test("derives runtime and generated content from the registry", () => {
    const runtime = read(
      RUNTIME_EFFECTS,
    );
    const hunterGenerator = read(
      HUNTER_GENERATOR,
    );
    const generated = read(
      GENERATED_RUNTIME,
    );
    const commonAnimalsMacro = read(
      COMMON_ANIMALS_MACRO,
    );

    expect(runtime).toContain(
      'from "../generated/external-references.js"',
    );
    expect(runtime).toContain(
      "externalReferenceUuid(",
    );
    expect(runtime).toContain(
      `"${REFERENCE_KEY}"`,
    );
    expect(runtime).not.toContain(
      "SbbSMsuvWeo3HaID",
    );

    expect(hunterGenerator).toContain(
      `"${REFERENCE_KEY}"`,
    );
    expect(hunterGenerator).toContain(
      "external-references.json",
    );
    expect(hunterGenerator).not.toContain(
      "SbbSMsuvWeo3HaID",
    );

    expect(generated).toContain(
      REFERENCE_UUID,
    );
    expect(generated).toContain(
      "externalReferenceUuid",
    );

    expect(commonAnimalsMacro).toContain(
      "__BOA_EXTERNAL_UUID_CONFIGURATION__",
    );
    expect(commonAnimalsMacro).toContain(
      REFERENCE_KEY,
    );
    expect(commonAnimalsMacro).not.toContain(
      "SbbSMsuvWeo3HaID",
    );
  });

  test("generates the external UUID Macro from the registries", () => {
    const template = read(
      UUID_MACRO,
    );
    const generator = read(
      SYSTEM_GENERATOR,
    );
    const compatibility = readJson(
      COMPATIBILITY,
    );
    const sources = readJson(
      EXTERNAL_SOURCES,
    );
    const references = readJson(
      REFERENCES,
    );
    const configuration = {
      verifiedEnvironment:
        compatibility.verifiedEnvironment,
      sources:
        sources.sources,
      references:
        references.references,
    };
    const placeholder =
      "__BOA_EXTERNAL_UUID_CONFIGURATION__";
    const placeholderCount =
      template.split(placeholder).length - 1;
    const command = template.replace(
      placeholder,
      JSON.stringify(
        configuration,
        null,
        2,
      ),
    );
    const entry = generatorEntry(
      generator,
      "external-uuids",
    );

    expect(entry).not.toBeNull();
    expect(entry).toContain(
      '"id": "BoaDevExtUuid001"',
    );
    expect(entry).toContain(
      '"file": "verify-external-uuids.js"',
    );
    expect(entry).toContain(
      '"suiteMember": True',
    );

    expect(placeholderCount).toBe(1);
    expect(command).toContain(
      REFERENCE_UUID,
    );
    expect(command).toContain(
      '"version": "2.2"',
    );
    expect(command).toContain(
      "await fromUuid(",
    );
    expect(command).toContain(
      "document.documentName",
    );
    expect(command).not.toContain(
      placeholder,
    );

    expect(generator).toContain(
      "load_external_uuid_configuration",
    );
    expect(generator).toContain(
      "render_macro_body",
    );
  });

  test("runs external UUID verification in Run All", () => {
    const runAll = read(
      RUN_ALL,
    );

    expect(runAll).toMatch(
      /"smoke",\s*"external-uuids",/,
    );
  });
});
