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

const LOCALE_PATH =
  fileURLToPath(
    new URL(
      "../../foundry/lang/en.json",
      import.meta.url,
    ),
  );

describe("Mage's Brilliance LANGUAGES localization", () => {
  test("defines Roll, Take 10, and Cancel choice text", () => {
    const locale =
      JSON.parse(
        readFileSync(
          LOCALE_PATH,
          "utf8",
        ),
      );

    const dialog =
      locale?.BOA?.dialog ?? {};

    expect(
      dialog
        .mageBrillianceLanguagesTitle,
    ).toContain("{skill}");

    expect(
      dialog
        .mageBrillianceLanguagesContent,
    ).toContain("{skill}");

    expect(
      dialog
        .mageBrillianceLanguagesRoll,
    ).toBe("Roll");

    expect(
      dialog
        .mageBrillianceLanguagesTakeTen,
    ).toBe("Take 10");

    expect(
      dialog
        .mageBrillianceLanguagesCancel,
    ).toBe("Cancel");
  });
});
