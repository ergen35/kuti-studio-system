import { useTranslation } from "~/hooks/useTranslation";
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  RouterLinkButton,
  SectionTitle,
} from "~/components/ui";
import { Input } from "~/components/ui/input";
import { Search, X, BookOpen, Book, FileText } from "lucide-react";
import type { StorySearchResult } from "~/lib/story-search";

type StorySearchPanelProps = {
  query: string;
  onQueryChange: (value: string) => void;
  results: StorySearchResult[];
};

const KIND_ICONS = {
  tome: BookOpen,
  chapter: Book,
  scene: FileText,
} as const;

export function StorySearchPanel({
  query,
  onQueryChange,
  results,
}: StorySearchPanelProps) {
  const { t } = useTranslation("story");
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  return (
    <Panel>
      <SectionTitle
        title={t("search.title")}
        meta={
          hasQuery
            ? t("search.meta", { count: results.length })
            : t("search.metaEmpty")
        }
        actions={
          hasQuery ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onQueryChange("")}
              className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X size={14} /> {t("search.clear")}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.inputLabel")}
            className="pl-9 pr-10"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onQueryChange("")}
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2 p-0 text-muted-foreground"
              aria-label={t("search.clear")}
            >
              <X size={14} />
            </Button>
          ) : null}
        </div>

        {hasQuery ? (
          results.length > 0 ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-secondary/20 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {t("search.meta", { count: results.length })}
                </span>
                <RouterLinkButton
                  to={results[0].href}
                  variant="secondary"
                  className="h-8 border border-border/70 bg-background/80 px-2.5 text-xs text-foreground hover:border-primary/30 hover:bg-primary/8"
                >
                  {t("search.openFirst")}
                </RouterLinkButton>
              </div>
              {results.map((result) => {
                const KindIcon = KIND_ICONS[result.kind];

                return (
                  <article
                    key={`${result.kind}:${result.id}`}
                    className="rounded-2xl border border-border/70 bg-secondary/20 p-3 transition-colors hover:border-primary/30 hover:bg-secondary/35"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
                        <KindIcon size={16} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="storyline">
                            {t(`search.kinds.${result.kind}`)}
                          </Badge>
                          <h3 className="truncate text-sm font-semibold text-foreground">
                            {result.title}
                          </h3>
                        </div>
                        {result.pathLabel ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {result.pathLabel}
                          </p>
                        ) : null}
                      </div>

                      <RouterLinkButton
                        to={result.href}
                        variant="ghost"
                        className="shrink-0 border border-border/70 bg-background/80 px-2.5 text-xs text-foreground hover:border-primary/30 hover:bg-primary/8 hover:text-primary"
                      >
                        {t("search.open")}
                      </RouterLinkButton>
                    </div>

                    {result.excerpt ? (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {result.excerpt}
                      </p>
                    ) : null}

                    {result.matchedFields.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.matchedFields.map((field) => (
                          <Badge
                            key={`${result.kind}:${result.id}:${field}`}
                            className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]"
                            tone="info"
                          >
                            {t(`search.fields.${field}`)}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={t("search.empty.title")}
              description={t("search.empty.description")}
            />
          )
        ) : (
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border/70 bg-secondary/10 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Search size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {t("search.helper.title")}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("search.helper.description")}
              </p>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
