import { afterEach, describe, expect, test, vi } from "vitest";
import {
  DEVELOPER_SETTING_KEYS,
  DeveloperSettingsForm,
  applyDeveloperSettings,
  isDevelopmentBuild,
  registerDeveloperSettings,
} from "../../foundry/scripts/developer-settings.js";

const MODULE_ID = "bane-of-azeroth";

afterEach(() => {
  delete globalThis.game;
});

function devModule(api = {}) {
  return {
    flags: {
      [MODULE_ID]: {
        developmentBuild: true,
      },
    },
    api,
  };
}

describe("developer settings", () => {
  test("detects only an explicit development-build manifest flag", () => {
    expect(isDevelopmentBuild(devModule())).toBe(true);
    expect(isDevelopmentBuild({ flags: {} })).toBe(false);
    expect(isDevelopmentBuild(null)).toBe(false);
  });

  test("does not register developer settings for production packages", () => {
    const settings = {
      register: vi.fn(),
      registerMenu: vi.fn(),
    };

    expect(registerDeveloperSettings(settings, { flags: {} })).toBe(false);
    expect(settings.register).not.toHaveBeenCalled();
    expect(settings.registerMenu).not.toHaveBeenCalled();
  });

  test("registers Druid lifecycle tracing as an opt-in client setting in development builds", () => {
    const settings = {
      register: vi.fn(),
      registerMenu: vi.fn(),
    };

    expect(registerDeveloperSettings(settings, devModule())).toBe(true);
    expect(settings.register).toHaveBeenCalledWith(
      MODULE_ID,
      DEVELOPER_SETTING_KEYS.DRUID_LIFECYCLE_TRACE,
      expect.objectContaining({
        scope: "client",
        config: false,
        type: Boolean,
        default: false,
        onChange: expect.any(Function),
      }),
    );
    expect(settings.registerMenu).toHaveBeenCalledWith(
      MODULE_ID,
      "developerSettings",
      expect.objectContaining({
        type: DeveloperSettingsForm,
        restricted: false,
      }),
    );
  });

  test("Druid lifecycle trace hooks are dormant until explicitly enabled and removed again when disabled", async () => {
    vi.resetModules();
    const on = vi.fn((event) => `hook-${event}`);
    const off = vi.fn();
    globalThis.Hooks = { on, off };

    const lifecycle = await import(
      "../../foundry/scripts/druid-form-lifecycle.js"
    );

    expect(lifecycle.isDruidLifecycleTraceEnabled()).toBe(false);
    expect(on).not.toHaveBeenCalled();

    lifecycle.setDruidLifecycleTraceEnabled(true, { Hooks: globalThis.Hooks });
    expect(lifecycle.isDruidLifecycleTraceEnabled()).toBe(true);
    expect(on).toHaveBeenCalledTimes(3);
    expect(on.mock.calls.map(([event]) => event)).toEqual([
      "updateActor",
      "updateToken",
      "refreshToken",
    ]);

    lifecycle.setDruidLifecycleTraceEnabled(false, { Hooks: globalThis.Hooks });
    expect(lifecycle.isDruidLifecycleTraceEnabled()).toBe(false);
    expect(off).toHaveBeenCalledTimes(3);

    delete globalThis.Hooks;
  });

  test("applies the saved trace setting through the module API", () => {
    const setter = vi.fn();
    const settings = {
      get: vi.fn(() => true),
    };
    const module = devModule({
      setDruidLifecycleTraceEnabled: setter,
    });

    expect(applyDeveloperSettings(settings, module)).toBe(true);
    expect(setter).toHaveBeenCalledWith(true);
  });
});
