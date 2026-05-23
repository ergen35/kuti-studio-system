import { Save, Trash2, X, AlertTriangle } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Button, ErrorState, LoadingState, PageHeader, Panel } from "~/components/ui";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const isConfirmEnabled = inputValue === projectName;

  // Reset input when opened
  useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isLoading, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !isLoading) {
      onClose();
    }
  };

  const handleSubmit = () => {
    if (isConfirmEnabled) {
      onConfirm(inputValue);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      style={{ animation: "fadeIn 0.15s ease-out" }}
    >
      <div
        className="w-full max-w-md rounded-[7px] border border-line bg-surface p-5 shadow-lg"
        style={{ animation: "scaleIn 0.15s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {t('delete.dialogTitle')}
            </h2>
          </div>
        </div>

        {/* Description */}
        <p className="mb-4 text-sm text-muted">
          {t('delete.dialogDescription')}
        </p>

        {/* Project name to confirm */}
        <div className="mb-4 rounded-[7px] bg-surface-2 p-3">
          <span className="text-xs text-muted">{t('fields.name')}:</span>
          <p className="font-medium text-ink">{projectName}</p>
        </div>

        {/* Input */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs text-muted">
            {t('delete.inputLabel')}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('delete.inputPlaceholder')}
            disabled={isLoading}
            className="min-h-9 w-full rounded-[7px] border border-line bg-surface px-2.5 py-2 text-ink outline-none transition-colors focus:border-danger disabled:opacity-50"
          />
          {inputValue && inputValue !== projectName && (
            <p className="mt-1.5 text-xs text-danger">
              {t('delete.errorNameMismatch')}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-[7px] border border-danger/45 bg-danger/10 p-3">
            <p className="text-sm text-danger">{apiErrorMessage(error)}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
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
        </div>
      </div>
    </div>
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

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ProjectSettingsInput>({
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
                <input {...register('name')} />
              </FormField>
              <FormField label={t('fields.status')} error={errors.status}>
                <select {...register('status')}>
                  {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </FormField>
              <FormField label={t('fields.allowedLocations')} error={errors.locations}>
                <input {...register('locations')} placeholder={t('fields.locationsPlaceholder')} />
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
