import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("package metadata is valid", () => {
  assert.equal(packageJson.name, "athleteos-taekwondo");
  assert.ok(packageJson.version);
});

test("required build and test scripts exist", () => {
  assert.equal(packageJson.scripts.build, "node scripts/build.mjs");
  assert.equal(packageJson.scripts.test, "node --test && node scripts/logic-tests.mjs");
});
