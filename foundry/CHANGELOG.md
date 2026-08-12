# Changelog

All notable changes to **Bane of Azeroth** will be documented in this file.

The project is currently in early alpha. Rules, document structures, compendium identifiers, and Foundry integrations may change between versions.

## [Unreleased]
### Security
- Updated transitive npm development dependencies to patched versions for `GHSA-2v37-7h3g-55p8` (Nanoid) and `GHSA-fxqj-rqcc-2cmp` (PostCSS).
- Confirmed the affected packages remain development/test-only dependencies and are not runtime dependencies of the delivered Foundry module.
### Testing
- Added an integration contract that rejects the known vulnerable Nanoid/PostCSS lockfile baselines.
- The dependency cleanup is verified with `npm audit` through the same Docker-based Node workflow used for project tests.
## [0.12.7] - 2026-08-12
### Added
- Added a manually triggered **Publish Foundry release candidate** workflow which publishes a production-shaped rolling GitHub prerelease under the permanent `release-candidate` manifest channel.
### Changed
- Stable release manifests now keep the permanent `releases/latest/download/module.json` update URL while retaining version-specific package download URLs.
- Release-candidate verification now tests the same public manifest and download endpoints that Foundry testers use instead of relying on manual zip installation.
- Normal branch CI now watches the release-candidate workflow.
### Testing
- Added integration coverage for stable/RC manifest-channel isolation, production RC identity, prerelease/latest behavior, public endpoint verification, and channel-neutral source metadata.
## [0.12.6] - 2026-08-11
### Added
- Added a dedicated tag-driven **stable Foundry release** workflow for production packages, separate from rolling branch prereleases.
- Added `tools/foundry-stable-release.py` to validate tag/version/README/Changelog alignment and extract release notes from the dated Changelog section.
### Changed
- Stable release publication is explicitly gated to version `1.0.0` or later and excludes all development-only System Test content.
- Normal branch CI now also watches the stable release workflow and its release-contract helper.
### Testing
- Added integration coverage for stable tag triggers, production package identity, development-content exclusion, release verification, and pre-1.0 safeguards.
## [0.12.5] - 2026-08-11
### Added
- Added the player- and GM-facing **Foundry VTT Guide** with concise pages for Druid form controls, draggable player Macro links, automatic spell grants, Death Knight rune controls, and summon workflows.
- Added curated Foundry screenshots for Druid Forms and Death Knight Runes under `foundry/assets/journals/foundry-guide/`.
### Changed
- Journal generation now resolves symbolic `boa:macro.*` references from the player convenience Macro source so guide links remain draggable without raw UUIDs in authoritative content.
- Journal asset generation now reserves and preserves the curated `foundry-guide/` screenshot directory instead of treating those manually captured UI images as generated Homebrewery assets.
### Testing
- Added integration coverage for Foundry VTT Guide page order/content, Adventure inclusion, screenshot paths, and curated screenshot ownership in the Journal asset pipeline.
## [0.12.4] - 2026-08-11
### Changed
- Removed routine successful-runtime console output from module initialization and Elemental Totem creation while preserving real warning/error paths.
### Testing
- Added a focused runtime console-policy regression contract so routine success logs stay quiet without weakening failure diagnostics.
## [0.12.3] - 2026-08-11
### Added
- Added dedicated 290×70 package-owned banners for the Bane of Azeroth Adventure Compendium and the development-only System Tests Compendium so Foundry no longer falls back to generic Compendium artwork.
- Added canonical project and issue-tracker URLs to the module manifest.
### Changed
- Refreshed the module description to describe the current rules, content, and automation scope rather than the older Player Options-only scope.
- Development packaging now rewrites package-qualified Compendium banner paths to the active package id, keeping production and Development presentation isolated.
### Fixed
- Fixed stale generated compatibility metadata after YZE Combat became optional, and added coverage keeping generated verified-environment data synchronized with its authoritative compatibility source.
- Fixed Mage's Brilliance automatic Sense Magic grants after symbolic external references replaced raw Foundry UUIDs.
## [0.12.2] - 2026-08-11
### Changed
- Audited and locked the supported Foundry/Dragonbane dependency baseline: Foundry V14 with Dragonbane 4.0.1 remains the hard runtime contract, while the verified whole-module environment remains Foundry 14.365 / Dragonbane 4.0.1 / Dragonbane Core Set 2.2 / YZE Combat 1.7.0.
- YZE Combat is now explicitly recorded as optional in compatibility metadata and remains absent from hard manifest dependencies.
- Documented Dragonbane Core Set 2.2 separately as the external content source used by registered Dragonbane Core references.

## [0.12.1] - 2026-08-11
### Changed
- The hardcoded-reference baseline is now empty and the policy is absolute: any raw Foundry UUID in authoritative content or runtime source fails the reference inventory/build gate, regardless of the presentation directive in which it appears.
- Internal Actor, Item, JournalEntryPage, and RollTable references now use symbolic keys. Journal-specific Dragonbane presentation directives use typed symbolic forms that materialize only in generated Adventure content.
- Symbolic references now support anchors such as `#human` without hardcoding the owning JournalEntry/Page UUID.

### Changed
- Hardcoded Foundry reference usage is now guarded by a committed baseline over authoritative `foundry/content` and `foundry/scripts` source. Any new raw Foundry UUID link or literal fails the reference inventory/build gate.
- Reference inventory UUID detection now recognizes actual Foundry document UUID types instead of treating arbitrary dotted `BOA.*` localization keys as UUID literals.
- The remaining baseline is cleanup debt only; 0.12.1 will drive it to zero, after which all authoritative cross-document references must be symbolic or registry-derived.

### Changed
- External Dragonbane/Core references used by canonical content now resolve through `external-references.json` instead of duplicated UUID literals in Heroic Class Ability, Kin, Journal, and Mage runtime source.
- Heroic Class Ability and Kin generation now resolve external `@Ref[...]` through the shared reference infrastructure.
- Mage's Brilliance now gets the Sense Magic UUID from the generated external-reference runtime registry.
- Reference inventory generation now rejects registered external UUIDs that leak back into authoritative source roots.

## [0.12.0] - 2026-08-10
### Fixed
- Development now remains authoritative if both production and development packages are enabled: production becomes inert before registering BoA runtime behavior, while Development continues and emits a clear warning.
- Production and development delivery manifests declare each other through `relationships.conflicts`, giving Foundry a known-conflict warning while retaining the runtime safety guard.

### Changed
- Development prerelease packages now use the distinct Foundry package identity `bane-of-azeroth-dev` and title **Bane of Azeroth - Development**, allowing production and development packages to be installed side-by-side.
- Development packaging rewrites package-qualified runtime/content namespaces only in staged prerelease output; the source manifest remains production-canonical.
- The Adventure pack name remains `bane-of-azeroth`, producing development pack id `bane-of-azeroth-dev.bane-of-azeroth`.
- Development packaging now rebrands generated JSON structurally, including Foundry flag namespaces and embedded Macro command source, so developer-test content and runtime lookup namespaces converge.

## [0.11.8] - 2026-08-10

### Added
- Added **Shadowform Visuals** automation, enabled by default.
- Active Shadowform now gives current Scene tokens a static dark-violet/shadow treatment without replacing or modifying their token image.
- Open character sheets apply a matching static treatment to the character portrait while leaving the stored Actor portrait unchanged.
- Added Shadowform to the existing **End Effects** workflow.
- Added active-Scene reconciliation for newly drawn Shadowform tokens and Scene activation/reload.

### Changed
- Shadowform visual state is stored as Bane of Azeroth-managed Actor state and follows the spell's existing Stretch duration.
- Stretch Rest and Shift Rest now expire Bane of Azeroth-managed Shadowform state through the shared lifecycle.
- Shadowform presentation intentionally affects only current Scene tokens and the character-sheet portrait; Directory, Chat, Compendium, prototype-token, and stored image presentation remain unchanged.
- Shadowform presentation is intentionally static and does not use animation.

### Testing
- Added focused unit and integration coverage for Shadowform state, static token filters, sheet presentation, setting behavior, spell activation, rest expiration, managed-effect integration, and runtime hook registration.
- Added **BOA DEV – Verify Shadowform Visuals** to the Foundry Developer Test suite.
- Verified the complete automated test suite after updating stale generic hook/settings-count contracts for the new Shadowform registration.
- Visually verified Shadowform token and character-portrait presentation in Foundry.

## [0.11.7] - 2026-08-10

### Added
- Added **Druid Forms** automation for Savage Incarnation, Feral Incarnation, Incarnation of Harmony, and Incarnation of the Stars.
- Added configurable and persistent portrait/token artwork for Travel PL1–PL3, Bear, Cat, Tree, and Moonkin forms, including live Scene-token switching and exact Humanoid artwork restoration.
- Added Druid form controls on character sheets plus the player-facing **Change Druid Form** and generic **End Effects** Macros in the blue **Bane of Azeroth** Macro folder.
- Added granular Druid automation settings for movement, natural attacks, armor, spell restrictions, Moonkin spell costs, Cat SNEAKING boons, Moonkin spellcasting boons, Maul Marked, and form artwork.
- Added development-only **Developer / Diagnostics** settings with opt-in Druid lifecycle tracing for branch packages.

### Changed
- Druid incarnation state now allows several Incarnations to remain active while one physical form is selected, including manual switching back to **Humanoid Form**.
- Travel Form doubles Movement; Bear/Cat forms use generated natural attacks and suppress ordinary armor/helmets; Tree and Bear use their form armor; Bear/Cat/Travel enforce Word-only spellcasting according to their rules.
- Moonkin Form now makes magic tricks free and reduces other spell WP costs by Incarnation of the Stars power level, while preserving Dragonbane's minimum normal spell cost.
- Mage, Evoker, Moonkin, and Dragonbane 4.0.1 rank-0 spell-cost compatibility now share the same Bane of Azeroth spellcasting adapter.
- Cat Form adds a default-selected SNEAKING boon, and Moonkin Form adds a default-selected boon to normal spellcasting rolls.
- Maul can apply the **Marked** reminder status without automatically removing or replacing an existing Marked source.
- Developer system-test Macros now use their own **Bane of Azeroth - System Tests** root folder so shipped player Macros can use the canonical **Bane of Azeroth** folder.
- English Dragonbane Core Set **Great Helm** data is reconciled on a best-effort basis so **Firearms** appears in Details → Banes alongside the other ranged-weapon skills.

### Fixed
- Fixed Player/GM Scene-token convergence so Druid artwork waits for the intended token state rather than accepting a stale observed state.
- Fixed Humanoid artwork restoration for active Scene tokens after rapid form switching, scene propagation, and effect ending.
- Fixed Druid armor/helmet restoration races where Bane of Azeroth could block its own `worn: true` restore after rapid form changes.
- Armor restoration now retains its baseline until the requested equipped state has actually landed.
- Fixed generated Adventure folder ordering so Journal and player-Macro generators converge regardless of generator execution order.
- Fixed Dragonbane 4.0.1 legacy magic-trick casting so Bear/Cat/Travel restrictions and Moonkin/Mage free-trick costs apply to the old direct sheet path.

### Notes
- Incarnation of Harmony **Rejuvenation** remains manually tracked: repeat the exact healing received on each of the target's next turns for a number of turns equal to Tree Form power level.
- **Marked** remains a reminder status and is never automatically removed because several Druids or other sources may contribute it.
- Great Helm + Firearms compatibility intentionally targets the supported English Core Set signature; Bane of Azeroth does not currently provide a Swedish localization layer.

### Testing
- Added focused unit/integration coverage for Druid lifecycle, artwork, active-token convergence, armor restoration, natural attacks, spell restrictions/costs, roll boons, Maul Marked, player convenience Macros, Macro folders, and Great Helm Firearms compatibility.
- Expanded **BOA DEV – Verify Druid Forms** and real-Player coverage, including GM/Player form switching, active-token convergence, artwork restoration, Druid roll boons, Maul Marked, and managed-effect ending.
- Verified Druid token/portrait restoration without lifecycle tracing enabled and separately verified GM-only, Player-only, and dual-client diagnostic tracing.
- Manually verified player convenience Macros, Druid armor restoration, and Cat/Moonkin boons; Maul Marked was verified as both GM and Player.


## [0.11.6] - 2026-08-06

### Added
- Added a dedicated **Death Knight Runes** automation setting, enabled by default.
- Added rune controls for characters with **Death Knight's Rebirth** directly beside eligible melee weapons on **Main → Weapons**.
- Added the same rune controls to **Inventory → Equipped Weapons** and **Inventory → Inventory**, allowing carried but unequipped melee weapons to be engraved.
- Added dedicated **Fallen Crusader**, **Razorice**, and **Unending Thirst** rune icons with a compact rune-selection dialog.
- Added localized rune rule descriptions to the selector and active-rune tooltips.
- Added persistent per-character rune state with one active rune on one weapon, replacement across weapons, and **Clear Rune**.

### Changed
- **Unending Thirst** now applies Movement +2 through a Bane of Azeroth-managed Dragonbane Active Effect only while the engraved weapon is equipped/wielded.
- Rune eligibility is limited to actual melee weapons; ranged weapons, shields, and **Unarmed** are rejected both by the sheet UI and the public rune API.
- Active rune state is shown directly beside the affected weapon wherever that weapon is managed, without replacing the weapon's normal icon.
- Disabling Death Knight Runes automation removes the rune UI and managed Unending Thirst effect while preserving the selected rune state; re-enabling restores valid state.
- Removing **Death Knight's Rebirth** or deleting/invalidating the engraved weapon cleans stale rune state and module-managed effects.

### Notes
- **Fallen Crusader** remains a visual/rules reminder; its healing is resolved manually.
- **Razorice** remains a visual/rules reminder; Bane of Azeroth does not invent a generic magical-weapon property that Dragonbane does not provide.
- Engraving or replacing a rune still takes a stretch according to the book; the stretch itself remains manual.

### Testing
- Added focused unit and integration coverage for rune eligibility, state replacement, cleanup, automation settings, Foundry V14 Active Effect data, localization, and sheet registration.
- Expanded **BOA DEV – Verify Death Knight Runes** with rune-definition, eligibility, state, and Unending Thirst contracts.
- Added real-Player coverage for owned-character rune selection and Unending Thirst Movement behavior.
- Expanded the manual system-test checklist for Main/Inventory presentation, rune descriptions, tooltips, setting toggles, equip/unequip behavior, and Player interaction.

## [0.11.5] - 2026-08-05

### Added
- Added a dedicated **Frostreaper** automation setting under Heroic Abilities, enabled by default.
- Added a purely visual, light-blue **10 meter Frostreaper aura** around the activating Death Knight during combat.
- Added persisted Frostreaper activation metadata to the native Dragonbane ability-use ChatMessage so the aura can be reconstructed consistently across clients and scene reloads.
- Added the missing Dragonbane **resist cold** rule reference to Frostreaper content and its generated Journal presentation.

### Changed
- Frostreaper keeps Dragonbane's native ability-use and WP workflow unchanged.
- Frostreaper's visual reminder remains active for the rest of the activation round and through the next round until the Death Knight's own turn begins.
- Frostreaper activation outside combat does not create an automatic aura because there is no combat-turn boundary from which to derive its duration.
- Disabling Frostreaper automation hides the visual aura without deleting the persisted activation state; re-enabling it restores an otherwise still-valid aura.

### Preserved
- Frostreaper automation does not modify Movement.
- Frostreaper automation does not roll, prompt, or resolve BUSHCRAFT checks to resist cold.
- The aura is a visual reminder only and does not automate the rules affecting creatures inside it.

### Testing
- Added focused unit and integration coverage for Frostreaper activation detection, persisted state, 10 meter radius conversion, light-blue presentation, disabled-setting behavior, hook registration, and exact next-round own-turn expiry.
- Added **BOA DEV – Verify Frostreaper** system-Macro coverage.
- Extended the real-Player harness with Frostreaper activation-state coverage using an owned Player character.
- Added manual GM and Player aura verification covering multi-client visibility, token movement, scene reload, setting toggles, combat timing, no out-of-combat aura, and preservation of manual Movement and BUSHCRAFT handling.
- Verified Frostreaper activation and aura rendering manually as both a game master and an owning player.

## [0.11.4] - 2026-08-05

### Added
- Added a dedicated **Demon Hunter Initiation** automation setting, enabled by default.
- Added automatic darkness-vision reconciliation for characters with Demon Hunter Initiation.
- Added real-Player coverage for assigning and removing Demon Hunter Initiation on an owned character.
- Added Player-to-GM reconciliation so Player-owned scene tokens do not require Player Token Configuration permission.

### Changed
- Demon Hunter Initiation now configures prototype and scene-token sight as enabled, unlimited-range **Darkvision**.
- Darkvision uses Foundry's own vision-mode defaults so the actual canvas rendering matches a manually selected Darkvision mode.
- Tokens created after the character already has Demon Hunter Initiation are reconciled automatically.

### Fixed
- Removing Demon Hunter Initiation or disabling its automation now restores the complete saved pre-automation sight configuration.
- Vision cleanup no longer depends on Foundry preserving an exact intermediate Darkvision representation.
- Demon Hunter Initiation system-test diagnostics now report individual lifecycle stages instead of collapsing failures into a generic workflow timeout.

### Testing
- Added focused unit/integration coverage, Foundry system-Macro coverage, real-Player lifecycle coverage, and manual GM/Player verification for Darkvision assignment and cleanup.

## [0.11.3] - 2026-08-05

### Added
- Added a dedicated **Monk's Serenity** automation setting, enabled by default.
- Added automatic reconciliation for Serenity, Unarmed, and Iron Fist regardless of item order.
- Added Foundry Developer Test coverage for the Serenity lifecycle.

### Changed
- Characters with Monk's Serenity now have their existing embedded **Unarmed** weapon damage increased to D10 without creating a replacement weapon.
- When the same character has **Iron Fist**, only the character's embedded Iron Fist description is adjusted from 2D6 to 2D10.
- Unarmed Items added after Serenity are reconciled automatically.

### Fixed
- Serenity cleanup preserves and restores the character's original local Unarmed damage instead of assuming a hard-coded value.
- Removing Serenity or disabling its automation restores only module-managed local changes and leaves world/source Items untouched.

### Testing
- Added focused unit/integration and Foundry Macro coverage for ordering, cleanup, setting changes, source-item preservation, Unarmed D10, and embedded Iron Fist 2D10 wording.

## [0.11.2] - 2026-08-04

### Added
- Added independent **War Stomp** and **Eye Beam** automation settings, enabled by default.
- Added a module-managed **War Stomp** weapon/action for Tauren characters.
- Added a module-managed **Eye Beam** weapon/action so its range and damage are visible with the character's other attacks.
- Added dedicated weapon-only icons for War Stomp and Eye Beam.
- Added Foundry Developer Test coverage for the combined ability-action workflow.

### Changed
- War Stomp uses BRAWLING with a mandatory bane, costs 3 WP, uses one attack roll for all creatures within 2 meters, and rolls D6 damage separately per affected creature.
- War Stomp now asks for confirmation before spending 3 WP on the initial attack and does not charge again when the attack is pushed.
- War Stomp waits for Dragonbane's normal hit/critical resolution before exposing manual Roll Damage actions.
- Eye Beam costs 3 WP, automatically hits one target within 20 meters, cannot be parried, and deals 2D8 magical damage without making a weapon test.
- Eye Beam now follows Dragonbane's normal hit/result → Roll Damage pause instead of rolling damage immediately.
- Module-managed ability-action weapons now reconcile their own metadata so stale generated items repair themselves without touching manual same-name items.

### Fixed
- Fixed concurrent ability-action reconciliation attempting to delete the same embedded Item twice.
- Fixed Eye Beam confirmation losing the DialogV2 method binding.
- Fixed War Stomp damage being rolled before Dragonbane's critical-effect choice.
- Removed irrelevant generic melee action, additional-damage, and enchanted-weapon choices from the War Stomp roll dialog.

### Testing
- Added focused unit/integration regression coverage for ability-action reconciliation, War Stomp roll behavior, Eye Beam auto-hit behavior, manual damage timing, DialogV2 confirmation, icon reconciliation, and module API exposure.

## [0.11.1] - 2026-08-04

### Added
- Added a dedicated **Evoker's Legacy** automation setting under **Heroic Abilities**, enabled by default.
- Added spell-cost automation for characters with **Evoker's Legacy**.

### Changed
- Evoker's Legacy now reduces spell costs to **2 WP at Power Level 1**, **3 WP at Power Level 2**, and **4 WP at Power Level 3**.
- Spell affordability and actual WP expenditure use Dragonbane's native `Item#getSpellCost()` path, keeping the spell-resolution path and resource payment synchronized.
- Characters without Evoker's Legacy, characters with the automation disabled, magic tricks, and unsupported power levels retain Dragonbane's native spell costs.

### Testing
- Added **BOA DEV – Verify Evoker's Legacy** to verify the imported ability, automation setting, 2/3/4 WP cost contract, native fallback, and real Dragonbane PL2 WP payment.
- Added focused unit and integration coverage for Evoker's Legacy spell-cost behavior, automation settings, runtime registration, system-test registration, and hook integration.
- Verified the complete automated test suite and Foundry Developer Test suite after the Evoker's Legacy implementation.

## [0.11.0] - 2026-08-04

### Added
- Added a dedicated **Heroic Abilities** automation setting for **Mage's Brilliance**, enabled by default.
- Added automatic granting and reconciliation of Dragonbane Core **Sense Magic** for Actors with Mage's Brilliance.
- Added **Roll / Take 10 / Cancel** when using **LANGUAGES** with Mage's Brilliance.
- Added Dragonbane-native LANGUAGES Take 10 resolution with a fixed result of 10 and no push.

### Changed
- **Sense Magic** now costs 0 WP for characters with Mage's Brilliance, including manually owned copies.
- Added a Dragonbane 4.0.1 compatibility adapter for the legacy rank-0 magic-trick Actor-sheet path that bypasses `Item#getSpellCost()`.
- The compatibility adapter feature-detects the legacy Dragonbane path and remains inactive when that workaround is no longer required.
- Disabling Mage's Brilliance automation restores normal spell-cost and LANGUAGES behavior while removing only module-managed Sense Magic grants.
- Updated Foundry wording to use **WP** consistently for Draconic Wings, Mage's Brilliance, Chain Heal, and Living Bomb.
- Kept the Character Options Journals synchronized with the corrected Kin and Heroic Class Ability wording.

### Fixed
- Corrected the Mage's Brilliance **Sense Magic** confirmation dialog so it no longer claims that the free cast costs 1 WP.
- Corrected stale generated and Journal text after the WP terminology updates.

### Testing
- Expanded **BOA DEV – Verify Mage's Brilliance** with grant lifecycle, free casting, dialog, LANGUAGES Take 10, and disabled-automation coverage.
- Added focused unit and integration coverage for Mage's Brilliance spell costs, Dragonbane 4.0.1 compatibility, LANGUAGES choice behavior, localization, and hook registration.
- Kept **BOA DEV – Verify Assets and Journals** as a drift check between canonical Ability content and the curated Journal Ability boxes.
- Regenerated affected Kin, Heroic Class Ability, and Journal Adventure content and kept generator/reference checks synchronized.

## [0.10.1] - 2026-08-02

### Added

- Added the curated **Introduction** page from the book to **Character Options**.
- Added one curated **Heroic Class Abilities** page with all thirteen classes, all fifty-two complete Ability overview boxes, class illustrations, and draggable linked Items.
- Added the **Gear** page using Dragonbane-native `@Gear` tables for all Bane of Azeroth weapons and trade goods.
- Added the **Spells** page using Dragonbane-native `@DisplaySpell` blocks for all six generated Bane of Azeroth spells.
- Added the **Appendices** Journal with **Companions** and **Demons** pages.
- Added full-width `@DisplayNpcCard` blocks for all fourteen companion animals in Appendix A book order.
- Added full-width `@DisplayMonster` blocks and linked attack tables for Felhunter, Imp, Sayaad, and Voidwalker in Appendix B book order.
- Added the book's composite Warlock demon illustration to the Demons page.
- Added generic internal Item reference discovery to Journal generation.
- Added rule-reference links from Journal content to Dragonbane rules, generated Bane of Azeroth Items, the Ghoul Actor, and the Dragonbane Common Animals list.

### Changed

- Set the Foundry module content version to `0.10.1`.
- Character Options now follows the book-facing page order: Illustration, Introduction, Kin, Derived Ratings, Heroic Class Abilities, Gear, Spells.
- The Bane of Azeroth Journal folder now uses deterministic manual sorting: Credits, Character Options, Appendices.
- Credits headings use title case.
- Custom Bane of Azeroth weapon-feature names now also localize correctly inside Dragonbane `@Gear` tables.
- Armor Piercing Journal text now links directly to Dragonbane's **Find Weak Spot** rule.
- Companion cards use full-width layout so animals with additional attributes remain readable.
- Demons use the same full-width Journal presentation with their attack tables directly below each monster.

### Fixed

- Stabilized the Common Animal attack-message system test by waiting for the expected enriched chat content instead of relying on fixed timing.
- Corrected Journal-reference integration expectations for Ghoul document type and the **Pushing your Roll** label.
- Kept generated Journal reference inventory synchronized when system-test Macro references move.

### Testing

- Added focused Vitest coverage for Introduction navigation, rules references, Gear Journal rendering, custom weapon-feature localization, Spells, Companions, Demons, Journal ordering, and release metadata.
- Expanded **BOA DEV – Verify Assets and Journals** to verify imported Journal presence, exact Character Options and Appendices page contracts, Journal ordering, source artwork, document links, Gear features, all six spells, all fourteen companions, and all four Warlock demons with their attack tables.
- Kept generator `--check` validation centralized so new Foundry generators remain part of automated build and packaging verification.
- Verified the 0.10.1 Journal vertical slice with Foundry Virtual Tabletop 14.365, Dragonbane 4.0.1, and Dragonbane Core Set 2.2.

## [0.10.0] - 2026-07-30

### Added

- Added imported **Credits** and **Player Options** Journals to the Bane of Azeroth Adventure.
- Added the complete **Kin** Journal page with illustrations for all sixteen playable kin.
- Added **Derived Ratings** as a separate Player Options page.
- Added three linked Kin selection RollTables and sixteen Kin name RollTables.
- Added dedicated icons for all sixteen Kin Items.
- Added class-specific icons to all fifty-two Heroic Class Ability Items.
- Added internal Journal navigation and symbolic links to imported Foundry documents.

### Changed

- Kin selection tables now link directly to the imported Kin Items and use the same icons as those documents.
- Kin name tables now display their generated names correctly in embedded Journal tables.
- Journal pages use Dragonbane-compatible presentation and styling.

### Testing

- Added generator, integration, and Foundry developer-test coverage for Journals, assets, document links, and Kin RollTables.

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
