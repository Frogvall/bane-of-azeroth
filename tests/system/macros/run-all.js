const checks = [];
const notes = [];
const results = [];
const startedAt = new Date();

if (!game.user.isGM) {
  boaCheck(
    checks,
    "Suite is run by a game master",
    false,
    "The suite creates temporary world documents and a Journal report."
  );

  return boaFinish(
    "run-all",
    "BOA DEV – Run All System Tests",
    checks,
    notes
  );
}

const pack = game.packs.get(BOA_TEST_PACK_ID);

if (!boaCheck(
  checks,
  "Developer-test compendium is available",
  Boolean(pack),
  BOA_TEST_PACK_ID
)) {
  return boaFinish(
    "run-all",
    "BOA DEV – Run All System Tests",
    checks,
    notes
  );
}

const orderedKeys = [
  "smoke",
  "external-uuids",
  "generated-content",
  "assets-journals",
  "common-animals",
  "common-animal-attack-messages",
  "common-animal-movement",
  "ghoul",
  "warlock-demons",
  "spell-grants",
  "mages-brilliance",
  "evokers-legacy",
  "ability-actions",
  "elemental-totems",
  "adventure-ownership",
];

const index = await pack.getIndex({
  fields: [
    `flags.${BOA_TEST_MODULE_ID}.systemTestKey`,
  ],
});

try {
  for (const key of orderedKeys) {
    const entry = index.find(
      candidate =>
        foundry.utils.getProperty(
          candidate,
          `flags.${BOA_TEST_MODULE_ID}.systemTestKey`
        ) === key
    );

    if (!entry) {
      const missingResult = boaBuildResult(
        key,
        `Missing system-test macro: ${key}`,
        [{
          status: "FAIL",
          description:
            "Macro exists in the developer-test pack",
          details: key,
        }]
      );

      results.push(missingResult);

      boaCheck(
        checks,
        missingResult.name,
        false,
        key
      );

      continue;
    }

    const macro = await pack.getDocument(entry._id);

    try {
      const result = await macro.execute({
        boaSystemTestSuite: true,
      });

      results.push(result);

      boaCheck(
        checks,
        result.name,
        result.passed,
        `${result.passedCount} passed, ` +
        `${result.failedCount} failed, ` +
        `${result.skippedCount} skipped`
      );
    } catch (error) {
      const result =
        error.boaResult ??
        boaBuildResult(
          key,
          macro.name,
          [{
            status: "FAIL",
            description:
              "System-test macro completed",
            details:
              error.stack ?? error.message,
          }]
        );

      results.push(result);

      boaCheck(
        checks,
        result.name,
        false,
        error.stack ?? error.message
      );
    }
  }
} finally {
  const cleanupEntry = index.find(
    candidate =>
      foundry.utils.getProperty(
        candidate,
        `flags.${BOA_TEST_MODULE_ID}.systemTestKey`
      ) === "cleanup"
  );

  if (!cleanupEntry) {
    const cleanupResult = boaBuildResult(
      "cleanup",
      "BOA DEV – Cleanup Test Data",
      [{
        status: "FAIL",
        description:
          "Cleanup macro exists in the developer-test pack",
        details: "cleanup",
      }]
    );

    results.push(cleanupResult);

    boaCheck(
      checks,
      cleanupResult.name,
      false,
      "Cleanup macro is missing."
    );
  } else {
    try {
      const cleanupMacro =
        await pack.getDocument(cleanupEntry._id);

      const cleanupResult =
        await cleanupMacro.execute({
          boaSystemTestSuite: true,
        });

      results.push(cleanupResult);

      boaCheck(
        checks,
        cleanupResult.name,
        cleanupResult.passed,
        `${cleanupResult.passedCount} passed, ` +
        `${cleanupResult.failedCount} failed`
      );
    } catch (error) {
      const cleanupResult =
        error.boaResult ??
        boaBuildResult(
          "cleanup",
          "BOA DEV – Cleanup Test Data",
          [{
            status: "FAIL",
            description:
              "Cleanup macro completed",
            details:
              error.stack ?? error.message,
          }]
        );

      results.push(cleanupResult);

      boaCheck(
        checks,
        cleanupResult.name,
        false,
        error.stack ?? error.message
      );
    }
  }
}

const completedAt = new Date();
const automaticSuiteResult = boaBuildResult(
  "run-all",
  "BOA DEV – Run All System Tests",
  checks,
  notes
);

let report = null;

try {
  const created = await boaCreateSystemTestReport({
    suiteResult: automaticSuiteResult,
    results,
    startedAt,
    completedAt,
  });

  report = created.report;

  boaCheck(
    checks,
    "Dated Journal test report was created",
    Boolean(report?.id),
    report?.uuid ?? ""
  );
} catch (error) {
  boaCheck(
    checks,
    "Dated Journal test report was created",
    false,
    error.stack ?? error.message
  );
}

notes.push(
  "Pointer placement, visual aura inspection, " +
  "and a real Elemental Totem cast through the " +
  "player–GM socket remain manual."
);

if (report) {
  notes.push(
    `Report: ${report.uuid}`
  );
}

const finalPreview = boaBuildResult(
  "run-all",
  "BOA DEV – Run All System Tests",
  checks,
  notes
);

const totals = boaSystemTestTotals(results);
const reportLink = report
  ? (
      report.link ??
      `@UUID[${report.uuid}]{Open the complete test report}`
    )
  : "<em>The Journal report could not be created.</em>";

const chatContent = `
  <p>
    <strong>
      BOA system tests:
      ${finalPreview.passed ? "PASS" : "FAIL"}
    </strong>
  </p>
  <p>
    ${totals.passed} passed,
    ${totals.failed} failed,
    ${totals.skipped} skipped.
  </p>
  <p>${reportLink}</p>
`;

return boaFinish(
  "run-all",
  "BOA DEV – Run All System Tests",
  checks,
  notes,
  {
    chatContent,
  }
);
