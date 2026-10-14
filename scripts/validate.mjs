// Validate data/keepers.json against data/keepers.schema.json, plus league-level checks.
// Dependency-free on purpose: this repo has no build step and no node_modules, so a
// once-a-year edit never meets a broken install. It implements exactly the JSON Schema
// subset the schema file uses (type, required, additionalProperties, properties, items,
// minimum/maximum, minLength, minItems, pattern); an unsupported keyword fails loudly.
import { readFileSync } from "node:fs";

const SUPPORTED = new Set([
  "$schema", "title", "description", "type", "required", "additionalProperties",
  "properties", "items", "minimum", "maximum", "minLength", "minItems", "pattern",
]);

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

export function checkSchema(value, schema, path = "") {
  const errs = [];
  for (const kw of Object.keys(schema)) {
    if (!SUPPORTED.has(kw)) errs.push(`${path || "/"}: validator does not support schema keyword "${kw}"`);
  }
  if (schema.type) {
    const t = typeOf(value);
    const ok = t === schema.type || (schema.type === "number" && t === "integer");
    if (!ok) return [...errs, `${path || "/"}: expected ${schema.type}, got ${t}`];
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${path}: ${value} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${path}: ${value} > maximum ${schema.maximum}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errs.push(`${path}: string is empty`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errs.push(`${path}: "${value}" does not match ${schema.pattern}${schema.description ? ` (${schema.description})` : ""}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${path}: needs at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((v, i) => errs.push(...checkSchema(v, schema.items, `${path}/${i}`)));
  }
  if (typeOf(value) === "object") {
    for (const r of schema.required ?? []) {
      if (!(r in value)) errs.push(`${path || "/"}: missing required "${r}"`);
    }
    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries(value)) {
      if (k in props) errs.push(...checkSchema(v, props[k], `${path}/${k}`));
      else if (schema.additionalProperties === false) errs.push(`${path || "/"}: unknown property "${k}" (typo?)`);
    }
  }
  return errs;
}

export function validate(data, schema) {
  const errors = checkSchema(data, schema);
  if (errors.length) return errors; // league-level checks assume the shape
  const teamNames = new Set();
  const players = new Map();
  for (const t of data.teams) {
    if (teamNames.has(t.name)) errors.push(`duplicate team name: ${t.name}`);
    teamNames.add(t.name);
    for (const k of t.keepers) {
      const key = k.player.trim().toLowerCase();
      if (players.has(key)) errors.push(`player kept twice: ${k.player} (${players.get(key)} and ${t.name})`);
      players.set(key, t.name);
    }
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
  let errors;
  try {
    errors = validate(read("../data/keepers.json"), read("../data/keepers.schema.json"));
  } catch (e) {
    errors = [`could not parse data/keepers.json: ${e.message}`];
  }
  if (errors.length) {
    console.error("keepers.json is INVALID:\n" + errors.map((e) => "  - " + e).join("\n"));
    process.exit(1);
  }
  console.log("keepers.json OK");
}
