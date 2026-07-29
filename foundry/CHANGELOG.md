# Changelog

All notable changes to **Bane of Azeroth** will be documented in this file.

The project is currently in early alpha. Rules, document structures, compendium identifiers, and Foundry integrations may change between versions.

## [Unreleased]

### Changed

- Moved development system-test reports into a dedicated flat Journal folder.
- Renamed the development-only report folder to `Bane of Azeroth - System Tests`.

### Fixed

- Added LevelDB source keys to generated JournalEntry pages and folders.

### Added

- Added generated JournalEntry infrastructure with Credits as the first Homebrewery-backed pilot.
- Reserved stable parent JournalEntry IDs for Player Options, Appendices, and Foundry VTT Guide.
- Added symbolic `@Ref[...]` and `@DisplayRef[...]` resolution to the Journal generator.
- Added Adventure and integration coverage for generated JournalEntries.

### Changed

- Moved module compatibility and external reference registries from `foundry/content` to `foundry/config`.
- Kept generated runtime reference data under `foundry/generated` and generated audit output under `generated`.
- Made the external UUID Macro integration test source-based, without Python or `pack-src` assumptions.

### Added

- Added generated external UUID verification to the Run All system-test suite.
- Added an installable generated external-reference JavaScript module derived from the source registries.
- Added literal UUID discovery to the reference inventory.

### Changed

- Centralized the Dragonbane Core lethal-poison JournalEntryPage UUID for runtime, Common Animal generation, and system tests.
- Limited the reference inventory to authoritative source areas instead of generated `pack-src` output.

### Added

- Added the central verified-environment manifest for Foundry, Dragonbane, Dragonbane Core Set, and YZE Combat.
- Added an external-source registry where package ownership is separate from the module-wide verified version.
- Added the shared `@Ref[...]` and `@DisplayRef[...]` symbolic-reference resolver.
- Added a generated, deterministic inventory of existing `@UUID`, `@DisplayTable`, symbolic reference, and runtime UUID lookup usage.
- Added integration contracts for the 0.10.0 reference foundation.

### Changed

- Started 0.10.0 development and set the Foundry module source version to `0.10.0`.

## [0.9.2] - 2026-07-28

### Added

- Added the Imp, Sayaad, Felhunter, and Voidwalker as generated Warlock summoned monsters.
- Added Demonologist selection and automated token placement within 10 meters.
- Added validated Player-to-primary-GM socket handling for demon creation.
- Added synthetic demon Actor ownership: owners of the caster receive Owner permission while other players receive Observer permission.
- Added automatic replacement of the caster's previous Warlock demon.
- Added world settings that independently enable or disable Elemental Totem and Warlock demon automation.
- Added Imp **Phase Shift** and Sayaad **Seductive** as preselected, removable attack banes.
- Added Voidwalker **Suffering**, sharing final HP damage equally with both halves rounded up.
- Added Dragonbane-native localized damage cards for transferred Voidwalker damage and corrected Suffering details on the caster's damage card.
- Added shared Stretch- and Shift-rest summon cleanup across scenes.

### Changed

- Removed the custom monster attack menu from summoned monsters and kept Dragonbane's ordinary action flow.
- Kept manual Demonologist instructions available when demon automation is disabled.
- Preserved lifecycle behavior for already-created automatic summons after their automation setting is disabled.
- Presented Suffering chat messages in deterministic order: caster HP loss, Suffering explanation, Voidwalker damage card, and corrected caster damage card.

### Testing

- Added unit and integration coverage for demon generation, placement, ownership, replacement, command control, automation settings, defense banes, Suffering, rest lifecycle, hook registration, and socket validation.
- Expanded the prerelease Warlock Demon system test with all four demons, disabled automation, lifecycle, defense, and Suffering checks.
- Expanded the real-player harness with Player-owned command control, Phase Shift, Seductive, Stretch and Shift cleanup, Suffering, and genuine Player-to-primary-GM demon creation and replacement.
- Added centralized build and packaging checks that execute every Foundry generator through its `--check` mode.

## [0.9.1] - 2026-07-24

### Added

- Added the Ghoul as a native Dragonbane monster Actor under `Bane of Azeroth/Undead`, with dedicated portrait and token artwork.
- Added a blue `Bane of Azeroth` Roll Tables folder with a flat `Monster Attacks` subfolder.
- Added the `Monster Attacks – Ghoul` RollTable with Claws and Infectious Bite.
- Added structured summoned-monster source data and `tools/generate-summoned-monsters.py`.
- Added versioned monster-control and monster-attack metadata for controlled attack selection and resource costs.
- Added optional automatic payment of Infectious Bite's 2 WP cost from the player's assigned character.
- Added a Dragonbane-style chat card showing the assigned character's WP expenditure.

### Changed

- Ghoul attacks use Dragonbane's native monster-attack dialog.
- The Ghoul dialog offers Claws and Infectious Bite without a Random option.
- Shortcuts and settings that normally trigger a random monster attack use Claws for the Ghoul instead.
- Infectious Bite offers Yes, No, and Cancel: Yes spends 2 WP, No attacks without automatic payment, and Cancel stops the attack.
- Failed attack execution restores automatically spent WP and removes its temporary payment message.

### Testing

- Added unit coverage for Ghoul attack metadata, native dialog behavior, Claws fallback, WP choices, payment chat messages, failure rollback, and sheet integration.
- Added integration coverage for generated Ghoul content, artwork, folders, RollTable data, Adventure references, generator synchronization, and Developer Test registration.
- Added `BOA DEV – Verify Ghoul` checks for the imported Actor, attack table, control metadata, real WP expenditure, payment-chat metadata, speaker data, and cleanup.
- Added Ghoul verification to `BOA DEV – Run All System Tests`.

### Notes

- Ghoul placement, ownership assignment, combat initiative, replacement, and removal remain game-master-managed workflows.

## [0.9.0] - 2026-07-24

### Added

- Added the complete roster of fourteen Common Animals to the `Bane of Azeroth/Common Animals` Actor folder.
- Added structured Common Animal source data, deterministic Foundry identifiers, and reproducible generation of Actor, Item, folder, and Adventure source documents.
- Added dedicated Common Animal portraits and token artwork.
- Added alternate movement support for flying and swimming animals while preserving each world Actor's base movement.
- Added Common Animal attack-effect handling for lethal poison and Restrain effects.
- Added automatic application of Dragonbane's built-in **Restrained** condition to a targeted creature hit by Large Serpent's Constriction or Giant Spider's Web Spray.

### Changed

- Implemented Giant Spider's Web Spray as a melee, effect-only attack with no damage roll.
- Renamed the Foundry-side Constrain effect terminology to **Restrain** and its resulting condition to **Restrained**.
- Kept effect text in the originating attack card without creating a separate ChatMessage.
- Preserved Dragonbane's Demon mishap and Dragon critical-hit flows for effect-only attacks.
- Displayed the attacking Common Animal as the source of an automatically applied Restrained effect.

### Fixed

- Removed empty damage parentheses from effect-only attacks on Dragonbane NPC sheets.
- Prevented Restrain text from appearing on failed or Demon attack results.
- Prevented duplicated effect text when Dragonbane updates a critical-hit attack card.
- Prevented repeated status application and preserved the source of an already active Restrained effect.
- Corrected Common Animal source and generated data for Giant Spider's Web Spray and Gorilla's Acrobatics value.

### Testing

- Added unit and integration coverage for Common Animal generation, movement rates, attack effects, effect-only attacks, status application, game-master delegation, source attribution, sheet rendering, and hook registration.
- Expanded prerelease Developer Tests to verify all fourteen Common Animals, real attack-message behavior, targeted and untargeted Web Spray, failure and Demon results, Dragon critical-hit preservation, Restrained status application, and effect source attribution.
- Verified the complete automated test suite and Foundry Developer Test suite after the Common Animal changes.

## [0.8.0] - 2026-07-21

### Added

- Added a dedicated Bane of Azeroth logo and expanded HTML Overview to the Adventure import screen.
- Added integration tests for the packaged Adventure banner, logo, caption, Overview content, and asset paths.
- Added the `BOA DEV – Verify Adventure Ownership` Developer Test Macro.
- Added Adventure ownership verification to the complete Developer Test suite.

### Changed

- Simplified the Adventure import presentation by leaving the caption blank and using the standard Foundry title, banner, and Overview layout.
- Expanded the Overview with an import explanation, overwrite warning, Dragonbane ownership-setting guidance, project credits, licensing information, and attribution.
- Kept the Overview free from hard-coded document counts so it remains accurate as the Adventure grows.

### Verified

- Verified the Adventure banner is packaged as a 1536 by 600 WebP and remains within the expected file-size limit.
- Verified that Dragonbane's `Keep ownership on import` world setting preserves ownership on existing documents when Adventure content is re-imported.
- Verified both enabled and disabled ownership-setting behavior through Dragonbane's registered Adventure import hook.
- Verified the Adventure import screen and the complete Bane of Azeroth test suite with Foundry Virtual Tabletop 14.365.

## [0.7.2] - 2026-07-20

### Fixed

  * Restored Elemental Totem aura redraw after token updates, which had been lost during the runtime refactor.
  * Ensured Elemental Totem aura graphics remain fully non-interactive in Foundry's PIXI compatibility layer.

### Testing

  * Added automated coverage for pushed successes and failures, demon results, Elemental Totem placement-range boundaries, Scattershot long-range bane preservation, and rounded half damage.
  * Added focused regression tests for Elemental Totem aura drawing, redraw, inactive-scene handling, deletion, and pointer-event behavior.
  * Expanded prerelease Developer Tests to verify production ownership propagation, Observer access, light and sight preservation, cross-scene cleanup, and aura lifecycle behavior.
  * Consolidated the manual checklist around checks that still require visual inspection, real canvas interaction, or separate player and game-master clients.

## [0.7.1] - 2026-07-17

### Changed

- Split the Foundry runtime into focused modules for adventure import,
  spell preparation, spell grants, weapon features, shared helpers, and
  Elemental Totems.
- Split Elemental Totem behavior into dedicated modules for definitions,
  planning, placement, creation, socket handling, dialogs, aura
  rendering, and token controls.
- Reduced `bane-of-azeroth.js` to the runtime entry point and Foundry
  hook registration.
- Preserved the existing public runtime exports while moving their
  implementations into focused modules.

### Fixed

- Users who own the caster Actor now receive Owner permission on its
  summoned Elemental Totems.
- Other players retain Observer permission on summoned Elemental Totems.
- Non-GM users can no longer reposition Elemental Totem tokens after
  placement.
- Game masters can still reposition Elemental Totems when required.

### Testing

- Added automated coverage for Elemental Totem ownership propagation and
  movement protection.
- Retained passing unit, integration, and system tests throughout the
  behavior-preserving runtime refactor.

## [0.7.0] - 2026-07-16

### Added

- Added a Vitest unit and integration test suite for the Foundry runtime.
- Added V8 coverage reporting.
- Added prerelease-only Developer Tests macros for Foundry system
  testing.
- Added Run All system tests with Journal Entry reports, cleanup tools,
  manual procedures, and expected-versus-actual diagnostics.
- Added automated Elemental Totem fixtures.

### Changed

- System tests identify created Elemental Totems by stored totem type
  rather than token creation order.
- Developer test content is generated from source and included only in
  prerelease packages.

### Verified

- Verified adventure import, spell grants, always-prepared spells,
  weapon features, runtime hooks, and Elemental Totem workflows.

## [0.6.0] - 2026-07-15

### Added

- Added Elemental Totem actors for Cleansing, Flametongue, Stoneskin, and Windfury Totems.
- Added automated Elemental Totem casting with power-level choices and token placement.
- Added automatic replacement of previously summoned totems across scenes.
- Added scalable totem range, hit points, and armor.
- Added colored visual auras for elemental totems.
- Added dedicated actor portraits and token artwork.
- Added player-accessible read-only totem sheets.

## [0.5.2] - 2026-07-14

### Changed

- Automatically granted spells are now always prepared.
- The prepared checkbox is disabled for spells granted by Heroic Class Abilities.
- Attempts to unprepare an automatically granted spell are reverted.
- Existing automatically granted spells are restored to prepared during reconciliation.

## [0.5.1] - 2026-07-14

### Added

- Added automatic spell grants for the six Heroic Class Abilities that teach a spell.
- Added automatic reconciliation for existing Actors with those abilities.
- Added module flags that identify the spell granted by each generated ability.

### Behavior

- Adding a spell-granting Heroic Class Ability adds its linked spell to the Actor.
- Granted spells are marked as memorized.
- Removing the final ability that grants a spell removes only the automatically granted copy.
- Manually added spells are never removed by the automation.
- Existing copies of a linked spell prevent duplicate creation.

## [0.5.0] - 2026-07-14

### Added

- Added structured Foundry source data for six Bane of Azeroth spells in `foundry/content/spells.json`.
- Added `tools/generate-spells.py` for reproducible generation of spell documents and folders.
- Added the `Spells/General Magic` Adventure folder structure.
- Added stable Foundry document IDs for all six spells.
- Added a `--check` mode for verifying generated spells against their structured source.

## [0.4.0] - 2026-07-13

### Added

- Added structured Foundry source data for Bane of Azeroth gear in `foundry/content/gear.json`.
- Added `tools/generate-gear.py` for reproducible generation of gear documents.
- Added the complete Chapter 3 gear selection:
  - 3 melee weapons
  - 3 ranged weapons
  - 2 trade good
- Added stable Foundry document IDs for all generated gear.
- Added a `--check` mode for verifying that generated gear matches its structured source.

### Changed

- Gear documents are now generated into the Dragonbane Core-style folders `Melee Weapons`, `Ranged Weapons`, and `Trade Goods`.
- Throwing Glaive is generated under `Melee Weapons`.
- Ammo Pouch is generated under `Trade Goods`.
- Preserved the existing document IDs for Warglaive, Blunderbuss, Pistol, and Ammo Pouch.
- The Adventure document's gear item references are updated automatically during generation.

### Notes

- Gear currently uses matching Dragonbane Core Set placeholder icons.
- Dedicated Bane of Azeroth gear artwork can be added later without changing document IDs.


## [0.3.0] - 2026-07-13

### Added

- Added structured source data for Heroic Class Abilities in `foundry/content/heroic-class-abilities.json`.
- Added `tools/generate-heroic-class-abilities.py` for reproducible generation of Heroic Class Ability documents and class folders.
- Added 13 class folders under Heroic Class Abilities.
- Added all 52 Heroic Class Ability documents.
- Added stable Foundry document and folder IDs for generated Heroic Class Ability content.
- Added automatic updates of the Adventure document's `items` and `folders` references.
- Added a `--check` mode for verifying that generated content matches its structured source.
- Added support for rich HTML descriptions used by abilities with lists or embedded creature statistics.

### Changed

- Heroic Class Ability documents now use the Dragonbane Core Set ability icon:
  `modules/dragonbane-coreset/assets/icons/ability/ability.webp`.
- Preserved the existing document IDs for Demon Hunter Initiation and Eye Beam while organizing them under the Demon Hunter class folder.
- The Heroic Class Abilities section of the Adventure source is now generated from structured content instead of being maintained manually.

## [0.2.0] - 2026-07-13

### Added

- Added structured Foundry source data for all playable kin in `foundry/content/kin.json`.
- Added `tools/generate-kin.py` for reproducible generation of Kin and Kin Ability documents.
- Added 16 playable Kin documents.
- Added 20 Kin Ability documents.
- Added stable Foundry document IDs for generated Kin and Kin Ability content.
- Added automatic updates of the Adventure document references when kin content is generated.
- Added a `--check` mode for verifying that generated content matches its structured source.

### Changed

- Kin Ability documents now use the Dragonbane Core Set ability icon:
  `modules/dragonbane-coreset/assets/icons/ability/ability.webp`.
- The Kin and Kin Abilities folders in the Adventure source are now generated from structured content instead of being maintained manually.
- Dwarf and Elf variants are presented as separate playable kin using the names Bronzebeard Dwarf, Dark Iron Dwarf, Blood Elf, and Night Elf.

### Notes

- Kin portraits currently use placeholder artwork and will be replaced with dedicated illustrations in a future version.
- The Dragonbane Core Set ability icon convention will also be used for future Heroic Ability documents.

## [0.1.5] - 2026-07-13

### Added

- Added automatic display of the Bane of Azeroth Adventure import screen for game masters.
- Added a hidden world setting that records the latest content version for which the import screen has been shown.

### Behavior

- The Adventure import screen opens automatically the first time a game master loads a world with a new Bane of Azeroth content version.
- Only game masters receive the automatic import prompt.
- Reopening the same world with the same content version does not display the import screen again.
- Development build suffixes are ignored when determining the content version.
- Updating between builds such as `0.1.5-foundry.8.1` and `0.1.5-foundry.9.1` does not display the import screen again.
- Updating to a future content version such as `0.1.6` displays the import screen again.

## [0.1.4] - 2026-07-13

### Added

- Added a reproducible Foundry module packaging workflow.
- Added automatic generation of the installable module manifest during packaging.
- Added per-branch development versions and rolling GitHub prereleases.
- Added installation and update support through Foundry's manifest URL.
- Added package validation and SHA-256 checksum generation.
- Added a containerized Foundry VTT CLI build environment.

### Changed

- Converted the unpacked Adventure documents under `foundry/pack-src/` into the canonical compendium source.
- Foundry LevelDB compendium files are now generated during packaging instead of being maintained as source files.
- Kept `foundry/module.json` channel-neutral; development versions, manifest URLs, and download URLs are injected only into deliverables.
- Development package versions now use the version declared in `foundry/module.json` with a branch-specific prerelease suffix.
- Workflow artifacts now contain the installable module archive, generated manifest, and checksum.

### Verified

- Verified installation through the rolling branch manifest.
- Verified automatic package updates through Foundry.
- Verified that the packaged Adventure compendium contains the expected Bane of Azeroth content.
- Verified that generated packages exclude pack source files and LevelDB runtime files.

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
