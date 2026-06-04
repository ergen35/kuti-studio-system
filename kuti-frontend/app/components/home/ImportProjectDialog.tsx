"use client";

import { FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useTranslation } from "~/hooks/useTranslation";

function suggestProjectName(rootPath: string): string {
  const trimmed = rootPath.trim().replace(/[\\/]+$/, "");
  if (!trimmed) return "";

  const parts = trimmed.split(/[\\/]/);
  const baseName = parts[parts.length - 1] ?? "";

  return baseName
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

interface ImportProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { rootPath: string; name?: string }) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ImportProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  error,
}: ImportProjectDialogProps) {
  const { t } = useTranslation("home");
  const [rootPath, setRootPath] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setRootPath("");
    setName("");
    setNameTouched(false);
  }, [open]);

  useEffect(() => {
    if (!open || nameTouched) {
      return;
    }

    setName(suggestProjectName(rootPath));
  }, [nameTouched, open, rootPath]);

  const canSubmit = rootPath.trim().length > 0 && !isLoading;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) =>
        !nextOpen && !isLoading && onOpenChange(false)
      }
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex-row items-start gap-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FolderOpen size={18} />
          </div>
          <div>
            <DialogTitle>{t("importProject.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("importProject.dialogDescription")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) return;

            onSubmit({
              rootPath: rootPath.trim(),
              name: name.trim() || undefined,
            });
          }}
        >
          <label
            className="grid gap-1.5 text-sm text-foreground"
            htmlFor="import-project-root-path"
          >
            <span>{t("importProject.rootPath")}</span>
            <Input
              id="import-project-root-path"
              value={rootPath}
              onChange={(event) => setRootPath(event.target.value)}
              placeholder={t("importProject.rootPathPlaceholder")}
              disabled={isLoading}
              autoFocus
            />
            <span className="text-xs text-muted-foreground">
              {t("importProject.rootPathHint")}
            </span>
          </label>

          <label
            className="grid gap-1.5 text-sm text-foreground"
            htmlFor="import-project-name"
          >
            <span>{t("importProject.name")}</span>
            <Input
              id="import-project-name"
              value={name}
              onChange={(event) => {
                setNameTouched(true);
                setName(event.target.value);
              }}
              placeholder={t("importProject.namePlaceholder")}
              disabled={isLoading}
            />
            <span className="text-xs text-muted-foreground">
              {t("importProject.nameHint")}
            </span>
          </label>

          {error ? (
            <p className="rounded-[7px] border border-danger/30 bg-danger/8 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {t("importProject.cancelButton")}
            </Button>
            <Button variant="primary" type="submit" disabled={!canSubmit}>
              {isLoading
                ? t("importProject.confirming")
                : t("importProject.confirmButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
