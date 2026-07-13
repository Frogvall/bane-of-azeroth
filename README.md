# Bane of Azeroth

**Bane of Azeroth** is an unofficial tabletop role-playing game adaptation inspired by the world, peoples, classes, creatures, and magic of Warcraft, built for the **Dragonbane** role-playing game.

The project aims to combine the fast, dangerous, and skill-based rules of Dragonbane with heroic fantasy adventures set in Azeroth.

> **Current status:** Early development / playtesting
> **Current Homebrewery document version:** 0.9
> **Current Foundry module version:** 0.1.2

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
│   ├── scripts/
│   ├── lang/
│   ├── packs/
│   ├── TESTING.md
│   └── CHANGELOG.md
└── README.md
```

### Homebrewery

The `homebrewery` directory contains the Homebrewery source for the Bane of Azeroth rulebook, together with its styles and image assets.

### Foundry

The `foundry` directory contains the Foundry VTT module, including scripts, localization, compendium data, testing documentation, and module metadata.

## Foundry VTT module

The Foundry module is currently under active development.

It adds support for Bane of Azeroth content and mechanics that cannot be represented through standard Dragonbane documents alone.

Currently implemented custom weapon features include:

- Ammunition
- Armor Piercing
- Freehanded
- Returning
- Scattershot

### Armor Piercing

Eligible ranged weapons can use **Find Weak Spot**, applying one bane to the attack and ignoring armor on a successful hit.

The implementation preserves Dragonbane's normal ranged attack behavior, including ranged mishaps.

### Scattershot

Scattershot weapons:

- Ignore the normal point-blank bane
- Retain the long-range bane
- Deal half damage beyond their normal range, rounded up
- Preserve critical hits, damage types, maximum-range restrictions, and ranged mishaps

## Compatibility

The current version has been developed and tested with:

| Component | Version |
|---|---:|
| Foundry Virtual Tabletop | 14.364 |
| Dragonbane system | 4.0.1 |
| Dragonbane Core Set | 2.2 |
| YZE Combat | 1.7.0 |

Compatibility with other versions has not yet been verified.

Detailed test results are available in [`foundry/TESTING.md`](Foundry/TESTING.md).

## Installation

There is currently no stable public release.

During development, the contents of the `foundry` directory can be installed manually in:

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

## Development status

Bane of Azeroth is incomplete and should currently be considered an alpha project.

Rules, document structures, compendium identifiers, and Foundry integrations may change between versions.

The current development priorities are:

- Establishing the core rules framework
- Implementing kin and kin abilities
- Implementing classes and heroic abilities
- Adding weapons and equipment
- Expanding Foundry automation
- Building the Adventure compendium
- Testing compatibility with future Dragonbane system releases

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
