import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FieldError, Merge } from "react-hook-form";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "~/components/ui/combobox";
import { FormField } from "~/components/FormField";
import { useTranslation } from "~/hooks/useTranslation";
import {
  PREDEFINED_NARRATIVE_ROLES,
  mergeNarrativeRoleCatalog,
  resolveNarrativeRoleCode,
} from "~/lib/narrative-roles";
import { listNarrativeRoles } from "~/lib/narrative-roles-api";

type NarrativeRoleOption = {
  code: string;
  label: string;
};

interface NarrativeRoleComboboxProps {
  projectId: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: FieldError | Merge<FieldError, (FieldError | undefined)[]>;
  disabled?: boolean;
  resetKey?: string;
}

export function NarrativeRoleCombobox({
  projectId,
  value,
  onValueChange,
  error,
  disabled,
  resetKey,
}: NarrativeRoleComboboxProps) {
  const { t } = useTranslation("characters");

  const rolesQuery = useQuery({
    queryKey: ["narrativeRoles", projectId],
    queryFn: () => listNarrativeRoles(projectId),
    enabled: Boolean(projectId),
  });

  const options = useMemo<NarrativeRoleOption[]>(() => {
    const roles = mergeNarrativeRoleCatalog(rolesQuery.data ?? []);
    return roles.map((role) => ({ code: role.code, label: role.label }));
  }, [rolesQuery.data]);

  const defaultSelectedValue = useMemo(() => {
    const code = resolveNarrativeRoleCode(value, options);
    if (!code) {
      return null;
    }

    return options.find((option) => option.code === code) ?? null;
  }, [options, value]);

  const predefinedOptions = useMemo(
    () =>
      options.filter((option) =>
        PREDEFINED_NARRATIVE_ROLES.some((role) => role.code === option.code),
      ),
    [options],
  );

  const customOptions = useMemo(
    () => options.filter(
      (option) =>
        !PREDEFINED_NARRATIVE_ROLES.some((role) => role.code === option.code),
    ),
    [options],
  );

  return (
    <FormField label={t("fields.narrativeRole")} error={error}>
      <Combobox
        key={resetKey ?? projectId}
        defaultValue={defaultSelectedValue ?? undefined}
        disabled={disabled}
        onValueChange={(option) => {
          onValueChange(option?.label ?? "");
        }}
        onInputValueChange={(inputValue) => {
          onValueChange(inputValue);
        }}
      >
        <ComboboxInput
          placeholder={t("fields.narrativeRole")}
          disabled={disabled}
          showClear
        />
        <ComboboxContent>
          <ComboboxList>
            <ComboboxGroup>
              <ComboboxLabel>Predefined</ComboboxLabel>
              {predefinedOptions.map((option) => (
                <ComboboxItem key={option.code} value={option}>
                  {option.label}
                </ComboboxItem>
              ))}
            </ComboboxGroup>

            {customOptions.length > 0 && (
              <>
                <ComboboxGroup>
                  <ComboboxLabel>Custom</ComboboxLabel>
                  {customOptions.map((option) => (
                    <ComboboxItem key={option.code} value={option}>
                      {option.label}
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
              </>
            )}

            <ComboboxEmpty>
              {t("createModal.rolePlaceholder")}
              <div className="mt-1 text-xs text-muted-foreground">
                New values are saved as custom roles when you submit.
              </div>
            </ComboboxEmpty>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </FormField>
  );
}
