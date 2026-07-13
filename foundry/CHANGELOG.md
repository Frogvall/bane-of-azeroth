# Changelog

All notable changes to **Bane of Azeroth** will be documented in this file.

The project is currently in early alpha. Rules, document structures, compendium identifiers, and Foundry integrations may change between versions.

## [Unreleased]

No unreleased changes recorded yet.

## [0.1.3] - 2026-07-13

### Added

- Added an Ammo Pouch confirmation dialog for weapons with the Ammunition feature.
- Added localized dialog text for missing ammunition containers.

### Behavior

- Using an Ammunition weapon without an Ammo Pouch displays a confirmation dialog.
- Perform Action continues the attack normally.
- Cancel Action cancels the attack.
- Ammunition is not automatically tracked or consumed.
- Weapons without Ammunition are unaffected.
- When multiple warnings apply, dialogs appear in this order:
  1. Missing Ammo Pouch
  2. Broken Weapon
  3. Long Range

### Verified

- Armor Piercing remains functional.
- Scattershot remains functional.
- Existing Dragonbane attack behavior remains intact.

## [0.1.2] - 2026-07-12

### Added

- Added functional support for the **Scattershot** weapon feature.
- Added long-range damage adjustment for Scattershot weapons.
- Added capture-phase handling for Scattershot damage rolls.

### Changed

- Scattershot weapons no longer suffer the normal point-blank bane at distances of 2 meters or less.
- Scattershot weapons retain the normal long-range bane.
- Scattershot attacks beyond normal range deal half total damage, rounded up.
- Critical hits double the weapon dice before long-range Scattershot damage is halved.
- Scattershot keeps the original target, damage type, and armor-handling data from the attack.
- Scattershot does not apply automatic range-dependent effects unless a target and calculated distance are available.

### Preserved

- Preserved Dragonbane's maximum-range warning beyond double weapon range.
- Preserved ranged mishaps for Scattershot weapons.
- Preserved Piercing damage type.
- Preserved normal point-blank and long-range behavior for weapons without Scattershot.
- Preserved Armor Piercing behavior introduced in version 0.1.1.

### Verified

Tested successfully with:

- Foundry Virtual Tabletop 14.364
- Dragonbane system 4.0.1
- Dragonbane Core Set 2.2
- YZE Combat 1.7.0

Verified behavior:

- Scattershot removes the point-blank bane at 2 meters or less.
- Scattershot does not alter damage within normal range.
- Scattershot retains the long-range bane.
- Scattershot halves total long-range damage.
- Odd damage totals round up after halving.
- Critical hits double weapon dice before halving.
- Weapons without Scattershot are unaffected.
- Scattershot requires a target or otherwise calculated range.
- Piercing damage remains Piercing.
- Attacks beyond double range still produce the normal warning.
- Ranged mishaps still occur.
- Find Weak Spot remains available for eligible Armor Piercing weapons.
- Find Weak Spot still applies one bane.
- Find Weak Spot still ignores armor.
- Demon results with Find Weak Spot still use Ranged Mishap.

## [0.1.1]

### Added

- Registered the following custom weapon features:
  - Ammunition
  - Armor Piercing
  - Freehanded
  - Returning
  - Scattershot
- Added English localization for custom weapon feature names and tooltips.
- Added Armor Piercing integration with Dragonbane's **Find Weak Spot** attack option.

### Changed

- Eligible ranged weapons with both **Piercing** and **Armor Piercing** can use Find Weak Spot.
- Find Weak Spot applies one bane and ignores armor on a successful hit.
- Armor Piercing support is limited to non-thrown ranged weapons.
- Armor Piercing support is only active while Dragonbane's optional Damage Types rule is enabled.
- Armor Piercing attacks retain ranged attack semantics so that ranged critical and mishap behavior remains intact.

### Verified

- Find Weak Spot appears only for eligible weapons.
- Find Weak Spot applies one bane.
- Successful attacks ignore armor.
- Demon results use Ranged Mishap.
- Find Weak Spot is unavailable when the Damage Types optional rule is disabled.
- Thrown weapons do not receive a duplicate Find Weak Spot option.
- Existing Dragonbane behavior for thrown Piercing weapons remains unchanged.

## [0.1.0]

### Added

- Created the initial Bane of Azeroth Foundry VTT module scaffold.
- Added the initial `module.json` manifest.
- Added Foundry VTT 14 compatibility metadata.
- Added the Dragonbane system dependency.
- Added the initial English localization structure.
- Added the initial Adventure compendium structure for Bane of Azeroth content.
- Established the module namespace and script entry point.

### Notes

- This was an initial development build intended for local testing.
- The module was not yet considered ready for a stable public release.
