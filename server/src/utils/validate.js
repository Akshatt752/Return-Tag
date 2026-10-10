import { httpError } from "../middleware/errorHandler.js";

const label = (field) => field[0].toUpperCase() + field.slice(1).replace(/([A-Z])/g, " $1").toLowerCase();

// Reads an optional/required string field. Anything that isn't a string (e.g. { "$gt": "" })
// is rejected, so request bodies can't smuggle MongoDB operators into queries.
export function str(value, field, { required = false, max = 200, min = 0 } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw httpError(400, `${label(field)} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw httpError(400, `${label(field)} must be text`);
  const trimmed = value.trim();
  if (required && !trimmed) throw httpError(400, `${label(field)} is required`);
  if (trimmed.length > max) throw httpError(400, `${label(field)} must be at most ${max} characters`);
  if (trimmed && trimmed.length < min) throw httpError(400, `${label(field)} must be at least ${min} characters`);
  return trimmed;
}

// Booleans arrive as real booleans from JSON and as "true"/"false" from multipart forms
export function bool(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return value === true || value === "true" || value === "on" || value === "1";
}

export function oneOf(value, field, allowed) {
  if (!allowed.includes(value)) throw httpError(400, `${label(field)} must be one of: ${allowed.join(", ")}`);
  return value;
}

export function email(value, field = "email", { required = false } = {}) {
  const result = str(value, field, { required, max: 120 });
  if (result === undefined) return undefined;
  if (!/^\S+@\S+\.\S+$/.test(result)) throw httpError(400, "Please enter a valid email");
  return result.toLowerCase();
}
