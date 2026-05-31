# Plan de correction des inconsistances Kuti Studio

## Summary
- Livrer en phases validables avec rupture nette : tous les contrats publics passent en `camelCase`, sans fallback `snake_case`.
- Garder les noms de colonnes PostgreSQL via Prisma `@map(...)`; la contrainte `camelCase` concerne DTO, OpenAPI, SDK, frontend, formulaires et docs.
- Initialiser officiellement shadcn dans `kuti-frontend` avec `yarn`, puis migrer tous les écrans vers des composants shadcn réels.
- Standardiser dark/light mode et i18n sur toutes les pages avant mise à jour documentaire.

## Key Changes
- **Contrats API / OpenAPI**
  - Auditer tous les DTO backend et garantir que `body`, `query`, `params`, `response` exposent uniquement des clés `camelCase`.
  - Renommer les schemas/frontend form models restants : `source_path` -> `sourcePath`, `narrative_role` -> `narrativeRole`, `characters_json` -> `charactersJson`, `model_key` -> `modelKey`, etc.
  - Supprimer les helpers frontend de compatibilité `root_path || rootPath` et tous les `@ts-expect-error` liés aux anciens shapes.
  - Régénérer le SDK avec `cd kuti-frontend && yarn api:generate`.

- **Usage SDK OpenAPI**
  - Utiliser par défaut `~/lib/backend/@tanstack/react-query.gen` pour les queries/mutations.
  - Réserver `sdk.gen` aux cas non couverts par les hooks générés, et l’encapsuler dans des helpers dédiés si nécessaire.
  - Importer les types depuis `~/lib/backend/types.gen` ou `~/lib/backend` de manière cohérente, sans types locaux divergents pour les payloads API.
  - Centraliser le client fetch via `~/lib/backend-client`; éviter les imports directs de `client.gen` dans les composants.

- **shadcn / UI**
  - Initialiser shadcn dans `kuti-frontend` avec `yarn dlx shadcn@latest init`, Tailwind v4, alias `~/`, et composants source dans `app/components/ui`.
  - Ajouter au minimum : `button`, `card`, `badge`, `input`, `textarea`, `select`, `dialog`, `sheet`, `table`, `dropdown-menu`, `tabs`, `breadcrumb`, `separator`, `skeleton`, `alert`, `avatar`, `tooltip`, `toggle-group`, `checkbox`, `progress`.
  - Remplacer les wrappers maison de `components/ui.tsx`, `FormField`, modals custom, side sheets custom, tables custom, selects custom et boutons raw par des compositions shadcn.
  - Les composants métier restent, mais doivent être composés avec shadcn primitives.

- **Theme et traductions**
  - Passer le dark mode sur convention shadcn `.dark` au niveau `document.documentElement`, en gardant Zustand/localStorage.
  - Définir les tokens shadcn dans `app/styles/app.css` et conserver temporairement des aliases CSS si nécessaire pendant migration.
  - Supprimer les chaînes visibles hardcodées en FR/EN dans routes et composants.
  - Ajouter les namespaces manquants, notamment `tasks`, et compléter `home`, `story`, `characters`, `generation`, `scene`, `common`.
  - Retirer les fallbacks visibles du type `t(...) || "Créer"` une fois les clés présentes.

- **Documentation**
  - Corriger `README.md`, `AGENTS.md` et `docs/*` pour refléter `kuti-backend` réel, `yarn` frontend, endpoints actuels, camelCase-only, SDK Hey API, shadcn officiel, thème `.dark`, et workflow `yarn api:generate`.

## Test Plan
- Backend : `cd kuti-backend && bun run typecheck`.
- Frontend : `cd kuti-frontend && yarn typecheck && yarn build`.
- SDK : démarrer le backend, vérifier `/openapi/api-doc.json`, puis `yarn api:generate` sans diff inattendu après une seconde génération.
- Recherches d’acceptation :
  - Aucun fallback `root_path`, `updated_at`, `last_opened_at`.
  - Aucun form field frontend en snake_case sauf valeurs métier explicites comme enum `spot_color`.
  - Aucun import direct non justifié de `sdk.gen` ou `client.gen` dans les composants.
  - Aucun texte UI visible hardcodé hors IDs techniques, valeurs enum ou logs.
  - Aucun écran principal avec modals/sheets/tables/form controls custom au lieu de shadcn.
- Vérification manuelle : home, project, characters, character, story, tome, chapter, scene, generation, tasks, assets, warnings, versions, exports, settings en light et dark.

## Assumptions
- Rupture nette acceptée : pas de compatibilité publique snake_case.
- Les noms SQL snake_case restent inchangés via Prisma `@map`; pas de migration DB nécessaire pour ce point.
- Le package manager frontend est `yarn`; toute commande frontend utilisera `yarn` ou `yarn dlx`.
- L’intégration “100% shadcn” signifie composants UI shadcn sur tous les écrans, pas une refonte produit complète des workflows.
