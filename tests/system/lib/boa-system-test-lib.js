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

function boaColorHex(value) {
  if (value === undefined || value === null) return null;
  return String(value?.css ?? value).trim().toLowerCase();
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
      This checklist now contains only tests that require human visual
      judgment, pointer interaction, multiple real Foundry clients, or
      Dragonbane UI that should not be replaced with fabricated test data.
      Everything else belongs in the automated Run All suites.
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
        Import or update the current Bane of Azeroth Adventure.
      </li>
      <li>
        Run <strong>BOA DEV – Run All System Tests</strong> and resolve
        every unexpected FAIL or SKIP before using this checklist.
      </li>
      <li>
        Run <strong>BOA DEV – Prepare Player Tests</strong> when a
        Player/GM check below is required.
      </li>
      <li>
        Keep the GM and Player browser consoles open while testing.
      </li>
      <li>
        Clean-world production installation, Adventure import/reimport,
        package presentation, and production-console checks belong to the
        Release Candidate checklist, not this development checklist.
      </li>
    </ol>

    <h2>Elemental Totem</h2>
    <ul>
      <li>[ ] Through Dragonbane's normal spell-roll UI, one successful Elemental Totem cast opens one selection flow; the pointer preview follows the cursor, snaps naturally to the grid, and Escape/right-click cleanly cancels without leaving preview artifacts.</li>
      <li>[ ] Created Totem auras look correct on the real canvas: colors and apparent radii are sensible, overlapping auras remain distinguishable, movement/reload does not leave stale graphics, and deleting a Totem removes its aura.</li>
      <li>[ ] In the prepared Player session, an owning Player can complete one real Elemental Totem cast through the connected GM; the owner can edit the summoned Actor, an observing Player cannot edit it, the Player cannot drag the Totem, the GM can move it, and no duplicate Token/dialog or unexpected BoA console error appears.</li>
    </ul>

    <h2>Frostreaper</h2>
    <ul>
      <li>[ ] A real Frostreaper activation in combat renders one light-blue aura with an apparent 10 m radius that follows the Death Knight cleanly; GM and Player clients agree on the visual state, reload reconstructs it, and it disappears at the already-automated next-turn boundary.</li>
    </ul>

    <h2>Death Knight Runes</h2>
    <ul>
      <li>[ ] Rune slots appear only beside eligible melee weapons in Main and Inventory views; the picker is compact and readable and shows Fallen Crusader, Razorice, Unending Thirst, Clear Rune, and the localized rule descriptions.</li>
      <li>[ ] Selecting, replacing, moving, and clearing a rune updates the dedicated icon everywhere the weapon is shown, and the active-icon tooltip shows the rune name and rule description without stale or duplicate UI.</li>
    </ul>

    <h2>Weapon Features</h2>
    <ul>
      <li>[ ] Armor Piercing and Scattershot integrate cleanly with Dragonbane's real action dialog and chat flow, including a readable Ammo Pouch warning and a representative Scattershot result with the expected visible damage handling.</li>
    </ul>

    <h2>Common Animal movement</h2>
    <ul>
      <li>[ ] On the real Dragonbane ruler, Dragonhawk Fly and Crocolisk Swim visibly use their alternate limits and switch back immediately; two Tokens from the same world Actor can show different token-local movement states without changing the world Actor.</li>
    </ul>

    <h2>Giant Spider Web Spray</h2>
    <ul>
      <li>[ ] Web Spray 12 renders cleanly in the compact Weapons row, and a real dragon result keeps the Critical Hit control; the Critical Hit dialog offers Extra Attack but not Double Weapon Damage, and rebuilding the attack card after Extra Attack leaves exactly one Restrain 10 text.</li>
    </ul>

    <h2>Druid Forms</h2>
    <ul>
      <li>[ ] The Change Form dialog and Druid Forms artwork editor are readable and intuitive; switching forms updates portrait/token artwork correctly, End Effect/rest restoration looks correct, and no stale artwork or duplicated controls remain.</li>
    </ul>

    <h2>Shadowform</h2>
    <ul>
      <li>[ ] Shadowform produces the intended visible token/sheet treatment on the real canvas and removes it cleanly when the effect ends, without stale filters after reload.</li>
    </ul>

    <h2>Mage's Brilliance</h2>
    <ul>
      <li>[ ] A real LANGUAGES roll for a Mage's Brilliance character presents the expected Roll / Take 10 / Cancel choice in a readable location and Take 10 completes without an extra roll.</li>
    </ul>

    <h2>Warlock Demon summoning</h2>
    <ul>
      <li>[ ] The real Demonologist demon selector and pointer-placement/cancel flow are readable and responsive, and completing or canceling the flow leaves no duplicate dialog, preview, or Token.</li>
    </ul>

    <h2>Adventure and interface presentation</h2>
    <ul>
      <li>[ ] In the development world, affected BoA dialogs, journal pages, images, and localization are readable at normal zoom; the always-prepared control is visually distinct and its tooltip is understandable.</li>
    </ul>

    <h2>Compatibility and presentation</h2>
    <ul>
      <li>[ ] GM and Player browser consoles contain no unexpected Bane of Azeroth warnings/errors during the manual smoke tests; any real deviation is documented below with reproduction steps.</li>
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

  const systemTestsFolder =
    await boaEnsureJournalFolder(
      "Bane of Azeroth - System Tests",
      null,
      "#1f5fbf"
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
