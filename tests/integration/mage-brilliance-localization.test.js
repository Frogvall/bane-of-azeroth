import {
  describe,
  expect,
  test,
} from "vitest";
import {
  readFileSync,
} from "node:fs";
import {
  fileURLToPath,
} from "node:url";

const LOCALE_PATH = fileURLToPath(
  new URL(
    "../../foundry/lang/en.json",
    import.meta.url,
  ),
);

describe("Mage's Brilliance localization", () => {
  test("defines a free Sense Magic prompt without a 1 WP claim", () => {
    const locale = JSON.parse(
      readFileSync(LOCALE_PATH, "utf8"),
    );

    const prompt =
      locale
        ?.BOA
        ?.dialog
        ?.mageBrillianceFreeSenseMagicContent;

    expect(prompt).toBe(
      "Cast {spell} without spending WP?",
    );
    expect(prompt).not.toContain("1 WP");
  });
});
