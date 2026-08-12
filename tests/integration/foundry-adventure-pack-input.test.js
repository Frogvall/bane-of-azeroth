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

const BUILD_SCRIPT = resolve(
  "tools",
  "build-foundry.sh",
);

describe("Foundry Adventure pack input", () => {
  test("packs the Adventure directory itself instead of its parent", () => {
    const source = readFileSync(
      BUILD_SCRIPT,
      "utf8",
    );

    expect(source).toContain(
      'PACK_SOURCE_RELATIVE="foundry/pack-src/'
      + 'bane-of-azeroth/'
      + 'Bane_of_Azeroth_ZoNOXZjdkOjV56e3"',
    );
    expect(source).toContain(
      'PACK_SOURCE="${ROOT_DIR}/'
      + '${PACK_SOURCE_RELATIVE}"',
    );
    expect(source).toContain(
      '--inputDirectory '
      + '"/work/${PACK_SOURCE_RELATIVE}"',
    );
    expect(source).not.toContain(
      "--inputDirectory "
      + "/work/foundry/pack-src/"
      + "bane-of-azeroth \\\n",
    );
    expect(source).toContain(
      "--recursive",
    );
  });
});
