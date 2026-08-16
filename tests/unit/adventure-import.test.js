import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  getContentVersion,
  promptAdventureImport,
} from "../../foundry/scripts/adventure-import.js";

describe("Adventure import version handling", () => {
  beforeEach(() => {
    game.user.isGM = true;
    game.modules = new Map([
      [
        "bane-of-azeroth",
        {
          version: "0.7.0-foundry.12.1",
        },
      ],
    ]);
    game.packs = new Map();
    game.settings.get.mockReset();
    game.settings.set.mockReset();
    foundry.utils.isNewerVersion.mockReset();
  });

  test("normalizes prerelease versions to semantic content version", () => {
    expect(getContentVersion()).toBe("0.7.0");
  });

  test("keeps a non-semantic version unchanged", () => {
    game.modules.set("bane-of-azeroth", {
      version: "development",
    });

    expect(getContentVersion()).toBe("development");
  });

  test("does nothing for non-GM users", async () => {
    game.user.isGM = false;

    await promptAdventureImport();

    expect(game.settings.get).not.toHaveBeenCalled();
  });

  test("does not prompt again for the same or older content version", async () => {
    game.settings.get.mockReturnValue("0.7.0");
    foundry.utils.isNewerVersion.mockReturnValue(false);

    await promptAdventureImport();

    expect(game.packs.size).toBe(0);
    expect(game.settings.set).not.toHaveBeenCalled();
  });

  test("opens the Adventure and stores the prompted version", async () => {
    game.settings.get.mockReturnValue("0.6.0");
    foundry.utils.isNewerVersion.mockReturnValue(true);

    const render = vi.fn(async () => undefined);
    const AdventureImporterV2 = vi.fn(function (options) {
      this.options = options;
      this.render = render;
    });
    foundry.applications ??= {};
    foundry.applications.sheets ??= {};
    foundry.applications.sheets.AdventureImporterV2 =
      AdventureImporterV2;

    const adventure = {};
    const pack = {
      getIndex: vi.fn(async () => ({
        contents: [
          {
            _id: "adventure-id",
          },
        ],
      })),
      getDocument: vi.fn(async () => adventure),
    };
    game.packs.set("bane-of-azeroth.bane-of-azeroth", pack);

    await promptAdventureImport();

    expect(pack.getDocument).toHaveBeenCalledWith("adventure-id");
    expect(AdventureImporterV2).toHaveBeenCalledWith({
      document: adventure,
    });
    expect(render).toHaveBeenCalledWith(true);
    expect(game.settings.set).toHaveBeenCalledWith(
      "bane-of-azeroth",
      "adventurePromptVersion",
      "0.7.0"
    );
  });

  test("logs and returns when the Adventure pack is missing", async () => {
    game.settings.get.mockReturnValue("");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await promptAdventureImport();

    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/Adventure pack .* was not found/i)
    );
    expect(game.settings.set).not.toHaveBeenCalled();
  });

  test("logs and returns when the pack contains no Adventure", async () => {
    game.settings.get.mockReturnValue("");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    game.packs.set("bane-of-azeroth.bane-of-azeroth", {
      getIndex: vi.fn(async () => ({ contents: [] })),
    });

    await promptAdventureImport();

    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/No Adventure document was found/i)
    );
    expect(game.settings.set).not.toHaveBeenCalled();
  });
});
