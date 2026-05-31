# Frontend - React Router 7

Documentation du frontend Kuti Studio construit avec React Router 7, TanStack Query et shadcn/ui.

## Organisation des routes

Le frontend utilise React Router 7 en framework mode avec `app/routes.ts` :

```typescript
// routes.ts
import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  // Page d'accueil (Project Hub)
  index("routes/home.tsx"),

  // Routes projet
  route("projects/:projectId", "routes/project.tsx"),
  route("projects/:projectId/characters", "routes/characters.tsx"),
  route("projects/:projectId/characters/:characterId", "routes/character.tsx"),
  route("projects/:projectId/story", "routes/story.tsx"),
  route("projects/:projectId/story/:tomeId", "routes/tome.tsx"),
  route("projects/:projectId/story/:tomeId/chapters/:chapterId", "routes/chapter.tsx"),
  route("projects/:projectId/story/:tomeId/scenes/:sceneId", "routes/scene.tsx"),
  route("projects/:projectId/assets", "routes/assets.tsx"),
  route("projects/:projectId/generation", "routes/generation.tsx"),
  route("projects/:projectId/drama-videos", "routes/drama-videos.tsx"),
  route("projects/:projectId/tasks", "routes/tasks.tsx"),
  route("projects/:projectId/exports", "routes/exports.tsx"),
  route("projects/:projectId/versions", "routes/versions.tsx"),
  route("projects/:projectId/warnings", "routes/warnings.tsx"),
  route("projects/:projectId/settings", "routes/settings.tsx"),
] satisfies RouteConfig;
```

### Structure des routes

| Route | Fichier | Description |
|-------|---------|-------------|
| `/` | `home.tsx` | Project Hub - liste des projets |
| `/projects/:projectId` | `project.tsx` | Dashboard projet |
| `/projects/:projectId/characters` | `characters.tsx` | Liste personnages |
| `/projects/:projectId/characters/:characterId` | `character.tsx` | Détail personnage |
| `/projects/:projectId/story` | `story.tsx` | Vue d'ensemble storyline |
| `/projects/:projectId/story/:tomeId` | `tome.tsx` | Détail tome |
| `/projects/:projectId/story/:tomeId/chapters/:chapterId` | `chapter.tsx` | Détail chapitre |
| `/projects/:projectId/story/:tomeId/scenes/:sceneId` | `scene.tsx` | Éditeur de scène |
| `/projects/:projectId/assets` | `assets.tsx` | Bibliothèque médias |
| `/projects/:projectId/generation` | `generation.tsx` | Studio génération IA |
| `/projects/:projectId/drama-videos` | `drama-videos.tsx` | Bibliothèque vidéos drama |
| `/projects/:projectId/tasks` | `tasks.tsx` | Suivi des tâches |
| `/projects/:projectId/exports` | `exports.tsx` | Exports |
| `/projects/:projectId/versions` | `versions.tsx` | Historique versions |
| `/projects/:projectId/warnings` | `warnings.tsx` | Centre warnings |
| `/projects/:projectId/settings` | `settings.tsx` | Paramètres projet |

## Gestion d'état

### Server State - TanStack Query

Configuration dans `app/lib/query.ts` :

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s avant refetch
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

Utilisation avec le SDK généré :

```typescript
// Lire des données
import { useQuery } from "@tanstack/react-query";
import { listProjectsOptions } from "~/lib/backend/@tanstack/react-query.gen";

function ProjectsList() {
  const { data, isLoading, error } = useQuery(listProjectsOptions());

  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error.message} />;

  return <ProjectCards projects={data?.projects || []} />;
}

// Mutations avec invalidation
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProjectMutation, listProjectsQueryKey } from "~/lib/backend/@tanstack/react-query.gen";

function CreateProjectButton() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...createProjectMutation(),
    onSuccess: () => {
      // Invalide le cache pour recharger la liste
      queryClient.invalidateQueries({
        queryKey: listProjectsQueryKey(),
      });
    },
  });

  return (
    <Button onClick={() => mutation.mutate({ body: { name: "Nouveau projet" } })}>
      Créer un projet
    </Button>
  );
}
```

### Client State - Zustand

Configuration dans `app/stores/ui.ts` :

```typescript
import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  language: "fr" | "en";

  // Actions
  toggleSidebar: () => void;
  setTheme: (theme: UIState["theme"]) => void;
  setLanguage: (lang: UIState["language"]) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: "system",
  language: "en",

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
}));
```

Utilisation :

```typescript
import { useUIStore } from "~/stores/ui";

function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <aside className={sidebarOpen ? "w-64" : "w-16"}>
      <button onClick={toggleSidebar}>Toggle</button>
    </aside>
  );
}
```

## Système de composants

### shadcn/ui

Les composants UI de base proviennent de shadcn/ui. Les primitives générées vivent dans `app/components/ui/`; `app/components/ui.tsx` sert de façade de compatibilité temporaire pour les anciens imports métier.

```typescript
// Exemple d'utilisation
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

function Dashboard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mon Projet</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs>
          <TabsList>
            <TabsTrigger value="scenes">Scènes</TabsTrigger>
            <TabsTrigger value="characters">Personnages</TabsTrigger>
          </TabsList>
          <TabsContent value="scenes">...</TabsContent>
          <TabsContent value="characters">...</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

### Composants métier

Les composants spécifiques au domaine sont organisés par fonction :

```
app/components/
├── characters/           # Composants personnages
│   ├── CharacterCard.tsx
│   ├── CharacterDetailModal.tsx
│   ├── CharacterImageGallery.tsx
│   └── GenerationPanelGrid.tsx
├── editor/              # Éditeur lexical
│   ├── LexicalEditor.tsx
│   └── EditorToolbar.tsx
├── home/                # Page d'accueil
│   ├── HeroSection.tsx
│   ├── ProjectCard.tsx
│   └── MinimalBackendStatus.tsx
├── scene/               # Composants scènes
│   ├── SceneGenerationModal.tsx
│   ├── SceneMangaGallery.tsx
│   └── CharacterImageSelector.tsx
├── story/               # Composants storyline
│   ├── StoryBreadcrumb.tsx
│   ├── TomeCard.tsx
│   └── TomeCardGrid.tsx
├── ui.tsx               # façade compatibilité UI
└── ui/                  # primitives shadcn/ui générées
```

## Internationalisation (i18n)

### Configuration

Fichiers de traduction dans `app/locales/` :

```
locales/
├── en/
│   ├── common.json
│   ├── home.json
│   ├── project.json
│   ├── characters.json
│   ├── story.json
│   ├── generation.json
│   ├── assets.json
│   ├── exports.json
│   ├── versions.json
│   ├── warnings.json
│   ├── settings.json
│   └── tasks.json
└── fr/
    └── ... (mêmes fichiers)
```

### Utilisation

```typescript
// Hook personnalisé
import { useTranslation } from "~/hooks/useTranslation";

function ProjectCard({ project }: { project: Project }) {
  const { t } = useTranslation("project");

  return (
    <div>
      <h3>{project.name}</h3>
      <p>{t("status", { status: project.status })}</p>
      <p>{t("lastOpened", { date: project.lastOpenedAt })}</p>
    </div>
  );
}
```

Fichier de traduction `fr/project.json` :

```json
{
  "status": "Statut : {{status}}",
  "lastOpened": "Dernier accès : {{date}}"
}
```

### LanguageSwitcher

```typescript
import { LanguageSwitcher } from "~/components/LanguageSwitcher";

function Header() {
  return (
    <header>
      <LanguageSwitcher />
    </header>
  );
}
```

## Génération du SDK API

Le client API est généré automatiquement depuis l'OpenAPI du backend.

### Configuration (`openapi-ts.config.ts`)

```typescript
import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "http://localhost:8000/openapi/api-doc.json",
  output: {
    path: "app/lib/backend",
    clean: true,
  },
  plugins: [
    "zod",
    "@hey-api/typescript",
    "@hey-api/client-fetch",
    "@hey-api/sdk",
    "@tanstack/react-query",
    "@hey-api/schemas",
  ],
});
```

### Commande

```bash
yarn api:generate
```

### Fichiers générés

| Fichier | Description |
|---------|-------------|
| `@tanstack/react-query.gen.ts` | Options queries/mutations à utiliser par défaut |
| `sdk.gen.ts` | Fonctions API brutes réservées aux wrappers dédiés |
| `types.gen.ts` | Types TypeScript |
| `zod.gen.ts` | Schémas Zod pour formulaires |

Les composants ne doivent pas importer directement `client.gen`. Le client fetch est centralisé dans `~/lib/backend-client`.

> **Important** : Ne jamais modifier les fichiers `*.gen.ts`. Les régénérer après chaque changement backend.

## Authentification Better Auth

### Client

Configuration dans `app/lib/backend-client.ts` :

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_KUTI_API_URL,
});

export type Session = typeof authClient.Infer.Session;
```

### Utilisation

```typescript
// Lire la session
const { data: session, isPending } = authClient.useSession();

// Connexion
await authClient.signIn.email({
  email: "user@example.com",
  password: "password",
});

// Déconnexion
await authClient.signOut();
```

## Providers globaux

Configuration dans `app/root.tsx` :

```typescript
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { Outlet } from "react-router";
import { i18n } from "~/i18n";
import { queryClient } from "~/lib/query";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <Outlet />
      </I18nextProvider>
    </QueryClientProvider>
  );
}
```

## Commandes utiles

```bash
# Développement
yarn dev                   # Démarrer le serveur

# Build
yarn build                 # Build de production
yarn preview               # Prévisualiser le build

# Génération
yarn api:generate            # Regénérer le SDK API

# Validation
yarn typecheck             # Vérifier les types
yarn lint                  # Linter ESLint
```
