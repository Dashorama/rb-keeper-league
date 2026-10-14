# RB Keeper League

Keeper board for the RB Keeper League (Yahoo hockey). Static page, one data file, nothing to compile.

Live: https://dashorama.github.io/rb-keeper-league/ (preview another date with `?asOf=2027-07-01`)

## Yearly edit (five lines)
1. On GitHub open `data/keepers.json` and click the pencil.
2. Edit each team's `keepers`: `player`, `firstYearKept`, `traded` (`true`/`false`). Nothing derived is stored.
3. Commit. The `validate` check fails loudly on a typo; fix it and commit again until green.
4. The page picks the change up within a minute; Years Remaining and Year Expiring are computed in the page.
5. Rules live in `settings` (term 3, traded +1, season rolls over July 1).

## Rules (identical to the retired Google Sheet)
- Season-start year = calendar year, minus 1 before July.
- Year Expiring = First Year Kept + term (3) + 1 if traded.
- Years Remaining = Year Expiring - season-start year - 1. `0` is **FINAL YEAR**, below `0` is **EXPIRED**.

## Develop
`npm test` runs schema validation and the date-math tests (clock injected). Node 20+, zero dependencies.
`scripts/export-from-sheet.py` was the one-time migration; it asserts the page's math equals the sheet's formula columns row by row.

Public data: owner first names and team names only. No surnames, emails or Yahoo ids.
