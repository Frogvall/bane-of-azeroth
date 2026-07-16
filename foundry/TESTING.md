# Testing

This document records automated and manual verification of the **Bane of
Azeroth** Foundry VTT module.

The module is in early alpha. Test results apply only to the versions and
configuration listed below.

## Current development target

| Component | Version |
|---|---:|
| Bane of Azeroth development version | 0.7.0 |
| Latest fully verified module version | 0.6.0 |
| Foundry Virtual Tabletop | 14.364 |
| Dragonbane system | 4.0.1 |
| Dragonbane Core Set | 2.2 |
| YZE Combat | 1.7.0 |

Compatibility results must be recorded against the exact installed module
version, including any prerelease suffix.

Tested by **Auvreannia** through 2026-07-16.

## Version status

| Module version | Foundry | Dragonbane | Core Set | YZE Combat | Result | Tester | Date |
|---|---:|---:|---:|---:|---|---|---|
| 0.1.1 | 14.364 | 4.0.1 | 2.2 | 1.7.0 | Pass | Auvreannia | 2026-07-12 |
| 0.1.2 | 14.364 | 4.0.1 | 2.2 | 1.7.0 | Pass | Auvreannia | 2026-07-12 |
| 0.1.3 | 14.364 | 4.0.1 | 2.2 | 1.7.0 | Pass | Auvreannia | 2026-07-13 |
| 0.4.0 | 14.364 | 4.0.1 | 2.2 | 1.7.0 | Pass | Auvreannia | 2026-07-13 |
| 0.5.1 | 14.364 | 4.0.1 | 2.2 | 1.7.0 | Pass | Auvreannia | 2026-07-14 |
| 0.5.2 | 14.364 | 4.0.1 | 2.2 | 1.7.0 | Pass | Auvreannia | 2026-07-14 |
| 0.6.0 | 14.364 | 4.0.1 | 2.2 | 1.7.0 | Pass | Auvreannia | 2026-07-15 |
| 0.7.0 | — | — | — | — | In progress | — | — |

---

# Automated unit and integration tests

Vitest runs during every Foundry package build. A failed test blocks packaging
and prerelease publication.

Local Docker command:

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -v "$PWD:/workspace" \
  -w /workspace \
  node:22-bookworm-slim \
  bash -lc 'npm ci --ignore-scripts && npm run test:coverage'
```

## Current automated baseline

Recorded from the Foundry branch pipeline on 2026-07-16:

| Metric | Covered | Total | Coverage |
|---|---:|---:|---:|
| Test files | 10 | 10 | 100% passing |
| Tests | 134 | 134 | 100% passing |
| Statements | 401 | 772 | 51.94% |
| Branches | 292 | 535 | 54.57% |
| Functions | 73 | 132 | 55.30% |
| Lines | 390 | 725 | 53.79% |

The pipeline publishes:

- a Vitest summary in the GitHub Actions job summary;
- JUnit XML as the `unit-test-results` artifact; and
- HTML, LCOV, and JSON coverage as the `unit-test-coverage` artifact.

Coverage is informational and currently has no blocking percentage threshold.
This baseline must not decrease during a behavior-preserving refactor.

## Automated areas

The current Vitest suite covers positive and negative cases for:

- Adventure import prompting and version handling;
- custom weapon feature eligibility;
- Ammo Pouch detection and confirmation handling;
- Armor Piercing and Scattershot prototype patches;
- Heroic Ability spell-grant definitions;
- automatic spell creation, reconciliation, preparation protection, duplicate
  prevention, and removal;
- Elemental Totem definition loading;
- Elemental Totem plan construction and validation;
- requester, ownership, message, scene, and placement validation;
- token creation, persistent flags, Observer ownership, rollback, and
  cross-scene cleanup;
- aura range, color, and alpha calculations; and
- Foundry hook registration.

Automated tests use Foundry and Dragonbane test doubles. They do not replace
tests in a real Foundry world.

---

# Prerelease system-test macros

Development builds include a Macro compendium named:

```text
Bane of Azeroth – Developer Tests
```

Pack ID:

```text
bane-of-azeroth.bane-of-azeroth-dev-tests
```

The pack is included only when the package is built with:

```text
BOA_INCLUDE_DEV_TESTS=true
```

The branch prerelease workflow sets this automatically. Stable/default-branch
packages do not declare or include the developer-test pack.

No system test runs automatically. A game master starts every macro manually.

## Included macros

### BOA DEV – Run All System Tests

Runs the automated system-test macros in sequence and performs fixture cleanup
afterwards.

### BOA DEV – Smoke Test

Read-only checks for the active module and system, compendiums, custom weapon
features, localization, and socket support.

### BOA DEV – Verify Generated Content

Read-only checks against imported Adventure content and the structured runtime
definitions: generated spells, granting abilities, Elemental Totem templates,
portraits, token images, statistics, traits, and aura flags.

### BOA DEV – Verify Spell Grants

Creates a temporary flagged Actor and verifies the real Foundry document-hook
workflow:

- adding Shamanic Calling grants Elemental Totem;
- the granted spell is prepared and marked as automatic;
- it cannot be unprepared;
- duplicate granting abilities do not duplicate it;
- it remains until the final granting ability is removed; and
- a manually added spell is preserved.

The temporary Actor is deleted in a `finally` block.

### BOA DEV – Verify Elemental Totems

Checks imported templates and, when summoned totems already exist, checks their
runtime flags, synthetic Actor ownership, statistics, images, and aura data.
Runtime-token checks are skipped when no summoned totems exist.

### BOA DEV – Cleanup Test Data

Deletes only documents carrying:

```text
flags.bane-of-azeroth.testFixture = true
```

It never deletes documents based on names.

## Running the macro suite

1. Install a branch prerelease.
2. Import or update the Bane of Azeroth Adventure.
3. Open **Compendium Packs**.
4. Open **Bane of Azeroth – Developer Tests**.
5. Execute **BOA DEV – Run All System Tests** as a game master.
6. Review the whispered chat report and browser console.
7. Complete the remaining manual compatibility tests.

## Persistent test reports

Every **BOA DEV – Run All System Tests** execution creates a dated Journal
Entry under:

```text
Bane of Azeroth
└── System Tests
    └── BOA Test Report – <module version> – <date and time>
```

The report is created even when an automated test fails. It contains four
Markdown pages:

1. **Summary** — automatic result, aggregate counts, exact runtime versions,
   user, world, and timestamps.
2. **Automated Results** — every PASS, FAIL, and SKIP result with details.
3. **Manual Checklist** — editable task-list lines using `- [ ]`; change them
   to `- [x]` as tests are completed.
4. **Environment and Notes** — browser, scene, active modules, and free-form
   notes.

The Journal Entry is marked with persistent module flags including automatic
result, the manual status at creation, module version, Foundry version,
Dragonbane version, and run timestamp. The completed manual result is kept
on the editable Summary and Manual Checklist pages.

`Run All` posts only a short whispered chat summary with a link to the complete
Journal report. The browser console retains the detailed diagnostic tables.

A compatibility run is complete only after the report's manual checklist and
manual result have been updated.

---

# General manual prerequisites

- Enable the Bane of Azeroth module.
- Use the versions listed in the current environment.
- Enable Dragonbane's **Damage Types** rule for Armor Piercing tests.
- Import the current Adventure.
- Reload after changing scripts, styles, localization, or generated content.
- Reimport the Adventure after changing generated documents.
- Keep an active game master connected for player-initiated totem summoning.

## Generated content verification

```bash
python3 tools/generate-kin.py --check
python3 tools/generate-heroic-class-abilities.py --check
python3 tools/generate-gear.py --check
python3 tools/generate-spells.py --check
python3 tools/generate-elemental-totems.py --check
```

Expected result:

- [x] Every generator succeeds.
- [x] Generated Adventure source matches structured content.
- [x] Unit and integration tests pass.
- [x] A full package build and deployment succeeds.
- [x] Prereleases contain the developer-test Macro pack.
- [x] Stable packages do not contain or declare the developer-test pack.
- [x] Elemental Totem portraits and token images are packaged.

---

# Adventure import

## AI-01: Version prompt

- [x] A game master is prompted for a newer semantic content version.
- [x] A player is not prompted.
- [x] A development-build suffix does not retrigger the prompt.
- [x] A later semantic version does retrigger it.

## AI-02: Clean-world import

- [x] The Adventure imports without errors.
- [x] Generated folders, Items, and Actors are present.
- [x] Totem portraits and prototype-token images are correct.

---

# Custom weapon features

## WF-01: Registration and localization

- [x] Ammunition, Armor Piercing, Freehanded, Returning, and Scattershot are
  selectable.
- [x] Each has an English label and tooltip.
- [x] Existing Dragonbane features remain available.

# Armor Piercing

## AP-01: Eligibility

- [x] A ranged, non-thrown, Piercing, Armor Piercing weapon receives
  **Find Weak Spot**.
- [x] Missing Piercing, missing Armor Piercing, thrown, and melee weapons do
  not receive the module's option.
- [x] The option is unavailable when Damage Types is disabled.

## AP-02: Attack behavior

- [x] Find Weak Spot applies exactly one bane.
- [x] A successful hit ignores armor.
- [x] A demon result uses Ranged Mishap.

# Scattershot

## SS-01: Distance bands

- [x] Point-blank bane is removed at 2 meters or less.
- [x] Normal-range damage is unchanged.
- [x] Long-range bane is retained.
- [x] Long-range damage is halved and rounded up.
- [x] Critical weapon dice are doubled before halving.
- [x] Maximum range is preserved.
- [x] No target means no automatic range effect.

## SS-02: Metadata and controls

- [x] Target, damage type, armor data, and ignore-armor data are retained.
- [x] A non-Scattershot control weapon is unaffected.
- [x] Demon results use Ranged Mishap.

# Ammunition warning

## AM-01: Dialog behavior

- [x] Missing Ammo Pouch shows a confirmation.
- [x] **Perform Action** continues.
- [x] **Cancel Action** cancels.
- [x] No warning appears with an Ammo Pouch or without Ammunition.
- [x] Warning order is Ammo Pouch, Broken Weapon, Long Range.
- [x] Ammunition is not consumed.

# Heroic Ability spell grants

| Heroic Class Ability | Spell |
|---|---|
| Druidic Awakening | Savage Incarnation |
| Chosen of Elune | Incarnation of the Stars |
| King of the Jungle | Feral Incarnation |
| Tree of Life | Incarnation of Harmony |
| Darkness | Shadowform |
| Shamanic Calling | Elemental Totem |

## SG-01: Lifecycle

- [x] Adding an ability adds exactly one prepared linked spell.
- [x] The automatic spell cannot be unprepared.
- [x] Duplicate granting abilities do not duplicate the spell.
- [x] The spell remains until the final granting ability is removed.
- [x] A manually added spell is preserved.
- [x] Existing Actors reconcile without duplicates.
- [x] Player-owned Actors are modified exactly once.

# Elemental Totems

Power level is limited to 1–3. A cast can include at most one of each type.

## ET-01: Templates

- [x] Four NPC templates exist.
- [x] Base statistics are 10 HP, armor 2, movement 0.
- [x] Prototype tokens are unlinked and 0.5 by 0.5.
- [x] Portraits and token images are correct.
- [x] Trait text uses **once per round**.

## ET-02: Power levels

- [x] PL 1 creates one baseline totem.
- [x] PL 3 presents two additional choices.
- [x] Duplicate types cannot be selected.
- [x] Reach can become 20 or 40 meters.
- [x] Durability can become 20 HP/armor 4 or 40 HP/armor 8.

## ET-03: Placement

- [x] Placement is limited to 6 meters.
- [x] Valid preview uses the totem color.
- [x] Invalid preview is red.
- [x] Placement snaps to the grid.
- [x] Escape and right-click cancel without removing existing totems.

## ET-04: Roll results

- [x] Normal failure, pushed failure, and demon do nothing.
- [x] Pushed success opens one flow.
- [x] Dragon waits for the critical-effect choice and opens once.

## ET-05: Replacement and multiplayer

- [x] Previous totems from the caster are removed across all scenes.
- [x] Other casters' totems remain.
- [x] A player chooses positions and the primary GM creates tokens once.
- [x] A player cannot submit a request for an Actor they do not own.

## ET-06: Ownership, images, and auras

- [x] Players can read but not edit summoned totem sheets.
- [x] Current prototype-token images are used.
- [x] Cleansing is blue/cyan.
- [x] Flametongue is orange.
- [x] Stoneskin is yellow-green.
- [x] Windfury is lavender.
- [x] Aura radius is 10, 20, or 40 meters.
- [x] Auras follow copied or moved tokens and survive scene reload.
- [x] Auras do not create light or change vision.

---

# Manual tests that macros do not replace

These require human interaction or multiple real clients:

- pointer movement and placement preview;
- grid snapping;
- Escape and right-click cancellation;
- visual distinction of auras on different maps;
- dialog layout and localization;
- real player-to-GM socket behavior across two clients;
- latency and reconnect behavior;
- Adventure import UI; and
- browser-specific rendering.

---

# Release acceptance for 0.6.0

- [x] All generators pass.
- [x] 134 of 134 automated tests pass.
- [x] Coverage baseline is recorded.
- [x] Full package build and deployment succeed.
- [x] Clean-world import succeeds.
- [x] Spell grants and always-prepared behavior pass.
- [x] Elemental Totem casting, placement, cleanup, ownership, images, and auras
  pass.
- [x] Final **once per round** text is present.
- [x] Changelog is updated.

# Known limitations

- Totem benefits are resolved manually.
- The module does not determine which allies are inside an aura.
- Player-initiated token creation requires an active game master.
- Ammunition is warned about but not consumed.
- System-test macros require imported world content.
- Visual and multi-client behavior remains manual.

# Recording future compatibility runs

1. Record exact module, Foundry, Dragonbane, Core Set, and YZE Combat versions.
2. Run pipeline unit and integration tests.
3. Run **BOA DEV – Run All System Tests** from a prerelease.
4. Complete manual compatibility tests.
5. Record failures explicitly.
6. Update `compatibility.verified` only after all required checks pass.
