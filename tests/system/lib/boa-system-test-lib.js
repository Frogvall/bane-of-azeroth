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

function boaDiagnosticValue(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function boaValuesEqual(actual, expected) {
  if (Object.is(actual, expected)) return true;

  if (
    actual &&
    expected &&
    typeof actual === "object" &&
    typeof expected === "object"
  ) {
    try {
      return JSON.stringify(actual) ===
        JSON.stringify(expected);
    } catch {
      return false;
    }
  }

  return false;
}

function boaCheckEqual(
  checks,
  description,
  actual,
  expected
) {
  const equal = boaValuesEqual(actual, expected);

  return boaCheck(
    checks,
    description,
    equal,
    equal
      ? ""
      : (
          `Expected: ${boaDiagnosticValue(expected)}; ` +
          `Actual: ${boaDiagnosticValue(actual)}`
        )
  );
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

function boaHtmlText(value) {
  return boaHtmlEscape(value ?? "")
    .replaceAll("\r", "")
    .replaceAll("\n", "<br>");
}

function boaStatusHtml(status) {
  const symbol =
    status === "PASS" ? "✓" :
    status === "FAIL" ? "✕" :
    "–";

  return (
    `<strong>${symbol} ` +
    `${boaHtmlEscape(status)}</strong>`
  );
}

function boaInterestingChecks(results) {
  return results.flatMap(result =>
    (result.checks ?? [])
      .filter(check =>
        check.status === "FAIL" ||
        check.status === "SKIP"
      )
      .map(check => ({
        suite: result.name,
        status: check.status,
        description: check.description,
        details: check.details ?? "",
      }))
  );
}

function boaBuildSummaryHtml({
  suiteResult,
  results,
  environment,
  createdAt,
}) {
  const totals = boaSystemTestTotals(results);
  const automaticResult =
    suiteResult.passed ? "PASS" : "FAIL";

  const issueRows = boaInterestingChecks(results)
    .map(issue => `
      <tr>
        <td>${boaStatusHtml(issue.status)}</td>
        <td>${boaHtmlText(issue.suite)}</td>
        <td>${boaHtmlText(issue.description)}</td>
        <td>${boaHtmlText(issue.details)}</td>
      </tr>
    `)
    .join("");

  const suiteRows = results
    .map(result => `
      <tr>
        <td>
          ${boaStatusHtml(
            result.passed ? "PASS" : "FAIL"
          )}
        </td>
        <td>${boaHtmlText(result.name)}</td>
        <td>${result.passedCount ?? 0}</td>
        <td>${result.failedCount ?? 0}</td>
        <td>${result.skippedCount ?? 0}</td>
      </tr>
    `)
    .join("");

  return `
    

    <p>
      <strong>Automated result:</strong>
      ${boaStatusHtml(automaticResult)}
      <br>
      <strong>Manual result:</strong> PENDING
      <br>
      <strong>Created:</strong>
      ${boaHtmlText(boaLocalTimestamp(createdAt))}
    </p>

    <h2>Needs attention</h2>

    ${
      issueRows
        ? `
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Suite</th>
                <th>Check</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>${issueRows}</tbody>
          </table>
        `
        : `
          <p>
            <strong>
              No failed or skipped automated checks.
            </strong>
          </p>
        `
    }

    <h2>Automated totals</h2>

    <table>
      <thead>
        <tr>
          <th>Passed</th>
          <th>Failed</th>
          <th>Skipped</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${totals.passed}</td>
          <td>${totals.failed}</td>
          <td>${totals.skipped}</td>
        </tr>
      </tbody>
    </table>

    <h2>Suite overview</h2>

    <table>
      <thead>
        <tr>
          <th>Result</th>
          <th>Suite</th>
          <th>Passed</th>
          <th>Failed</th>
          <th>Skipped</th>
        </tr>
      </thead>
      <tbody>${suiteRows}</tbody>
    </table>

    <h2>Environment</h2>

    <table>
      <tbody>
        <tr>
          <th>Bane of Azeroth</th>
          <td>${boaHtmlText(environment.moduleVersion)}</td>
        </tr>
        <tr>
          <th>Foundry VTT</th>
          <td>${boaHtmlText(environment.foundryVersion)}</td>
        </tr>
        <tr>
          <th>Dragonbane</th>
          <td>${boaHtmlText(environment.dragonbaneVersion)}</td>
        </tr>
        <tr>
          <th>Dragonbane Core Set</th>
          <td>${boaHtmlText(
            environment.dragonbaneCoreSetVersion
          )}</td>
        </tr>
        <tr>
          <th>YZE Combat</th>
          <td>${boaHtmlText(environment.yzeCombatVersion)}</td>
        </tr>
        <tr>
          <th>World</th>
          <td>${boaHtmlText(environment.worldTitle)}</td>
        </tr>
        <tr>
          <th>Run by</th>
          <td>${boaHtmlText(environment.userName)}</td>
        </tr>
        <tr>
          <th>Started</th>
          <td>${boaHtmlText(
            boaLocalTimestamp(new Date(environment.startedAt))
          )}</td>
        </tr>
        <tr>
          <th>Completed</th>
          <td>${boaHtmlText(
            boaLocalTimestamp(new Date(environment.completedAt))
          )}</td>
        </tr>
        <tr>
          <th>Duration</th>
          <td>
            ${(environment.durationMs / 1000).toFixed(2)}
            seconds
          </td>
        </tr>
      </tbody>
    </table>

    <h2>Manual completion</h2>

    <ul>
      <li>[ ] All required manual tests were completed.</li>
      <li>[ ] All manual failures are documented.</li>
      <li>
        [ ] Manual result was changed from
        PENDING to PASS or FAIL.
      </li>
    </ul>
  `;
}

function boaBuildAutomatedResultsHtml(results) {
  const sections = results.map(result => {
    const rows = (result.checks ?? [])
      .map(check => `
        <tr>
          <td>${boaStatusHtml(check.status)}</td>
          <td>${boaHtmlText(check.description)}</td>
          <td>${boaHtmlText(check.details ?? "")}</td>
        </tr>
      `)
      .join("");

    const notes = (result.notes ?? [])
      .map(note => `<li>${boaHtmlText(note)}</li>`)
      .join("");

    return `
      <h2>${boaHtmlText(result.name)}</h2>

      <p>
        <strong>Result:</strong>
        ${boaStatusHtml(result.passed ? "PASS" : "FAIL")}
        <br>
        <strong>Passed:</strong>
        ${result.passedCount ?? 0}
        <br>
        <strong>Failed:</strong>
        ${result.failedCount ?? 0}
        <br>
        <strong>Skipped:</strong>
        ${result.skippedCount ?? 0}
      </p>

      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Check</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows ||
            `
              <tr>
                <td>${boaStatusHtml("SKIP")}</td>
                <td>No checks were returned.</td>
                <td></td>
              </tr>
            `
          }
        </tbody>
      </table>

      ${
        notes
          ? `
            <h3>Notes</h3>
            <ul>${notes}</ul>
          `
          : ""
      }

      <hr>
    `;
  });

  return `
    
    ${sections.join("")}
  `;
}

function boaBuildManualChecklistHtml() {
  return `
    <p>
      This checklist contains tests that require visual judgment,
      pointer interaction, multiple clients, or deliberate roll
      outcomes. Follow the procedure in each section before marking
      its checks as complete.
    </p>

    <p>
      Edit this page and change <code>[ ]</code> to
      <code>[x]</code> as each test is completed.
    </p>

    <p>
      <strong>Manual result:</strong> PENDING
      <br>
      <strong>Tested by:</strong>
      <br>
      <strong>Completed:</strong>
    </p>

    <h2>Before you start</h2>

    <ol>
      <li>
        Use the Foundry, Dragonbane, Core Set, YZE Combat,
        and Bane of Azeroth versions recorded in this report.
      </li>
      <li>
        Import or update the current Bane of Azeroth Adventure.
      </li>
      <li>
        Place a character token with the
        <strong>Elemental Totem</strong> spell in an active scene.
      </li>
      <li>
        Ensure the character has enough Willpower Points
        for repeated casts at power levels 1–3.
      </li>
      <li>
        Keep a game master connected throughout player tests.
      </li>
      <li>
        Open the browser console before testing and leave it open.
      </li>
    </ol>

    <h2>Elemental Totem placement and interaction</h2>

    <p>
      Select a token whose Actor has the
      <strong>Elemental Totem</strong> spell. Cast the spell
      successfully at power level 1, choose a totem, and move the
      placement preview around the caster. Repeat the cast as needed
      to test cancellation separately from successful placement.
    </p>

    <ul>
      <li>[ ] Pointer placement preview follows the cursor.</li>
      <li>[ ] Valid placement uses the selected totem's aura color.</li>
      <li>[ ] Invalid placement is shown in red.</li>
      <li>[ ] Placement snaps correctly to the active grid.</li>
      <li>[ ] Placement is accepted within 6 meters.</li>
      <li>[ ] Placement is rejected beyond 6 meters.</li>
      <li>[ ] Escape cancels the entire placement.</li>
      <li>[ ] Right-click cancels the entire placement.</li>
      <li>[ ] Canceling preserves the caster's existing totems.</li>
    </ul>

    <h2>Elemental Totem visual verification</h2>

    <p>
      Successfully summon each totem type and inspect it on the
      canvas. Recast with reach upgrades to verify larger radii.
      To test overlapping auras, use two different casters because
      a new cast replaces the previous totems from the same caster.
    </p>

    <ul>
      <li>[ ] Cleansing aura is blue/cyan.</li>
      <li>[ ] Flametongue aura is orange.</li>
      <li>[ ] Stoneskin aura is yellow-green.</li>
      <li>[ ] Windfury aura is lavender.</li>
      <li>[ ] Overlapping auras remain visually distinguishable.</li>
      <li>[ ] Aura radius matches 10, 20, or 40 meters.</li>
      <li>[ ] Auras follow moved tokens.</li>
      <li>[ ] Auras survive copying and scene reload.</li>
      <li>[ ] Auras disappear when their tokens are deleted.</li>
      <li>[ ] Auras do not create light or modify token vision.</li>
    </ul>

    <h2>Elemental Totem roll workflow</h2>

    <p>
      Repeat casts until each listed roll outcome has occurred.
      Push failed rolls where required. For a dragon result, complete
      the system's critical-effect choice before judging whether the
      totem dialog starts. Watch for duplicate dialogs after every
      roll and chat-message update.
    </p>

    <ul>
      <li>[ ] A normal success opens one selection dialog.</li>
      <li>[ ] A normal failure opens no dialog.</li>
      <li>[ ] A pushed failure opens no dialog.</li>
      <li>[ ] A pushed success opens one dialog.</li>
      <li>[ ] A demon result opens no dialog.</li>
      <li>[ ] A dragon result waits for the critical-effect choice and opens once.</li>
      <li>[ ] Power level 1 permits one totem.</li>
      <li>[ ] Power level 3 permits two additional choices.</li>
      <li>[ ] Duplicate totem types cannot be selected.</li>
      <li>[ ] Existing totems are replaced only after successful placement.</li>
    </ul>

    <h2>Player and game-master workflow</h2>

  <p>
  Connect to the same world with a game-master user and two
  ordinary player users, using separate clients or testing the
  player users sequentially. Give the first player Owner
  permission for one test Actor with Elemental Totem, and no
  ownership of a second control Actor. Do not give the second
  player ownership of the caster Actor. Perform the cast and
  placement from the owning player client while observing the
  relevant consoles.
  </p>

  <ul>
  <li>[ ] A player can cast using an owned Actor.</li>
  <li>[ ] The player chooses the totems and placement positions.</li>
  <li>[ ] The active primary GM creates the tokens exactly once.</li>
  <li>[ ] A player cannot submit a request for an Actor they do not own.</li>
  <li>[ ] The caster Actor owner receives Owner permission for the summoned totem.</li>
  <li>[ ] Another ordinary player receives Observer permission only.</li>
  <li>[ ] The owning player can read and edit the summoned totem Actor sheet.</li>
  <li>[ ] The observing player can read but not edit the summoned totem Actor sheet.</li>
  <li>[ ] The owning player cannot drag or reposition the summoned totem.</li>
  <li>[ ] The game master can drag and reposition the summoned totem.</li>
  <li>[ ] A permitted non-position token update remains possible for the owning player.</li>
  <li>[ ] Cross-scene cleanup removes the caster's older totems.</li>
  <li>[ ] Other casters' totems remain.</li>
  </ul>

  <h2>Adventure and interface verification</h2>

    <p>
      Use a clean test world for the first import. Then reopen the
      same world with the same content version, a new development
      suffix, and finally a later semantic content version. Inspect
      every dialog and affected Actor or Item sheet at normal browser
      zoom.
    </p>

    <ul>
      <li>[ ] Clean-world Adventure import succeeds.</li>
      <li>[ ] The import prompt appears only for a newer content version.</li>
      <li>[ ] Development build suffix changes do not retrigger the prompt.</li>
      <li>[ ] Dialog layout is readable at normal browser zoom.</li>
      <li>[ ] All new interface text is localized in English.</li>
      <li>[ ] The always-prepared checkbox is disabled and visually distinct.</li>
      <li>[ ] The always-prepared tooltip is displayed.</li>
    </ul>

    <h2>Weapon feature verification</h2>

    <p>
      Prepare one eligible ranged weapon and one control weapon.
      The eligible weapon must be non-thrown, Piercing, and have
      Armor Piercing or Scattershot as appropriate. Toggle the
      Dragonbane Damage Types option where instructed, and test at
      point-blank, normal, and long range against a target token.
    </p>

    <ul>
      <li>[ ] Armor Piercing adds exactly one Find Weak Spot option to an eligible weapon.</li>
      <li>[ ] Armor Piercing is unavailable when Damage Types is disabled.</li>
      <li>[ ] Scattershot removes the point-blank bane.</li>
      <li>[ ] Scattershot preserves the long-range bane.</li>
      <li>[ ] Scattershot long-range damage is halved and rounded up.</li>
      <li>[ ] Missing Ammo Pouch shows the confirmation dialog.</li>
      <li>[ ] Perform Action continues after the warning.</li>
      <li>[ ] Cancel Action cancels after the warning.</li>
    </ul>

    <h2>Compatibility and presentation</h2>

    <p>
      Review this report's Environment page, the browser console,
      the chat log, and the created world documents. Record any
      unexpected behavior in Manual notes, including reproduction
      steps and screenshots where useful.
    </p>

    <ul>
      <li>[ ] Browser console contains no unexpected errors.</li>
      <li>[ ] The tested Foundry version is recorded correctly.</li>
      <li>[ ] The tested Dragonbane version is recorded correctly.</li>
      <li>[ ] Relevant module versions are recorded correctly.</li>
      <li>[ ] Any failures or deviations are documented below.</li>
    </ul>

    <h2>Manual notes</h2>

    <p>
      Add observations, screenshots, failure details, and
      reproduction steps here.
    </p>
  `;
}

function boaBuildEnvironmentHtml(environment) {
  const moduleRows = environment.activeModules
    .map(module => `
      <tr>
        <td>${boaHtmlText(module.title)}</td>
        <td>${boaHtmlText(module.id)}</td>
        <td>${boaHtmlText(module.version)}</td>
      </tr>
    `)
    .join("");

  return `
    

    <h2>Runtime</h2>

    <table>
      <tbody>
        <tr>
          <th>Bane of Azeroth</th>
          <td>${boaHtmlText(environment.moduleVersion)}</td>
        </tr>
        <tr>
          <th>Foundry VTT</th>
          <td>${boaHtmlText(environment.foundryVersion)}</td>
        </tr>
        <tr>
          <th>Dragonbane</th>
          <td>${boaHtmlText(environment.dragonbaneVersion)}</td>
        </tr>
        <tr>
          <th>Dragonbane Core Set</th>
          <td>${boaHtmlText(
            environment.dragonbaneCoreSetVersion
          )}</td>
        </tr>
        <tr>
          <th>YZE Combat</th>
          <td>${boaHtmlText(environment.yzeCombatVersion)}</td>
        </tr>
        <tr>
          <th>World</th>
          <td>${boaHtmlText(environment.worldTitle)}</td>
        </tr>
        <tr>
          <th>World ID</th>
          <td>${boaHtmlText(environment.worldId)}</td>
        </tr>
        <tr>
          <th>Active scene</th>
          <td>${boaHtmlText(environment.sceneName)}</td>
        </tr>
        <tr>
          <th>User</th>
          <td>${boaHtmlText(environment.userName)}</td>
        </tr>
        <tr>
          <th>User ID</th>
          <td>${boaHtmlText(environment.userId)}</td>
        </tr>
        <tr>
          <th>Game master</th>
          <td>${environment.userIsGM ? "Yes" : "No"}</td>
        </tr>
        <tr>
          <th>Started</th>
          <td>${boaHtmlText(environment.startedAt)}</td>
        </tr>
        <tr>
          <th>Completed</th>
          <td>${boaHtmlText(environment.completedAt)}</td>
        </tr>
        <tr>
          <th>Duration</th>
          <td>
            ${(environment.durationMs / 1000).toFixed(2)}
            seconds
          </td>
        </tr>
        <tr>
          <th>Browser</th>
          <td>${boaHtmlText(environment.browser)}</td>
        </tr>
      </tbody>
    </table>

    <h2>Active modules</h2>

    <table>
      <thead>
        <tr>
          <th>Module</th>
          <th>ID</th>
          <th>Version</th>
        </tr>
      </thead>
      <tbody>
        ${
          moduleRows ||
          `
            <tr>
              <td colspan="3">None</td>
            </tr>
          `
        }
      </tbody>
    </table>

    <h2>Additional notes</h2>
    <p>Add environment-specific observations here.</p>
  `;
}

function boaHtmlPage(
  name,
  content,
  sort
) {
  return {
    name,
    type: "text",
    sort,
    text: {
      format:
        CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,
      content,
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
      boaHtmlPage(
        "Summary",
        boaBuildSummaryHtml({
          suiteResult,
          results,
          environment,
          createdAt,
        }),
        100000
      ),
      boaHtmlPage(
        "Automated Results",
        boaBuildAutomatedResultsHtml(results),
        200000
      ),
      boaHtmlPage(
        "Manual Checklist",
        boaBuildManualChecklistHtml(),
        300000
      ),
      boaHtmlPage(
        "Environment and Notes",
        boaBuildEnvironmentHtml(environment),
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
