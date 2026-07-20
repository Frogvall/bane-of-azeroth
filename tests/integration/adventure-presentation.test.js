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
const MODULE_ROOT = resolve("foundry");
const ADVENTURE_SOURCE = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "_Adventure.json"
);

function readAdventure() {
  return JSON.parse(
    readFileSync(ADVENTURE_SOURCE, "utf-8")
  );
}

function resolveModuleAsset(modulePath) {
  const prefix = `modules/${MODULE_ID}/`;

  expect(modulePath).toMatch(
    /^modules\/bane-of-azeroth\//
  );

  const relativePath = modulePath.slice(
    prefix.length
  );
  const absolutePath = resolve(
    MODULE_ROOT,
    relativePath
  );
  const moduleRootPrefix = `${MODULE_ROOT}${sep}`;

  expect(
    absolutePath.startsWith(moduleRootPrefix)
  ).toBe(true);

  return absolutePath;
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
    throw new Error("The Adventure banner is not a valid WebP file.");
  }

  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString(
      "ascii",
      offset,
      offset + 4
    );
    const chunkSize = buffer.readUInt32LE(
      offset + 4
    );
    const dataOffset = offset + 8;

    if (dataOffset + chunkSize > buffer.length) {
      throw new Error(
        `Invalid WebP ${chunkType} chunk length.`
      );
    }

    if (chunkType === "VP8X") {
      if (chunkSize < 10) {
        throw new Error("Invalid WebP VP8X header.");
      }

      return {
        width:
          1 + readUInt24LE(buffer, dataOffset + 4),
        height:
          1 + readUInt24LE(buffer, dataOffset + 7),
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
    "The Adventure banner has no supported WebP image header."
  );
}

describe("Adventure import presentation", () => {
  test("uses a packaged module WebP path", () => {
    const adventure = readAdventure();

    expect(adventure.img).toMatch(
      /^modules\/bane-of-azeroth\/assets\/adventure\/.+\.webp$/i
    );
    expect(adventure.img).not.toMatch(
      /^(?:assets2\/|\/|[A-Za-z]:[\\/])/
    );
  });

  test("ships the banner referenced by the Adventure", () => {
    const adventure = readAdventure();
    const bannerPath = resolveModuleAsset(
      adventure.img
    );

    expect(existsSync(bannerPath)).toBe(true);
    expect(statSync(bannerPath).isFile()).toBe(
      true
    );
  });

  test("uses the approved 1536 by 600 banner canvas", () => {
    const adventure = readAdventure();
    const bannerPath = resolveModuleAsset(
      adventure.img
    );
    const dimensions = readWebpDimensions(
      readFileSync(bannerPath)
    );

    expect(dimensions).toEqual({
      width: 1536,
      height: 600,
    });
  });

  test("keeps the packaged banner reasonably small", () => {
    const adventure = readAdventure();
    const bannerPath = resolveModuleAsset(
      adventure.img
    );

    expect(
      statSync(bannerPath).size
    ).toBeLessThanOrEqual(512 * 1024);
  });

  test("uses intentional HTML caption content without placeholders", () => {
    const adventure = readAdventure();
    const caption = String(
      adventure.caption ?? ""
    ).trim();

    expect(caption).not.toBe("");
    expect(caption).not.toMatch(
      /test caption|placeholder|todo/i
    );
    expect(caption).not.toMatch(/^#{1,6}\s/m);
    expect(caption).toMatch(/<[^>]+>/);
    expect(caption).toMatch(/bane of azeroth/i);
  });

  test("explains what importing the Adventure does", () => {
    const adventure = readAdventure();
    const description = String(
      adventure.description ?? ""
    ).trim();

    expect(description).not.toBe("");
    expect(description).not.toMatch(
      /placeholder|todo/i
    );
    expect(description).toMatch(/import/i);
    expect(description).toMatch(/adventure/i);
    expect(description).toMatch(/world/i);
  });
});
