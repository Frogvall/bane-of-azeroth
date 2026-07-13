# Testing

This document records manual verification of the **Bane of Azeroth** Foundry VTT module.

The module is currently in early alpha. Test results apply only to the versions and configuration listed below.

## Test environment

| Component | Version |
|---|---:|
| Bane of Azeroth | 0.1.2 |
| Foundry Virtual Tabletop | 14.364 |
| Dragonbane system | 4.0.1 |
| Dragonbane Core Set | 2.2 |
| YZE Combat | 1.7.0 |

Tested by **Auvreannia** on 2026-07-12.

## Version status

| Module version | Foundry | Dragonbane | Core Set | YZE Combat | Result | Tester | Date |
|---|---:|---:|---:|---:|---|---|---|
| 0.1.1 | 14.364 | 4.0.1 | 2.2 | 1.7.0 | Pass | Auvreannia | 2026-07-12 |
| 0.1.2 | 14.364 | 4.0.1 | 2.2 | 1.7.0 | Pass | Auvreannia | 2026-07-12 |
| 0.1.3 | 14.364 | 4.0.1 | 2.2 | 1.7.0 | Pass | Auvreannia | 2026-07-13 |

## General prerequisites

Before running the tests:

- Enable the Bane of Azeroth module.
- Use the Dragonbane system version listed above.
- Enable the Dragonbane **Damage Types** optional rule for tests involving Piercing and Armor Piercing.
- Create or use a ranged weapon with the required test features.
- Place an attacker and a target token in a scene when testing distance-dependent behavior.
- Use a target with armor when testing armor-ignoring behavior.
- Reload the world after changing module scripts or localization files.

## Custom weapon feature registration

The module registers these custom weapon features:

- Ammunition
- Armor Piercing
- Freehanded
- Returning
- Scattershot

### Registration and localization

- [x] Each custom feature is available as a selectable weapon feature.
- [x] Each custom feature has an English label.
- [x] Each custom feature has an English tooltip.
- [x] Existing Dragonbane weapon features remain available.

---

# Armor Piercing

Armor Piercing support was introduced in version 0.1.1.

The implementation extends Dragonbane's **Find Weak Spot** attack option for eligible ranged weapons while retaining ranged attack behavior.

## Eligibility

An eligible weapon must be:

- Ranged
- Non-thrown
- Piercing
- Marked with the Armor Piercing feature

### AP-01: Eligible ranged weapon

1. Equip a ranged, non-thrown weapon.
2. Give it both **Piercing** and **Armor Piercing**.
3. Start an attack.

Expected result:

- [x] **Find Weak Spot** is available.

### AP-02: Missing Armor Piercing

1. Equip a ranged Piercing weapon without Armor Piercing.
2. Start an attack.

Expected result:

- [x] The module does not add its Armor Piercing version of Find Weak Spot.

### AP-03: Missing Piercing

1. Equip a ranged weapon with Armor Piercing but without Piercing.
2. Start an attack.

Expected result:

- [x] The module does not add Find Weak Spot.

### AP-04: Thrown weapon regression

1. Equip a thrown Piercing weapon.
2. Start an attack.

Expected result:

- [x] The module does not add a duplicate Find Weak Spot option.
- [x] Dragonbane's normal thrown-weapon behavior remains unchanged.

### AP-05: Damage Types disabled

1. Disable Dragonbane's **Damage Types** optional rule.
2. Start an attack with an otherwise eligible weapon.

Expected result:

- [x] The Armor Piercing Find Weak Spot option is unavailable.

## Attack behavior

### AP-06: Bane

1. Start an attack with an eligible weapon.
2. Select **Find Weak Spot**.

Expected result:

- [x] The attack receives exactly one bane.

### AP-07: Armor ignored

1. Target an armored creature.
2. Select **Find Weak Spot**.
3. Succeed on the attack.
4. Roll damage.

Expected result:

- [x] The successful hit ignores armor.

### AP-08: Ranged mishap

1. Attack with an eligible weapon using Find Weak Spot.
2. Produce a demon result.

Expected result:

- [x] The attack uses **Ranged Mishap**.
- [x] The attack does not use melee mishap behavior.

## Armor Piercing regression status in 0.1.2

- [x] Find Weak Spot remains available for Pistol.
- [x] Find Weak Spot still applies one bane.
- [x] Find Weak Spot still ignores armor.
- [x] Demon results still use Ranged Mishap.
- [x] Armor Piercing behavior from version 0.1.1 remains unchanged.

---

# Scattershot

Functional Scattershot support was introduced in version 0.1.2.

Scattershot changes point-blank and long-range behavior for weapons carrying the Scattershot feature.

## Distance bands

For the tests below:

- **Point blank** means a calculated distance of 2 meters or less.
- **Normal range** means beyond point blank and no farther than the weapon's listed range.
- **Long range** means beyond normal range and no farther than double the listed range.
- **Beyond maximum range** means farther than double the listed range.

## Point blank

### SS-01: Scattershot at 2 meters or less

1. Target a token at a calculated distance of 2 meters or less.
2. Attack with a Scattershot weapon.

Expected result:

- [x] The normal point-blank bane is removed.

### SS-02: Non-Scattershot control weapon

1. Target a token at a calculated distance of 2 meters or less.
2. Attack with a comparable ranged weapon without Scattershot, such as Pistol.

Expected result:

- [x] The normal point-blank bane still applies.

## Normal range

### SS-03: Damage within normal range

1. Target a token beyond point blank but within the weapon's normal range.
2. Attack with a Scattershot weapon.
3. Roll damage.

Expected result:

- [x] Damage is not halved.
- [x] Normal damage calculation is preserved.

## Long range

### SS-04: Long-range bane

1. Target a token beyond the weapon's normal range but within double range.
2. Attack with a Scattershot weapon.

Expected result:

- [x] The normal long-range bane still applies.

### SS-05: Even damage total

1. Make a successful long-range Scattershot attack.
2. Produce an even total damage result.

Expected result:

- [x] Total damage is halved.

### SS-06: Odd damage total

1. Make a successful long-range Scattershot attack.
2. Produce an odd total damage result, such as 9.

Expected result:

- [x] Total damage is halved and rounded up.
- [x] A total of 9 becomes 5.

### SS-07: Critical hit

1. Make a successful critical long-range Scattershot attack.
2. Roll damage.

Expected result:

- [x] Critical-hit weapon dice are doubled first.
- [x] The resulting total is then halved.
- [x] Fractions are rounded up.
- [x] A verified critical result of 13 becomes 7.

### SS-08: Non-Scattershot long-range control

1. Make a long-range attack with a weapon without Scattershot, such as Pistol.
2. Roll damage.

Expected result:

- [x] Long-range damage is not halved by the module.

## Range and target handling

### SS-09: No target or calculated distance

1. Attack with a Scattershot weapon without a targeted token or otherwise calculated distance.
2. Roll damage.

Expected result:

- [x] No automatic Scattershot range effect is applied.
- [x] Damage is not automatically halved.

### SS-10: Beyond double range

1. Target a token beyond double the weapon's listed range.
2. Attempt an attack with a Scattershot weapon.

Expected result:

- [x] Dragonbane's normal maximum-range warning is shown.
- [x] Scattershot does not bypass the maximum range restriction.

## Damage metadata

### SS-11: Damage type

1. Make a successful Scattershot attack with a Piercing weapon.
2. Roll damage.

Expected result:

- [x] The damage type remains Piercing.

### SS-12: Target and armor data

1. Make a successful long-range Scattershot attack against a targeted creature.
2. Roll damage.

Expected result:

- [x] The original target is retained.
- [x] Existing armor-handling information is retained.
- [x] Existing ignore-armor information is retained when applicable.

## Mishaps

### SS-13: Ranged mishap

1. Attack with a Scattershot weapon.
2. Produce a demon result.

Expected result:

- [x] The attack uses Ranged Mishap.
- [x] Scattershot does not convert the attack to melee behavior.

## Scattershot status in 0.1.2

- [x] Point-blank bane removed at 2 meters or less.
- [x] Normal-range damage unchanged.
- [x] Long-range bane preserved.
- [x] Long-range total damage halved.
- [x] Odd totals rounded up.
- [x] Critical weapon dice doubled before halving.
- [x] Weapons without Scattershot unaffected.
- [x] No automatic effect without a target or calculated range.
- [x] Piercing damage type preserved.
- [x] Maximum-range warning preserved.
- [x] Ranged mishaps preserved.

---

# Final result for 0.1.2

Version 0.1.2 passed all currently defined manual tests in the listed environment.

Verified areas:

- Custom weapon feature registration
- English localization
- Armor Piercing eligibility
- Find Weak Spot integration
- Bane application
- Armor ignoring
- Optional-rule handling
- Thrown-weapon regression behavior
- Point-blank Scattershot behavior
- Normal-range Scattershot behavior
- Long-range Scattershot behavior
- Damage halving and rounding
- Critical-hit ordering
- Damage type preservation
- Maximum-range handling
- Ranged mishaps
- Regression of version 0.1.1 behavior

## Version 0.1.3 — Ammunition warning

- [x] An Ammunition weapon without an Ammo Pouch opens the confirmation dialog.
- [x] Perform Action continues to the normal attack dialog.
- [x] Cancel Action cancels the attack.
- [x] No warning appears when the actor carries an Ammo Pouch.
- [x] No warning appears for a weapon without Ammunition.
- [x] Ammunition is not consumed or tracked.
- [x] Multiple confirmation dialogs appear in the expected order:
  1. Missing Ammo Pouch
  2. Broken Weapon
  3. Long Range
- [x] Armor Piercing remains functional.
- [x] Scattershot remains functional.

## Not yet verified

The following areas have not yet been verified and should not be assumed compatible:

- Foundry VTT versions other than 14.364
- Dragonbane system versions other than 4.0.1
- Dragonbane Core Set versions other than 2.2
- YZE Combat versions other than 1.7.0
- Other optional-rule combinations
- Conflicts with modules not listed in the test environment
- Multiplayer or high-latency behavior
- Localization languages other than English
- Automated migration between module versions

## Adding future test results

For each new module release:

1. Add the environment to the version status table.
2. Copy relevant test sections when behavior changes.
3. Add new test cases for new features.
4. Run regression tests for all previously implemented mechanics.
5. Record failures explicitly rather than removing failed cases.
6. Mark a version as **Pass** only after every required test has been completed.
