import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  join,
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const SOURCE = resolve(
  "foundry",
  "content",
  "journals",
  "foundry-vtt-guide",
);
const GENERATED = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
  "Foundry_VTT_Guide_BoAJrnlFoundry01.json",
);
const ADVENTURE = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
  "_Adventure.json",
);
const DRUID_IMAGE = resolve(
  "foundry",
  "assets",
  "journals",
  "foundry-guide",
  "druid-forms.webp",
);
const RUNES_IMAGE = resolve(
  "foundry",
  "assets",
  "journals",
  "foundry-guide",
  "death-knight-runes.webp",
);

function readJson(path) {
  return JSON.parse(
    readFileSync(
      path,
      "utf8",
    ),
  );
}

describe(
  "Foundry VTT Guide",
  () => {
    test(
      "ships as a compact five-page player/GM guide",
      () => {
        const journal = readJson(
          join(
            SOURCE,
            "journal.json",
          ),
        );

        expect(journal).toMatchObject({
          key: "foundry-vtt-guide",
          id: "BoAJrnlFoundry01",
          name: "Foundry VTT Guide",
          enabled: true,
        });

        const pageFiles =
          readdirSync(SOURCE)
            .filter(
              file =>
                file.endsWith(".json")
                && file !== "journal.json",
            );
        const pages =
          pageFiles
            .map(
              file =>
                readJson(
                  join(
                    SOURCE,
                    file,
                  ),
                ),
            )
            .sort(
              (left, right) =>
                left.sort - right.sort,
            );

        expect(
          pages.map(
            page => page.name,
          ),
        ).toEqual([
          "Using Bane of Azeroth",
          "Druid Forms",
          "Player Macros",
          "Death Knight Runes",
          "Summons",
        ]);

        expect(
          pages.map(
            page => page.id,
          ),
        ).toEqual([
          "BoAPgFoundryIntr",
          "BoAPgFoundryDrud",
          "BoAPgFoundryMacr",
          "BoAPgFoundryRune",
          "BoAPgFoundrySumm",
        ]);
      },
    );

    test(
      "documents only Foundry-specific user workflows",
      () => {
        const content =
          readdirSync(SOURCE)
            .filter(
              file =>
                file.endsWith(".json")
                && file !== "journal.json",
            )
            .map(
              file =>
                readJson(
                  join(
                    SOURCE,
                    file,
                  ),
                ).source.content,
            )
            .join("\n");

        for (const marker of [
          "Automation Settings",
          "Change Form",
          "Druid Forms",
          "End Effects",
          "Change Druid Form",
          "Clear Rune",
          "Elemental Totems",
          "Warlock Demons",
          "Left-click to place",
        ]) {
          expect(content).toContain(
            marker,
          );
        }

        for (const excluded of [
          "Developer / Diagnostics",
          "System Tests",
          "Troubleshooting",
          "bane-of-azeroth-dev",
        ]) {
          expect(content).not.toContain(
            excluded,
          );
        }
      },
    );

    test(
      "uses the two curated Foundry-guide screenshots",
      () => {
        expect(
          existsSync(
            DRUID_IMAGE,
          ),
        ).toBe(true);
        expect(
          existsSync(
            RUNES_IMAGE,
          ),
        ).toBe(true);

        const druid =
          readJson(
            join(
              SOURCE,
              "druid-forms.json",
            ),
          ).source.content;
        const runes =
          readJson(
            join(
              SOURCE,
              "death-knight-runes.json",
            ),
          ).source.content;

        expect(druid).toContain(
          "modules/bane-of-azeroth/assets/journals/"
          + "foundry-guide/druid-forms.webp",
        );
        expect(runes).toContain(
          "modules/bane-of-azeroth/assets/journals/"
          + "foundry-guide/death-knight-runes.webp",
        );
      },
    );

    test(
      "generates the guide into the Adventure",
      () => {
        expect(
          existsSync(
            GENERATED,
          ),
        ).toBe(true);

        const generated =
          readJson(
            GENERATED,
          );
        expect(generated._id).toBe(
          "BoAJrnlFoundry01",
        );
        expect(generated.pages).toHaveLength(
          5,
        );

        const adventure =
          readJson(
            ADVENTURE,
          );
        expect(
          adventure.journal,
        ).toContain(
          "JournalEntry/"
          + "Bane_of_Azeroth_BoAJournals00001/"
          + "Foundry_VTT_Guide_BoAJrnlFoundry01.json",
        );
      },
    );
  },
);
