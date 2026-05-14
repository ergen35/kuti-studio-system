import { QueryClientProvider } from "@tanstack/react-query";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { useEffect } from "react";
import type { Route } from "./+types/root";
import { queryClient } from "~/lib/query";
import { useUiStore } from "~/stores/ui";
import { initI18n } from "~/i18n/config";
import "~/styles/app.css";

// Initialize i18n before app render
void initI18n();

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" },
];

export function meta() {
  return [
    { title: "Kuti Studio" },
    { name: "description", content: "Local-first narrative production workspace" },
  ];
}

function ThemeBridge() {
  const theme = useUiStore((state) => state.theme);
  const density = useUiStore((state) => state.density);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
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
      <ThemeBridge />
      <Outlet />
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = error instanceof Error ? error.message : "Unexpected application error";
  return <main className="mx-auto max-w-[1500px] p-5"><div className="rounded-[7px] border border-danger/45 bg-danger/10 p-4 text-danger"><strong className="text-sm">{message}</strong></div></main>;
}
