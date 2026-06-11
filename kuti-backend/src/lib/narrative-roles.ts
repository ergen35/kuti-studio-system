import slugify from "slugify";

export type NarrativeRoleCatalogEntry = {
  code: string;
  label: string;
};

export const PREDEFINED_NARRATIVE_ROLE_CODES = new Set([
  "protagonist",
  "deuteragonist",
  "antagonist",
  "tritagonist",
  "mentor",
  "ally",
  "foil",
  "love-interest",
  "guardian",
  "comic-relief",
  "wildcard",
]);

export function normalizeNarrativeRoleCode(value: string): string {
  return slugify(value.trim(), { lower: true, strict: true }) || "role";
}

export function isPredefinedNarrativeRoleCode(value: string): boolean {
  return PREDEFINED_NARRATIVE_ROLE_CODES.has(value);
}

export function buildNarrativeRoleLabelMap(
  roles: Array<{ code: string; label: string }>,
): Map<string, string> {
  return new Map(roles.map((role) => [role.code, role.label]));
}
