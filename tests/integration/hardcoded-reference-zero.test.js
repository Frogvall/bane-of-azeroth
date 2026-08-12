import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const ROOT = process.cwd();

const BASELINE = path.join(
  ROOT,
  "foundry",
  "config",
  "references",
  "hardcoded-reference-baseline.json",
);

const INVENTORY_GENERATOR = path.join(
  ROOT,
  "tools",
  "generate-reference-inventory.py",
);

const JOURNAL_GENERATOR = path.join(
  ROOT,
  "tools",
  "generate-journals.py",
);

const SHARED_REFERENCES = path.join(
  ROOT,
  "tools",
  "boa-references.py",
);

const AUTHORITATIVE_ROOTS = [
  path.join(
    ROOT,
    "foundry",
    "content",
  ),
  path.join(
    ROOT,
    "foundry",
    "scripts",
  ),
];

const DOCUMENT_TYPE =
  "(?:Actor|Adventure|Cards|ChatMessage|Combat|Folder|Item|"
  + "JournalEntry|JournalEntryPage|Macro|Playlist|RollTable|"
  + "Scene|TableResult|Token|User)";

const UUID_BODY =
  "(?:"
  + "Compendium\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\."
  + DOCUMENT_TYPE
  + "\\.[A-Za-z0-9]{16}"
  + "(?:\\." + DOCUMENT_TYPE + "\\.[A-Za-z0-9]{16})*"
  + "|"
  + DOCUMENT_TYPE
  + "\\.[A-Za-z0-9]{16}"
  + "(?:\\." + DOCUMENT_TYPE + "\\.[A-Za-z0-9]{16})*"
  + ")"
  + "(?:#[A-Za-z0-9._:-]+)?";

const DIRECTIVE_UUID = new RegExp(
  "@(?:UUID|DisplayNpcCard|DisplayMonster|DisplaySpell|"
  + "DisplayTable|Gear)\\[(?<target>"
  + UUID_BODY
  + ")\\]",
  "g",
);

const QUOTED_UUID = new RegExp(
  "[\\\"'`]((?<target>"
  + UUID_BODY
  + "))[\\\"'`]",
  "g",
);

function filesBelow(
  root,
) {
  const result = [];

  function visit(
    current,
  ) {
    for (
      const entry
      of fs.readdirSync(
        current,
        {
          withFileTypes: true,
        },
      )
    ) {
      const candidate =
        path.join(
          current,
          entry.name,
        );

      if (
        entry.isDirectory()
      ) {
        visit(
          candidate,
        );
      } else if (
        entry.isFile()
        && /\.(?:json|js|mjs|html|hbs|md|txt)$/.test(
          entry.name,
        )
      ) {
        result.push(
          candidate,
        );
      }
    }
  }

  visit(
    root,
  );

  return result.sort();
}

function rawReferences() {
  const result = [];

  for (
    const root
    of AUTHORITATIVE_ROOTS
  ) {
    for (
      const file
      of filesBelow(
        root,
      )
    ) {
      const source =
        fs.readFileSync(
          file,
          "utf8",
        );

      for (
        const pattern
        of [
          DIRECTIVE_UUID,
          QUOTED_UUID,
        ]
      ) {
        for (
          const match
          of source.matchAll(
            pattern,
          )
        ) {
          result.push({
            file:
              path.relative(
                ROOT,
                file,
              ),
            target:
              match.groups.target,
          });
        }
      }
    }
  }

  return result;
}

describe(
  "0.12.1 zero hardcoded Foundry references",
  () => {
    test(
      "does not mistake Foundry class method access for document UUIDs",
      () => {
        for (
          const value
          of [
            "Token.getSnappedPosition(",
            "Actor.testUserPermission(",
            "Actor.getTokenDocument(",
          ]
        ) {
          expect(
            [
              ...value.matchAll(
                DIRECTIVE_UUID,
              ),
              ...value.matchAll(
                QUOTED_UUID,
              ),
            ],
          ).toHaveLength(0);
        }

        expect(
          [
            ...'"Item.ElTotem1a2b3c4d5"'.matchAll(
              QUOTED_UUID,
            ),
          ][0].groups.target,
        ).toBe(
          "Item.ElTotem1a2b3c4d5",
        );

        expect(
          [
            ..."@DisplayTable[RollTable.Y6MEcCH35zRiBNUw]{Felhunter}".matchAll(
              DIRECTIVE_UUID,
            ),
          ][0].groups.target,
        ).toBe(
          "RollTable.Y6MEcCH35zRiBNUw",
        );
      },
    );

    test(
      "has no raw Foundry UUIDs in authoritative content or runtime scripts",
      () => {
        expect(
          rawReferences(),
        ).toEqual([]);
      },
    );

    test(
      "uses an absolute empty baseline",
      () => {
        const baseline =
          JSON.parse(
            fs.readFileSync(
              BASELINE,
              "utf8",
            ),
          );

        expect(
          baseline,
        ).toEqual({
          schemaVersion: 1,
          policy:
            "no-hardcoded-foundry-references",
          authoritativeRoots: [
            "foundry/content",
            "foundry/scripts",
          ],
          entries: [],
        });
      },
    );

    test(
      "inventory policy checks every real Foundry reference target regardless of inventory kind",
      () => {
        const source =
          fs.readFileSync(
            INVENTORY_GENERATOR,
            "utf8",
          );

        expect(
          source,
        ).toContain(
          "def assert_no_hardcoded_references(",
        );
        expect(
          source,
        ).toContain(
          "Hardcoded Foundry references are forbidden",
        );

        const functionStart =
          source.indexOf(
            "def hardcoded_reference_counts(",
          );
        const functionEnd =
          source.indexOf(
            "\ndef ",
            functionStart + 5,
          );
        const functionSource =
          source.slice(
            functionStart,
            functionEnd,
          );

        expect(
          functionSource,
        ).not.toContain(
          '"uuid-link"',
        );
        expect(
          functionSource,
        ).not.toContain(
          '"uuid-literal"',
        );
        expect(
          functionSource,
        ).toContain(
          "is_foundry_uuid(",
        );
      },
    );

    test(
      "journal generator resolves typed symbolic presentation references",
      () => {
        const source =
          fs.readFileSync(
            JOURNAL_GENERATOR,
            "utf8",
          );

        for (
          const marker
          of [
            "TYPED_REF_PATTERN",
            "DisplayNpcCard",
            "DisplayMonster",
            "DisplaySpell",
            "Gear",
            "load_internal_actor_references",
            "load_internal_generated_roll_table_references",
          ]
        ) {
          expect(
            source,
          ).toContain(
            marker,
          );
        }
      },
    );

    test(
      "shared resolver loads Actor Item and Journal targets and supports anchors",
      () => {
        const source =
          fs.readFileSync(
            SHARED_REFERENCES,
            "utf8",
          );

        for (
          const marker
          of [
            "def load_internal_adventure_reference_targets(",
            '("RollTable", "boa:table."),',
            "def load_internal_journal_reference_targets(",
            "def split_reference_key(",
            "def resolved_reference_uuid(",
          ]
        ) {
          expect(
            source,
          ).toContain(
            marker,
          );
        }
      },
    );

    test(
      "canonical journal source uses symbolic typed directives",
      () => {
        const companions =
          fs.readFileSync(
            path.join(
              ROOT,
              "foundry/content/journals/appendices/companions.json",
            ),
            "utf8",
          );
        const demons =
          fs.readFileSync(
            path.join(
              ROOT,
              "foundry/content/journals/appendices/demons.json",
            ),
            "utf8",
          );
        const gear =
          fs.readFileSync(
            path.join(
              ROOT,
              "foundry/content/journals/player-options/gear.json",
            ),
            "utf8",
          );
        const spells =
          fs.readFileSync(
            path.join(
              ROOT,
              "foundry/content/journals/player-options/spells.json",
            ),
            "utf8",
          );

        expect(
          companions,
        ).toContain(
          "@DisplayNpcCardRef[boa:actor.",
        );
        expect(
          demons,
        ).toContain(
          "@DisplayMonsterRef[boa:actor.",
        );
        expect(
          demons,
        ).toContain(
          "@DisplayRef[boa:table.",
        );
        expect(
          gear,
        ).toContain(
          "@GearRef[boa:item.",
        );
        expect(
          spells,
        ).toContain(
          "@DisplaySpellRef[boa:item.",
        );
      },
    );
  },
);
