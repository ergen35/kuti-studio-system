"use client";

import { Sun, Moon } from "lucide-react";
import { Button } from "~/components/ui";
import { useTranslation } from "~/hooks/useTranslation";
import { useUiStore } from "~/stores/ui";

export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const { t } = useTranslation('home');

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={toggleTheme}
      className="rounded-full bg-surface/95"
      title={theme === "light" ? t('theme.darkTitle') : t('theme.lightTitle')}
    >
      {theme === "light" ? (
        <>
          <Moon size={14} className="text-accent" />
          <span className="text-xs font-medium text-muted hidden sm:inline">{t('theme.dark')}</span>
        </>
      ) : (
        <>
          <Sun size={14} className="text-warning" />
          <span className="text-xs font-medium text-muted hidden sm:inline">{t('theme.light')}</span>
        </>
      )}
    </Button>
  );
}
