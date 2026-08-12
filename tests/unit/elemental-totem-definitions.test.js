import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  loadElementalTotemDefinitions,
} from "../../foundry/scripts/elemental-totems.js";

function validContent(overrides = {}) {
  return {
    defaults: {
      auraRange: 10,
      hitPoints: 10,
      armorRating: 2,
      tokenWidth: 0.5,
      tokenHeight: 0.5,
      ...(overrides.defaults ?? {}),
    },
    totems: overrides.totems ?? [
      {
        key: "cleansing",
        name: "Cleansing Totem",
        auraColor: "#38bdf8",
      },
      {
        key: "windfury",
        name: "Windfury Totem",
      },
    ],
  };
}

describe("loadElementalTotemDefinitions", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    delete globalThis.fetch;
  });

  test("loads and normalizes valid definitions", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => validContent(),
    });

    const definitions = await loadElementalTotemDefinitions();

    expect(definitions).toEqual({
      baseRange: 10,
      baseHitPoints: 10,
      baseArmor: 2,
      tokenWidth: 0.5,
      tokenHeight: 0.5,
      totems: [
        {
          key: "cleansing",
          name: "Cleansing Totem",
          auraColor: "#38bdf8",
        },
        {
          key: "windfury",
          name: "Windfury Totem",
          auraColor: "#00ff00",
        },
      ],
    });
  });

  test("rejects a failed HTTP response", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    await expect(loadElementalTotemDefinitions()).rejects.toThrow(
      /404 Not Found/
    );
  });

  test.each([
    [{}, /missing defaults or totems/i],
    [{ defaults: {}, totems: [] }, /missing defaults or totems/i],
  ])("rejects missing structural data %#", async (content, message) => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => content,
    });

    await expect(loadElementalTotemDefinitions()).rejects.toThrow(message);
  });

  test.each([
    ["auraRange", 0],
    ["auraRange", -1],
    ["hitPoints", Number.NaN],
    ["armorRating", "2"],
    ["tokenWidth", 0],
    ["tokenHeight", null],
  ])("rejects invalid positive number %s=%s", async (field, value) => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => validContent({
        defaults: {
          [field]: value,
        },
      }),
    });

    await expect(loadElementalTotemDefinitions()).rejects.toThrow(
      new RegExp(`defaults\\.${field}.*positive number`, "i")
    );
  });

  test.each([
    [
      [
        { key: "", name: "No Key" },
      ],
    ],
    [
      [
        { key: "cleansing", name: "" },
      ],
    ],
  ])("rejects a totem without key or name %#", async totems => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => validContent({ totems }),
    });

    await expect(loadElementalTotemDefinitions()).rejects.toThrow(
      /must have a key and a name/i
    );
  });

  test("rejects duplicate totem keys", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => validContent({
        totems: [
          { key: "cleansing", name: "One" },
          { key: "cleansing", name: "Two" },
        ],
      }),
    });

    await expect(loadElementalTotemDefinitions()).rejects.toThrow(
      /keys must be unique/i
    );
  });
});
