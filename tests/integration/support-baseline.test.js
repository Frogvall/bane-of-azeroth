import fs from "node:fs";
import path from "node:path";
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
  "0.12.2 dependency and support baseline",
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
        ).toEqual([
          {
            id: "dragonbane",
            type: "system",
            compatibility: {
              minimum: "4.0.1",
              verified: "4.0.1",
            },
          },
        ]);

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

        expect(
          compatibility,
        ).toEqual({
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
                required: false,
              },
            },
          },
        });
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
          "Dragonbane system 4.0.1 is the only hard Foundry runtime dependency",
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
