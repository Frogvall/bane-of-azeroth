import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const druid = readFileSync(
  resolve("foundry", "scripts", "druid-forms.js"),
  "utf8",
);
const lifecycle = readFileSync(
  resolve("foundry", "scripts", "druid-form-lifecycle.js"),
  "utf8",
);

describe("Druid 0.11.7 lifecycle repair contracts", () => {
  test("artwork Save treats the two built-in paths as Reset to Default", () => {
    const start = druid.indexOf(
      "export async function openDruidFormArtworkDialog(",
    );
    const end = druid.indexOf("\\nfunction artworkRoot(", start);
    const block = druid.slice(start, end);

    expect(block).toContain("portrait === profile.defaultPortrait");
    expect(block).toContain("token === profile.defaultToken");
    expect(block).toContain("await resetDruidFormArtwork(");
  });

  test("artwork renderer no longer deletes the shared Druid control row", () => {
    const start = druid.indexOf(
      "export function onRenderDruidFormArtworkActorSheet(",
    );
    const block = druid.slice(start);

    expect(block).toContain('".boa-druid-form-artwork-button"');
    expect(block).not.toMatch(
      /querySelector\(\s*["']\.boa-druid-form-artwork-controls["']\s*,?\s*\)[\s\S]{0,80}\?\.remove/,
    );
  });

  test("Druid state replacement uses unsetFlag plus setFlag", () => {
    const start = lifecycle.indexOf("async function persistState(");
    const end = lifecycle.indexOf("\\nasync function syncArtwork(", start);
    const block = lifecycle.slice(start, end);

    expect(block).toContain("await actor.unsetFlag(");
    expect(block).toContain("await actor.setFlag(");
  });

  test("Druid rest wrapper preserves the shared summon lifecycle marker", () => {
    expect(lifecycle).toContain("SUMMON_REST_PATCH_MARKER");
    expect(lifecycle).toContain("summonLifecycleMetadata");
  });

  test("active forms expose a visible Change Form sheet action", () => {
    expect(lifecycle).toContain("boa-druid-form-switch-button");
    expect(lifecycle).toContain("Change Form");
  });
});
