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
        Run <strong>BOA DEV – Prepare Player Tests</strong>.
        It creates the temporary Player User, assigned character,
        required Heroic Abilities and spell, Willpower Points,
        linked token, and isolated test scene needed below.
      </li>
      <li>
        Open the browser console before testing and leave it open.
      </li>
    </ol>

    <h2>Elemental Totem placement and interaction</h2>

  <p>
  Automated tests cover placement-range validation and server-side
  rejection. Use the real canvas to verify pointer interaction, grid
  measurement, preview rendering, and cancellation behavior.
  </p>

  <ul>
  <li>[ ] The placement preview follows the cursor.</li>
  <li>[ ] Valid placement uses the selected totem's aura color, while invalid placement is red.</li>
  <li>[ ] Placement snaps correctly to the active grid.</li>
  <li>[ ] A grid position displayed as 6 meters is accepted, while one displayed beyond 6 meters is rejected.</li>
  <li>[ ] Escape and right-click each cancel the entire placement flow.</li>
  <li>[ ] Canceling any PL1–PL3 placement preserves the caster's existing totems.</li>
  </ul>

  <h2>Elemental Totem visual verification</h2>

  <p>
  Automated tests verify configured aura values, light and sight data,
  redraw lifecycle, and graphics cleanup. Inspect the rendered result on
  the real canvas, including copy, reload, overlap, and visibility.
  </p>

  <ul>
  <li>[ ] All four totem auras visually match their configured colors and apparent radii.</li>
  <li>[ ] Overlapping auras remain visually distinguishable.</li>
  <li>[ ] Auras follow moved tokens smoothly.</li>
  <li>[ ] Auras survive token copying and scene reload.</li>
  <li>[ ] Auras disappear visually when their tokens are deleted.</li>
  <li>[ ] Aura rendering does not visibly create light or modify token vision.</li>
  </ul>

  <h2>Elemental Totem roll workflow</h2>

  <p>
  Automated tests cover normal, pushed, dragon, and demon result
  classification, power-level plans, duplicate prevention, and cleanup.
  Perform a compact end-to-end smoke test through Dragonbane's real roll
  and chat-message workflow. To reach edge results faster, temporarily
  add nine boons for dragons or nine banes for demons.
  </p>

  <ul>
  <li>[ ] A real normal success opens exactly one selection dialog and completed placement creates the expected totem.</li>
  <li>[ ] A real dragon waits for the critical-effect choice and opens exactly once; a real demon opens no dialog.</li>
  <li>[ ] PL1 and PL3 dialogs show the expected number of choices and prevent duplicate totem types.</li>
  <li>[ ] Aborting any placement preserves the previous cast, while a completed recast replaces it.</li>
  </ul>

  <h2>Player and game-master workflow</h2>

  <p>
  The real-player harness now verifies a genuine Player User, assigned
  character ownership, required Heroic Abilities, automatic Elemental
  Totem grant, owned-Actor updates, active-GM presence, and a
  player-authored demon-command payment. Existing automated tests also
  cover request authorization, ownership propagation, Observer defaults,
  movement-hook logic, non-position updates, and cross-scene cleanup.
  Only the remaining spell-roll, pointer, sheet, drag, and real Elemental
  Totem socket interactions need manual verification.
  </p>

  <ul>
  <li>[ ] Using the prepared Player Test session, an owning player can make one real successful Elemental Totem cast, select totems, and complete pointer placement through the connected GM.</li>
  <li>[ ] The owning player can open and edit the summoned totem Actor sheet; an observing player can open but not edit it.</li>
  <li>[ ] The owning player cannot drag or reposition the totem, while the game master can.</li>
  <li>[ ] The complete player/GM flow creates no duplicate tokens or dialogs and produces no unexpected console errors.</li>
  </ul>

  <h2>Adventure and interface verification</h2>

  <p>
  Automated tests cover semantic-version prompt rules and preparation
  enforcement. Use a clean world and the packaged module to verify the
  actual import sheet, rendered layouts, localization, and visual state.
  </p>

  <ul>
  <li>[ ] Clean-world Adventure import succeeds from the packaged prerelease module.</li>
  <li>[ ] The import sheet and all affected dialogs are readable at normal browser zoom, with every referenced image loading.</li>
  <li>[ ] New interface text appears as natural English without untranslated localization keys.</li>
  <li>[ ] The always-prepared checkbox is disabled and visually distinct, and its tooltip is displayed.</li>
  </ul>

  <h2>Weapon feature verification</h2>

  <p>
  Automated tests cover Find Weak Spot eligibility and duplication,
  Damage Types gating, Scattershot bane handling and rounded damage, and
  both Ammo Pouch confirmation outcomes. Perform a small end-to-end smoke
  test through Dragonbane's actual action and chat interfaces.
  </p>

  <ul>
  <li>[ ] Armor Piercing and Scattershot appear correctly in the real action dialog for eligible weapons and settings.</li>
  <li>[ ] One Scattershot sequence confirms point-blank handling, preserved long-range bane, and the expected halved damage result in chat.</li>
  <li>[ ] The Ammo Pouch warning is readable; accepting continues the action and canceling stops it.</li>
  </ul>

<h2>Common Animal movement ruler</h2>

  <p>
  Automated tests verify alternate-movement metadata, token-local
  ActorDelta updates, base-rate restoration, and world-Actor isolation.
  Use Dragonbane's real movement-action selector and ruler on a gridded
  scene to verify the visible movement classification at the exact limit
  and immediately beyond it. Verify the functional classification rather
  than relying on a specific color or wording.
  </p>

  <ul>
  <li>[ ] With normal movement selected, a Dragonhawk path of exactly 2 meters is shown within its normal allowance, while a path immediately beyond 2 meters is visibly classified beyond that allowance.</li>
  <li>[ ] After selecting Fly, a Dragonhawk path of exactly 14 meters is shown within its normal allowance, while a path immediately beyond 14 meters is visibly classified beyond that allowance.</li>
  <li>[ ] Switching the Dragonhawk back from Fly to normal movement immediately restores the visible ruler limit from 14 meters to 2 meters.</li>
  <li>[ ] With normal movement selected, a Crocolisk path of exactly 6 meters is shown within its normal allowance; Swim changes that limit to 12 meters, and switching back restores 6 meters.</li>
  <li>[ ] Two Dragonhawk tokens from the same world Actor can simultaneously show ruler limits of 14 meters for Fly and 2 meters for normal movement, while the world Actor remains at movement 2.</li>
  <li>[ ] Changing movement actions on a Gorilla does not change its movement limit from 8 meters or produce an unexpected ruler, warning, token, or Actor-sheet state.</li>
  </ul>

<h2>Giant Spider Web Spray</h2>

  <p>
  Automated tests verify the generated effect-only metadata, message
  enrichment, dragon-result persistence, and compact NPC-sheet cleanup.
  Use the real Dragonbane weapon-test workflow to verify system integration.
  </p>

  <ul>
  <li>[ ] Giant Spider lists <strong>Web Spray 12</strong> in the compact Weapons row without empty damage parentheses.</li>
  <li>[ ] A normal successful Web Spray attack immediately adds the Restrain 10 text to the same attack card and shows no Roll Damage button.</li>
  <li>[ ] A failed Web Spray attack adds no Restrain text.</li>
  <li>[ ] A demon result adds no Restrain text and uses Dragonbane's melee mishap flow.</li>
  <li>[ ] A dragon result immediately adds Restrain 10 and still shows the Critical Hit button.</li>
  <li>[ ] Opening Critical Hit for Web Spray offers Extra Attack but not Double Weapon Damage.</li>
  <li>[ ] After confirming Extra Attack, the same attack card still contains exactly one copy of the Restrain 10 text.</li>
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
