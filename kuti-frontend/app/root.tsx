import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { darkTheme, defaultTheme, Provider, SSRProvider } from "@adobe/react-spectrum";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";
import { AppShell } from "./components/layout/app-shell";
import { queryClient } from "./lib/query";
import { Button, Card, EmptyState } from "./components/ui";
import { useUiStore } from "./stores/ui";
import "./styles/app.css";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f3efe8" />
        <Meta />
        <Links />
      </head>
      <body className="h-full antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function meta() {
  return [
    { title: "Kuti Studio" },
    { name: "description", content: "Local narrative production workspace for Kuti Studio." },
  ];
}

export default function App() {
  const { theme, density } = useUiStore();

  return (
    <SSRProvider>
      <QueryClientProvider client={queryClient}>
        <Provider
          theme={theme === "dark" ? darkTheme : defaultTheme}
          colorScheme={theme}
          defaultColorScheme="light"
          scale={density === "compact" ? "medium" : "large"}
        >
          <AppShell>
            <Outlet />
          </AppShell>
        </Provider>
      </QueryClientProvider>
    </SSRProvider>
  );
}

export function HydrateFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md space-y-3 text-center">
        <div className="text-[11px] uppercase tracking-[0.28em] text-[rgb(var(--muted-foreground))]">Kuti Studio</div>
        <div className="text-2xl font-semibold tracking-tight">Loading workspace</div>
        <p className="text-sm leading-6 text-[rgb(var(--muted-foreground))]">Preparing the local editorial workspace and restoring your interface state.</p>
      </Card>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <EmptyState
          title={`${error.status} ${error.statusText}`}
          description={typeof error.data === "string" ? error.data : "The application route failed to load."}
          action={<Button onClick={() => window.location.assign("/")}>Return to hub</Button>}
        />
      </div>
    );
  }

  const message = error instanceof Error ? error.message : "An unexpected error occurred.";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <EmptyState
        title="Application error"
        description={message}
        action={<Button onClick={() => window.location.assign("/")}>Return to hub</Button>}
      />
    </div>
  );
}
