import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { $createTextNode } from "lexical";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  PUNCTUATION,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { getReferenceSuggestionsOptions } from "~/lib/backend/@tanstack/react-query.gen";
import { Badge } from "~/components/ui";
import { useTranslation } from "~/hooks/useTranslation";
import {
  buildReferenceToken,
  createReferenceLinkMatcher,
  filterReferenceOptions,
  parseReferenceQuery,
  type ReferenceKind,
  type ReferenceUrlResolver,
  type ReferenceOption,
} from "~/lib/references";

type ReferenceAutocompletePluginProps = {
  projectId: string;
};

type ReferenceAutoLinkPluginProps = {
  resolveReferenceUrl: ReferenceUrlResolver;
};

// Keep `:` inside the trigger match so typing `@chara:` still opens the menu.
const REFERENCE_TRIGGER_PUNCTUATION = PUNCTUATION.replace(":", "");

class ReferenceMenuOption extends MenuOption {
  kind: ReferenceKind;
  syntax: string;
  label: string;
  description: string;
  insertText: string;
  isEntity: boolean;

  constructor(data: {
    kind: ReferenceKind;
    syntax: string;
    label: string;
    description: string;
    insertText: string;
    isEntity: boolean;
  }) {
    super(`${data.kind}:${data.insertText}`);
    this.kind = data.kind;
    this.syntax = data.syntax;
    this.label = data.label;
    this.description = data.description;
    this.insertText = data.insertText;
    this.isEntity = data.isEntity;
    this.title = data.syntax;
  }
}

function buildTypeOptions(filter: string): ReferenceMenuOption[] {
  return filterReferenceOptions(filter).map(
    (option) =>
      new ReferenceMenuOption({
        kind: option.kind,
        syntax: option.syntax,
        label: option.label,
        description: option.description,
        insertText: option.syntax,
        isEntity: false,
      }),
  );
}

function buildEntityOptions(
  suggestions:
    | Array<{
        slug: string;
        label: string;
        href?: string;
        description?: string;
        kind?: ReferenceKind;
      }>
    | undefined,
  kind: ReferenceKind,
): ReferenceMenuOption[] {
  return (suggestions ?? []).map(
    (suggestion) =>
      new ReferenceMenuOption({
        kind,
        syntax: buildReferenceToken(kind, suggestion.slug),
        label: suggestion.label,
        description:
          suggestion.description ?? suggestion.href ?? suggestion.slug,
        insertText: buildReferenceToken(kind, suggestion.slug),
        isEntity: true,
      }),
  );
}

function ReferenceMenu({
  options,
  selectedIndex,
  selectOptionAndCleanUp,
  setHighlightedIndex,
  matchingString,
  emptyMessage,
}: {
  options: Array<ReferenceMenuOption>;
  selectedIndex: number | null;
  selectOptionAndCleanUp: (option: ReferenceMenuOption) => void;
  setHighlightedIndex: (index: number) => void;
  matchingString: string;
  emptyMessage: string;
}) {
  if (options.length === 0) {
    return (
      <div className="reference-menu-shell">
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 px-3 py-5 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="reference-menu-shell">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-border/70 px-2 pb-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            References
          </p>
          <p className="text-xs text-muted-foreground">
            {matchingString ? `@${matchingString}` : "@"}
          </p>
        </div>
        <Badge className="rounded-full px-2">{options.length}</Badge>
      </div>

      <div className="max-h-[320px] overflow-y-auto px-1 pb-1">
        {options.map((option, index) => {
          const isSelected = selectedIndex === index;

          return (
            <button
              type="button"
              key={option.key}
              ref={option.setRefElement}
              aria-selected={isSelected}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectOptionAndCleanUp(option)}
              className={
                isSelected
                  ? "reference-menu-item reference-menu-item-active"
                  : "reference-menu-item"
              }
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <div className="flex items-center gap-2">
                  <span className="reference-menu-syntax">{option.syntax}</span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {option.label}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {option.isEntity ? option.kind : "type"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReferenceAutocompletePlugin({
  projectId,
}: ReferenceAutocompletePluginProps) {
  const { t } = useTranslation("story");
  const [query, setQuery] = useState<string | null>(null);
  const parsed = useMemo(() => parseReferenceQuery(query), [query]);

  const entitySuggestions = useQuery({
    ...getReferenceSuggestionsOptions({
      path: { projectId, type: parsed.kind ?? "" },
      query: { q: parsed.search },
    }),
    enabled: !!projectId && parsed.isEntityQuery && !!parsed.kind,
    staleTime: 30_000,
  });
  const isLoading = entitySuggestions.isFetching && parsed.isEntityQuery;

  const options = useMemo(() => {
    if (parsed.isEntityQuery && parsed.kind) {
      return buildEntityOptions(
        (entitySuggestions.data as
          | Array<{
              slug: string;
              label: string;
              href?: string;
              description?: string;
              kind?: ReferenceKind;
            }>
          | undefined) ?? [],
        parsed.kind,
      );
    }

    const filter = parsed.rawQuery.replace(/^@/, "");
    return buildTypeOptions(filter);
  }, [entitySuggestions.data, parsed]);

  const triggerFn = useBasicTypeaheadTriggerMatch("@", {
    minLength: 0,
    maxLength: 80,
    punctuation: REFERENCE_TRIGGER_PUNCTUATION,
  });

  const onSelectOption = (
    option: ReferenceMenuOption,
    textNodeContainingQuery: any,
    closeMenu: () => void,
  ) => {
    const insertedText = option.insertText;

    textNodeContainingQuery?.replace($createTextNode(insertedText));
    closeMenu();
  };

  return (
    <LexicalTypeaheadMenuPlugin
      options={options}
      triggerFn={triggerFn}
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      preselectFirstItem
      menuRenderFn={(anchorElementRef, itemProps, matchingString) =>
        createPortal(
          <ReferenceMenu
            options={itemProps.options as Array<ReferenceMenuOption>}
            selectedIndex={itemProps.selectedIndex}
            selectOptionAndCleanUp={
              itemProps.selectOptionAndCleanUp as (
                option: ReferenceMenuOption,
              ) => void
            }
            setHighlightedIndex={itemProps.setHighlightedIndex}
            matchingString={matchingString}
            emptyMessage={
              isLoading
                ? t("editor.autocomplete.loading")
                : parsed.rawQuery.trim().length === 0
                  ? t("editor.autocomplete.startTyping")
                  : t("editor.autocomplete.noResults")
            }
          />,
          anchorElementRef.current ?? document.body,
        )
      }
    />
  );
}

export function ReferenceAutoLinkPlugin({
  resolveReferenceUrl,
}: ReferenceAutoLinkPluginProps) {
  const matchers = useMemo(
    () => [createReferenceLinkMatcher(resolveReferenceUrl)],
    [resolveReferenceUrl],
  );

  return <AutoLinkPlugin matchers={matchers} />;
}
