import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "~/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  completeStoryFieldMutation,
  listStoryCompletionModelsOptions,
} from "~/lib/backend/@tanstack/react-query.gen";
import type { CompleteStoryFieldData, ListStoryCompletionModelsResponse } from "~/lib/backend";
import { useTranslation } from "~/hooks/useTranslation";

type CompletionField = CompleteStoryFieldData["body"]["field"];
type CompletionTargetKind = CompleteStoryFieldData["body"]["targetKind"];

export function StoryCompletionButton({
  projectId,
  targetKind,
  targetId,
  field,
  currentValue,
  instruction,
  onComplete,
}: {
  projectId: string;
  targetKind: CompletionTargetKind;
  targetId: string;
  field: CompletionField;
  currentValue?: string;
  instruction?: string;
  onComplete: (text: string) => void;
}) {
  const { t } = useTranslation("story");
  const [modelKey, setModelKey] = useState<string>("");

  const modelsQuery = useQuery({
    ...listStoryCompletionModelsOptions({ path: { projectId } }),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const models = useMemo(() => {
    const items: ListStoryCompletionModelsResponse = modelsQuery.data ?? [];
    return items.filter((model) => model.enabled && model.configured);
  }, [modelsQuery.data]);

  const selectedModelKey = modelKey || models[0]?.key || "";

  const completion = useMutation({
    ...completeStoryFieldMutation(),
    onSuccess: (result) => {
      if (result?.text) onComplete(result.text);
    },
  });

  const runCompletion = () => {
    completion.mutate({
      path: { projectId },
      body: {
        targetKind,
        targetId,
        field,
        currentValue,
        instruction,
        modelKey: selectedModelKey || undefined,
      },
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      {models.length > 1 ? (
        <Select value={selectedModelKey} onValueChange={setModelKey}>
          <SelectTrigger size="sm" className="h-7 max-w-36 text-xs" title={t("completion.model") }>
            <SelectValue placeholder={t("completion.model")} />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.key} value={model.key}>
                {model.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="size-7 border border-primary/25 bg-primary/10 p-0 text-primary hover:bg-primary/15"
        onClick={runCompletion}
        disabled={completion.isPending || modelsQuery.isLoading || !projectId || !targetId}
        title={completion.error ? t("completion.error") : t("completion.generate")}
      >
        {completion.isPending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
      </Button>
    </div>
  );
}
