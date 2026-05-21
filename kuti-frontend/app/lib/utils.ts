/**
 * General utility functions
 * Extracted from legacy api.ts for SDK compatibility
 */

/**
 * Parse a comma-separated string into an array of trimmed, non-empty values
 */
export function csv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
