import { QueryClientProvider } from "@tanstack/react-query";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import type { Route } from "./+types/root";
import { queryClient } from "~/lib/query";
import { useUiStore } from "~/stores/ui";
import { initI18n } from "~/i18n/config";
import { TooltipProvider } from "~/components/ui/tooltip";
import "~/styles/app.css";

// Initialize i18n before app render
void initI18n();

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
  },
];

export function meta() {
  return [
    { title: "Kuti Studio" },
    {
      name: "description",
      content: "Local-first narrative production workspace",
    },
  ];
}

function ThemeBridge() {
  const theme = useUiStore((state) => state.theme);
  const density = useUiStore((state) => state.density);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme, density]);
  return null;
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeBridge />
        <Outlet />
        <Toaster
          position="top-center"
          toastOptions={{
            className: "!bg-surface !text-ink !border !border-line !shadow-lg",
            duration: 3000,
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message =
    error instanceof Error ? error.message : "Unexpected application error";
  const stack = error instanceof Error ? error.stack : null;
  const isDev = import.meta.env.DEV;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-5 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-lg">
        <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-white shadow-xl dark:border-red-900/50 dark:bg-slate-900">
          {/* Decorative gradient bar */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

          <div className="p-8">
            {/* Icon */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg
                className="h-8 w-8 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* Title */}
            <h1 className="mb-2 text-center text-xl font-semibold text-slate-900 dark:text-white">
              Oups, quelque chose s'est mal passé
            </h1>

            {/* Subtitle */}
            <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Une erreur inattendue est survenue. Pas de panique, ça arrive !
            </p>

            {/* Error message */}
            <div className="mb-6 rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
              <p className="font-mono text-sm text-red-700 dark:text-red-300">
                {message}
              </p>
            </div>

            {/* Stack trace (dev only) */}
            {isDev && stack && (
              <details className="mb-6">
                <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                  Voir les détails techniques
                </summary>
                <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {stack}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => window.location.reload()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Rafraîchir la page
              </button>
              <button
                onClick={() => window.history.back()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Retour
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 bg-slate-50 px-8 py-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Si le problème persiste, essayez de vider le cache ou contactez le
              support.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
