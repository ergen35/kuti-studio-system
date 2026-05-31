import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * General utility functions
 * Extracted from legacy api.ts for SDK compatibility
 */

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a comma-separated string into an array of trimmed, non-empty values
 */
export function csv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
