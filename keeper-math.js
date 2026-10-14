// Keeper date math. Mirrors the retired Google Sheet's formulas exactly:
//   Current Year   = YEAR(TODAY()) - IF(MONTH(TODAY()) < 7, 1, 0)
//   Year Expiring  = First Year Kept + Keeper Starting Term + Traded?
//   Years Remaining = Year Expiring - Current Year - 1
// Pure functions; the clock is always passed in.

export function seasonStartYear(now, rolloverMonth) {
  return now.getFullYear() - (now.getMonth() + 1 < rolloverMonth ? 1 : 0);
}

export function yearExpiring(keeper, settings) {
  return keeper.firstYearKept + settings.keeperTermYears + (keeper.traded ? settings.tradedExtraYears : 0);
}

export function yearsRemaining(expiringYear, season) {
  return expiringYear - season - 1;
}

export function keeperStatus(remaining) {
  if (remaining < 0) return "expired";
  if (remaining === 0) return "final";
  return "active";
}

export function computeKeeper(keeper, settings, now) {
  const season = seasonStartYear(now, settings.seasonRolloverMonth);
  const expiring = yearExpiring(keeper, settings);
  const remaining = yearsRemaining(expiring, season);
  return { ...keeper, yearExpiring: expiring, yearsRemaining: remaining, status: keeperStatus(remaining) };
}

export function computeLeague(data, now) {
  const season = seasonStartYear(now, data.settings.seasonRolloverMonth);
  const teams = data.teams.map((t) => ({
    ...t,
    keepers: t.keepers.map((k) => computeKeeper(k, data.settings, now)),
  }));
  return { season, teams };
}
