import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  join,
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const SOURCE_ROOT = resolve(
  "homebrewery",
  "images",
);
const ASSET_ROOT = resolve(
  "foundry",
  "assets",
  "journals",
);
const MANIFEST = resolve(
  "foundry",
  "config",
  "journal-assets.json",
);
const GENERATOR = resolve(
  "tools",
  "generate-journal-assets.py",
);

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

function filesBelow(directory) {
  const result = [];

  function visit(current) {
    for (
      const entry
      of readdirSync(current).sort()
    ) {
      const path = join(
        current,
        entry,
      );
      const stats = statSync(path);

      if (stats.isDirectory()) {
        visit(path);
      } else if (stats.isFile()) {
        result.push(path);
      }
    }
  }

  visit(directory);
  return result;
}

function relativeUnix(
  root,
  path,
) {
  return path
    .slice(root.length + 1)
    .replaceAll("\\", "/");
}

describe("generated Journal image assets", () => {
  test("maps every checked-in Homebrewery PNG to one WebP asset", () => {
    const sourceFiles = filesBelow(
      SOURCE_ROOT,
    )
      .filter(path =>
        path.toLowerCase().endsWith(
          ".png",
        )
      )
      .map(path =>
        relativeUnix(
          SOURCE_ROOT,
          path,
        )
      )
      .sort();

    const assetFiles = filesBelow(
      ASSET_ROOT,
    )
      .map(path =>
        relativeUnix(
          ASSET_ROOT,
          path,
        )
      )
      .sort();

    expect(
      sourceFiles.length,
    ).toBeGreaterThan(0);
    expect(assetFiles).toEqual(
      sourceFiles.map(path =>
        path.replace(
          /\.png$/i,
          ".webp",
        )
      ),
    );
  });

  test("publishes stable module paths for all generated assets", () => {
    const manifest = readJson(
      MANIFEST,
    );

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      sourceRoot:
        "homebrewery/images",
      assetRoot:
        "foundry/assets/journals",
      moduleRoot:
        "modules/bane-of-azeroth/"
        + "assets/journals",
      conversion: {
        format: "webp",
        lossless: true,
        method: 6,
        exact: true,
        metadata: "stripped",
        pillowVersion: "12.3.0",
        pythonImage:
          "python:3.13-slim-bookworm",
      },
    });

    expect(
      manifest.assets.length,
    ).toBeGreaterThan(0);

    for (
      const asset
      of manifest.assets
    ) {
      expect(asset.source).toMatch(
        /^homebrewery\/images\/.+\.png$/i,
      );
      expect(asset.asset).toMatch(
        /^foundry\/assets\/journals\/.+\.webp$/,
      );
      expect(asset.modulePath).toMatch(
        /^modules\/bane-of-azeroth\/assets\/journals\/.+\.webp$/,
      );
      expect(asset.sourceSha256).toMatch(
        /^[a-f0-9]{64}$/,
      );
      expect(asset.assetSha256).toMatch(
        /^[a-f0-9]{64}$/,
      );
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      expect(asset.sourceBytes).toBeGreaterThan(0);
      expect(asset.assetBytes).toBeGreaterThan(0);
    }
  });

  test("supports repeatable focused source generation", () => {
    const generator = read(
      GENERATOR,
    );

    for (const marker of [
      '"--source"',
      'action="append"',
      "type=Path",
      "default=[]",
      "def resolve_selected_sources(",
      "selected: dict[str, Path] = {}",
      "selected[relative] = source",
      "for source in (sources or [])",
    ]) {
      expect(generator).toContain(marker);
    }
  });

  test("keeps --check global when focused generation exists", () => {
    const generator = read(
      GENERATOR,
    );

    expect(generator).toContain(
      "if args.check and args.source:",
    );
    expect(generator).toMatch(
      /"--source cannot be combined with "\s*"--check\./,
    );
    expect(generator).toContain(
      "if args.check:\n"
        + "        check_generated(root)",
    );
  });

  test("updates focused assets transactionally", () => {
    const generator = read(
      GENERATOR,
    );

    for (const marker of [
      "def convert_selected_with_pillow(",
      "def merge_manifest_entries(",
      "resolve_selected_sources(",
      "except BaseException:",
      "check_generated(root)",
      "selected_sources or None",
    ]) {
      expect(generator).toContain(marker);
    }
  });

  test("keeps CI verification dependency-free", () => {
    const generator = read(
      GENERATOR,
    );

    expect(generator).toContain(
      "def check_generated(",
    );
    expect(generator).toContain(
      "def parse_png(",
    );
    expect(generator).toContain(
      "def parse_webp(",
    );
    expect(generator).toContain(
      "--check",
    );
    expect(generator).toContain(
      "--pillow-worker",
    );
    expect(generator).toContain(
      "lossless=True",
    );
    expect(generator).toContain(
      "exact=True",
    );
    expect(generator).toContain(
      'PILLOW_VERSION = "12.3.0"',
    );
  });
});
