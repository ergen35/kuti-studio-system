export const projectSections = [
  { label: "Dashboard", path: "", description: "Project overview and activity" },
  { label: "Characters", path: "characters", description: "Character sheets and relations" },
  { label: "Story", path: "story", description: "Tomes, chapters, scenes, references" },
  { label: "Generation", path: "generation", description: "Jobs, boards, and panel progress" },
  { label: "Assets", path: "assets", description: "Files, references, and usages" },
  { label: "Exports", path: "exports", description: "Export manifests and downloads" },
  { label: "Warnings", path: "warnings", description: "Continuity and QA issues" },
  { label: "Versions", path: "versions", description: "Timeline and comparisons" },
  { label: "Settings", path: "settings", description: "Project preferences and storage" },
] as const;

export const hubCommands = [
  "Open project hub",
  "Create new project",
  "Import project folder",
  "Open characters workspace",
  "Open story workspace",
  "Open generation studio",
  "Open asset library",
  "Open warnings center",
  "Open version history",
  "Open project settings",
  "Toggle theme",
  "Toggle density",
] as const;
