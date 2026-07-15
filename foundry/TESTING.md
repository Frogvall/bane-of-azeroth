# Testing

This document records manual verification of the **Bane of Azeroth** Foundry
VTT module.

The module is in early alpha. Test results apply only to the versions and
configuration listed below.

## Current test environment

| Component | Version |
|---|---:|
| Bane of Azeroth | 0.6.0 |
| Foundry Virtual Tabletop | 14.364 |
| Dragonbane system | 4.0.1 |
| Dragonbane Core Set | 2.2 |
| YZE Combat | 1.7.0 |

Tested by **Auvreannia** through 2026-07-15.

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

## General prerequisites

Before running manual tests:

- Enable the Bane of Azeroth module.
- Use the Dragonbane system version listed above.
- Enable the Dragonbane **Damage Types** optional rule for tests involving
  Piercing and Armor Piercing.
- Import the current Bane of Azeroth Adventure.
- Reload the world after changing module scripts, styles, localization, or
  generated content.
- Reimport the Adventure after changing generated Actor, Item, or Folder
  documents.
- Use an active game master when testing player-initiated Elemental Totem
  summoning.
- Place the relevant Actor tokens in the active scene for tests involving
  distance or token placement.

## Generated content verification

The structured sources are the canonical source for generated Foundry
documents.

Run each generator in check mode before release:

```bash
python3 tools/generate-kin.py --check
python3 tools/generate-heroic-class-abilities.py --check
python3 tools/generate-gear.py --check
python3 tools/generate-spells.py --check
python3 tools/generate-elemental-totems.py --check
```

Expected result:

- [x] Every generator exits successfully.
- [x] Generated Adventure source matches the structured content.
- [x] A full module build and deployment completes successfully.
- [x] The installable package contains the dedicated Elemental Totem portrait
  and token images.

---

# Adventure import

## AI-01: New content version prompt

1. Open a world as a game master after installing a newer content version.
2. Observe the Bane of Azeroth Adventure import prompt.

Expected result:

- [x] The Adventure import screen opens automatically.
- [x] The prompt is shown only to game masters.
- [x] Reopening the same content version does not show the prompt again.
- [x] Development build suffix changes do not retrigger the prompt.
- [x] A later semantic content version retriggers the prompt.

## AI-02: Clean-world import

1. Install Bane of Azeroth in a world without previously imported Bane of
   Azeroth content.
2. Import the current Adventure.
3. Inspect its generated folders, Items, and Actors.

Expected result:

- [x] The Adventure imports without errors.
- [x] Kin, Kin Abilities, Heroic Class Abilities, gear, spells, and Elemental
  Totem Actors are present.
- [x] Generated documents appear in their intended folder hierarchy.
- [x] The four Elemental Totem Actors use their dedicated portraits.
- [x] The four Elemental Totem prototype tokens use their dedicated token
  images.

---

# Custom weapon features

The module registers these custom weapon features:

- Ammunition
- Armor Piercing
- Freehanded
- Returning
- Scattershot

## WF-01: Registration and localization

Expected result:

- [x] Every custom feature is available as a selectable weapon feature.
- [x] Every custom feature has an English label.
- [x] Every custom feature has an English tooltip.
- [x] Existing Dragonbane weapon features remain available.

---

# Armor Piercing

An eligible weapon must be:

- ranged;
- non-thrown;
- Piercing; and
- marked with the Armor Piercing feature.

## AP-01: Eligible ranged weapon

1. Equip a ranged, non-thrown weapon with both **Piercing** and
   **Armor Piercing**.
2. Start an attack.

Expected result:

- [x] **Find Weak Spot** is available.

## AP-02: Ineligible weapons

Repeat the attack test with:

- a Piercing weapon without Armor Piercing;
- an Armor Piercing weapon without Piercing; and
- a thrown Piercing weapon.

Expected result:

- [x] The module does not add its Armor Piercing version of Find Weak Spot to
  either ineligible ranged weapon.
- [x] The thrown weapon does not receive a duplicate Find Weak Spot option.
- [x] Normal Dragonbane thrown-weapon behavior remains unchanged.

## AP-03: Damage Types disabled

1. Disable Dragonbane's **Damage Types** optional rule.
2. Start an attack with an otherwise eligible weapon.

Expected result:

- [x] The Armor Piercing Find Weak Spot option is unavailable.

## AP-04: Attack behavior

1. Start an attack with an eligible weapon.
2. Select **Find Weak Spot**.
3. Attack an armored target successfully.
4. Roll damage.

Expected result:

- [x] The attack receives exactly one bane.
- [x] The successful hit ignores armor.

## AP-05: Ranged mishap

1. Attack with an eligible weapon using Find Weak Spot.
2. Produce a demon result.

Expected result:

- [x] The attack uses **Ranged Mishap**.
- [x] The attack does not use melee mishap behavior.

---

# Scattershot

For these tests:

- **Point blank** is a calculated distance of 2 meters or less.
- **Normal range** is beyond point blank and no farther than the weapon's
  listed range.
- **Long range** is beyond normal range and no farther than double the listed
  range.
- **Beyond maximum range** is farther than double the listed range.

## SS-01: Point blank

1. Attack a target at 2 meters or less with a Scattershot weapon.
2. Repeat with a comparable ranged weapon without Scattershot.

Expected result:

- [x] Scattershot removes the normal point-blank bane.
- [x] The control weapon retains the normal point-blank bane.

## SS-02: Normal range

1. Make a successful Scattershot attack within normal range.
2. Roll damage.

Expected result:

- [x] Damage is not halved.
- [x] Normal damage calculation is preserved.

## SS-03: Long range

1. Make a successful Scattershot attack beyond normal range but within double
   range.
2. Roll both even and odd damage totals.

Expected result:

- [x] The normal long-range bane still applies.
- [x] Total damage is halved.
- [x] Fractions are rounded up.
- [x] An original total of 9 becomes 5.

## SS-04: Critical hit at long range

1. Make a successful critical long-range Scattershot attack.
2. Roll damage.

Expected result:

- [x] Critical-hit weapon dice are doubled first.
- [x] The resulting total is then halved.
- [x] Fractions are rounded up.
- [x] A verified critical result of 13 becomes 7.

## SS-05: Control weapon at long range

1. Make a long-range attack with a weapon without Scattershot.
2. Roll damage.

Expected result:

- [x] The module does not halve the damage.

## SS-06: Missing target or distance

1. Attack with a Scattershot weapon without a targeted token or calculated
   distance.
2. Roll damage.

Expected result:

- [x] No automatic Scattershot range effect is applied.
- [x] Damage is not automatically halved.

## SS-07: Beyond double range

1. Target a token beyond double the weapon's listed range.
2. Attempt an attack.

Expected result:

- [x] Dragonbane's normal maximum-range warning is shown.
- [x] Scattershot does not bypass the maximum range restriction.

## SS-08: Damage metadata

1. Make a successful long-range Scattershot attack against a targeted,
   armored creature.
2. Roll damage.

Expected result:

- [x] The original target is retained.
- [x] The original damage type is retained.
- [x] Existing armor-handling information is retained.
- [x] Existing ignore-armor information is retained when applicable.

## SS-09: Ranged mishap

1. Attack with a Scattershot weapon.
2. Produce a demon result.

Expected result:

- [x] The attack uses **Ranged Mishap**.
- [x] Scattershot does not convert the attack to melee behavior.

---

# Ammunition warning

## AM-01: Missing Ammo Pouch

1. Use a weapon with the Ammunition feature on an Actor without an Ammo
   Pouch.
2. Test both dialog choices.

Expected result:

- [x] A confirmation dialog is shown.
- [x] **Perform Action** continues to the normal attack dialog.
- [x] **Cancel Action** cancels the attack.

## AM-02: Warning eligibility

Expected result:

- [x] No warning appears when the Actor carries an Ammo Pouch.
- [x] No warning appears for a weapon without Ammunition.
- [x] Ammunition is not consumed or tracked.

## AM-03: Warning order

Trigger every applicable warning during the same attack.

Expected result:

- [x] Dialogs appear in this order:
  1. Missing Ammo Pouch
  2. Broken Weapon
  3. Long Range

## AM-04: Weapon regression

Expected result:

- [x] Armor Piercing remains functional.
- [x] Scattershot remains functional.

---

# Heroic Ability spell grants

The following Heroic Class Abilities grant spells:

| Heroic Class Ability | Spell |
|---|---|
| Druidic Awakening | Savage Incarnation |
| Chosen of Elune | Incarnation of the Stars |
| King of the Jungle | Feral Incarnation |
| Tree of Life | Incarnation of Harmony |
| Darkness | Shadowform |
| Shamanic Calling | Elemental Totem |

## SG-01: Add a spell-granting ability

1. Add one of the listed Heroic Class Abilities to an Actor.

Expected result:

- [x] The linked spell is added to the Actor.
- [x] The spell is marked as prepared.
- [x] The spell is identified as automatically granted.
- [x] Exactly one copy of the spell is present.

## SG-02: Remove the granting ability

1. Add a spell-granting ability.
2. Confirm that the spell was added automatically.
3. Remove the ability.

Expected result:

- [x] The automatically granted spell is removed.

## SG-03: Preserve a manual spell

1. Add the linked spell to an Actor manually.
2. Add and then remove its granting ability.

Expected result:

- [x] No duplicate spell is created.
- [x] The manually added spell remains after the ability is removed.

## SG-04: Multiple granting abilities

1. Add two copies of the same granting ability.
2. Remove one copy.
3. Remove the final copy.

Expected result:

- [x] Only one copy of the linked spell exists.
- [x] The spell remains while another granting ability is present.
- [x] The automatically granted spell is removed after the final granting
  ability is removed.

## SG-05: Existing Actors and reconciliation

1. Use an Actor that already has a spell-granting ability.
2. Start or reload the world.

Expected result:

- [x] The linked spell is added if missing.
- [x] An existing manual or automatically granted spell is not duplicated.
- [x] An automatically granted spell is restored to prepared if necessary.

## SG-06: Adventure reimport

1. Reimport the current Bane of Azeroth Adventure.
2. Inspect Actors with spell-granting abilities.

Expected result:

- [x] Reimporting world content does not create duplicate Actor spells.
- [x] All six ability-to-spell relationships continue to work.

## SG-07: Multiplayer ownership

1. Log in as a player who owns an Actor.
2. Add and remove a spell-granting Heroic Class Ability.

Expected result:

- [x] The linked spell is created or removed exactly once.
- [x] No duplicate operation is performed by another connected client.

---

# Always-prepared granted spells

## GP-01: Sheet presentation

1. Open an Actor sheet containing an automatically granted spell.
2. Inspect the prepared checkbox.

Expected result:

- [x] The spell is shown as prepared.
- [x] Its prepared checkbox is disabled.
- [x] Its checkbox is visually distinct from normal prepared spells.
- [x] Hovering the checkbox displays the localized always-prepared tooltip.

## GP-02: Preparation protection

1. Attempt to set an automatically granted spell to unprepared.
2. Repeat with a normal prepared spell.

Expected result:

- [x] The automatically granted spell remains prepared.
- [x] The normal spell can be unprepared.
- [x] The protection does not affect manually managed spells.

---

# Elemental Totems

`Elemental Totem` can summon:

- Cleansing Totem
- Flametongue Totem
- Stoneskin Totem
- Windfury Totem

Power level is limited to 1–3 by the Dragonbane spellcasting flow.

At power level 1, the caster summons one chosen totem. Each additional power
level is spent on one of these choices:

- summon one additional, different totem;
- double the reach of all summoned totems; or
- double the HP and armor rating of all summoned totems.

Only one totem of each type can exist in the same casting plan.

## ET-01: Actor templates

Inspect all four imported Elemental Totem Actors.

Expected result:

- [x] Each totem is an NPC Actor.
- [x] Each totem has 10 base HP.
- [x] Each totem has 2 armor from its embedded armor Item.
- [x] Each totem has movement 0.
- [x] Each prototype token is unlinked and sized 0.5 by 0.5 grid units.
- [x] Each totem has its own portrait.
- [x] Each totem has its own token image.
- [x] Each trait uses the final **once per round** wording.
- [x] The totem Actors are stored under
  `Actors/Bane of Azeroth/Elemental Totems`.

## ET-02: Normal success at power level 1

1. Control the caster token.
2. Cast Elemental Totem at power level 1.
3. Produce a normal success.
4. Choose and place one totem within 6 meters.

Expected result:

- [x] The Elemental Totem dialog opens.
- [x] The caster chooses one of the four totem types.
- [x] The summary reports one totem, 10-meter aura range, 10 HP, and 2 armor.
- [x] Placement is allowed within 6 meters of the caster.
- [x] One token of the selected type is created.
- [x] The token uses its dedicated token image.
- [x] The Actor sheet uses its dedicated portrait.

## ET-03: Power level 3 choices

1. Cast Elemental Totem at power level 3.
2. Choose two different totems.
3. Spend the remaining choice on either reach or durability.

Expected result:

- [x] One upgrade dialog is shown for each power level above 1.
- [x] A second totem cannot use a type already selected.
- [x] The final summary lists the selected totems.
- [x] A reach upgrade changes all aura ranges from 10 to 20 meters.
- [x] A durability upgrade changes all summoned totems from 10 HP and
  2 armor to 20 HP and 4 armor.
- [x] The calculated values are applied to every totem created by the cast.

## ET-04: Placement range

1. Begin placement.
2. Move the preview inside and outside 6 meters of the caster.
3. Attempt to place outside the valid range.

Expected result:

- [x] Valid placement is shown in the selected totem's aura color.
- [x] Invalid placement is shown in red.
- [x] Placement outside 6 meters is rejected.
- [x] Valid placement snaps to the scene grid.

## ET-04: Cancel placement

1. Begin placement while the caster already has summoned totems.
2. Cancel with Escape or right-click.

Expected result:

- [x] The entire placement flow is cancelled.
- [x] No partial replacement is performed.
- [x] Previously summoned totems remain in place.

## ET-04: Failed cast

Produce each of these failed spell tests:

- a normal, pushable failure;
- a pushed failure; and
- a demon result.

Expected result:

- [x] No Elemental Totem dialog opens.
- [x] No totem is created.
- [x] Existing totems are not removed.

## ET-04: Pushed success

1. Fail the initial spell test.
2. Push the roll.
3. Succeed on the pushed roll.

Expected result:

- [x] The dialog opens once for the successful pushed result.
- [x] The original failed ChatMessage does not open another dialog.
- [x] The selected totems can be placed normally.

## ET-04: Dragon result

1. Produce a dragon result.
2. Choose the critical effect offered by Dragonbane.

Expected result:

- [x] The Elemental Totem dialog waits for the critical-effect choice.
- [x] The dialog opens only once.
- [x] Placement and creation complete successfully.

## ET-04: Replace previous totems

1. Summon one or more totems.
2. Cast Elemental Totem again with the same caster.
3. Complete all new placements.

Expected result:

- [x] New totems are created successfully.
- [x] Previous Elemental Totems belonging to the caster are removed.
- [x] Totems belonging to other casters are not removed.

## ET-04: Cross-scene cleanup

1. Move or copy one of the caster's summoned totems to another scene.
2. Make that scene inactive.
3. Cast Elemental Totem again on the active scene.

Expected result:

- [x] The previous totem is removed from the inactive scene.
- [x] All copies carrying the same caster flags are removed.
- [x] The new cast remains on the active scene.

## ET-04: Player casting with active GM

1. Log in as a player who owns the caster Actor.
2. Keep a game master connected.
3. Cast and place Elemental Totem as the player.

Expected result:

- [x] The player receives the choice and placement dialogs.
- [x] The player selects all token positions.
- [x] The active game master creates the tokens.
- [x] The operation is performed exactly once.

## ET-04: Read-only player sheets

1. Summon a totem.
2. Open it as the caster's player.
3. Open it as another player.

Expected result:

- [x] Players can open and read the summoned totem's Actor sheet.
- [x] Players cannot edit its HP, armor, Items, or other Actor data.
- [x] The source Actor templates do not need to be exposed as player-owned
  Actors.

## ET-04: Aura range and color

Summon all four totem types and test both normal and upgraded range.

Expected result:

- [x] Cleansing uses its blue/cyan effect color.
- [x] Flametongue uses its orange effect color.
- [x] Stoneskin uses its yellow-green effect color.
- [x] Windfury uses its lavender effect color.
- [x] The aura radius matches the stored 10-, 20-, or 40-meter range.
- [x] Different totem types remain visually distinguishable when their auras
  overlap.

## ET-04: Aura lifecycle

1. Summon a totem.
2. Move or copy the token.
3. Reload the scene.
4. Delete or replace the token.

Expected result:

- [x] The aura follows the token when it moves.
- [x] A copied token retains its aura data.
- [x] The aura is restored after the scene reloads.
- [x] The aura is removed with the token.
- [x] The aura does not create light or alter token vision.
- [x] The aura is visual only and does not automate the totem's rules effect.

## ET-04: Reimported content

1. Change generated Elemental Totem data.
2. Regenerate and rebuild the module.
3. Reimport the current Adventure.
4. Cast Elemental Totem again.

Expected result:

- [x] Newly created tokens use the current prototype-token image.
- [x] Newly created tokens use the current aura color and alpha.
- [x] Previously imported Actor templates are updated by reimporting.
- [x] No runtime workaround is required for stale imported template data.

---

# Release acceptance for 0.6.0

Version 0.6.0 is accepted when all of the following are true:

- [x] All content generators pass in `--check` mode.
- [x] Full module build and deployment succeed.
- [x] Clean-world Adventure import succeeds.
- [x] Heroic Ability spell grants and always-prepared behavior pass.
- [x] Elemental Totem normal success, failure, push, and dragon handling pass.
- [x] Power levels 1 and 3 pass.
- [x] Placement range and cancellation pass.
- [x] Previous totem cleanup passes across active and inactive scenes.
- [x] Player casting with an active GM passes.
- [x] Player-readable, read-only summoned Actor sheets pass.
- [x] Dedicated portrait and token artwork is packaged and displayed.
- [x] Aura colors, ranges, persistence, and cleanup pass.
- [x] Final **once per round** rules text is present.
- [x] Changelog is updated for 0.6.0.

---

# Known limitations and intended manual handling

These are not release failures:

- Elemental Totem aura effects are not applied automatically to nearby Actors.
- The module does not automatically determine allies inside an aura.
- Cleansing, bonus damage, damage reduction, and attack boons are resolved
  manually according to the totem's trait.
- Player-initiated token creation requires an active game master.
- Automatically granted spells are tied to the current six declarative
  Heroic Ability relationships.
- Ammunition requires an Ammo Pouch warning but is not consumed or tracked.

# Compatibility not verified

The following areas have not been verified and should not be assumed
compatible:

- Foundry VTT versions other than 14.364
- Dragonbane system versions other than 4.0.1
- Dragonbane Core Set versions other than 2.2
- YZE Combat versions other than 1.7.0
- Localization languages other than English
- Conflicts with modules not listed in the test environment
- High-latency multiplayer sessions
- Automated migration from arbitrary older world-document states

# Adding future test results

For each release:

1. Update the current test environment.
2. Add the release to the version status table.
3. Add test cases for new or changed behavior.
4. Run relevant regression tests for existing mechanics.
5. Record failures explicitly rather than removing failed cases.
6. Mark the version as **Pass** only after every required test has completed.
