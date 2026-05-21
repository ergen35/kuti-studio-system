# Kuti Studio

Plateforme de production narrative local-first pour créer des œuvres de type bande dessinée, manga et univers narratifs multimodaux.

## Vue d'ensemble

Kuti Studio centralise l'écriture, la conception des personnages, l'organisation des scènes, la génération d'images et la préparation des exports de publication.

### Fonctionnalités principales

- **Gestion de projets** - Création, organisation, archivage de projets narratifs
- **Fiches personnages** - Création de personnages avec médias, relations et voix
- **Storyline structurée** - Organisation en tomes, chapitres et scènes
- **Système de références** - Mentions typées `@chara:`, `@environment:` dans le texte
- **Génération IA** - Génération d'images de personnages et de planches manga
- **Assets Library** - Import, archivage et gestion des médias
- **Warnings de cohérence** - Détection d'incohérences narrative
- **Versioning** - Historique et branches de versions
- **Exports** - Export travail (JSON/ZIP) et publication (PDF/CBZ)

## Stack technique

| Couche | Technologie |
|--------|-------------|
| **Backend** | Bun + ElysiaJS + Prisma + PostgreSQL |
| **Frontend** | React Router v7 + TanStack Query + Zustand |
| **Background Jobs** | Inngest (durable execution) |
| **Auth** | Better Auth |
| **Storage** | Filesystem local |

## Démarrage rapide

### Prérequis

- Bun 1.1+
- PostgreSQL 15+
- Redis 7+ (optionnel)

### Installation

```bash
# Backend
cd kuti-backend-v2
bun install
cp .env.example .env
# Éditer .env avec DATABASE_URL

bun run db:generate
bun run db:migrate
bun run dev

# Frontend (nouveau terminal)
cd kuti-frontend
yarn install
cp .env.example .env
yarn dev
```

## Structure du projet

```
.
├── kuti-backend-v2/          # Backend ElysiaJS
│   ├── src/
│   │   ├── modules/          # Modules métier (14 modules)
│   │   ├── lib/              # Librairies partagées
│   │   └── index.ts          # Entry point
│   └── prisma/
│       └── schema.prisma     # Schéma de données
├── kuti-frontend/            # Frontend React Router 7
│   ├── app/
│   │   ├── routes/           # Pages et layouts
│   │   ├── components/       # Composants React
│   │   └── lib/              # API client, stores
│   └── locales/              # i18n (fr/en)
├── kuti-data/                # Stockage local des projets
└── docs/                     # Documentation
```

## Documentation

- [Guide pour Agents](AGENTS.md) - Documentation de référence pour développer
- [Architecture](docs/overview.md) - Vue d'ensemble technique
- [Backend](docs/backend.md) - Conventions ElysiaJS
- [Frontend](docs/frontend.md) - Guidelines React Router 7
- [Base de données](docs/database.md) - Schéma Prisma
- [Déploiement](docs/deployment.md) - Configuration et déploiement
- [API](docs/api-conventions.md) - Conventions REST
- [Workflows](docs/workflows.md) - Inngest et jobs
- [Checklist](docs/checklist.md) - Checklist de développement

## Modules backend

| Module | Endpoint | Description |
|--------|----------|-------------|
| health | `/api/v1/health` | Santé et configuration |
| authentication | `/api/v1/auth/*` | Auth Better Auth |
| projects | `/api/v1/projects` | Projets |
| characters | `/api/v1/projects/:id/characters` | Personnages |
| story | `/api/v1/projects/:id/story/*` | Tomes/Chapitres/Scènes |
| generation | `/api/v1/projects/:id/generation` | Génération IA |
| assets | `/api/v1/projects/:id/assets` | Médias |
| exports | `/api/v1/projects/:id/exports` | Exports |
| versions | `/api/v1/projects/:id/versions` | Historique |
| warnings | `/api/v1/projects/:id/warnings` | Cohérence |
| inngest | `/api/inngest` | Workflows |

## Commandes utiles

### Backend
```bash
cd kuti-backend-v2
bun run dev              # Démarrer
bun run db:migrate       # Migrations
bun run db:studio        # Prisma Studio
bun run typecheck        # TypeScript
```

### Frontend
```bash
cd kuti-frontend
yarn dev                 # Démarrer
yarn build               # Build production
yarn openapi-ts          # Générer SDK API
yarn typecheck           # TypeScript
```

## Configuration

### Variables d'environnement backend (.env)

```env
NODE_ENV=development
PORT=8000
DATABASE_URL=postgresql://user:pass@localhost:5432/kuti_studio
KUTI_DATA_DIR=./kuti-data
BETTER_AUTH_URL=http://localhost:8000
BETTER_AUTH_SECRET=your_secret
GPT_IMAGES_2_API_KEY=your_openai_key
```

### Variables d'environnement frontend (.env)

```env
VITE_KUTI_API_URL=http://localhost:8000
```

## Principes

1. **OpenAPI primauté** - Le backend expose Swagger UI, le frontend consomme le SDK généré
2. **Type safety** - Types Prisma partagés, Zod pour validation
3. **Durable execution** - Jobs longs via Inngest (survient aux redémarrages)
4. **Modularité** - Un module Elysia par domaine métier
5. **Local-first** - Stockage local dans `kuti-data/`

## Contribution

Voir [AGENTS.md](AGENTS.md) et [docs/checklist.md](docs/checklist.md) pour les conventions de développement.

## Licence

Propriétaire - Tous droits réservés
