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

const ENTRYPOINT =
  resolve(
    "foundry",
    "scripts",
    "bane-of-azeroth.js",
  );

const ADAPTER =
  resolve(
    "foundry",
    "scripts",
    "firearms-base-skill.js",
  );

function read(
  path,
) {
  return readFileSync(
    path,
    "utf8",
  );
}

describe(
  "Firearms base-skill registration",
  () => {
    test(
      "uses Dragonbane's native getBaseSkills creation path",
      () => {
        const adapter =
          read(
            ADAPTER,
          );

        expect(
          adapter,
        ).toContain(
          "getBaseSkills",
        );
        expect(
          adapter,
        ).toContain(
          "appendFirearmsBaseSkill",
        );
        expect(
          adapter,
        ).toContain(
          "systems/dragonbane/modules/utility.js",
        );
      },
    );

    test(
      "registers the adapter during ready before users can create Actors",
      () => {
        const entrypoint =
          read(
            ENTRYPOINT,
          );

        expect(
          entrypoint,
        ).toContain(
          'from "./firearms-base-skill.js"',
        );

        const ready =
          entrypoint.indexOf(
            'Hooks.once("ready"',
          );
        const registration =
          entrypoint.indexOf(
            "await registerFirearmsBaseSkillAdapter()",
          );

        expect(
          ready,
        ).toBeGreaterThan(-1);
        expect(
          registration,
        ).toBeGreaterThan(
          ready,
        );
      },
    );
  },
);
