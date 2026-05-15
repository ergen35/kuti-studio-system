"use client";

import { Sun, Moon } from "lucide-react";
import { useUiStore } from "~/stores/ui";

export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/80 backdrop-blur-sm border border-line/50 hover:border-accent/50 transition-colors"
      title={theme === "light" ? "Passer en mode sombre" : "Passer en mode clair"}
    >
      {theme === "light" ? (
        <>
          <Moon size={14} className="text-accent" />
          <span className="text-xs font-medium text-muted hidden sm:inline">Sombre</span>
        </>
      ) : (
        <>
          <Sun size={14} className="text-warning" />
          <span className="text-xs font-medium text-muted hidden sm:inline">Clair</span>
        </>
      )}
    </button>
  );
}
