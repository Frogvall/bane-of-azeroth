import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

const GENERATOR = resolve(
  "tools",
  "generate-system-test-macros.py",
);

function generatorEntryBlocks(source) {
  return [
    ...source.matchAll(
      /\{\s*"key"\s*:\s*"([^"]+)"[\s\S]*?\n\s*\},/g,
    ),
  ].map(
    match => match[0],
  );
}

function stringField(
  block,
  name,
) {
  return block.match(
    new RegExp(
      `"${name}"\\s*:\\s*"([^"]+)"`,
    ),
  )?.[1] ?? null;
}

function integerField(
  block,
  name,
) {
  const raw = block.match(
    new RegExp(
      `"${name}"\\s*:\\s*(\\d+)`,
    ),
  )?.[1];

  return raw === undefined
    ? null
    : Number(raw);
}

function booleanField(
  block,
  name,
) {
  const raw = block.match(
    new RegExp(
      `"${name}"\\s*:\\s*(True|False)`,
    ),
  )?.[1];

  if (raw === "True") {
    return true;
  }
  if (raw === "False") {
    return false;
  }
  return null;
}

export function systemTestMacroEntries() {
  const source = readFileSync(
    GENERATOR,
    "utf8",
  );

  return generatorEntryBlocks(
    source,
  ).map(
    block => ({
      key:
        stringField(
          block,
          "key",
        ),
      file:
        stringField(
          block,
          "file",
        ),
      order:
        integerField(
          block,
          "order",
        ),
      suiteOrder:
        integerField(
          block,
          "suiteOrder",
        ),
      suiteMember:
        booleanField(
          block,
          "suiteMember",
        ),
    }),
  );
}

export function systemTestSuiteEntries() {
  return systemTestMacroEntries()
    .filter(
      entry =>
        entry.suiteMember === true,
    )
    .sort(
      (left, right) =>
        left.suiteOrder -
        right.suiteOrder,
    );
}

export function systemTestSuiteKeys() {
  return systemTestSuiteEntries()
    .map(
      entry =>
        entry.key,
    );
}
