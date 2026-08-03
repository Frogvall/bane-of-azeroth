import {
  readFileSync,
  readdirSync,
  statSync,
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

const MODULE_ID = "bane-of-azeroth";

const HEROIC_SOURCE = resolve(
  "foundry",
  "content",
  "heroic-class-abilities.json",
);
const SPELL_SOURCE = resolve(
  "foundry",
  "content",
  "spells.json",
);
const JOURNAL_SOURCE = resolve(
  "foundry",
  "content",
  "journals",
  "player-options",
  "heroic-class-abilities.json",
);
const HEROIC_GENERATOR = resolve(
  "tools",
  "generate-heroic-class-abilities.py",
);
const ADVENTURE_DIRECTORY = resolve(
  "foundry",
  "pack-src",
  "bane-of-azeroth",
  "Bane_of_Azeroth_ZoNOXZjdkOjV56e3",
);
const ITEM_DIRECTORY = join(
  ADVENTURE_DIRECTORY,
  "Item",
);
const GENERATED_JOURNAL = join(
  ADVENTURE_DIRECTORY,
  "JournalEntry",
  "Bane_of_Azeroth_BoAJournals00001",
  "Character_Options_BoAJrnlPlayerOpt.json",
);

function read(path) {
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(read(path));
}

function filesBelow(directory) {
  const result = [];

  function visit(current) {
    for (
      const entry
      of readdirSync(current).sort()
    ) {
      const path = join(current, entry);
      const stats = statSync(path);

      if (stats.isDirectory()) {
        visit(path);
      } else if (
        stats.isFile()
        && path.endsWith(".json")
      ) {
        result.push(path);
      }
    }
  }

  visit(directory);
  return result;
}

function itemsByContentKey() {
  const result = new Map();

  for (const path of filesBelow(ITEM_DIRECTORY)) {
    if (path.endsWith("_Folder.json")) continue;

    const item = readJson(path);
    const contentKey =
      item.flags?.[MODULE_ID]?.contentKey;

    if (typeof contentKey !== "string") continue;

    expect(result.has(contentKey)).toBe(false);
    result.set(contentKey, item);
  }

  return result;
}

function sourceDescription(ability) {
  if (
    typeof ability.descriptionHtml === "string"
  ) {
    return ability.descriptionHtml;
  }

  return (ability.description ?? []).join(" ");
}

function occurrences(value, marker) {
  return String(value).split(marker).length - 1;
}

describe("spell-granting Heroic Class Abilities", () => {
  test("records the external Sense Magic grant for Mage's Brilliance", () => {
    const heroic = readJson(HEROIC_SOURCE);
    const mage = heroic.classes.find(
      entry => entry.key === "mage",
    );
    const brilliance = mage?.abilities.find(
      ability => ability.key === "mages-brilliance",
    );

    expect(brilliance?.grantsSpellUuid).toBe(
      "Item.RPnxXYVb8z7EG5Wl",
    );
  });

  test("uses one symbolic Spell reference in each source description", () => {
    const heroic = readJson(HEROIC_SOURCE);
    const spells = readJson(SPELL_SOURCE);
    const journal = readJson(JOURNAL_SOURCE);
    const spellsByKey = new Map(
      spells.spells.map(
        spell => [spell.key, spell],
      ),
    );

    const grants = heroic.classes.flatMap(
      classEntry =>
        classEntry.abilities
          .filter(
            ability =>
              typeof ability.grantsSpell
              === "string",
          )
          .map(
            ability => ({
              classEntry,
              ability,
            }),
          ),
    );

    expect(grants).toHaveLength(6);
    expect(
      new Set(
        grants.map(
          entry =>
            entry.ability.grantsSpell,
        ),
      ).size,
    ).toBe(6);

    for (const { ability } of grants) {
      const spell = spellsByKey.get(
        ability.grantsSpell,
      );

      expect(spell).toBeDefined();

      const reference =
        "@Ref[boa:item.spells."
        + `${spell.key}]`
        + `{${spell.name}}`;

      expect(
        occurrences(
          sourceDescription(ability),
          reference,
        ),
      ).toBe(1);
      expect(
        occurrences(
          journal.source.content,
          reference,
        ),
      ).toBe(1);
    }
  });

  test("generates UUID Spell links in Ability Items and the Journal", () => {
    const heroic = readJson(HEROIC_SOURCE);
    const spells = readJson(SPELL_SOURCE);
    const items = itemsByContentKey();
    const journal = readJson(
      GENERATED_JOURNAL,
    );
    const page = journal.pages.find(
      candidate =>
        candidate.flags?.[MODULE_ID]?.contentKey
        === (
          "journal-page.player-options."
          + "heroic-class-abilities"
        ),
    );

    expect(page).toBeDefined();
    expect(page.text.content).not.toContain(
      "@Ref[",
    );

    const spellsByKey = new Map(
      spells.spells.map(
        spell => [spell.key, spell],
      ),
    );

    let abilityLinks = 0;
    let journalLinks = 0;

    for (const classEntry of heroic.classes) {
      for (const ability of classEntry.abilities) {
        if (
          typeof ability.grantsSpell
          !== "string"
        ) {
          continue;
        }

        const spell = spellsByKey.get(
          ability.grantsSpell,
        );
        const generatedSpell = items.get(
          `spells.${spell.key}`,
        );
        const generatedAbility = items.get(
          "heroic-class-ability."
          + `${classEntry.key}.${ability.key}`,
        );

        expect(generatedSpell).toBeDefined();
        expect(generatedAbility).toBeDefined();
        expect(generatedSpell._id).toBe(
          spell.id,
        );

        const uuidLink =
          `@UUID[Item.${spell.id}]`
          + `{${spell.name}}`;

        expect(
          generatedAbility.system
            .itemDescription,
        ).toContain(uuidLink);
        expect(page.text.content).toContain(
          uuidLink,
        );

        abilityLinks += 1;
        journalLinks += 1;
      }
    }

    expect(abilityLinks).toBe(6);
    expect(journalLinks).toBe(6);
  });

  test("makes the Heroic Ability generator resolve Spell references", () => {
    const source = read(HEROIC_GENERATOR);

    for (const marker of [
      '"--spells-content"',
      "def load_spell_references(",
      "def resolve_spell_references(",
      "def resolve_granted_spell_description(",
      "spell_references = load_spell_references(",
      "resolve_granted_spell_description(",
    ]) {
      expect(source).toContain(marker);
    }
  });
});
