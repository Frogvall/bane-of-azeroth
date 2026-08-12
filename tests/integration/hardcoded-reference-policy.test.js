import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const ROOT = process.cwd();

const INVENTORY = path.join(
  ROOT,
  "generated",
  "reference-inventory.json",
);

const BASELINE = path.join(
  ROOT,
  "foundry",
  "config",
  "references",
  "hardcoded-reference-baseline.json",
);

const GENERATOR = path.join(
  ROOT,
  "tools",
  "generate-reference-inventory.py",
);

const AUTHORITATIVE_PREFIXES = [
  "foundry/content/",
  "foundry/scripts/",
];

const DOCUMENT_TYPE =
  "(?:Actor|Adventure|Cards|ChatMessage|Combat|Folder|Item|"
  + "JournalEntry|JournalEntryPage|Macro|Playlist|RollTable|"
  + "Scene|TableResult|Token|User)";

const WORLD_UUID = new RegExp(
  "^"
  + DOCUMENT_TYPE
  + "\\.[A-Za-z0-9]{16}"
  + "(?:\\."
  + DOCUMENT_TYPE
  + "\\.[A-Za-z0-9]{16})*"
  + "(?:#[A-Za-z0-9._:-]+)?$",
);

const COMPENDIUM_UUID = new RegExp(
  "^Compendium\\."
  + "[A-Za-z0-9_-]+\\."
  + "[A-Za-z0-9_-]+\\."
  + DOCUMENT_TYPE
  + "\\.[A-Za-z0-9]{16}"
  + "(?:\\."
  + DOCUMENT_TYPE
  + "\\.[A-Za-z0-9]{16})*"
  + "(?:#[A-Za-z0-9._:-]+)?$",
);

function readJson(
  file,
) {
  return JSON.parse(
    fs.readFileSync(
      file,
      "utf8",
    ),
  );
}

function isFoundryUuid(
  target,
) {
  return (
    WORLD_UUID.test(target)
    || COMPENDIUM_UUID.test(target)
  );
}

function keyFor(
  entry,
) {
  return [
    entry.path,
    entry.kind,
    entry.target,
  ].join("\u0000");
}

function currentViolations() {
  const inventory =
    readJson(
      INVENTORY,
    );

  const counts =
    new Map();

  for (
    const entry
    of inventory.entries
  ) {
    if (
      ![
        "uuid-link",
        "uuid-literal",
      ].includes(
        entry.kind,
      )
    ) {
      continue;
    }

    if (
      !AUTHORITATIVE_PREFIXES.some(
        prefix =>
          entry.path.startsWith(
            prefix,
          ),
      )
    ) {
      continue;
    }

    if (
      !isFoundryUuid(
        entry.target,
      )
    ) {
      continue;
    }

    const key =
      keyFor(
        entry,
      );

    counts.set(
      key,
      (
        counts.get(
          key,
        )
        ?? 0
      )
      + 1,
    );
  }

  return [
    ...counts.entries(),
  ]
    .map(
      ([key, count]) => {
        const [
          entryPath,
          kind,
          target,
        ] = key.split(
          "\u0000",
        );

        return {
          path:
            entryPath,
          kind,
          target,
          count,
        };
      },
    )
    .sort(
      (left, right) =>
        left.path.localeCompare(
          right.path,
        )
        || left.kind.localeCompare(
          right.kind,
        )
        || left.target.localeCompare(
          right.target,
        ),
    );
}

describe(
  "hardcoded Foundry reference policy",
  () => {
    test(
      "uses a document-aware UUID scanner rather than treating arbitrary dotted BOA keys as UUIDs",
      () => {
        const source =
          fs.readFileSync(
            GENERATOR,
            "utf8",
          );

        expect(
          source,
        ).toContain(
          "FOUNDRY_DOCUMENT_TYPES",
        );
        expect(
          source,
        ).toContain(
          "def is_foundry_uuid(",
        );
        expect(
          source,
        ).toContain(
          "assert_no_hardcoded_references",
        );
      },
    );

    test(
      "keeps the committed hardcoded-reference baseline synchronized with the current authoritative source",
      () => {
        const baseline =
          readJson(
            BASELINE,
          );

        expect(
          baseline.schemaVersion,
        ).toBe(1);
        expect(
          baseline.policy,
        ).toBe(
          "no-hardcoded-foundry-references",
        );
        expect(
          baseline.authoritativeRoots,
        ).toEqual(
          AUTHORITATIVE_PREFIXES.map(
            value =>
              value.slice(
                0,
                -1,
              ),
          ),
        );

        expect(
          baseline.entries,
        ).toEqual([]);
        expect(
          currentViolations(),
        ).toEqual([]);
      },
    );

    test(
      "baseline entries are deterministic unique reference identities with positive counts",
      () => {
        const baseline =
          readJson(
            BASELINE,
          );

        const keys =
          baseline.entries.map(
            keyFor,
          );

        expect(
          new Set(
            keys,
          ).size,
        ).toBe(
          keys.length,
        );

        for (
          const entry
          of baseline.entries
        ) {
          expect(
            entry.count,
          ).toBeGreaterThan(
            0,
          );
          expect(
            AUTHORITATIVE_PREFIXES.some(
              prefix =>
                entry.path.startsWith(
                  prefix,
                ),
            ),
          ).toBe(true);
          expect(
            isFoundryUuid(
              entry.target,
            ),
          ).toBe(true);
        }
      },
    );
  },
);
