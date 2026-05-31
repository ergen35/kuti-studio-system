import { Save, Trash2, X, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Button, ErrorState, LoadingState, PageHeader, Panel } from "~/components/ui";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { FormField } from "~/components/FormField";
import { apiErrorMessage } from "~/lib/errors";
import { csv } from "~/lib/utils";
import type { Project } from "~/lib/backend/types.gen";
import { getProjectOptions, updateProjectMutation, deleteProjectMutation } from "~/lib/backend/@tanstack/react-query.gen";
import { projectSettingsSchema, type ProjectSettingsInput } from "~/lib/schemas";

// ============================================================================
// Delete Confirmation Modal
// ============================================================================

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (confirmedName: string) => void;
  projectName: string;
  isLoading: boolean;
  error?: Error | null;
}

function DeleteProjectModal({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  isLoading,
  error,
}: DeleteProjectModalProps) {
  const { t } = useTranslation('settings');
  const [inputValue, setInputValue] = useState("");

  const isConfirmEnabled = inputValue === projectName;

  useEffect(() => {
    if (isOpen) {
      setInputValue("");
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (isConfirmEnabled) {
      onConfirm(inputValue);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex-row items-start gap-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10">
            <AlertTriangle className="text-danger" />
          </div>
          <div>
            <DialogTitle>{t('delete.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('delete.dialogDescription')}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="mb-4 rounded-[7px] bg-surface-2 p-3">
          <span className="text-xs text-muted">{t('fields.name')}:</span>
          <p className="font-medium text-ink">{projectName}</p>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs text-muted" htmlFor="delete-project-name">
            {t('delete.inputLabel')}
          </label>
          <Input
            id="delete-project-name"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('delete.inputPlaceholder')}
            disabled={isLoading}
            autoFocus
          />
          {inputValue && inputValue !== projectName && (
            <p className="mt-1.5 text-xs text-danger">
              {t('delete.errorNameMismatch')}
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{apiErrorMessage(error)}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('delete.cancelButton')}
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            disabled={!isConfirmEnabled || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t('delete.confirmButton')}
              </span>
            ) : (
              <>
                <Trash2 size={16} />
                {t('delete.confirmButton')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Settings Route
// ============================================================================

export default function SettingsRoute() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['settings', 'common']);
  const queryClient = useQueryClient();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const project = useQuery({
    ...getProjectOptions({ path: { projectId: projectId } }),
    enabled: !!projectId,
  });

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<ProjectSettingsInput>({
    resolver: zodResolver(projectSettingsSchema),
    defaultValues: { name: '', status: 'draft', locations: '' },
  });

  useEffect(() => {
    if (project.data) {
      const raw = project.data.settingsJson?.locationsJson as string[] | undefined;
      reset({
        name: project.data.name,
        status: project.data.status as Project['status'],
        locations: Array.isArray(raw) ? raw.join(", ") : '',
      });
    }
  }, [project.data, reset]);

  const update = useMutation({
    ...updateProjectMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getProject"] });
      queryClient.invalidateQueries({ queryKey: ["listProjects"] });
    }
  });

  const onSubmit = (data: ProjectSettingsInput) => update.mutate({
    path: { projectId: projectId },
    body: {
      name: data.name || project.data?.name,
      status: data.status,
      settingsJson: { ...(project.data?.settingsJson || {}), locationsJson: csv(data.locations || '') }
    }
  });

  const deleteProject = useMutation({
    ...deleteProjectMutation(),
    onSuccess: () => {
      // Invalidate projects list and redirect to home
      queryClient.invalidateQueries({ queryKey: ["listProjects"] });
      navigate("/");
    }
  });

  const handleDeleteConfirm = (confirmedName: string) => {
    deleteProject.mutate({
      path: { projectId: projectId },
      body: { confirmedName }
    });
  };

  const statusOptions = [
    { value: "draft", label: t('common:status.draft') },
    { value: "active", label: t('common:status.active') },
    { value: "archived", label: t('common:status.archived') },
    { value: "maintenance", label: t('common:status.maintenance') },
  ];
  const statusValue = watch('status');

  return (
    <AppShell>
      <PageHeader title={t('title')} description={t('description')} />
      {project.isLoading ? <LoadingState /> : null}
      {project.error ? <ErrorState message={apiErrorMessage(project.error)} /> : null}
      {project.data ? (
        <>
          {/* Settings Form */}
          <Panel>
            <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
              <FormField label={t('fields.name')} error={errors.name}>
                <Input {...register('name')} />
              </FormField>
              <FormField label={t('fields.status')} error={errors.status}>
                <Select value={statusValue} onValueChange={(value) => setValue('status', value as Project['status'], { shouldDirty: true, shouldValidate: true })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {statusOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t('fields.allowedLocations')} error={errors.locations}>
                <Input {...register('locations')} placeholder={t('fields.locationsPlaceholder')} />
              </FormField>
              <Button variant="primary" disabled={isSubmitting || update.isPending}>
                <Save size={16} /> {t('actions.save')}
              </Button>
              {update.error ? <ErrorState message={apiErrorMessage(update.error)} /> : null}
            </form>
          </Panel>

          {/* Danger Zone */}
          <div className="mt-6">
            <Panel className="border-danger/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-danger">
                    <AlertTriangle size={16} />
                    {t('delete.sectionTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {t('delete.sectionDescription')}
                  </p>
                </div>
                <Button
                  variant="danger"
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  <Trash2 size={16} />
                  {t('delete.buttonLabel')}
                </Button>
              </div>
            </Panel>
          </div>
        </>
      ) : null}

      {/* Delete Confirmation Modal */}
      <DeleteProjectModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        projectName={project.data?.name || ""}
        isLoading={deleteProject.isPending}
        error={deleteProject.error}
      />

      {/* Animation styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </AppShell>
  );
}
