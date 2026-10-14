import { test } from "node:test";
import assert from "node:assert/strict";
import { seasonStartYear, yearExpiring, yearsRemaining, keeperStatus, computeKeeper } from "../keeper-math.js";

const SETTINGS = { keeperTermYears: 3, tradedExtraYears: 1, seasonRolloverMonth: 7 };
// The clock is always injected as a Date; nothing in these tests reads the real time.
const d = (s) => new Date(`${s}T12:00:00`);

test("season-start year: before July belongs to the season that started last year", () => {
  assert.equal(seasonStartYear(d("2027-06-30"), 7), 2026);
  assert.equal(seasonStartYear(d("2027-01-01"), 7), 2026);
});

test("season-start year: July 1 rolls over to the new season", () => {
  assert.equal(seasonStartYear(d("2027-07-01"), 7), 2027);
  assert.equal(seasonStartYear(d("2026-10-13"), 7), 2026);
  assert.equal(seasonStartYear(d("2026-12-31"), 7), 2026);
});

test("season-start year honours a configured rollover month", () => {
  assert.equal(seasonStartYear(d("2027-09-30"), 10), 2026);
  assert.equal(seasonStartYear(d("2027-10-01"), 10), 2027);
});

test("year expiring = first year kept + term", () => {
  assert.equal(yearExpiring({ firstYearKept: 2024, traded: false }, SETTINGS), 2027);
});

test("a traded keeper gets the +1", () => {
  assert.equal(yearExpiring({ firstYearKept: 2023, traded: true }, SETTINGS), 2027);
});

test("years remaining = year expiring - season year - 1 (the sheet's =F-$B$1-1)", () => {
  assert.equal(yearsRemaining(2029, 2026), 2);
  assert.equal(yearsRemaining(2028, 2026), 1);
  assert.equal(yearsRemaining(2027, 2026), 0);
});

test("status: final year at 0, expired below 0, active above", () => {
  assert.equal(keeperStatus(2), "active");
  assert.equal(keeperStatus(1), "active");
  assert.equal(keeperStatus(0), "final");
  assert.equal(keeperStatus(-1), "expired");
});

test("final year: kept 2024, evaluated October 2026", () => {
  const k = computeKeeper({ player: "X", firstYearKept: 2024, traded: false }, SETTINGS, d("2026-10-13"));
  assert.deepEqual(
    { yearsRemaining: k.yearsRemaining, yearExpiring: k.yearExpiring, status: k.status },
    { yearsRemaining: 0, yearExpiring: 2027, status: "final" },
  );
});

test("expired: the same keeper the day the 2027 season starts", () => {
  const k = computeKeeper({ player: "X", firstYearKept: 2024, traded: false }, SETTINGS, d("2027-07-01"));
  assert.equal(k.yearsRemaining, -1);
  assert.equal(k.status, "expired");
});

test("still final the day before the rollover", () => {
  const k = computeKeeper({ player: "X", firstYearKept: 2024, traded: false }, SETTINGS, d("2027-06-30"));
  assert.equal(k.status, "final");
});

test("traded keeper survives one more rollover than an untraded twin", () => {
  const traded = { player: "N", firstYearKept: 2024, traded: true };
  const plain = { player: "N", firstYearKept: 2024, traded: false };
  const at = d("2027-07-01");
  assert.equal(computeKeeper(traded, SETTINGS, at).status, "final");
  assert.equal(computeKeeper(plain, SETTINGS, at).status, "expired");
});

test("a rule change in the JSON settings changes the output", () => {
  const k = computeKeeper(
    { player: "X", firstYearKept: 2024, traded: true },
    { ...SETTINGS, keeperTermYears: 2, tradedExtraYears: 2 },
    d("2026-10-13"),
  );
  assert.equal(k.yearExpiring, 2028);
});
