export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function readString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

export function readStatsObject(value: unknown): Record<string, unknown> | undefined {
  if (isPlainObject(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    const first = value.find(isPlainObject);
    return first;
  }
  return undefined;
}
