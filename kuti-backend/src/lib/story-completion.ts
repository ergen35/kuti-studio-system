import { config } from "@lib/config";

export type StoryCompletionTargetKind = "tome" | "chapter" | "scene";

export type StoryCompletionField =
  | "title"
  | "sceneType"
  | "location"
  | "synopsis"
  | "summary"
  | "content"
  | "notes"
  | "charactersJson"
  | "tagsJson";

export type StoryCompletionInput = {
  targetKind: StoryCompletionTargetKind;
  field: StoryCompletionField;
  currentValue?: string;
  instruction?: string;
  modelKey?: string;
  context: Record<string, unknown>;
};

export type StoryCompletionResult = {
  modelKey: string;
  text: string;
};

export class StoryCompletionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "completion_disabled"
      | "completion_missing_configuration"
      | "completion_model_not_allowed"
      | "completion_provider_failed"
      | "completion_provider_invalid_response"
      | "timeout"
  ) {
    super(message);
    this.name = "StoryCompletionError";
  }
}

function allowedModels(): string[] {
  return config.storyCompletionModels.length > 0
    ? config.storyCompletionModels
    : [config.storyCompletionDefaultModel];
}

function isSceneSummaryCompletion(input: StoryCompletionInput): boolean {
  return input.targetKind === "scene" && input.field === "summary";
}

function isSceneContentCompletion(input: StoryCompletionInput): boolean {
  return input.targetKind === "scene" && input.field === "content";
}

function buildSceneCharacterInventory(context: Record<string, unknown>): string[] {
  const rawCharacters = context["characters"];
  if (!Array.isArray(rawCharacters)) return [];

  return rawCharacters.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];

    const character = candidate as Record<string, unknown>;
    const slug = typeof character.slug === "string" ? character.slug.trim() : "";
    if (!slug) return [];

    const name = typeof character.name === "string" && character.name.trim() ? character.name.trim() : slug;
    return [`${name} -> @chara:${slug}`];
  });
}

function buildPrompt(input: StoryCompletionInput): string {
  const lines = [
    "Tu es l'assistant narratif de Kuti Studio.",
    "Complete uniquement le champ demande en respectant le contexte existant.",
    "Le resultat doit etre directement exploitable dans le champ, sans markdown explicatif ni preambule.",
    "Conserve les noms, lieux, relations et contraintes fournis.",
    "Pour les scenes, privilegie un style visuel precis, decoupable en manga et adaptable ensuite en drama coreen.",
    "Pour les champs charactersJson et tagsJson, retourne uniquement une liste courte separee par des virgules.",
    "",
    `Type cible: ${input.targetKind}`,
    `Champ cible: ${input.field}`,
    `Valeur actuelle: ${input.currentValue?.trim() || "(vide)"}`,
    input.instruction?.trim() ? `Instruction utilisateur: ${input.instruction.trim()}` : "",
  ];

  if (isSceneSummaryCompletion(input)) {
    lines.push(
      "",
      "Pour le champ scene.summary:",
      "Ecris un resume en prose fluide et concise.",
      "N'utilise aucun prefixe de script comme DIALOGUE:, THOUGHT: ou NARRATION:.",
      "Garde le style narratif naturel du resume, sans structure de scenario ligne par ligne.",
    );
  }

  if (isSceneContentCompletion(input)) {
    const inventory = buildSceneCharacterInventory(input.context);

    lines.push(
      "",
      "Pour le champ scene.content:",
      "Ecris un script de scene ligne par ligne avec la syntaxe canonique suivante:",
      "- DIALOGUE: pour une bulle de dialogue avec pointeur.",
      "- THOUGHT: pour une bulle nuageuse de pensee interieure.",
      "- NARRATION: pour un rectangle de narration dans un coin.",
      "Ne convertis pas un type de ligne en un autre, ne fusionne pas les lignes et ne paraphrase pas leur ordre.",
      "Preserve exactement les lignes deja prefixees dans la valeur actuelle, y compris leur type et leur ordre.",
      "Quand un personnage apparait dans une ligne typée, conserve ou ajoute la syntaxe canonique `@chara:<slug>` dans cette ligne.",
      inventory.length > 0
        ? "Inventaire des personnages disponibles dans le contexte:"
        : "Inventaire des personnages disponibles dans le contexte: aucun personnage disponible.",
      ...inventory.map((entry) => `- ${entry}`),
      "Exemples:",
      "- DIALOGUE: @chara:asha On y va.",
      "- THOUGHT: @chara:kairo Je dois rester calme.",
      "- NARRATION: Le vent se leve sur le quai.",
    );
  }

  lines.push("Contexte JSON:", JSON.stringify(input.context, null, 2));

  return lines.filter(Boolean).join("\n");
}

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;

  const choices = obj["choices"];
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!choice || typeof choice !== "object") continue;
      const choiceObj = choice as Record<string, unknown>;
      const message = choiceObj["message"];
      if (message && typeof message === "object") {
        const content = (message as Record<string, unknown>)["content"];
        if (typeof content === "string" && content.trim()) return content.trim();
      }
      const text = choiceObj["text"];
      if (typeof text === "string" && text.trim()) return text.trim();
    }
  }

  const outputText = obj["output_text"];
  if (typeof outputText === "string" && outputText.trim()) return outputText.trim();

  return null;
}

export function getStoryCompletionModels() {
  return allowedModels().map((modelKey) => ({
    key: modelKey,
    displayName: modelKey,
    enabled: config.storyCompletionEnabled,
    configured: config.storyCompletionEnabled && !!config.storyCompletionEndpoint && !!config.storyCompletionApiKey,
  }));
}

export async function completeStoryField(input: StoryCompletionInput): Promise<StoryCompletionResult> {
  if (!config.storyCompletionEnabled) {
    throw new StoryCompletionError("Story completion disabled", "completion_disabled");
  }
  if (!config.storyCompletionEndpoint || !config.storyCompletionApiKey) {
    throw new StoryCompletionError("Story completion provider not configured", "completion_missing_configuration");
  }

  const modelKey = input.modelKey || config.storyCompletionDefaultModel;
  if (!allowedModels().includes(modelKey)) {
    throw new StoryCompletionError(`Model not allowed: ${modelKey}`, "completion_model_not_allowed");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(config.storyCompletionEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.storyCompletionApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: modelKey,
        messages: [
          {
            role: "system",
            content: "Tu completes des champs narratifs pour un studio local de manga et drama coreen.",
          },
          { role: "user", content: buildPrompt(input) },
        ],
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new StoryCompletionError(
        `Provider returned ${response.status}: ${await response.text()}`,
        "completion_provider_failed"
      );
    }

    const text = extractText(await response.json());
    if (!text) {
      throw new StoryCompletionError("Invalid completion response", "completion_provider_invalid_response");
    }

    return { modelKey, text };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof StoryCompletionError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new StoryCompletionError("Completion request timeout", "timeout");
    }
    throw new StoryCompletionError(String(error), "completion_provider_failed");
  }
}
