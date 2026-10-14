import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validate } from "../scripts/validate.mjs";

const schema = JSON.parse(readFileSync(new URL("../data/keepers.schema.json", import.meta.url), "utf8"));
const good = () => ({
  settings: { keeperTermYears: 3, tradedExtraYears: 1, seasonRolloverMonth: 7 },
  teams: [
    { name: "A", owner: "Dana", keepers: [{ player: "P One", firstYearKept: 2024, traded: false }] },
    { name: "B", owner: "Lee", keepers: [{ player: "P Two", firstYearKept: 2025, traded: true }] },
  ],
});
const errorsFor = (mutate) => { const d = good(); mutate(d); return validate(d, schema); };

test("a well-formed file passes", () => assert.deepEqual(validate(good(), schema), []));

test("a typo'd key fails (firstYearKept -> firstYearKeept)", () => {
  const e = errorsFor((d) => { const k = d.teams[0].keepers[0]; k.firstYearKeept = k.firstYearKept; delete k.firstYearKept; });
  assert.ok(e.some((m) => m.includes("firstYearKeept")), e.join("\n"));
  assert.ok(e.some((m) => m.includes('missing required "firstYearKept"')));
});

test("year as a string fails", () => {
  const e = errorsFor((d) => { d.teams[0].keepers[0].firstYearKept = "2024"; });
  assert.ok(e.some((m) => m.includes("expected integer")));
});

test("traded as 0/1 or 'yes' fails - must be a boolean", () => {
  assert.ok(errorsFor((d) => { d.teams[0].keepers[0].traded = 1; }).length > 0);
  assert.ok(errorsFor((d) => { d.teams[0].keepers[0].traded = "yes"; }).length > 0);
});

test("an owner surname fails (first name only)", () => {
  const e = errorsFor((d) => { d.teams[0].owner = "Dana Smith"; });
  assert.ok(e.some((m) => m.includes("First name only")));
});

test("a year that is off by a digit fails", () => {
  assert.ok(errorsFor((d) => { d.teams[0].keepers[0].firstYearKept = 202; }).length > 0);
});

test("the same player on two teams fails", () => {
  const e = errorsFor((d) => { d.teams[1].keepers[0].player = "p one"; });
  assert.ok(e.some((m) => m.includes("kept twice")));
});

test("duplicate team name fails", () => {
  assert.ok(errorsFor((d) => { d.teams[1].name = "A"; }).some((m) => m.includes("duplicate team")));
});

test("rollover month out of range fails", () => {
  assert.ok(errorsFor((d) => { d.settings.seasonRolloverMonth = 13; }).length > 0);
});

test("a schema keyword the validator does not implement fails loudly", () => {
  const s = structuredClone(schema);
  s.properties.teams.uniqueItems = true;
  const e = validate(good(), s);
  assert.ok(e.some((m) => m.includes('does not support schema keyword "uniqueItems"')));
});
