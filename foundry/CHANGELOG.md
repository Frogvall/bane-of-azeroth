# Changelog

All notable changes to **Bane of Azeroth** will be documented in this file.

## [Unreleased]

## [1.2.1] - 2026-08-29

### Fixed
- Fixed the Throwing Glaive range formula so thrown attacks correctly use the wielder's Strength instead of causing a roll error.

### Changed
- Added regression coverage for actually throwing a Throwing Glaive and hardened gear generation against invalid bare attribute references in weapon range formulas.

## [1.2.0] - 2026-08-24

### Added
- New Dragonbane characters and NPCs automatically receive the Bane of Azeroth Firearms weapon skill, making Firearms available on the Actor sheet from creation.

## [1.1.1] - 2026-08-20

### Fixed
- Restored Bane of Azeroth weapon features in Dragonbane 4.1 weapon sheets (1.1.0 regression).

## [1.1.0] - 2026-08-16

### Changed
- Verified compatibility with Dragonbane 4.1 while retaining Dragonbane 4.0.1 as the minimum supported system version.

### Fixed
- Corrected free magic-trick dialogs for Mage's Brilliance and Moonkin so the displayed WP cost matches the actual cost.
- Migrated Bane of Azeroth Adventure import dialogs to Foundry's ApplicationV2 framework, including direct opening from the Adventure compendium.

## [1.0.0] - 2026-08-12

### Added
- Initial public release of Bane of Azeroth for Foundry VTT.
- Complete game content from the Bane of Azeroth rules.
- Foundry automation for supported abilities, spells, forms, summons, and other module-specific mechanics.
- Adventure import, player macros, configuration options, and Foundry VTT usage guide.
