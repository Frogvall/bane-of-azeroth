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

const HCA = resolve(
  "foundry",
  "content",
  "heroic-class-abilities.json",
);

const JOURNAL = resolve(
  "foundry",
  "content",
  "journals",
  "player-options",
  "heroic-class-abilities.json",
);

const LINK =
  "@Ref[dragonbane-core:rule.resist-cold]" +
  "{resist cold}";

describe(
  "Frostreaper rules reference",
  () => {
    test("links Resist Cold from the Heroic Class Ability source", () => {
      const source =
        JSON.parse(
          readFileSync(
            HCA,
            "utf8",
          ),
        );

      const deathKnight =
        source.classes.find(
          entry =>
            entry.key ===
              "death-knight",
        );

      const frostreaper =
        deathKnight?.abilities?.find(
          ability =>
            ability.key ===
              "frostreaper",
        );

      expect(
        frostreaper,
      ).toBeTruthy();

      expect(
        frostreaper.description.join(
          "\n",
        ),
      ).toContain(
        LINK,
      );
    });

    test("links Resist Cold from the Heroic Class Abilities Journal source", () => {
      const source =
        JSON.parse(
          readFileSync(
            JOURNAL,
            "utf8",
          ),
        );

      expect(
        source.source.content,
      ).toContain(
        LINK,
      );

      expect(
        source.source.content,
      ).toContain(
        "@Ref[boa:item.heroic-class-ability.death-knight.frostreaper]",
      );
    });
  },
);
