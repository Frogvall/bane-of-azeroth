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
      "restore uses TokenDocument-local baseline provenance for live Scene Tokens",
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
      "TOKEN_ARTWORK_BASELINE_FLAG",
    );
        expect(block).toContain(
      "tokenBaseline.applied",
    );
    expect(block).toContain(
      "tokenBaseline.original",
    );
        expect(block).toContain(
      "unsetDocumentFlag(",
    );
      },
    );
  },
);
