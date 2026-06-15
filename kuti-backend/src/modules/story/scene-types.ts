import { z } from "zod";

export const SCENE_TYPES = [
  { value: "free", label: { en: "Free", fr: "Libre" } },
  { value: "dialogue", label: { en: "Dialogue", fr: "Dialogue" } },
  { value: "action", label: { en: "Action", fr: "Action" } },
  { value: "reveal", label: { en: "Reveal", fr: "Révélation" } },
  { value: "transition", label: { en: "Transition", fr: "Transition" } },
  { value: "confrontation", label: { en: "Confrontation", fr: "Confrontation" } },
  { value: "flashback", label: { en: "Flashback", fr: "Flashback" } },
  { value: "quiet_beat", label: { en: "Quiet Beat", fr: "Temps calme" } },
  { value: "climax", label: { en: "Climax", fr: "Climax" } },
  { value: "resolution", label: { en: "Resolution", fr: "Résolution" } },
] as const;

export type SceneType = (typeof SCENE_TYPES)[number]["value"];

export const sceneTypeSchema = z.enum([
  "free",
  "dialogue",
  "action",
  "reveal",
  "transition",
  "confrontation",
  "flashback",
  "quiet_beat",
  "climax",
  "resolution",
]);

export const sceneTypesResponseSchema = z.array(
  z.object({
    value: z.string(),
    label: z.object({
      en: z.string(),
      fr: z.string(),
    }),
  }),
);
