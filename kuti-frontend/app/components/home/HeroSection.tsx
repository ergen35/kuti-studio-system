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
    <section className="relative overflow-hidden rounded-2xl border border-line/50 bg-surface shadow-elevated">
      <div className="grid gap-8 p-8 md:grid-cols-[1fr_auto] md:p-10">
        <div className="min-w-0">
          <div className="mb-5 inline-flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Sparkles size={24} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-ink md:text-5xl">
            Kuti Studio
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            {t("hero.subtitle")}
          </p>
        </div>

        <div className="min-w-0 md:w-[440px] md:self-end">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 sm:flex-row"
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
              className="min-h-12 flex-1 rounded-xl px-4 text-base"
              disabled={isLoading}
            />
            <Button
              variant="primary"
              type="submit"
              disabled={isLoading || !projectName.trim()}
              className="min-h-12 rounded-xl px-6 text-base"
            >
              <Plus size={20} className="mr-2" />
              {isLoading ? t("hero.creating") : t("hero.create")}
            </Button>
          </form>

          {onOpenExisting ? (
            <div className="mt-4 flex items-center justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={onOpenExisting}
                className="gap-2 text-xs text-muted hover:text-ink"
              >
                <FolderOpen size={14} />
                {t("hero.openExisting")}
              </Button>
            </div>
          ) : null}

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        </div>
      </div>
      {/* Spectrum 2 style accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
    </section>
  );
}
