import {
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import {
  resolve,
  sep,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const MODULE_ID = "bane-of-azeroth";
const PACK_NAME = "bane-of-azeroth";
const DEV_TEST_PACK_NAME = "bane-of-azeroth-dev-tests";
const MODULE_ROOT = resolve("foundry");
const MODULE_MANIFEST = resolve(
  MODULE_ROOT,
  "module.json",
);
const PACKAGE_SCRIPT = resolve(
  "tools",
  "package-foundry.sh",
);
const BANNER_RELATIVE =
  "assets/pack-banners/adventure.webp";
const SYSTEM_TEST_BANNER_RELATIVE =
  "assets/pack-banners/system-tests.webp";
const BANNER_SOURCE =
  `modules/${MODULE_ID}/${BANNER_RELATIVE}`;

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function readUInt24LE(buffer, offset) {
  return (
    buffer[offset]
    | (buffer[offset + 1] << 8)
    | (buffer[offset + 2] << 16)
  );
}

function readWebpDimensions(buffer) {
  if (
    buffer.length < 20
    || buffer.toString("ascii", 0, 4) !== "RIFF"
    || buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new Error(
      "The Compendium banner is not a valid WebP file.",
    );
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString(
      "ascii",
      offset,
      offset + 4,
    );
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (dataOffset + chunkSize > buffer.length) {
      throw new Error(
        `Invalid WebP ${chunkType} chunk length.`,
      );
    }

    if (chunkType === "VP8X") {
      if (chunkSize < 10) {
        throw new Error("Invalid WebP VP8X header.");
      }
      return {
        width: 1 + readUInt24LE(buffer, dataOffset + 4),
        height: 1 + readUInt24LE(buffer, dataOffset + 7),
      };
    }

    if (chunkType === "VP8L") {
      if (
        chunkSize < 5
        || buffer[dataOffset] !== 0x2f
      ) {
        throw new Error("Invalid WebP VP8L header.");
      }
      const byte1 = buffer[dataOffset + 1];
      const byte2 = buffer[dataOffset + 2];
      const byte3 = buffer[dataOffset + 3];
      const byte4 = buffer[dataOffset + 4];

      return {
        width:
          1
          + byte1
          + ((byte2 & 0x3f) << 8),
        height:
          1
          + (byte2 >> 6)
          + (byte3 << 2)
          + ((byte4 & 0x0f) << 10),
      };
    }

    if (chunkType === "VP8 ") {
      if (
        chunkSize < 10
        || buffer[dataOffset + 3] !== 0x9d
        || buffer[dataOffset + 4] !== 0x01
        || buffer[dataOffset + 5] !== 0x2a
      ) {
        throw new Error("Invalid WebP VP8 frame header.");
      }
      return {
        width:
          buffer.readUInt16LE(dataOffset + 6)
          & 0x3fff,
        height:
          buffer.readUInt16LE(dataOffset + 8)
          & 0x3fff,
      };
    }

    offset =
      dataOffset
      + chunkSize
      + (chunkSize % 2);
  }

  throw new Error(
    "The Compendium banner has no supported WebP image header.",
  );
}

function resolveModuleAsset(modulePath) {
  const prefix = `modules/${MODULE_ID}/`;
  expect(modulePath.startsWith(prefix)).toBe(true);

  const absolutePath = resolve(
    MODULE_ROOT,
    modulePath.slice(prefix.length),
  );
  const moduleRootPrefix = `${MODULE_ROOT}${sep}`;
  expect(
    absolutePath.startsWith(moduleRootPrefix),
  ).toBe(true);
  return absolutePath;
}

function expectBannerAsset(relativePath) {
  const bannerPath = resolve(MODULE_ROOT, relativePath);
  expect(existsSync(bannerPath)).toBe(true);
  expect(statSync(bannerPath).isFile()).toBe(true);
  expect(
    readWebpDimensions(readFileSync(bannerPath)),
  ).toEqual({
    width: 290,
    height: 70,
  });
}

describe("0.12.3 package presentation", () => {
  test("declares canonical project presentation metadata", () => {
    const manifest = readJson(MODULE_MANIFEST);

    expect(manifest.description).toBe(
      "Unofficial Warcraft-inspired rules, content, and automation for Dragonbane.",
    );
    expect(manifest.url).toBe(
      "https://github.com/Frogvall/bane-of-azeroth",
    );
    expect(manifest.bugs).toBe(
      "https://github.com/Frogvall/bane-of-azeroth/issues",
    );
  });

  test("declares the Adventure Compendium banner", () => {
    const manifest = readJson(MODULE_MANIFEST);
    const adventurePack = manifest.packs?.find(
      (pack) => pack.name === PACK_NAME,
    );

    expect(adventurePack).toBeDefined();
    expect(adventurePack?.banner).toBe(BANNER_SOURCE);
  });

  test("ships both 290 by 70 WebP Compendium banners", () => {
    expectBannerAsset(BANNER_RELATIVE);
    expectBannerAsset(SYSTEM_TEST_BANNER_RELATIVE);
  });

  test("keeps Adventure and developer-test banners package-qualified", () => {
    const source = read(PACKAGE_SCRIPT);

    expect(source).toContain(
      'PACK_BANNER_RELATIVE="assets/pack-banners/adventure.webp"',
    );
    expect(source).toContain(
      'DEV_TEST_PACK_BANNER_RELATIVE="assets/pack-banners/system-tests.webp"',
    );
    expect(source).toContain(
      '--arg packBannerRelative "$PACK_BANNER_RELATIVE"',
    );
    expect(source).toContain(
      '+ $packBannerRelative',
    );
    expect(source).toContain(
      'EXPECTED_PACK_BANNER="modules/${MODULE_ID}/${PACK_BANNER_RELATIVE}"',
    );
    expect(source).toContain(
      'EXPECTED_DEV_TEST_PACK_BANNER="modules/${MODULE_ID}/${DEV_TEST_PACK_BANNER_RELATIVE}"',
    );
    expect(source).toContain(
      '--arg banner "$EXPECTED_DEV_TEST_PACK_BANNER"',
    );
    expect(source).toContain(
      '"banner": $banner',
    );
    expect(source).toContain(
      '--arg packName "$DEV_TEST_PACK_NAME"',
    );
    expect(source).toContain(
      'The packaged developer-test Compendium banner paths are incorrect.',
    );
  });
});
