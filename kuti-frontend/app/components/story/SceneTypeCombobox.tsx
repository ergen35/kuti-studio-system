import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "~/components/ui/combobox";
import { listSceneTypesOptions } from "~/lib/backend/@tanstack/react-query.gen";
import { useTranslation } from "~/hooks/useTranslation";
import { client } from "~/lib/backend-client";

type SceneTypeOption = {
  value: string;
  label: string;
};

interface SceneTypeComboboxProps {
  projectId: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function SceneTypeCombobox({
  projectId,
  value,
  onValueChange,
  disabled,
  className,
}: SceneTypeComboboxProps) {
  const { t, i18n } = useTranslation("scene");

  const sceneTypesQuery = useQuery({
    ...listSceneTypesOptions({ client, path: { projectId } }),
    enabled: Boolean(projectId),
  });

  const options = useMemo<SceneTypeOption[]>(() => {
    if (!sceneTypesQuery.data) return [];
    const lang = i18n.language.startsWith("fr") ? "fr" : "en";
    return sceneTypesQuery.data.map((type: { value: string; label: { en: string; fr: string } }) => ({
      value: type.value,
      label: type.label[lang] ?? type.label.en,
    }));
  }, [sceneTypesQuery.data, i18n.language]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value) ?? null;
  }, [options, value]);

  return (
    <Combobox
      value={selectedOption ?? undefined}
      disabled={disabled}
      onValueChange={(option: SceneTypeOption | null) => {
        onValueChange(option?.value ?? "free");
      }}
    >
      <ComboboxInput
        placeholder={t("placeholders.type")}
        disabled={disabled}
        className={className}
      />
      <ComboboxContent>
        <ComboboxList>
          {options.map((option) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
