import {
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";
import {
  describe,
  expect,
  test,
} from "vitest";

const PREP =
  resolve(
    "tests",
    "system",
    "macros",
    "prepare-player-tests.js",
  );
const PLAYER =
  resolve(
    "tests",
    "system",
    "macros",
    "run-player-tests.js",
  );
const CLEANUP =
  resolve(
    "tests",
    "system",
    "macros",
    "cleanup-player-tests.js",
  );
const LIBRARY =
  resolve(
    "tests",
    "system",
    "lib",
    "boa-system-test-lib.js",
  );

function read(path) {
  return readFileSync(
    path,
    "utf-8",
  );
}

describe(
  "Death Knight runes real-Player coverage",
  () => {
    test(
      "prepares an owned Rebirth ability, melee weapon, and automation setting",
      () => {
        const prep =
          read(
            PREP,
          );

        for (
          const marker
          of [
            "heroic-class-ability.death-knight.death-knights-rebirth",
            '"Warglaive"',
            '"Mtrym5LUbMbXISlI"',
            "runeTestWeaponId",
            "originalDeathKnightRunesAutomationSetting",
            '"deathKnightRunesAutomation"',
          ]
        ) {
          expect(
            prep,
          ).toContain(
            marker,
          );
        }
      },
    );

    test(
      "runs selection and equipped Movement +2 in genuine Player context",
      () => {
        const player =
          read(
            PLAYER,
          );

        for (
          const marker
          of [
            "setDeathKnightRune",
            "clearDeathKnightRune",
            "getDeathKnightRuneState",
            "DEATH_KNIGHT_RUNE_EFFECT_FLAG",
            "Real Player selects Unending Thirst on an owned melee weapon",
            "Unending Thirst equipped Movement +2",
            "Real Player gains +2 Movement while wielding the Unending Thirst weapon",
            "Real Player loses the +2 Movement when the Unending Thirst weapon is no longer wielded",
            "visual-only Razorice",
            "visual-only Fallen Crusader",
            "Real Player can clear the rune selection and managed effect",
          ]
        ) {
          expect(
            player,
          ).toContain(
            marker,
          );
        }
      },
    );

    test(
      "restores the setting and documents the weapon-row rune contract",
      () => {
        const cleanup =
          read(
            CLEANUP,
          );
        const library =
          read(
            LIBRARY,
          );

        for (
          const marker
          of [
            "originalDeathKnightRunesAutomationSetting",
            '"deathKnightRunesAutomation"',
            "Restored Death Knight Runes automation",
          ]
        ) {
          expect(
            cleanup,
          ).toContain(
            marker,
          );
        }

        for (
          const marker
          of [
            "<h2>Death Knight Runes</h2>",
            "Rune slots appear only beside eligible melee weapons in Main and Inventory views",
            "picker is compact and readable",
            "Fallen Crusader",
            "Razorice",
            "Unending Thirst",
            "Clear Rune",
            "localized rule descriptions",
            "dedicated icon everywhere the weapon is shown",
            "active-icon tooltip",
            "without stale or duplicate UI",
          ]
        ) {
          expect(
            library,
          ).toContain(
            marker,
          );
        }

        for (
          const automatedMarker
          of [
            "exactly +2 Movement",
            "never starts, enforces, or completes a stretch",
          ]
        ) {
          expect(
            library,
          ).not.toContain(
            automatedMarker,
          );
        }
      },
    );
  },
);
