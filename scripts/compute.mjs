// Print the computed league as JSON for a given date: node scripts/compute.mjs [YYYY-MM-DD]
// Used by the export script's equality check so it exercises the exact module the page ships.
import { readFileSync } from "node:fs";
import { computeLeague } from "../keeper-math.js";

const data = JSON.parse(readFileSync(new URL("../data/keepers.json", import.meta.url), "utf8"));
const arg = process.argv[2];
const now = arg ? new Date(`${arg}T12:00:00`) : new Date();
console.log(JSON.stringify(computeLeague(data, now)));
