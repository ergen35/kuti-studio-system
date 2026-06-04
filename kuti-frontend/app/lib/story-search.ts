type SearchableTome = {
  id: string;
  title: string;
  synopsis: string;
  slug: string;
};

type SearchableChapter = {
  id: string;
  tomeId: string;
  title: string;
  synopsis: string;
  slug: string;
};

type SearchableScene = {
  id: string;
  tomeId: string;
  chapterId: string;
  title: string;
  sceneType: string;
  location: string;
  summary: string;
  content: string;
  notes: string;
  tagsJson: string[];
  slug: string;
};

export type StorySearchSource = {
  projectId: string;
  tomes: SearchableTome[];
  chapters: SearchableChapter[];
  scenes: SearchableScene[];
};

export type StorySearchResultKind = "tome" | "chapter" | "scene";

export type StorySearchResult = {
  kind: StorySearchResultKind;
  id: string;
  title: string;
  pathLabel: string;
  href: string;
  excerpt: string;
  matchedFields: Array<
    | "title"
    | "synopsis"
    | "summary"
    | "content"
    | "notes"
    | "tags"
    | "sceneType"
    | "location"
  >;
  score: number;
};

const FIELD_WEIGHTS: Record<string, number> = {
  title: 90,
  synopsis: 60,
  summary: 50,
  content: 42,
  notes: 38,
  tags: 32,
  sceneType: 20,
  location: 20,
};

const KIND_PRIORITY: Record<StorySearchResultKind, number> = {
  scene: 3,
  chapter: 2,
  tome: 1,
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenizeSearchQuery(query: string) {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

function matchesField(text: string, normalizedQuery: string, terms: string[]) {
  const normalizedText = normalizeSearchText(text);
  if (!normalizedText) {
    return false;
  }

  if (!normalizedQuery) {
    return false;
  }

  return (
    terms.length > 0 &&
    (normalizedText.includes(normalizedQuery) ||
      terms.some((term) => normalizedText.includes(term)))
  );
}

function scoreField(
  text: string,
  normalizedQuery: string,
  terms: string[],
  weight: number,
) {
  const normalizedText = normalizeSearchText(text);
  if (!normalizedText) {
    return 0;
  }

  let score = 0;

  if (normalizedText.includes(normalizedQuery)) {
    score += weight;
  }

  for (const term of terms) {
    if (normalizedText.includes(term)) {
      score += Math.max(1, Math.floor(weight / 4));
    }
  }

  return score;
}

function excerptAroundMatch(text: string, query: string, maxLength = 120) {
  const normalizedText = normalizeSearchText(text);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedText || !normalizedQuery) {
    return text.trim().slice(0, maxLength);
  }

  const index = normalizedText.indexOf(normalizedQuery);
  if (index < 0) {
    return text.trim().slice(0, maxLength);
  }

  const start = Math.max(0, index - 35);
  const end = Math.min(text.length, index + normalizedQuery.length + 70);
  const snippet = text.slice(start, end).trim();

  return snippet.length > maxLength
    ? `${snippet.slice(0, maxLength).trim()}…`
    : snippet;
}

function buildTagsExcerpt(tags: string[]) {
  return tags.filter(Boolean).join(", ");
}

function buildResult(
  kind: StorySearchResultKind,
  data: Omit<
    StorySearchResult,
    "kind" | "score" | "matchedFields" | "excerpt"
  > & {
    fields: Record<StorySearchResult["matchedFields"][number], string>;
    excerptFields?: Array<StorySearchResult["matchedFields"][number]>;
  },
  query: string,
  terms: string[],
  normalizedQuery: string,
) {
  const matchedFields: StorySearchResult["matchedFields"] = [];
  let score = 0;

  for (const [field, text] of Object.entries(data.fields)) {
    if (!text) {
      continue;
    }

    const fieldKey = field as keyof typeof FIELD_WEIGHTS;
    const fieldWeight = FIELD_WEIGHTS[fieldKey] ?? 0;

    if (matchesField(text, normalizedQuery, terms)) {
      matchedFields.push(field as StorySearchResult["matchedFields"][number]);
      score += fieldWeight;
    }

    score += scoreField(text, normalizedQuery, terms, fieldWeight);
  }

  const excerptCandidates = data.excerptFields ?? [];
  const excerptSource =
    excerptCandidates
      .map((field) => data.fields[field])
      .find((text) => text && matchesField(text, normalizedQuery, terms)) ||
    excerptCandidates
      .map((field) => data.fields[field])
      .find((text) => !!text) ||
    "";
  const excerpt = excerptSource ? excerptAroundMatch(excerptSource, query) : "";

  return {
    kind,
    id: data.id,
    title: data.title,
    pathLabel: data.pathLabel,
    href: data.href,
    excerpt,
    matchedFields,
    score,
  } satisfies StorySearchResult;
}

export function buildStorySearchResults(
  source: StorySearchSource | undefined,
  query: string,
): StorySearchResult[] {
  if (!source) {
    return [];
  }

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const terms = tokenizeSearchQuery(query);
  if (terms.length === 0) {
    return [];
  }

  const tomeById = new Map(source.tomes.map((tome) => [tome.id, tome]));
  const chapterById = new Map(
    source.chapters.map((chapter) => [chapter.id, chapter]),
  );

  const results: StorySearchResult[] = [];

  for (const tome of source.tomes) {
    const title = tome.title ?? "";
    const synopsis = tome.synopsis ?? "";
    const searchable = normalizeSearchText(
      [title, synopsis, tome.slug].join(" "),
    );
    if (!terms.every((term) => searchable.includes(term))) {
      continue;
    }

    results.push(
      buildResult(
        "tome",
        {
          id: tome.id,
          title,
          pathLabel: tome.synopsis || tome.slug || "",
          href: `/projects/${source.projectId}/story/${tome.id}`,
          fields: {
            title,
            synopsis,
            summary: "",
            content: "",
            notes: "",
            tags: "",
            sceneType: "",
            location: "",
          },
          excerptFields: ["synopsis", "title"],
        },
        query,
        terms,
        normalizedQuery,
      ),
    );
  }

  for (const chapter of source.chapters) {
    const tome = tomeById.get(chapter.tomeId);
    const title = chapter.title ?? "";
    const synopsis = chapter.synopsis ?? "";
    const searchable = normalizeSearchText(
      [title, synopsis, chapter.slug].join(" "),
    );
    if (!terms.every((term) => searchable.includes(term))) {
      continue;
    }

    results.push(
      buildResult(
        "chapter",
        {
          id: chapter.id,
          title,
          pathLabel: tome ? `${tome.title}` : chapter.slug,
          href: `/projects/${source.projectId}/story/${chapter.tomeId}/chapters/${chapter.id}`,
          fields: {
            title,
            synopsis,
            summary: "",
            content: "",
            notes: "",
            tags: "",
            sceneType: "",
            location: "",
          },
          excerptFields: ["synopsis", "title"],
        },
        query,
        terms,
        normalizedQuery,
      ),
    );
  }

  for (const scene of source.scenes) {
    const tome = tomeById.get(scene.tomeId);
    const chapter = chapterById.get(scene.chapterId);
    const tags = buildTagsExcerpt(scene.tagsJson ?? []);
    const title = scene.title ?? "";
    const summary = scene.summary ?? "";
    const content = scene.content ?? "";
    const notes = scene.notes ?? "";
    const sceneType = scene.sceneType ?? "";
    const location = scene.location ?? "";
    const searchable = normalizeSearchText(
      [
        title,
        summary,
        content,
        notes,
        tags,
        sceneType,
        location,
        scene.slug,
      ].join(" "),
    );

    if (!terms.every((term) => searchable.includes(term))) {
      continue;
    }

    results.push(
      buildResult(
        "scene",
        {
          id: scene.id,
          title,
          pathLabel:
            [tome?.title, chapter?.title].filter(Boolean).join(" · ") ||
            scene.slug,
          href: `/projects/${source.projectId}/story/${scene.tomeId}/scenes/${scene.id}`,
          fields: {
            title,
            synopsis: "",
            summary,
            content,
            notes,
            tags,
            sceneType,
            location,
          },
          excerptFields: [
            "content",
            "notes",
            "summary",
            "tags",
            "title",
            "sceneType",
            "location",
          ],
        },
        query,
        terms,
        normalizedQuery,
      ),
    );
  }

  return results
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const kindDelta = KIND_PRIORITY[b.kind] - KIND_PRIORITY[a.kind];
      if (kindDelta !== 0) {
        return kindDelta;
      }

      return a.title.localeCompare(b.title);
    })
    .slice(0, 50);
}
