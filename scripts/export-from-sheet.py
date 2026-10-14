#!/usr/bin/env python3
"""ONE-TIME migration: export the 'RB Keeper League' Google Sheet to data/keepers.json.

Read-only (values.get only - no sheet writes). Uses the existing sheets helper in
~/.config/sheets-cli. Only the hand-entered columns (Player, First Year Kept, Traded?) plus
team/owner (first name only) and the league settings are exported; nothing derived is stored.

Acceptance test, run at export time: the page's math (keeper-math.js, via scripts/compute.mjs)
is evaluated for the sheet's own 'Current Year' and its Years Remaining / Year Expiring must
equal the sheet's formula columns for EVERY row. Any difference exits non-zero and the
written JSON must not be trusted.

    python3 scripts/export-from-sheet.py [--check-only]
"""
import json, os, re, subprocess, sys

sys.path.insert(0, os.path.expanduser("~/.config/sheets-cli"))
import sheets  # noqa: E402

SID = "18rXNKMzgGz7TIh_wqpI7NKgnRG0KG3sXAB8X-1yiGTI"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "keepers.json")


def get(rng, render):
    return sheets.call(f"{SID}/values/{sheets.enc(rng)}", valueRenderOption=render).get("values", [])


def main():
    check_only = "--check-only" in sys.argv
    vals = get("Raw Data", "FORMATTED_VALUE")
    forms = get("Raw Data", "FORMULA")

    # --- settings, asserted from the sheet's own formulas so a changed rule fails loudly ---
    season_formula = forms[0][1]
    m = re.fullmatch(r"=YEAR\(TODAY\(\)\)-IF\(MONTH\(TODAY\(\)\)<(\d+),1,0\)", season_formula)
    assert m, f"Current Year formula changed: {season_formula!r}"
    rollover = int(m.group(1))
    term = int(forms[0][6])
    sheet_year = int(vals[0][1])
    row_formulas = {f for r in forms[3:] if len(r) >= 7 for f in (r[3], r[5])}
    assert all(re.fullmatch(r"=F\d+-\$B\$1-1|=E\d+\+\$G\$1\+G\d+", f) for f in row_formulas), \
        f"row formulas changed: {row_formulas}"
    # '+G' is the traded flag, so tradedExtraYears is 1 by the formula's shape.
    settings = {"keeperTermYears": term, "tradedExtraYears": 1, "seasonRolloverMonth": rollover}

    # --- teams in sheet order, owners reduced to first names ---
    teams, index = [], {}
    sheet_rows = []
    for r in vals[3:]:
        if len(r) < 7 or not r[2].strip():
            continue
        team, owner, player, remaining, first, expiring, traded = (c.strip() for c in r[:7])
        assert traded in ("0", "1"), f"unexpected Traded? value {traded!r} for {player}"
        if team not in index:
            index[team] = len(teams)
            teams.append({"name": team, "owner": owner.split()[0], "keepers": []})
        t = teams[index[team]]
        assert t["owner"] == owner.split()[0], f"team {team} has two owners"
        t["keepers"].append({"player": player, "firstYearKept": int(first), "traded": traded == "1"})
        sheet_rows.append((team, player, int(remaining), int(expiring)))

    data = {"settings": settings, "teams": teams}
    if not check_only:
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"wrote {OUT}: {len(teams)} teams, {len(sheet_rows)} keepers")

    # --- equality check against the sheet's formula columns ---
    asof = f"{sheet_year}-12-15"  # any December date resolves to season-start year == sheet_year
    out = subprocess.run(["node", os.path.join(ROOT, "scripts", "compute.mjs"), asof],
                         capture_output=True, text=True, check=True).stdout
    league = json.loads(out)
    assert league["season"] == sheet_year, f"page season {league['season']} != sheet Current Year {sheet_year}"
    page = {(t["name"], k["player"]): (k["yearsRemaining"], k["yearExpiring"])
            for t in league["teams"] for k in t["keepers"]}
    bad = 0
    for team, player, rem, exp in sheet_rows:
        got = page.get((team, player))
        if got != (rem, exp):
            bad += 1
            print(f"MISMATCH {team} / {player}: sheet=(remaining {rem}, expiring {exp}) page={got}")
    if bad or len(page) != len(sheet_rows):
        print(f"FAIL: {bad} mismatching row(s); sheet rows={len(sheet_rows)} page rows={len(page)}")
        return 1
    print(f"EQUAL: {len(sheet_rows)}/{len(sheet_rows)} rows - page Years Remaining and Year Expiring "
          f"match the sheet's formula columns (season {sheet_year})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
