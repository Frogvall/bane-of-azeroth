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
  "Druid reset draft form-root handling",
  () => {
    test(
      "resolves the inner artwork form from the Foundry render wrapper",
      () => {
        const start =
          source.indexOf(
            "export function boaBindDruidResetDraft(",
          );
        const end =
          source.indexOf(
            "\\nexport async function openDruidFormArtworkDialog(",
            start,
          );
        const block =
          source.slice(
            start,
            end,
          );

        expect(
          start,
        ).toBeGreaterThanOrEqual(
          0,
        );
        expect(
          block,
        ).toContain(
          '"form.boa-druid-form-artwork-dialog"',
        );
        expect(
          block,
        ).toContain(
          "dialogForm.elements",
        );
        expect(
          block,
        ).toContain(
          "dialogForm.querySelectorAll",
        );
        expect(
          block,
        ).toContain(
          "button.addEventListener",
        );
      },
    );
  },
);
