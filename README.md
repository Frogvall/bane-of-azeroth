# Bane of Azeroth

**Bane of Azeroth** is an unofficial tabletop role-playing game adaptation inspired by the world, peoples, classes, creatures, and magic of Warcraft, built for the **Dragonbane** role-playing game.

The project aims to combine the fast, dangerous, and skill-based rules of Dragonbane with heroic fantasy adventures set in Azeroth.

> **Current status:** Active development / prerelease testing
> **Current Homebrewery document version:** 1.0
> **Current Foundry module version:** 0.12.9
## Project goals

Bane of Azeroth is intended to provide a coherent Dragonbane ruleset for adventures inspired by Azeroth, rather than attempting to reproduce every mechanic from the source material directly.

The project focuses on:

- Playable kin inspired by the peoples of Azeroth
- Dragonbane-compatible classes and heroic abilities
- Spells and supernatural abilities
- Weapons, armor, and equipment
- Creatures and adversaries
- Optional rules for mechanics such as firearms
- Foundry Virtual Tabletop support
- A printable rulebook created with Homebrewery

Rules are adapted to fit Dragonbane's existing mechanics wherever possible. New mechanics are introduced only when the base system does not adequately represent an important concept.

## Repository structure

```text
bane-of-azeroth/
├── homebrewery/
│   ├── Bane of Azeroth.md
│   ├── Bane of Azeroth.css
│   └── images/
├── foundry/
│   ├── module.json
│   ├── content/
│   ├── scripts/
│   ├── pack-src/
│   ├── lang/
│   └── CHANGELOG.md
├── tests/
├── tools/
└── README.md
```

### Homebrewery

The `homebrewery` directory contains the Homebrewery source for the Bane of Azeroth rulebook, together with its styles and image assets.

### Foundry

The `foundry` directory contains the Foundry VTT module, including structured content, runtime scripts, localization, unpacked Adventure source, and module metadata.

The generated `foundry/packs/` directory is build output and is not maintained as source.

## Foundry VTT module

The Foundry module is under active development and distributes the current book content through a single Adventure compendium.

Implemented content and automation include:

- Playable kin and kin abilities
- Heroic Class Abilities and linked spell grants
- Bane of Azeroth spells and equipment
- Generated **Character Options** Journal covering Introduction, Kin, Derived Ratings, Heroic Class Abilities, Gear, and Spells
- Generated **Appendices** Journal with full-width Companion and Warlock Demon stat blocks, linked attack tables, and book artwork
- Stable cross-document references and deterministic Journal ordering
- Custom weapon features such as Ammunition, Armor Piercing, Freehanded, Returning, and Scattershot
- Elemental Totem actors, placement, replacement, ownership, movement protection, and aura rendering
- Fourteen Common Animal actors with dedicated portraits, token artwork, attacks, skills, armor, and alternate movement rates
- Common Animal attack effects for lethal poison, Constriction, and Web Spray
- Automatic application of Dragonbane's **Restrained** condition when a successful Restrain effect has a target
- Death Knight Ghoul summoning with validated ownership, command control, and Infectious Bite Willpower handling
- Warlock Demonologist support for Imp, Sayaad, Felhunter, and Voidwalker summons
- Validated Player-to-GM demon placement, ownership propagation, replacement, and Shift-rest cleanup
- Optional per-world automation settings for Elemental Totems and Warlock demons
- Imp Phase Shift and Sayaad Seductive defense banes
- Voidwalker Suffering with rounded-up damage sharing, native Dragonbane damage cards, and corrected chat presentation
- Heroic/class automation for Mage's Brilliance, Evoker's Legacy, War Stomp, Eye Beam, Monk's Serenity, Demon Hunter Initiation, Frostreaper, and Death Knight Runes
- Druid incarnation/form automation with persistent configurable artwork, movement, natural attacks, armor, spell restrictions/costs, roll boons, Maul Marked, and managed Stretch/Shift lifecycle
- Player convenience Macros for changing active Druid form and opening the shared End Effects dialog
- Best-effort English Core Set compatibility that extends Great Helm's ranged-attack Banes to the Bane of Azeroth Firearms skill
- Static Shadowform visual state for active Scene tokens and character-sheet portraits, integrated with End Effects and Stretch/Shift lifecycle cleanup
Generated content uses stable Foundry document identifiers and is checked against its structured source during development and packaging.

## Compatibility

The current version has been developed and verified with:

| Component | Version |
|---|---:|
| Foundry Virtual Tabletop | 14.365 |
| Dragonbane system | 4.0.1 |
| Dragonbane Core Set | 2.2 |
| YZE Combat | 1.7.0 |

The module manifest declares compatibility with Foundry VTT 14 and Dragonbane 4.0.1. **Dragonbane system 4.0.1 is the only hard Foundry runtime dependency declared by Bane of Azeroth.** Dragonbane Core Set 2.2 is the required external content source for the registered Dragonbane Core references used by generated Bane of Azeroth content; those links are verified against Core Set content imported into the test world. **YZE Combat 1.7.0 is optional** and is included in the verified environment because it is the combat module recommended for Dragonbane; Bane of Azeroth does not require YZE Combat to be installed or enabled. Compatibility with other versions has not yet been verified.

## Installation

> **Package identities:** Production/release packages use `bane-of-azeroth` (**Bane of Azeroth**). Development prerelease packages use the separate Foundry package id `bane-of-azeroth-dev` (**Bane of Azeroth - Development**). They can therefore be installed side-by-side. Foundry is told that the two packages are a known conflict and only one should normally be enabled in a given world. As a safety guard, if both are enabled the Development runtime wins and the production runtime remains inert; development worlds should still use the development package and its Adventure content consistently.

There is currently no stable public release. Development builds are distributed as rolling branch prereleases and may change without notice. Stable production releases are published from version tags `vMAJOR.MINOR.PATCH` once the module reaches 1.0.0; the release workflow requires the tag, module version, README, and dated Changelog section to agree before publishing.

Stable installations use the permanent manifest channel `https://github.com/Frogvall/bane-of-azeroth/releases/latest/download/module.json`. Each stable manifest points back to that same URL, while its `download` field points to the zip for that specific version.

Release candidates use a separate opt-in rolling GitHub prerelease channel at `https://github.com/Frogvall/bane-of-azeroth/releases/download/release-candidate/module.json`. Trigger **Publish Foundry release candidate** manually in GitHub Actions and install the candidate through its manifest URL in Foundry. The candidate release is explicitly marked as a prerelease and does not replace the stable `releases/latest` channel. A tester who intentionally moves between the RC and stable channels may be asked by Foundry to confirm the manifest-URL change; normal stable users remain on the stable URL.

For a manual development installation, place the packaged module contents in:

```text
Data/modules/bane-of-azeroth/
```

The installed module directory must contain `module.json` at its root:

```text
bane-of-azeroth/
├── module.json
├── scripts/
├── lang/
└── packs/
```

Restart Foundry VTT after installing or updating the module.

## Development and testing

The Foundry module uses four complementary verification layers:

- Unit tests for isolated runtime and generator behavior
- Integration tests for generated content, hook registration, Adventure contracts, and packaging
- Foundry system tests executed through prerelease-only Developer Test macros
- Manual verification recorded in generated Foundry Journal reports

The tests and reports are the authoritative record of verified behavior. This README documents only how to run them.

### Automated tests

Run the complete automated test suite from the repository root:

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp/home \
  -v "$PWD:/workspace" \
  -v boa-node-modules:/workspace/node_modules \
  -w /workspace \
  node:22-bookworm-slim \
  sh -lc 'npm ci && npm run test:coverage'
```

### Generated content

Every generator that supports `--check` must succeed before release. The complete generator set is also exercised by the automated and packaging workflows.

Run the complete generator verification from the repository root:

```bash
npm run check:generated
```

The npm command runs `python3 tools/check-foundry-generators.py`, which discovers every `tools/generate-*.py` script and invokes its `--check` mode. The same central check runs in GitHub Actions and at the start of `tools/package-foundry.sh`, so new generators are automatically included in build and packaging verification.
### Foundry system tests
Developer Test macros and reusable System Test Actors are included in development prerelease packages only. Production release candidates use the production package identity and do not include either development-only Compendium.

In a Foundry test world:

1. Import or reimport the Bane of Azeroth Adventure.
2. Confirm that the **Bane of Azeroth - System Tests** Actor folder is auto-populated with the managed manual-test roster (Death Knight, Demon Hunter, Druid, Shaman, Warlock, Mage, Monk, Evoker, Shadow Priest, Tauren, Hunter, and Target).
3. Open the **Bane of Azeroth – Developer Tests** compendium.
4. Run **BOA DEV – Run All System Tests** as a game master.
5. Review the generated Journal report and use the prepared Actors for the remaining manual checks.
6. Complete and record the remaining manual checks in that report.

The Actor fixtures are reconciled from the current imported world Items. Bane of Azeroth only replaces embedded Items that it marked as managed fixture data; Items added manually to a fixture Actor are left untouched. Reimport the Adventure if a fixture reports that a required source Item is missing.
### Release verification

Use the development package for **BOA DEV – Run All System Tests** and the generated manual Player/GM report. When those checks are green, trigger **Publish Foundry release candidate**.

The RC workflow runs the automated test suite, generator checks, builds the production `bane-of-azeroth` package without Developer Tests, publishes it as the rolling `release-candidate` GitHub prerelease, and verifies the public manifest/download endpoints. Install the candidate through its manifest URL in a clean Foundry test environment; do not install its zip manually for the release-path verification.

A release candidate is ready only when:

- the automated test suite passes;
- generated content is synchronized;
- all Foundry system tests pass in the matching development build;
- the manual verification report has no unresolved BoA failures;
- the production RC installs and updates through the RC manifest URL;
- Adventure import and reimport have been verified in a clean test world using the RC;
- package presentation is correct; and
- GM and Player consoles show no unexpected Bane of Azeroth warnings or errors.

Foundry Core or PIXI warnings that do not indicate broken Bane of Azeroth behavior are not release blockers.

Bane of Azeroth remains an alpha project. Rules, document structures, compendium identifiers, and Foundry integrations may change between versions.

## Contributing

Bug reports, rules feedback, and compatibility reports are welcome.

When reporting a Foundry issue, include:

- Foundry VTT version
- Dragonbane system version
- Bane of Azeroth module version
- Other relevant active modules
- Steps required to reproduce the issue
- Any errors shown in the browser console

The project is currently maintained by **Auvreannia**.

## Legal notice

Bane of Azeroth is an unofficial, non-commercial fan project.

It is not affiliated with, endorsed by, or sponsored by Blizzard Entertainment, Free League Publishing, Foundry Gaming LLC, or any of their partners.

Warcraft, World of Warcraft, Azeroth, and related names and concepts are the property of their respective rights holders.

Dragonbane and related names and game materials are the property of their respective rights holders.

This repository does not grant permission to redistribute third-party copyrighted artwork, text, or other protected material. Contributors are responsible for ensuring that submitted material may legally be distributed.

## License

A license has not yet been selected.

Until a license is added, the contents of this repository remain protected by copyright and may not automatically be copied, modified, or redistributed.
