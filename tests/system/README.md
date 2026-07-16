# Planned Foundry system-test macros

The unit and mocked-integration suite deliberately does not attempt to prove
behaviour that depends on a real Foundry canvas, real Dragonbane documents, or
multiple connected clients.

Before the script refactor, add prerelease-only macros for these cases:

1. **BOA DEV - Run All System Tests**
   - Runs every non-interactive macro and reports PASS/FAIL.
2. **BOA DEV - Verify Imported Content**
   - Verifies required world Items, Actors, content keys, portraits, token
     images, traits, spell relations, and Elemental Totem prototype flags.
3. **BOA DEV - Verify Spell Grants**
   - Creates a temporary Actor, adds and removes each granting ability,
     verifies prepared-state protection, and cleans up.
4. **BOA DEV - Verify Elemental Totem Documents**
   - Verifies token flags, synthetic Actor ownership, HP, armor, aura data,
     cross-scene cleanup, and Actor-sheet readability.
5. **BOA DEV - Cleanup Test Fixtures**
   - Removes every Actor, Item, Token, and flag created by the test macros.

These remain manual acceptance tests even after macros exist:

- pointer movement, grid preview, Escape, and right-click placement;
- visual aura appearance and distinguishability on real maps;
- a genuine player-to-GM socket round trip using two clients;
- compatibility verification against a new Foundry or Dragonbane version;
- Adventure import dialog layout and user interaction.

The macros must be packaged only in prerelease builds and must never execute
automatically.
