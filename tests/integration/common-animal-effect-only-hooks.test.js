import {
  readFileSync,
} from "node:fs";
import {
  expect,
  test,
} from "vitest";

const entrypoint = readFileSync(
  "foundry/scripts/bane-of-azeroth.js",
  "utf-8"
);

test("registers the Common Animal effect-only attack hooks", () => {
  expect(entrypoint).toContain(
    'from "./common-animal-effect-only-attacks.js";'
  );
  expect(entrypoint).toContain(
    '"preCreateChatMessage",\n' +
    "    onPreCreateCommonAnimalEffectOnlyWeaponTestMessage"
  );
  expect(entrypoint).toContain(
    '"createChatMessage",\n' +
    "    onCreateCommonAnimalEffectOnlyWeaponTestMessage"
  );
  expect(entrypoint).toContain(
    '"updateChatMessage",\n' +
    "    onUpdateCommonAnimalEffectOnlyWeaponTestMessage"
  );
  expect(entrypoint).toContain(
    '"renderDoDActorBaseSheet",\n' +
    "    onRenderCommonAnimalEffectOnlyActorSheet"
  );
});
