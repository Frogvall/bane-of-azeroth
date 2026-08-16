import fs from "node:fs";
import path from "node:path";
import {
  BOA_VERIFIED_ENVIRONMENT,
} from "../../foundry/generated/external-references.js";
import {
  describe,
  expect,
  test,
} from "vitest";

const ROOT = process.cwd();

function readJson(
  ...parts
) {
  return JSON.parse(
    fs.readFileSync(
      path.join(
        ROOT,
        ...parts,
      ),
      "utf8",
    ),
  );
}

function read(
  ...parts
) {
  return fs.readFileSync(
    path.join(
      ROOT,
      ...parts,
    ),
    "utf8",
  );
}

describe(
  "dependency and support baseline",
  () => {
    test(
      "declares only Dragonbane as a hard Foundry runtime dependency",
      () => {
        const manifest =
          readJson(
            "foundry",
            "module.json",
          );

        expect(
          manifest.compatibility,
        ).toEqual({
          minimum: "14",
          verified: "14",
          maximum: "14",
        });

        expect(
          manifest.relationships.systems,
        ).toHaveLength(1);

        const [dragonbaneSystem] =
          manifest.relationships.systems;

        expect(
          dragonbaneSystem,
        ).toMatchObject({
          id: "dragonbane",
          type: "system",
          compatibility: {
            minimum: "4.0.1",
          },
        });

        expect(
          dragonbaneSystem
            .compatibility
            .verified,
        ).toMatch(
          /^\d+(?:\.\d+){1,2}$/,
        );

        expect(
          manifest.relationships.requires
          ?? [],
        ).toEqual([]);

        expect(
          JSON.stringify(
            manifest.relationships,
          ),
        ).not.toContain(
          "yze-combat",
        );
      },
    );
    test(
      "records one whole-module verified environment without making YZE Combat required",
      () => {
        const compatibility =
          readJson(
            "foundry",
            "config",
            "compatibility.json",
          );
        const manifest =
          readJson(
            "foundry",
            "module.json",
          );
        const dragonbaneSystem =
          manifest.relationships.systems
            .find(
              system =>
                system.id ===
                  "dragonbane",
            );

        expect(
          dragonbaneSystem,
        ).toBeTruthy();

        expect(
          compatibility,
        ).toEqual({
          schemaVersion: 1,
          verifiedEnvironment: {
            foundry: "14.365",
            system: {
              id: "dragonbane",
              version:
                dragonbaneSystem
                  .compatibility
                  .verified,
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
      },
    );
    test(
      "keeps generated verified environment synchronized with compatibility source",
      () => {
        const compatibility =
          readJson(
            "foundry",
            "config",
            "compatibility.json",
          );

        expect(
          BOA_VERIFIED_ENVIRONMENT,
        ).toEqual(
          compatibility.verifiedEnvironment,
        );
      },
    );
    test(
      "keeps Dragonbane Core Set as the registered external content source",
      () => {
        const sources =
          readJson(
            "foundry",
            "config",
            "references",
            "external-sources.json",
          );

        expect(
          sources,
        ).toEqual({
          schemaVersion: 1,
          sources: {
            "dragonbane-core": {
              packageType: "module",
              packageId:
                "dragonbane-coreset",
              required: true,
            },
          },
        });
      },
    );

    test(
      "documents the distinction between hard dependency, external content source, and optional verified companion module",
      () => {
        const readme =
          read(
            "README.md",
          );

        expect(
          readme,
        ).toContain(
          "Dragonbane system is the only hard Foundry runtime dependency",
        );
        expect(
          readme,
        ).toContain(
          "Dragonbane Core Set 2.2 is the required external content source",
        );
        expect(
          readme,
        ).toContain(
          "YZE Combat 1.7.0 is optional",
        );
        expect(
          readme,
        ).toContain(
          "does not require YZE Combat",
        );
      },
    );
  },
);
