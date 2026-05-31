# Kuti Studio - Guide pour Agents

> Documentation de référence pour travailler sur la plateforme Kuti Studio.

## Vue d'ensemble

Kuti Studio est une plateforme de production narrative local-first pour créer des projets avec personnages, storylines, assets et génération assistée par IA.

### Stack Technique

| Couche              | Technologie                                     |
| ------------------- | ----------------------------------------------- |
| **Backend**         | Bun + ElysiaJS + Prisma + PostgreSQL            |
| **Frontend**        | React Router v7 + TanStack Query + Zustand      |
| **Background Jobs** | Inngest (durable execution)                     |
| **Cache**           | BentoCache (L1 Memory / L2 Redis)               |
| **Auth**            | Better Auth                                     |
| **Storage**         | Filesystem local (option S3 via presigned URLs) |

### Structure des dossiers

```
/home/ergen35/Sources/repos/creative-work/kuti-studio-system/
├── kuti-backend/             # Backend ElysiaJS (stack principale)
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── lib/              # Librairies partagées
│   │   └── modules/          # Modules métier
│   └── prisma/
│       └── schema.prisma     # Schéma de données
├── kuti-frontend/            # Frontend React Router 7
│   ├── app/
│   │   ├── routes/           # Pages et layouts
│   │   ├── components/       # Composants React
│   │   ├── lib/              # API client, utils
│   │   └── stores/           # Zustand stores
│   └── locales/              # i18n (fr/en)
├── kuti-data/                # Stockage local des projets
└── docs/                     # Documentation détaillée
```

> **Note** : La stack backend principale est dans `kuti-backend/`.

---

## Documentation

- [📐 Vue d'ensemble de l'architecture](./docs/overview.md)
- [⚡ Backend - ElysiaJS & Prisma](./docs/backend.md)
- [🎨 Frontend - React Router 7](./docs/frontend.md)
- [🗄️ Base de données - Schéma Prisma](./docs/database.md)
- [⚙️ Configuration & Déploiement](./docs/deployment.md)
- [🔌 Conventions API](./docs/api-conventions.md)
- [🔄 Workflows Inngest](./docs/workflows.md)
- [📋 Checklist de développement](./docs/checklist.md)

---

## Démarrage rapide

### Backend

```bash
cd kuti-backend

# Installer les dépendances
bun install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec DATABASE_URL, etc.

# Générer le client Prisma et appliquer les migrations
bun run db:generate
bun run db:migrate

# Démarrer le serveur
bun run dev
```

Le serveur démarre sur `http://localhost:8000` avec Swagger UI sur `/openapi`.

### Frontend

```bash
cd kuti-frontend

# Installer les dépendances
yarn install

# Configurer l'environnement
cp .env.example .env
# VITE_KUTI_API_URL=http://localhost:8000

# Démarrer le serveur de développement
yarn dev
```

---

## Principes de développement

1. **OpenAPI primauté** : Le backend expose le contrat via Swagger, le frontend l'utilise via le SDK Hey API généré
2. **Contrats camelCase-only** : `body`, `query`, `params`, `response`, SDK, formulaires et docs exposent du `camelCase` uniquement. Les colonnes SQL peuvent rester en `snake_case` via Prisma `@map(...)`.
3. **SDK centralisé** : Les composants utilisent `~/lib/backend/@tanstack/react-query.gen` par défaut, les types viennent de `~/lib/backend/types.gen` ou `~/lib/backend`, et le client fetch centralisé est `~/lib/backend-client`.
4. **UI shadcn** : Les primitives officielles vivent dans `app/components/ui/`; les écrans doivent composer ces primitives. Le thème utilise la classe `.dark` sur `document.documentElement`.
5. **i18n systématique** : Toute chaîne UI visible passe par les namespaces `common`, `home`, `project`, `characters`, `story`, `generation`, `tasks`, etc.
6. **Durable execution** : Les jobs longs passent par Inngest (pas de threading local)
7. **Modularité** : Chaque domaine métier est un module Elysia autonome
8. **Local-first** : Les projets sont stockés localement dans `kuti-data/`

---

## Modules backend

| Module               | Description                                    | Endpoint                                       |
| -------------------- | ---------------------------------------------- | ---------------------------------------------- |
| **health**           | Santé et configuration                         | `/api/health`                                  |
| **authentication**   | Better Auth (users, sessions, accounts)        | `/api/auth/*`                                  |
| **projects**         | Gestion des projets                            | `/api/projects`                                |
| **characters**       | Fiches personnages et relations                | `/api/projects/:projectId/characters`          |
| **story**            | Structure narrative (tomes, chapitres, scènes) | `/api/projects/:projectId/story/*`             |
| **generation**       | Jobs de génération IA                          | `/api/projects/:projectId/generation`          |
| **scene-generation** | Configuration et génération de planches manga  | `/api/projects/:projectId/story/scenes/:sceneId` |
| **assets**           | Bibliothèque de médias                         | `/api/projects/:projectId/assets`              |
| **versions**         | Historique et branches                         | `/api/projects/:projectId/versions`            |
| **warnings**         | Vérification de cohérence                      | `/api/projects/:projectId/warnings`            |
| **exports**          | Export travail et publication                  | `/api/projects/:projectId/exports`             |
| **inngest**          | Webhooks Inngest                               | `/api/inngest`                                 |
| **upload**           | Upload de fichiers                             | `/api/v1/files`                                |
| **users**            | Gestion des utilisateurs                       | `/api/v1/users`                                |

---

## Structure détaillée

### Backend (`kuti-backend/`)```

src/
├── index.ts # Entry point Elysia
├── lib/
│ ├── auth.ts # Configuration Better Auth
│ ├── bento-cache/ # Configuration BentoCache
│ ├── config.ts # Variables d'environnement
│ ├── cron.ts # Cron jobs (orphan checker)
│ ├── db/
│ │ └── generated/ # Client Prisma généré
│ ├── files.ts # Gestion fichiers
│ ├── inngest-client.ts # Client Inngest
│ ├── logger.ts # Logging
│ ├── model-router.ts # Routage modèles IA
│ └── storage.ts # Stockage fichiers
└── modules/
├── authentication/ # Auth Better Auth
├── assets/ # Assets médias
├── characters/ # Personnages
├── exports/ # Exports
├── generation/ # Génération IA
├── health/ # Santé
├── inngest/ # Workflows Inngest
├── projects/ # Projets
├── scene-generation/ # Génération scènes manga
├── story/ # Storyline
├── upload/ # Upload
├── users/ # Utilisateurs
├── versions/ # Versions
└── warnings/ # Warnings

````

### Frontend (`kuti-frontend/`)```
app/
├── routes/                 # Pages React Router
│   ├── assets.tsx
│   ├── chapter.tsx
│   ├── character.tsx
│   ├── characters.tsx
│   ├── exports.tsx
│   ├── generation.tsx
│   ├── home.tsx
│   ├── project.tsx
│   ├── scene.tsx
│   ├── settings.tsx
│   ├── story.tsx
│   ├── tome.tsx
│   ├── versions.tsx
│   └── warnings.tsx
├── components/
│   ├── characters/        # Composants personnages
│   ├── editor/            # Éditeur lexical
│   ├── home/              # Composants page d'accueil
│   ├── scene/             # Composants scènes
│   ├── story/             # Composants storyline
│   ├── ui.tsx             # Façade compatibilité UI
│   └── ui/                # Primitives shadcn/ui générées
├── lib/
│   ├── backend/           # SDK API généré (Hey API)
│   ├── api.ts
│   ├── backend-client.ts
│   ├── query.ts           # TanStack Query config
│   └── schemas.ts
├── hooks/                 # Hooks React personnalisés
├── stores/                # Stores Zustand
└── locales/               # i18n (fr/en)
````

---

## Workflows Inngest

Les workflows durables sont gérés par Inngest pour les opérations longues :

- `generation/job.run` - Exécution d'un job de génération IA
- `generation/board.assemble` - Assemblage d'un board de planches
- `exports/create` - Création d'un export

Configuration dans `src/lib/inngest-client.ts` et `src/modules/inngest/`.

---

## Commandes utiles

### Backend```bash

cd kuti-backend

# Développement

bun run dev # Démarrer le serveur
bun run start # Démarrer en production

# Base de données

bun run db:generate # Générer le client Prisma
bun run db:migrate # Appliquer les migrations
bun run db:studio # Ouvrir Prisma Studio
bun run db:seed # Seeder la base

# Validation

bun run typecheck # Vérifier les types TypeScript
bun run test # Lancer les tests

````

### Frontend```bash
cd kuti-frontend

# Développement
yarn dev                   # Démarrer le serveur
yarn build                 # Build de production
yarn preview               # Prévisualiser le build

# Génération
yarn api:generate          # Regénérer le SDK Hey API depuis OpenAPI

# Validation
yarn typecheck             # Vérifier les types
yarn lint                  # Linter ESLint
````

---

## Contacts & Ressources

| Ressource              | Lien                                                 |
| ---------------------- | ---------------------------------------------------- |
| Architecture générique | [ARCHITECTURE.md](./ARCHITECTURE.md)                 |
| Vue d'ensemble         | [docs/overview.md](./docs/overview.md)               |
| Backend                | [docs/backend.md](./docs/backend.md)                 |
| Frontend               | [docs/frontend.md](./docs/frontend.md)               |
| Base de données        | [docs/database.md](./docs/database.md)               |
| Configuration          | [docs/deployment.md](./docs/deployment.md)           |
| Conventions API        | [docs/api-conventions.md](./docs/api-conventions.md) |
| Workflows Inngest      | [docs/workflows.md](./docs/workflows.md)             |
| Checklist dev          | [docs/checklist.md](./docs/checklist.md)             |

### Commandes rapides```bash

# Migrations

bun run db:migrate

# Studio Prisma

bun run db:studio

# Regénérer SDK frontend

yarn api:generate

```

```
