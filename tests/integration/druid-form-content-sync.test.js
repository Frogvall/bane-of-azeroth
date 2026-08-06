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

const SPELLS = resolve(
  "foundry",
  "content",
  "spells.json",
);

const HEROIC = resolve(
  "foundry",
  "content",
  "heroic-class-abilities.json",
);

const JOURNAL_SPELLS = resolve(
  "foundry",
  "content",
  "journals",
  "player-options",
  "spells.json",
);

const BOOK = resolve(
  "homebrewery",
  "Bane of Azeroth.md",
);

function read(path) {
  return readFileSync(
    path,
    "utf8",
  );
}

function spellByKey(
  content,
  key,
) {
  return content.spells.find(
    spell =>
      spell.key === key,
  );
}

describe(
  "Druid incarnation content synchronization",
  () => {
    test(
      "all four Druid incarnation spells use the shared 1 WP free-action form-switch rule",
      () => {
        const content =
          JSON.parse(
            read(
              SPELLS,
            ),
          );

        for (
          const key
          of [
            "savage-incarnation",
            "feral-incarnation",
            "incarnation-of-harmony",
            "incarnation-of-the-stars",
          ]
        ) {
          const spell =
            spellByKey(
              content,
              key,
            );

          expect(
            spell,
            key,
          ).toBeTruthy();

          expect(
            spell.descriptionHtml,
            key,
          ).toContain(
            "as a free action if you spend 1 WP",
          );

          expect(
            spell.descriptionHtml,
            key,
          ).not.toContain(
            "as a free action if you spend one WP",
          );
        }
      },
    );

    test(
      "the corrected rule exists in Homebrewery for all four incarnation spells",
      () => {
        const book =
          read(
            BOOK,
          );

        expect(
          book.match(
            /as a free action if you spend 1 WP/g,
          )?.length,
        ).toBeGreaterThanOrEqual(
          4,
        );
      },
    );

    test(
      "Druid Heroic Abilities still grant the corrected incarnation Spell Items",
      () => {
        const content =
          JSON.parse(
            read(
              HEROIC,
            ),
          );

        const druid =
          content.classes.find(
            entry =>
              entry.key ===
                "druid",
          );

        expect(
          druid,
        ).toBeTruthy();

        const grants =
          Object.fromEntries(
            druid.abilities.map(
              ability => [
                ability.key,
                ability.grantsSpell ??
                  null,
              ],
            ),
          );

        expect(
          grants,
        ).toMatchObject({
          "druidic-awakening":
            "savage-incarnation",
          "king-of-the-jungle":
            "feral-incarnation",
          "tree-of-life":
            "incarnation-of-harmony",
          "chosen-of-elune":
            "incarnation-of-the-stars",
        });
      },
    );

    test(
      "the Character Options Journal renders all four generated Druid Spell Items",
      () => {
        const journal =
          JSON.parse(
            read(
              JOURNAL_SPELLS,
            ),
          );

        const content =
          journal.source.content;

        for (
          const id
          of [
            "SavIncarn6e7f8g9",
            "FeralInc2OpQrS3t",
            "Harmony4UvWxY5zQ",
            "StarsInc6AbCdE7f",
          ]
        ) {
          expect(
            content,
          ).toContain(
            `@DisplaySpell[Item.${id}]`,
          );
        }
      },
    );
  },
);
