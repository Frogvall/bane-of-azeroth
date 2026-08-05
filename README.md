# Bane of Azeroth

**Bane of Azeroth** is an unofficial tabletop role-playing game adaptation inspired by the world, peoples, classes, creatures, and magic of Warcraft, built for the **Dragonbane** role-playing game.

The project aims to combine the fast, dangerous, and skill-based rules of Dragonbane with heroic fantasy adventures set in Azeroth.

> **Current status:** Active development / prerelease testing
> **Current Homebrewery document version:** 1.0
> **Current Foundry module version:** 0.11.4

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
Generated content uses stable Foundry document identifiers and is checked against its structured source during development and packaging.

## Compatibility

The current version has been developed and verified with:

| Component | Version |
|---|---:|
| Foundry Virtual Tabletop | 14.365 |
| Dragonbane system | 4.0.1 |
| Dragonbane Core Set | 2.2 |
| YZE Combat | 1.7.0 |

The module manifest declares compatibility with Foundry VTT 14 and Dragonbane 4.0.1. Compatibility with other versions has not yet been verified.

## Installation

There is currently no stable public release. Development builds are distributed as rolling branch prereleases and may change without notice.

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

Developer Test macros are included in prerelease packages only.

In a Foundry test world:

1. Import or reimport the Bane of Azeroth Adventure.
2. Open the **Bane of Azeroth – Developer Tests** compendium.
3. Run **BOA DEV – Run All System Tests** as a game master.
4. Review the generated Journal report.
5. Complete and record the remaining manual checks in that report.

### Release verification

A release candidate is ready only when:

- the automated test suite passes;
- generated content is synchronized;
- all Foundry system tests pass;
- the manual verification report has no unresolved failures;
- Adventure import and reimport have been verified in a clean test world; and
- package validation succeeds.

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
