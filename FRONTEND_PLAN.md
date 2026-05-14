# Plan Progressif de Construction du Frontend Kuti Studio

Ce document décrit les 10 phases pour construire le frontend complet de Kuti Studio, de la génération du SDK jusqu'à la production.

## Stack Technique Finale

| Couche | Technologie |
|--------|-------------|
| Framework | React Router v7 (SSR désactivé) |
| Build Tool | Vite |
| Design System | Adobe React Spectrum S2 |
| State Server | TanStack Query (React Query) v5 |
| State Client | Zustand |
| SDK API | @hey-api/openapi-ts + Axios |
| Styling | Spectrum S2 CSS + Tailwind pour overrides |
| i18n | React i18next |
| Icons | Spectrum Icons + Heroicons |

---

## Phase 0 : Génération SDK OpenAPI (Jour 1)

### Objectifs
- Générer le SDK TypeScript depuis l'OpenAPI du backend
- Configurer le client HTTP avec Axios
- Tester la connexion backend

### Fichiers créés
```
kuti-frontend/src/api/
├── generated/           # Généré automatiquement
│   ├── types.gen.ts
│   ├── services.gen.ts
│   └── client.gen.ts
├── client.ts           # Configuration Axios
└── index.ts            # Exports publics
```

### Commandes
```bash
# 1. Vérifier que le backend tourne sur localhost:8000
curl http://localhost:8000/api/health

# 2. Générer le SDK
npx @hey-api/openapi-ts -i http://localhost:8000/api/openapi.json -o src/api/generated -c axios

# 3. Ajouter les dépendances
yarn add axios @tanstack/react-query zustand
```

---

## Phase 1 : React Query + Zustand (Jour 1-2)

### Objectifs
- Configurer React Query Provider
- Créer les hooks métier pour chaque entité
- Configurer Zustand pour l'état UI

### Modules à créer

```
kuti-frontend/src/
├── hooks/
│   ├── useProjects.ts      # CRUD projets
│   ├── useCharacters.ts    # CRUD personnages
│   ├── useStory.ts         # Storyline (tomes/chapters/scenes)
│   ├── useAssets.ts        # Assets library
│   ├── useGeneration.ts    # Génération IA
│   ├── useVersions.ts      # Versioning
│   └── useWarnings.ts      # Warnings cohérence
│
└── stores/
    ├── projectStore.ts     # Projet actif, navigation
    ├── uiStore.ts          # Thème, sidebar, modales
    └── editorStore.ts      # État éditeur scène
```

### Pattern React Query à suivre

```typescript
// hooks/useProjects.ts
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects').then(r => r.data),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectCreate) => apiClient.post('/projects', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
}
```

---

## Phase 2 : Adobe React Spectrum S2 + Thème (Jour 2-3)

### Objectifs
- Intégrer React Spectrum S2
- Créer le thème clair/sombre
- Configurer les CSS variables de Kuti

### Installation
```bash
yarn add @react-spectrum/s2 @react-spectrum/provider
```

### Structure
```
kuti-frontend/src/components/
├── providers/
│   └── SpectrumProvider.tsx   # Provider S2 + thème
├── ui/
│   ├── Button.tsx             # Wrapper Spectrum
│   ├── TextField.tsx
│   ├── Dialog.tsx
│   ├── ListBox.tsx
│   └── ...
└── layout/
    ├── Shell.tsx              # Layout principal
    ├── Sidebar.tsx            # Navigation latérale
    └── Header.tsx             # En-tête projet
```

### Thème Kuti (variables CSS)

```css
/* src/styles/kuti-theme.css */
:root {
  --kuti-accent: #7c3aed;
  --kuti-accent-hover: #6d28d9;
  --kuti-sidebar-width: 240px;
  --kuti-header-height: 64px;
}

/* Overrides Spectrum S2 pour l'identité Kuti */
```

---

## Phase 3 : Shell UI + Navigation (Jour 3-4)

### Objectifs
- Créer le layout principal avec sidebar
- Navigation entre les modules projet
- Header avec contexte projet actif

### Routes React Router

```typescript
// routes/_layout.tsx
<Shell>
  <Sidebar />
  <Main>
    <Header />
    <Outlet />
  </Main>
</Shell>

// Routes:
// /                          -> Project Hub
// /projects/:projectId       -> Dashboard
// /projects/:projectId/characters
// /projects/:projectId/story
// /projects/:projectId/generation
// /projects/:projectId/assets
// /projects/:projectId/exports
// /projects/:projectId/settings
// /projects/:projectId/warnings
// /projects/:projectId/versions
```

### Composants Shell

```typescript
// components/layout/Shell.tsx
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar className="w-60" />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
```

### Items de navigation

- 🏠 Dashboard
- 👤 Characters
- 📖 Storyline
- 🎨 Generation
- 🖼️ Assets
- 📦 Exports
- ⚠️ Warnings
- 📜 Versions
- ⚙️ Settings

---

## Phase 4 : Project Hub + Dashboard (Jour 4-5)

### Project Hub (`/`)

**Contenu:**
- Liste des projets (cards ou liste)
- Bouton "New Project"
- Actions: Open, Clone, Archive, Export
- État vide avec CTA

**Composants:**
```
app/routes/_index.tsx
components/projects/
├── ProjectCard.tsx
├── ProjectList.tsx
├── CreateProjectDialog.tsx
└── ProjectActions.tsx
```

### Project Dashboard (`/projects/:projectId`)

**Contenu:**
- Métadonnées du projet
- Cartes vers chaque module
- Dernières activités
- Warnings récents
- Versions récentes

**Composants:**
```
app/routes/projects.$projectId/
├── _layout.tsx
└── _index.tsx
components/dashboard/
├── ProjectHeader.tsx
├── ModuleGrid.tsx
├── RecentWarnings.tsx
└── RecentVersions.tsx
```

---

## Phase 5 : Characters Workspace (Jour 5-6)

### Objectifs
- Liste des personnages avec filtres
- Fiche personnage détaillée
- Relations entre personnages

### Structure

```
routes/projects.$projectId.characters/
├── _layout.tsx
├── _index.tsx              # Liste
└── $characterId.tsx        # Détail

components/characters/
├── CharacterList.tsx       # Liste + filtres
├── CharacterCard.tsx
├── CharacterForm.tsx       # Édition fiche
├── CharacterRelations.tsx  # Graphe/liste relations
└── VoiceSamples.tsx        # Gestion voix
```

### Features

1. **Liste**
   - Grid/list toggle
   - Filtres: statut, tags, rôle narratif
   - Search full-text
   - Tri: nom, date, rôle

2. **Fiche personnage**
   - Onglets: Overview, Relations, Voice, Assets
   - Formulaire inline
   - Preview "carte tarot"

3. **Relations**
   - Tableau des relations
   - Ajout/édition/suppression
   - Intensité (0-100 slider)

---

## Phase 6 : Storyline Workspace (Jour 7-9)

### Objectifs
- Arbre Tome > Chapitre > Scène
- Éditeur de scène avec Markdown
- Métadonnées de scène
- Système de références `@`

### Structure

```
routes/projects.$projectId.story/
├── _layout.tsx
├── _index.tsx
└── scenes.$sceneId.tsx     # /story/scenes/:sceneId

components/story/
├── StoryTree.tsx           # Arbre navigable
├── TomeNode.tsx
├── ChapterNode.tsx
├── SceneNode.tsx
├── SceneEditor.tsx         # Éditeur principal
├── SceneMetaPanel.tsx      # Métadonnées latérales
├── ReferenceAutocomplete.tsx # Autocomplete @
└── ReferencesList.tsx      # Liste des références
```

### Éditeur de Scène

**Composants de l'éditeur:**
- Toolbar (formatage)
- Zone de texte (textarea Markdown)
- Preview toggle
- Autocomplete `@chara:`, `@scene:`, etc.

**Métadonnées à éditer:**
- Intention narrative (textarea)
- Personnages présents (multi-select)
- Lieu (input)
- Durée (input)
- Ton (select: dramatique, humoristique, etc.)
- Rythme (select: lent, moyen, rapide)
- Contraintes visuelles (textarea)
- Notes de mise en scène (textarea)

### Autocomplete `@`

```typescript
// Déclencheurs:
@chara:    -> Personnages
@scene:    -> Scènes
@chapter:  -> Chapitres
@tome:     -> Tomes
@asset:    -> Assets
```

---

## Phase 7 : Generation Studio + Assets (Jour 10-11)

### Generation Studio

```
routes/projects.$projectId.generation/
├── _layout.tsx
├── _index.tsx              # Liste des jobs
├── jobs.$jobId.tsx         # Détail job
└── boards.$boardId.tsx     # Planche générée

components/generation/
├── JobList.tsx
├── JobCard.tsx
├── GenerationForm.tsx      # Formulaire de lancement
├── JobProgress.tsx         # Barre de progression
├── BoardViewer.tsx         # Visualisation planche
└── PanelEditor.tsx         // Édition cases
```

### Features

1. **Nouvelle génération**
   - Source: Scene / Chapter / Tome
   - Stratégie: direct / intermediate
   - Modèle IA sélectionnable
   - Lancement avec confirm

2. **Suivi des jobs**
   - Liste avec statuts
   - Progression en temps réel
   - Logs des étapes

3. **Board générée**
   - Visualisation des cases
   - Réordonnancement
   - Édition captions
   - Validation finale

### Assets Library

```
routes/projects.$projectId.assets/
├── _layout.tsx
├── _index.tsx
└── $assetId.tsx

components/assets/
├── AssetGrid.tsx
├── AssetCard.tsx
├── AssetUploader.tsx
├── AssetDetail.tsx
└── AssetUsage.tsx          // Où l'asset est utilisé
```

---

## Phase 8 : Warnings Center + Version History (Jour 12)

### Warnings Center

```
routes/projects.$projectId.warnings/
├── _layout.tsx
└── _index.tsx

components/warnings/
├── WarningList.tsx
├── WarningFilters.tsx      // Gravité, statut, type
├── WarningCard.tsx
└── WarningDetail.tsx
```

### Version History

```
routes/projects.$projectId.versions/
├── _layout.tsx
├── _index.tsx
└── compare.tsx             // Comparaison

components/versions/
├── VersionList.tsx
├── VersionBranches.tsx
├── VersionCard.tsx
├── CompareView.tsx
└── RestoreConfirm.tsx
```

---

## Phase 9 : Exports + Settings (Jour 13)

### Exports

```
routes/projects.$projectId.exports/
├── _layout.tsx
├── _index.tsx
└── $exportId.tsx

components/exports/
├── ExportList.tsx
├── ExportForm.tsx          // Choix format
├── ExportCard.tsx
└── DownloadButton.tsx
```

### Settings

```
routes/projects.$projectId.settings/
├── _layout.tsx
└── _index.tsx

components/settings/
├── SettingsForm.tsx
├── GenerationSettings.tsx
├── WarningSettings.tsx
└── ExportSettings.tsx
```

---

## Phase 10 : i18n + Polish (Jour 14)

### i18n Setup

```bash
yarn add react-i18next i18next
```

```
src/i18n/
├── index.ts
├── config.ts
├── en.ts                     # Traductions EN
└── fr.ts                     # Traductions FR
```

### Features finales

- [ ] Switch langue EN/FR
- [ ] Switch thème clair/sombre
- [ ] États de chargement partout
- [ ] États vides avec CTA
- [ ] Gestion erreurs API
- [ ] Toasts/notifications
- [ ] Raccourcis clavier
- [ ] Responsive mobile (minimal)

---

## Dépendances à installer (résumé)

```bash
# Core
yarn add @react-spectrum/s2 @react-spectrum/provider

# State
yarn add @tanstack/react-query zustand

# API
yarn add axios @hey-api/openapi-ts

# Utils
yarn add react-i18next i18next date-fns clsx tailwind-merge

# Dev
yarn add -D @types/react @types/react-dom
```

---

## Ordre d'implémentation recommandé

1. Jour 1: ✅ Backend tourne → Génération SDK → React Query config
2. Jour 2: ✅ Zustand stores → Spectrum S2 install → Thème
3. Jour 3: ✅ Shell layout → Navigation sidebar
4. Jour 4: ✅ Project Hub → Project Dashboard
5. Jour 5: ✅ Characters (liste + fiche)
6. Jour 6: ✅ Characters (relations)
7. Jour 7: ✅ Storyline (arbre tome/chapter/scene)
8. Jour 8: ✅ Storyline (éditeur scène)
9. Jour 9: ✅ Storyline (références @, métadonnées)
10. Jour 10: ✅ Generation Studio
11. Jour 11: ✅ Assets Library
12. Jour 12: ✅ Warnings Center + Versions
13. Jour 13: ✅ Exports + Settings
14. Jour 14: ✅ i18n + Polish final

---

## Livrables par phase

| Phase | Livrable testable |
|-------|-------------------|
| 0 | SDK généré, `useProjects` fonctionnel |
| 1 | Tous les hooks API prêts |
| 2 | Page vierge mais avec thème Spectrum S2 |
| 3 | Navigation sidebar fonctionnelle |
| 4 | Créer/ouvrir projet, voir dashboard |
| 5 | CRUD personnages complet |
| 6 | Ajouter/editer/supprimer scènes |
| 7 | Lancer une génération, voir résultat |
| 8 | Voir warnings et versions |
| 9 | Faire un export |
| 10 | Switch FR/EN, thème, erreurs gérées |
