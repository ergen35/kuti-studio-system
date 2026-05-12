export type ProjectStatus = "active" | "draft" | "maintenance" | "archived";
export type EntityStatus = "draft" | "active" | "review" | "archived";
export type WarningStatus = "open" | "resolved";
export type JobStatus = "running" | "failed" | "done";

export interface CharacterRelation {
  target: string;
  type: string;
  intensity: number;
}

export interface Character {
  id: string;
  name: string;
  alias: string;
  role: string;
  status: EntityStatus;
  summary: string;
  personality: string;
  arc: string;
  tags: string[];
  voice: string;
  palette: string;
  relations: CharacterRelation[];
  scenes: string[];
  assets: string[];
}

export interface SceneReference {
  kind: "chara" | "environment" | "file" | "scene";
  value: string;
  valid: boolean;
}

export interface Scene {
  id: string;
  title: string;
  tome: string;
  chapter: string;
  status: EntityStatus;
  summary: string;
  intention: string;
  location: string;
  duration: string;
  tone: string;
  pace: string;
  characters: string[];
  notes: string;
  references: SceneReference[];
}

export interface Asset {
  id: string;
  name: string;
  kind: string;
  status: EntityStatus;
  size: string;
  updatedAt: string;
  usage: string[];
  tags: string[];
}

export interface WarningItem {
  id: string;
  title: string;
  type: string;
  status: WarningStatus;
  severity: "low" | "medium" | "high";
  source: string;
  note: string;
}

export interface JobItem {
  id: string;
  label: string;
  kind: string;
  status: JobStatus;
  progress: number;
  step: string;
  model: string;
  updatedAt: string;
}

export interface ExportItem {
  id: string;
  kind: "work" | "publication";
  format: "json" | "tree" | "zip";
  status: "ready" | "running" | "failed" | "obsolete";
  label: string;
  createdAt: string;
  manifest: string;
}

export interface VersionItem {
  id: string;
  label: string;
  branch: string;
  summary: string;
  createdAt: string;
  status: "active" | "archived";
}

export interface ProjectRecord {
  id: string;
  slug: string;
  name: string;
  status: ProjectStatus;
  accent: string;
  language: string;
  summary: string;
  lastUpdated: string;
  lastActivity: string;
  progress: number;
  stats: {
    characters: number;
    scenes: number;
    assets: number;
    warnings: number;
    jobs: number;
    versions: number;
  };
  activity: string[];
  jobs: JobItem[];
  warnings: WarningItem[];
  versions: VersionItem[];
  exports: ExportItem[];
  characters: Character[];
  scenes: Scene[];
  assets: Asset[];
}

export const demoProjects: ProjectRecord[] = [
  {
    id: "moon-docks",
    slug: "moon-docks",
    name: "Moon Docks",
    status: "active",
    accent: "#5f8cff",
    language: "en",
    summary: "Noir sci-fi manga about freight crews, false saints, and a port that never sleeps.",
    lastUpdated: "2026-05-11T07:52:00Z",
    lastActivity: "2026-05-11T09:10:00Z",
    progress: 72,
    stats: { characters: 14, scenes: 43, assets: 61, warnings: 6, jobs: 2, versions: 12 },
    activity: [
      "Scene 4-12 validated and marked ready for generation.",
      "Warning batch reclassified after slug reconciliation.",
      "Version 1.12 tagged before board export.",
    ],
    jobs: [
      { id: "job-441", label: "Board pass A", kind: "panel-generation", status: "running", progress: 64, step: "Rendering panel variants", model: "gpt-2-images", updatedAt: "2026-05-11T09:18:00Z" },
      { id: "job-438", label: "Scene refinement", kind: "story-assist", status: "done", progress: 100, step: "Prompt reconciled", model: "gpt-2-images", updatedAt: "2026-05-11T08:42:00Z" },
    ],
    warnings: [
      { id: "warn-21", title: "Missing environment reference", type: "reference", status: "open", severity: "medium", source: "Scene 4-08", note: "Dockyard location is referenced but not linked to an environment entity." },
      { id: "warn-18", title: "Timeline drift detected", type: "continuity", status: "resolved", severity: "low", source: "Chapter 4", note: "Time gap normalized after chapter reorder." },
      { id: "warn-12", title: "Asset orphaned", type: "asset", status: "open", severity: "high", source: "Asset: lighthouse-matte.png", note: "Referenced by two scenes but no longer present in the folder." },
    ],
    versions: [
      { id: "ver-12", label: "Revision 1.12", branch: "main", summary: "Board structure stabilized after scene review.", createdAt: "2026-05-10T21:20:00Z", status: "active" },
      { id: "ver-11", label: "Revision 1.11", branch: "draft-line", summary: "Character relations and warnings synchronized.", createdAt: "2026-05-09T18:15:00Z", status: "archived" },
    ],
    exports: [
      { id: "exp-08", kind: "publication", format: "zip", status: "ready", label: "Volume 3 draft package", createdAt: "2026-05-11T08:05:00Z", manifest: "manifest-v3.json" },
      { id: "exp-07", kind: "work", format: "json", status: "obsolete", label: "Working tree snapshot", createdAt: "2026-05-09T17:20:00Z", manifest: "work-tree.json" },
    ],
    characters: [
      { id: "jack-vespers", name: "Jack Vespers", alias: "Dock Runner", role: "Lead courier", status: "active", summary: "A meticulous runner who keeps the port moving and never trusts the loudest voice in the room.", personality: "Controlled, observant, stubborn", arc: "Learns to choose people over systems.", tags: ["lead", "courier", "noir"], voice: "Low, dry, clipped", palette: "Slate, electric blue, rust", relations: [
        { target: "Mira Sato", type: "trust", intensity: 72 },
        { target: "Elder Wren", type: "conflict", intensity: 41 },
      ], scenes: ["4-01", "4-07", "4-12"], assets: ["jack-profile", "dock-runner-hood", "express-card"] },
      { id: "mira-sato", name: "Mira Sato", alias: "Signal Clerk", role: "Information broker", status: "review", summary: "Keeps the port's secret ledgers and speaks in careful half-truths.", personality: "Precise, patient, guarded", arc: "Decides whether the truth can be weaponized.", tags: ["broker", "signal", "support"], voice: "Light, measured, archival", palette: "Ivory, coral, ink", relations: [
        { target: "Jack Vespers", type: "trust", intensity: 72 },
        { target: "The Relay", type: "duty", intensity: 58 },
      ], scenes: ["4-02", "4-09"], assets: ["mira-notes", "signal-lens"] },
      { id: "elder-wren", name: "Elder Wren", alias: "Harbor Oracle", role: "Antagonist", status: "active", summary: "A respected figure whose calm presence hides a strategy built on pressure and scarcity.", personality: "Patient, authoritative, fatalistic", arc: "Protects the dock by closing it to outsiders.", tags: ["antagonist", "leader"], voice: "Gravelly, ceremonial", palette: "Coal, brass, smoke", relations: [
        { target: "Jack Vespers", type: "conflict", intensity: 41 },
        { target: "Mira Sato", type: "control", intensity: 65 },
      ], scenes: ["4-03", "4-11"], assets: ["wren-mask", "harbor-ring"] },
    ],
    scenes: [
      { id: "4-01", title: "Outbound signal", tome: "Volume 4", chapter: "Chapter 1", status: "active", summary: "Jack intercepts a warning before the port's gates close for the night.", intention: "Introduce the countdown and the first fracture in the system.", location: "Outer berth", duration: "6m", tone: "tense", pace: "measured", characters: ["Jack Vespers", "Mira Sato"], notes: "Keep the exchange terse. Avoid exposition blocks.", references: [
        { kind: "chara", value: "jack-vespers", valid: true },
        { kind: "environment", value: "outer-berth", valid: true },
        { kind: "file", value: "signal-card.svg", valid: true },
      ] },
      { id: "4-07", title: "Cistern corridor", tome: "Volume 4", chapter: "Chapter 2", status: "review", summary: "A hidden route reveals why the harbor stays active after curfew.", intention: "Deepen the world and expose a logistical dependency.", location: "Cistern corridor", duration: "4m", tone: "ominous", pace: "slow", characters: ["Jack Vespers", "Elder Wren"], notes: "Insert reference to the relay system.", references: [
        { kind: "scene", value: "4-03", valid: true },
        { kind: "environment", value: "cistern-corridor", valid: false },
      ] },
      { id: "4-12", title: "Saints at the dock", tome: "Volume 4", chapter: "Chapter 4", status: "draft", summary: "The crew prepares the first board while the public version tells a different story.", intention: "Set up the generation-ready climax.", location: "Dock 12", duration: "8m", tone: "urgent", pace: "fast", characters: ["Jack Vespers", "Mira Sato", "Elder Wren"], notes: "This is the board handoff scene.", references: [
        { kind: "chara", value: "mira-sato", valid: true },
        { kind: "file", value: "dock-12-layout.png", valid: true },
      ] },
    ],
    assets: [
      { id: "jack-profile", name: "Jack profile sheet", kind: "image/png", status: "active", size: "3.2 MB", updatedAt: "2026-05-10T22:10:00Z", usage: ["Character sheet", "Version compare"], tags: ["portrait", "reference"] },
      { id: "dock-runner-hood", name: "Dock runner hood", kind: "image/png", status: "active", size: "1.1 MB", updatedAt: "2026-05-09T19:12:00Z", usage: ["Character sheet", "Scene 4-01"], tags: ["wardrobe", "accessory"] },
      { id: "signal-card.svg", name: "Signal card", kind: "image/svg+xml", status: "review", size: "42 KB", updatedAt: "2026-05-11T06:55:00Z", usage: ["Scene 4-01"], tags: ["graphic", "signal"] },
      { id: "dock-12-layout.png", name: "Dock 12 layout", kind: "image/png", status: "active", size: "7.6 MB", updatedAt: "2026-05-10T18:22:00Z", usage: ["Scene 4-12", "Board preview"], tags: ["layout", "environment"] },
    ],
  },
  {
    id: "paper-archive",
    slug: "paper-archive",
    name: "Paper Archive",
    status: "draft",
    accent: "#c06e4a",
    language: "fr",
    summary: "A slower literary project built around memory, documents, and a vanished post office.",
    lastUpdated: "2026-05-10T17:35:00Z",
    lastActivity: "2026-05-10T17:10:00Z",
    progress: 41,
    stats: { characters: 8, scenes: 21, assets: 19, warnings: 3, jobs: 1, versions: 5 },
    activity: [
      "Chapter 2 outline moved into validation.",
      "Reference validation found two orphaned files.",
      "Theme accents aligned to the latest project palette.",
    ],
    jobs: [
      { id: "job-201", label: "Archive preview", kind: "board-generation", status: "running", progress: 37, step: "Blocking composition", model: "gpt-2-images", updatedAt: "2026-05-10T17:28:00Z" },
    ],
    warnings: [
      { id: "warn-01", title: "Letter reference missing", type: "reference", status: "open", severity: "high", source: "Scene 2-04", note: "Referenced letter file was renamed during import." },
      { id: "warn-03", title: "Character voice note empty", type: "character", status: "resolved", severity: "low", source: "Iris Dume", note: "Voice notes completed after interview sync." },
    ],
    versions: [
      { id: "ver-05", label: "Revision 0.5", branch: "main", summary: "Story scaffold tightened around the archival motif.", createdAt: "2026-05-08T11:20:00Z", status: "active" },
    ],
    exports: [
      { id: "exp-01", kind: "work", format: "tree", status: "ready", label: "Archive tree", createdAt: "2026-05-10T16:44:00Z", manifest: "archive-tree.json" },
    ],
    characters: [
      { id: "iris-dume", name: "Iris Dume", alias: "Post clerk", role: "Protagonist", status: "active", summary: "An archivist who reconstructs lost routes from damaged records.", personality: "Patient, principled, self-contained", arc: "Learns to trust the gaps as much as the documents.", tags: ["archive", "lead"], voice: "Quiet, deliberate", palette: "Paper, ochre, ink", relations: [{ target: "Noe Vale", type: "memory", intensity: 54 }], scenes: ["2-01", "2-04"], assets: ["iris-sheet"] },
      { id: "noe-vale", name: "Noe Vale", alias: "Courier", role: "Ally", status: "review", summary: "Knows the abandoned routes and the people who still use them.", personality: "Dry, mobile, protective", arc: "Decides whether to keep moving or stay.", tags: ["support", "travel"], voice: "Low, warm", palette: "Brown, charcoal, teal", relations: [{ target: "Iris Dume", type: "memory", intensity: 54 }], scenes: ["2-02"], assets: ["noe-note"] },
    ],
    scenes: [
      { id: "2-01", title: "Room of receipts", tome: "Book 1", chapter: "Chapter 2", status: "active", summary: "Iris discovers the first unlogged delivery in the ledger room.", intention: "Introduce the archival method.", location: "Ledger room", duration: "5m", tone: "quiet", pace: "slow", characters: ["Iris Dume"], notes: "Let the paper texture carry the scene.", references: [{ kind: "file", value: "receipts-folder.pdf", valid: true }] },
      { id: "2-04", title: "Undelivered letter", tome: "Book 1", chapter: "Chapter 2", status: "review", summary: "A letter points to a route that no longer exists.", intention: "Trigger the first continuity question.", location: "Back office", duration: "3m", tone: "melancholy", pace: "measured", characters: ["Iris Dume", "Noe Vale"], notes: "Keep the note under three paragraphs.", references: [{ kind: "file", value: "letter-03.png", valid: false }] },
    ],
    assets: [
      { id: "iris-sheet", name: "Iris reference sheet", kind: "image/png", status: "active", size: "2.5 MB", updatedAt: "2026-05-09T16:40:00Z", usage: ["Character sheet"], tags: ["portrait"] },
      { id: "noe-note", name: "Noe route note", kind: "text/plain", status: "draft", size: "8 KB", updatedAt: "2026-05-10T14:20:00Z", usage: ["Scene 2-02"], tags: ["route", "note"] },
    ],
  },
];
