import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const source =
  readFileSync(
    resolve(
      "foundry",
      "scripts",
      "druid-forms.js",
    ),
    "utf8",
  );

describe(
  "Druid placed-token humanoid restore contract",
  () => {
    test(
      "restore enumerates live Actor Scene Tokens and accepts managed current-form provenance",
      () => {
        const start =
          source.indexOf(
            "async function restoreDruidHumanoidArtworkNow(",
          );
        const end =
          source.indexOf(
            "\nfunction primaryActiveGM(",
            start,
          );
        const block =
          source.slice(
            start,
            end,
          );

        expect(block).toContain(
          "actorSceneTokens(",
        );
        expect(block).toContain(
          "managedTokenSources",
        );
        expect(block).toContain(
          "currentProfileArtwork",
        );
        expect(block).toContain(
          "restoredTokenKeys",
        );
      },
    );
  },
);
