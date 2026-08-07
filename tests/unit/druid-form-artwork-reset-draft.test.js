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
  "Druid artwork reset draft contract",
  () => {
    test(
      "Reset to Default is a draft button with dedicated defaults",
      () => {
        expect(source).toContain(
          'class="boa-druid-artwork-reset"',
        );
        expect(source).toContain(
          "data-reset-profile=",
        );
        expect(source).toContain(
          "data-default-portrait=",
        );
        expect(source).toContain(
          "data-default-token=",
        );
        expect(source).toContain(
          'type="hidden"',
        );
        expect(source).not.toContain(
          '<input type="checkbox" `\n          + `name="reset.',
        );
      },
    );

    test(
      "Save resets when both submitted artwork paths equal the profile defaults",
      () => {
        const start =
          source.indexOf(
            "export async function openDruidFormArtworkDialog(",
          );
        const end =
          source.indexOf(
            "\nfunction artworkRoot(",
            start,
          );
        const block =
          source.slice(
            start,
            end,
          );

        expect(
          block,
        ).toContain(
          "portrait ===",
        );
        expect(
          block,
        ).toContain(
          "profile.defaultPortrait",
        );
        expect(
          block,
        ).toContain(
          "token ===",
        );
        expect(
          block,
        ).toContain(
          "profile.defaultToken",
        );
        expect(
          block,
        ).toContain(
          "await resetDruidFormArtwork(",
        );
        expect(
          block,
        ).not.toMatch(
          /formChecked\([\s\S]*?`reset\.\$\{profile\.key\}`/,
        );
      },
    );

    test(
      "reset binder owns the click handler without persisting Actor data",
      () => {
        const dialogStart =
          source.indexOf(
            "export async function openDruidFormArtworkDialog(",
          );
        const dialogEnd =
          source.indexOf(
            "\nfunction artworkRoot(",
            dialogStart,
          );
        const dialogBlock =
          source.slice(
            dialogStart,
            dialogEnd,
          );

        expect(
          dialogBlock,
        ).toContain(
          "boaBindDruidResetDraft",
        );

        const binderStart =
          source.indexOf(
            "function boaBindDruidResetDraft(",
          );
        const binderEnd =
          source.indexOf(
            "\nexport async function openDruidFormArtworkDialog(",
            binderStart,
          );
        const binderBlock =
          source.slice(
            binderStart,
            binderEnd,
          );

        expect(
          binderStart,
        ).toBeGreaterThanOrEqual(
          0,
        );
        expect(
          binderEnd,
        ).toBeGreaterThan(
          binderStart,
        );
        expect(
          binderBlock,
        ).toContain(
          "button.addEventListener",
        );
        expect(
          binderBlock,
        ).toContain(
          '"click"',
        );
        expect(
          binderBlock,
        ).not.toMatch(
          /\b(?:setFlag|unsetFlag|resetDruidFormArtwork|setDruidFormArtwork)\s*\(/,
        );
      },
    );

  },
);
