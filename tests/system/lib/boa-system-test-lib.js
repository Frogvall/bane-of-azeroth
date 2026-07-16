const BOA_TEST_MODULE_ID = "bane-of-azeroth";
const BOA_TEST_FIXTURE_FLAG = "testFixture";
const BOA_TEST_PACK_ID =
  "bane-of-azeroth.bane-of-azeroth-dev-tests";

const BOA_TEST_ARGS =
  typeof args !== "undefined" && Array.isArray(args)
    ? args
    : [];

const BOA_TEST_SUITE_MODE = BOA_TEST_ARGS.some(
  value => value?.boaSystemTestSuite === true
);

function boaGetFlag(document, key) {
  const direct = document?.getFlag?.(
    BOA_TEST_MODULE_ID,
    key
  );

  if (direct !== undefined) return direct;

  return foundry.utils.getProperty(
    document,
    `flags.${BOA_TEST_MODULE_ID}.${key}`
  );
}

function boaContentKey(document) {
  const value = boaGetFlag(document, "contentKey");
  return typeof value === "string" ? value : "";
}

function boaCollectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.values === "function") {
    return Array.from(collection.values());
  }
  return Array.from(collection);
}

function boaCheck(
  checks,
  description,
  condition,
  details = ""
) {
  checks.push({
    status: condition ? "PASS" : "FAIL",
    description,
    details:
      typeof details === "string"
        ? details
        : JSON.stringify(details),
  });

  return Boolean(condition);
}

function boaSkip(checks, description, details = "") {
  checks.push({
    status: "SKIP",
    description,
    details,
  });
}

async function boaWaitFor(
  predicate,
  {
    timeout = 4000,
    interval = 50,
    description = "condition",
  } = {}
) {
  const started = Date.now();

  while (Date.now() - started < timeout) {
    const value = await predicate();
    if (value) return value;

    await new Promise(resolve =>
      setTimeout(resolve, interval)
    );
  }

  throw new Error(
    `Timed out waiting for ${description}.`
  );
}

function boaCloneEmbeddedItem(item) {
  const data = item.toObject();

  delete data._id;
  delete data.folder;
  delete data.ownership;

  return data;
}

function boaFindWorldItem(contentKey, type = null) {
  return boaCollectionValues(game.items).find(
    item =>
      (!type || item.type === type) &&
      boaContentKey(item) === contentKey
  );
}

function boaFindWorldActor(contentKey) {
  return boaCollectionValues(game.actors).find(
    actor => boaContentKey(actor) === contentKey
  );
}

async function boaFetchJson(relativePath) {
  const url = foundry.utils.getRoute(
    `modules/${BOA_TEST_MODULE_ID}/${relativePath}`
  );

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Could not load ${relativePath}: ` +
      `${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

function boaHtmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function boaMarkdownCell(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\r", "")
    .replaceAll("\n", "<br>");
}

function boaResultHtml(result) {
  const rows = result.checks
    .map(check => `
      <tr>
        <td><strong>${boaHtmlEscape(check.status)}</strong></td>
        <td>${boaHtmlEscape(check.description)}</td>
        <td>${boaHtmlEscape(check.details || "")}</td>
      </tr>
    `)
    .join("");

  return `
    <h2>${boaHtmlEscape(result.name)}</h2>
    <p>
      <strong>${result.passed ? "PASS" : "FAIL"}</strong>:
      ${result.passedCount} passed,
      ${result.failedCount} failed,
      ${result.skippedCount} skipped.
    </p>
    <table>
      <thead>
        <tr>
          <th>Status</th>
          <th>Check</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function boaBuildResult(
  key,
  name,
  checks,
  notes = []
) {
  const failedCount = checks.filter(
    check => check.status === "FAIL"
  ).length;
  const passedCount = checks.filter(
    check => check.status === "PASS"
  ).length;
  const skippedCount = checks.filter(
    check => check.status === "SKIP"
  ).length;

  return {
    key,
    name,
    checks,
    notes,
    passed: failedCount === 0,
    failedCount,
    passedCount,
    skippedCount,
  };
}

async function boaFinish(
  key,
  name,
  checks,
  notes = [],
  options = {}
) {
  const result = boaBuildResult(
    key,
    name,
    checks,
    notes
  );

  console.group(
    `${name}: ${result.passed ? "PASS" : "FAIL"}`
  );
  console.table(checks);
  if (notes.length > 0) {
    console.info("Notes:", notes);
  }
  console.groupEnd();

  if (!BOA_TEST_SUITE_MODE) {
    const message =
      `${name}: ${result.passedCount} passed, ` +
      `${result.failedCount} failed, ` +
      `${result.skippedCount} skipped.`;

    if (result.passed) {
      ui.notifications.info(message);
    } else {
      ui.notifications.error(message);
    }

    const gmIds = boaCollectionValues(game.users)
      .filter(user => user.isGM)
      .map(user => user.id);

    if (
      globalThis.ChatMessage?.create &&
      options.createChatMessage !== false
    ) {
      await ChatMessage.create({
        content:
          options.chatContent ??
          boaResultHtml(result),
        whisper: gmIds,
      });
    }

    if (!result.passed) {
      const error = new Error(
        `${name} failed ${result.failedCount} check(s).`
      );
      error.boaResult = result;
      throw error;
    }
  }

  return result;
}

function boaDocumentParentFolderId(folder) {
  return folder?.folder?.id ??
    folder?.folder ??
    null;
}

async function boaEnsureJournalFolder(
  name,
  parent = null,
  color = null
) {
  const parentId = parent?.id ?? null;

  const existing = boaCollectionValues(game.folders)
    .find(folder =>
      folder.type === "JournalEntry" &&
      folder.name === name &&
      boaDocumentParentFolderId(folder) === parentId
    );

  if (existing) {
    if ((existing.color ?? null) !== color) {
      await existing.update({ color });
    }

    return existing;
  }

  return Folder.create({
    name,
    type: "JournalEntry",
    folder: parentId,
    sorting: "a",
    color,
  });
}

function boaVersionForModule(
  ids,
  titlePattern = null
) {
  for (const id of ids) {
    const module = game.modules.get(id);
    if (module) {
      return {
        id: module.id,
        title: module.title,
        active: module.active,
        version: module.version ?? "unknown",
      };
    }
  }

  if (titlePattern) {
    const module = boaCollectionValues(game.modules)
      .find(candidate =>
        titlePattern.test(candidate.title ?? "")
      );

    if (module) {
      return {
        id: module.id,
        title: module.title,
        active: module.active,
        version: module.version ?? "unknown",
      };
    }
  }

  return null;
}

function boaLocalTimestamp(date) {
  return new Intl.DateTimeFormat(
    "sv-SE",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }
  )
    .format(date)
    .replace(",", "");
}

function boaReportFileTimestamp(date) {
  const parts = new Intl.DateTimeFormat(
    "sv-SE",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  )
    .formatToParts(date)
    .reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});

  return (
    `${parts.year}-${parts.month}-${parts.day} ` +
    `${parts.hour}-${parts.minute}`
  );
}

function boaSystemTestEnvironment(
  startedAt,
  completedAt
) {
  const boaModule = game.modules.get(
    BOA_TEST_MODULE_ID
  );

  const coreSet = boaVersionForModule(
    [
      "dragonbane-coreset",
      "dragonbane-core-set",
    ],
    /Dragonbane Core Set/i
  );

  const yzeCombat = boaVersionForModule(
    [
      "yze-combat",
      "yzec",
    ],
    /YZE Combat/i
  );

  return {
    moduleVersion: boaModule?.version ?? "unknown",
    foundryVersion: game.version ?? "unknown",
    dragonbaneVersion:
      game.system?.version ?? "unknown",
    dragonbaneCoreSetVersion:
      coreSet?.version ?? "not installed",
    yzeCombatVersion:
      yzeCombat?.version ?? "not installed",
    worldId: game.world?.id ?? "unknown",
    worldTitle: game.world?.title ?? "unknown",
    sceneName:
      canvas?.scene?.name ??
      game.scenes?.active?.name ??
      "none",
    userId: game.user?.id ?? "unknown",
    userName: game.user?.name ?? "unknown",
    userIsGM: game.user?.isGM === true,
    browser:
      globalThis.navigator?.userAgent ??
      "unknown",
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs:
      completedAt.getTime() -
      startedAt.getTime(),
    activeModules: boaCollectionValues(game.modules)
      .filter(module => module.active)
      .map(module => ({
        id: module.id,
        title: module.title,
        version: module.version ?? "unknown",
      }))
      .sort((left, right) =>
        left.title.localeCompare(right.title)
      ),
  };
}

function boaSystemTestTotals(results) {
  return results.reduce(
    (totals, result) => {
      totals.passed += result.passedCount ?? 0;
      totals.failed += result.failedCount ?? 0;
      totals.skipped += result.skippedCount ?? 0;
      return totals;
    },
    {
      passed: 0,
      failed: 0,
      skipped: 0,
    }
  );
}

function boaBuildSummaryMarkdown({
  suiteResult,
  results,
  environment,
  createdAt,
}) {
  const totals = boaSystemTestTotals(results);
  const automaticResult =
    suiteResult.passed ? "PASS" : "FAIL";

  const suiteRows = results
    .map(result =>
      `| ${boaMarkdownCell(
        result.passed ? "PASS" : "FAIL"
      )} | ${boaMarkdownCell(result.name)} | ` +
      `${result.passedCount ?? 0} | ` +
      `${result.failedCount ?? 0} | ` +
      `${result.skippedCount ?? 0} |`
    )
    .join("\n");

  return `# Bane of Azeroth System Test Report

**Automated result:** ${automaticResult}  
**Manual result:** PENDING  
**Created:** ${boaLocalTimestamp(createdAt)}

## Environment

| Component | Version |
|---|---|
| Bane of Azeroth | ${boaMarkdownCell(environment.moduleVersion)} |
| Foundry VTT | ${boaMarkdownCell(environment.foundryVersion)} |
| Dragonbane | ${boaMarkdownCell(environment.dragonbaneVersion)} |
| Dragonbane Core Set | ${boaMarkdownCell(environment.dragonbaneCoreSetVersion)} |
| YZE Combat | ${boaMarkdownCell(environment.yzeCombatVersion)} |

**World:** ${boaMarkdownCell(environment.worldTitle)}  
**Run by:** ${boaMarkdownCell(environment.userName)}  
**Started:** ${boaLocalTimestamp(new Date(environment.startedAt))}  
**Completed:** ${boaLocalTimestamp(new Date(environment.completedAt))}  
**Duration:** ${(environment.durationMs / 1000).toFixed(2)} seconds

## Automated totals

| Passed | Failed | Skipped |
|---:|---:|---:|
| ${totals.passed} | ${totals.failed} | ${totals.skipped} |

## Test suites

| Result | Test suite | Passed | Failed | Skipped |
|---|---|---:|---:|---:|
${suiteRows}

## Manual completion

- [ ] All required manual tests have been completed.
- [ ] All manual tests passed, or failures are documented.
- [ ] The final manual result above has been changed from PENDING to PASS or FAIL.
`;
}

function boaBuildAutomatedResultsMarkdown(
  results
) {
  const sections = results.map(result => {
    const rows = result.checks
      .map(check =>
        `| ${boaMarkdownCell(check.status)} | ` +
        `${boaMarkdownCell(check.description)} | ` +
        `${boaMarkdownCell(check.details)} |`
      )
      .join("\n");

    const notes = (result.notes ?? [])
      .map(note => `- ${note}`)
      .join("\n");

    return `## ${result.name}

**Result:** ${result.passed ? "PASS" : "FAIL"}  
**Passed:** ${result.passedCount ?? 0}  
**Failed:** ${result.failedCount ?? 0}  
**Skipped:** ${result.skippedCount ?? 0}

| Status | Check | Details |
|---|---|---|
${rows || "| SKIP | No checks were returned | |"}

${notes ? `### Notes\n\n${notes}` : ""}
`;
  });

  return `# Automated Results

${sections.join("\n---\n\n")}
`;
}

function boaBuildManualChecklistMarkdown() {
  return `# Manual Test Checklist

Edit this Markdown page and change \`[ ]\` to \`[x]\` as each test is completed.

**Manual result:** PENDING  
**Tested by:**  
**Completed:**  

## Elemental Totem placement and interaction

- [ ] Pointer placement preview follows the cursor.
- [ ] Valid placement uses the selected totem's aura color.
- [ ] Invalid placement is shown in red.
- [ ] Placement snaps correctly to the active grid.
- [ ] Placement is accepted within 6 meters.
- [ ] Placement is rejected beyond 6 meters.
- [ ] Escape cancels the entire placement.
- [ ] Right-click cancels the entire placement.
- [ ] Canceling preserves the caster's existing totems.

## Elemental Totem visual verification

- [ ] Cleansing aura is blue/cyan.
- [ ] Flametongue aura is orange.
- [ ] Stoneskin aura is yellow-green.
- [ ] Windfury aura is lavender.
- [ ] Overlapping auras remain visually distinguishable.
- [ ] Aura radius matches 10, 20, or 40 meters.
- [ ] Auras follow moved tokens.
- [ ] Auras survive copying and scene reload.
- [ ] Auras disappear when their tokens are deleted.
- [ ] Auras do not create light or modify token vision.

## Elemental Totem roll workflow

- [ ] A normal success opens the selection dialog once.
- [ ] A normal failure opens no dialog.
- [ ] A pushed failure opens no dialog.
- [ ] A pushed success opens one dialog.
- [ ] A demon result opens no dialog.
- [ ] A dragon result waits for the critical-effect choice and opens once.
- [ ] PL 1 permits one totem.
- [ ] PL 3 permits two additional distinct choices.
- [ ] Duplicate totem types cannot be selected.
- [ ] Existing totems are replaced only after successful placement.

## Player and game-master workflow

- [ ] A player can cast using an owned Actor.
- [ ] The player chooses the totems and placement positions.
- [ ] The active primary GM creates the tokens exactly once.
- [ ] A player cannot submit a request for an Actor they do not own.
- [ ] Summoned totem sheets are readable by players.
- [ ] Summoned totem sheets are not editable by players.
- [ ] Cross-scene cleanup removes the caster's older totems.
- [ ] Other casters' totems remain.

## Adventure and interface verification

- [ ] Clean-world Adventure import succeeds.
- [ ] The Adventure import prompt appears only for a newer content version.
- [ ] Development build suffix changes do not retrigger the import prompt.
- [ ] Dialog layout is readable at the normal browser zoom.
- [ ] All new interface text is localized in English.
- [ ] The always-prepared checkbox is disabled and visually distinct.
- [ ] The always-prepared tooltip is displayed.

## Weapon feature verification

- [ ] Armor Piercing adds exactly one Find Weak Spot option to an eligible weapon.
- [ ] Armor Piercing remains unavailable when Damage Types is disabled.
- [ ] Scattershot removes the point-blank bane.
- [ ] Scattershot preserves the long-range bane.
- [ ] Scattershot long-range damage is halved and rounded up.
- [ ] Missing Ammo Pouch shows the confirmation dialog.
- [ ] Perform Action continues after the warning.
- [ ] Cancel Action cancels after the warning.

## Compatibility and presentation

- [ ] Browser console contains no unexpected errors.
- [ ] The tested Foundry version is recorded correctly.
- [ ] The tested Dragonbane version is recorded correctly.
- [ ] Relevant module versions are recorded correctly.
- [ ] Any failures or deviations are documented below.

## Manual notes

Add observations, screenshots, failure details, or reproduction steps here.

`;
}

function boaBuildEnvironmentMarkdown(environment) {
  const activeModuleRows = environment.activeModules
    .map(module =>
      `| ${boaMarkdownCell(module.title)} | ` +
      `${boaMarkdownCell(module.id)} | ` +
      `${boaMarkdownCell(module.version)} |`
    )
    .join("\n");

  return `# Environment and Notes

## Runtime

| Property | Value |
|---|---|
| Bane of Azeroth | ${boaMarkdownCell(environment.moduleVersion)} |
| Foundry VTT | ${boaMarkdownCell(environment.foundryVersion)} |
| Dragonbane | ${boaMarkdownCell(environment.dragonbaneVersion)} |
| Dragonbane Core Set | ${boaMarkdownCell(environment.dragonbaneCoreSetVersion)} |
| YZE Combat | ${boaMarkdownCell(environment.yzeCombatVersion)} |
| World | ${boaMarkdownCell(environment.worldTitle)} |
| World ID | ${boaMarkdownCell(environment.worldId)} |
| Active scene | ${boaMarkdownCell(environment.sceneName)} |
| User | ${boaMarkdownCell(environment.userName)} |
| User ID | ${boaMarkdownCell(environment.userId)} |
| Game master | ${environment.userIsGM ? "Yes" : "No"} |
| Started | ${boaMarkdownCell(environment.startedAt)} |
| Completed | ${boaMarkdownCell(environment.completedAt)} |
| Duration | ${(environment.durationMs / 1000).toFixed(2)} seconds |
| Browser | ${boaMarkdownCell(environment.browser)} |

## Active modules

| Module | ID | Version |
|---|---|---|
${activeModuleRows || "| None | | |"}

## Additional notes

Add environment-specific observations here.
`;
}

function boaMarkdownPage(
  name,
  markdown,
  sort
) {
  return {
    name,
    type: "text",
    sort,
    text: {
      format:
        CONST.JOURNAL_ENTRY_PAGE_FORMATS.MARKDOWN,
      markdown,
    },
  };
}

async function boaCreateSystemTestReport({
  suiteResult,
  results,
  startedAt,
  completedAt,
}) {
  const createdAt = new Date();
  const environment = boaSystemTestEnvironment(
    startedAt,
    completedAt
  );

  const rootFolder = await boaEnsureJournalFolder(
    "Bane of Azeroth",
    null,
    "#1f5fbf"
  );

  const systemTestsFolder =
    await boaEnsureJournalFolder(
      "System Tests",
      rootFolder,
      null
    );

  const reportName =
    `BOA Test Report – ` +
    `${environment.moduleVersion} – ` +
    `${boaReportFileTimestamp(createdAt)}`;

  const report = await JournalEntry.create({
    name: reportName,
    folder: systemTestsFolder.id,
    ownership: {
      default:
        CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
    },
    flags: {
      [BOA_TEST_MODULE_ID]: {
        systemTestReport: true,
        automaticResult:
          suiteResult.passed ? "pass" : "fail",
        manualResultAtCreation: "pending",
        moduleVersion:
          environment.moduleVersion,
        foundryVersion:
          environment.foundryVersion,
        dragonbaneVersion:
          environment.dragonbaneVersion,
        runAt: createdAt.toISOString(),
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
      },
    },
    pages: [
      boaMarkdownPage(
        "Summary",
        boaBuildSummaryMarkdown({
          suiteResult,
          results,
          environment,
          createdAt,
        }),
        100000
      ),
      boaMarkdownPage(
        "Automated Results",
        boaBuildAutomatedResultsMarkdown(results),
        200000
      ),
      boaMarkdownPage(
        "Manual Checklist",
        boaBuildManualChecklistMarkdown(),
        300000
      ),
      boaMarkdownPage(
        "Environment and Notes",
        boaBuildEnvironmentMarkdown(environment),
        400000
      ),
    ],
  }, {
    renderSheet: false,
  });

  return {
    report,
    environment,
  };
}
