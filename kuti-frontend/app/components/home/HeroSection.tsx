"use client";

import { FolderOpen, Plus, Sparkles } from "lucide-react";
import { Button } from "~/components/ui";
import { Input } from "~/components/ui/input";
import { useTranslation } from "~/hooks/useTranslation";

interface HeroSectionProps {
  projectName: string;
  onProjectNameChange: (value: string) => void;
  onSubmit: () => void;
  onOpenExisting?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function HeroSection({
  projectName,
  onProjectNameChange,
  onSubmit,
  onOpenExisting,
  isLoading,
  error,
}: HeroSectionProps) {
  const { t } = useTranslation("home");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectName.trim()) {
      onSubmit();
    }
  };

  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
        <div className="min-w-0">
          <div className="mb-4 inline-flex size-10 items-center justify-center rounded-md border border-border bg-secondary text-primary">
            <Sparkles size={20} />
          </div>
          <h1 className="text-4xl font-semibold tracking-normal text-foreground md:text-5xl">
            Kuti Studio
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            {t("hero.subtitle")}
          </p>
        </div>

        <div className="min-w-0 md:w-[420px] md:self-end">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <label htmlFor="home-project-name" className="sr-only">
              {t("hero.projectNameLabel")}
            </label>
            <Input
              id="home-project-name"
              type="text"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder={t("hero.placeholder")}
              className="min-h-12 flex-1 px-4"
              disabled={isLoading}
            />
            <Button
              variant="primary"
              type="submit"
              disabled={isLoading || !projectName.trim()}
              className="min-h-12 px-6"
            >
              <Plus size={20} className="mr-2" />
              {isLoading ? t("hero.creating") : t("hero.create")}
            </Button>
          </form>

          {onOpenExisting ? (
            <div className="mt-3 flex items-center justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={onOpenExisting}
                className="gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <FolderOpen size={14} />
                {t("hero.openExisting")}
              </Button>
            </div>
          ) : null}

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      </div>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
    </section>
  );
}
