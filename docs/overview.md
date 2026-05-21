# Vue d'ensemble de l'architecture

Ce document présente l'architecture globale de Kuti Studio, une plateforme de production narrative local-first.

## Architecture globale

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KUTI STUDIO ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐         ┌─────────────────────────────┐   │
│  │      kuti-frontend          │         │      kuti-backend-v2        │   │
│  │    (React Router 7)         │◄───────►│      (ElysiaJS)             │   │
│  │                             │   HTTP  │                             │   │
│  │  • React Router v7          │         │  • ElysiaJS                 │   │
│  │  • TanStack Query           │         │  • Prisma ORM               │   │
│  │  • Zustand stores           │         │  • Better Auth              │   │
│  │  • shadcn/ui                │         │  • Inngest                  │   │
│  │  • i18n (fr/en)             │         │  • BentoCache               │   │
│  └─────────────────────────────┘         └──────────────┬──────────────┘   │
│           ▲                                             │                   │
│           │              OpenAPI/Swagger                │                   │
│           └─────────────────────────────────────────────┘                   │
│                                                                             │
│                              ┌─────────────────┐                             │
│                              │    PostgreSQL   │                             │
│                              │   (Prisma ORM)  │                             │
│                              └─────────────────┘                             │
│                                                                             │
│                              ┌─────────────────┐                             │
│                              │    kuti-data/   │                             │
│                              │  (filesystem)   │                             │
│                              └─────────────────┘                             │
│                                                                             │
│                              ┌─────────────────┐                             │
│                              │  Inngest Cloud  │                             │
│                              │  (workflows)    │                             │
│                              └─────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Flux de données

### 1. Requête API standard

```
Frontend                                         Backend
────────                                         ───────
   │                                                │
   │  1. TanStack Query / SDK Hey API               │
   │ ─────────────────────────────────────────────► │
   │                                                │
   │  2. Validation Zod                             │
   │                                                │
   │  3. Auth (Better Auth session)                 │
   │                                                │
   │  4. Controller logic                           │
   │                                                │
   │  5. Prisma ORM                                 │
   │     ┌─────────────┐                           │
   │     │ PostgreSQL  │                           │
   │     └─────────────┘                           │
   │                                                │
   │  6. Response (JSON)                           │
   │ ◄───────────────────────────────────────────── │
   │                                                │
```

### 2. Workflow Inngest (génération IA)

```
Frontend        Backend                    Inngest                Provider
────────        ───────                    ───────                ────────
   │              │                           │                      │
   │  Trigger     │                           │                      │
   │ ───────────► │                           │                      │
   │              │  Send event               │                      │
   │              │ ────────────────────────► │                      │
   │              │                           │  1. step.run()       │
   │              │                           │ ──────────────────► │
   │              │                           │  2. Retry/Resume     │
   │              │                           │     on failure       │
   │              │                           │                      │
   │              │  Callback/Webhook         │                      │
   │              │ ◄──────────────────────── │                      │
   │  Update UI   │                           │                      │
   │ ◄─────────── │                           │                      │
```

## Modules métier

```
┌─────────────────────────────────────────────────────────────────┐
│                         DOMAINE MÉTIER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Projects   │  │  Characters  │  │     Story    │          │
│  │              │  │              │  │              │          │
│  │ • CRUD       │  │ • Fiches     │  │ • Tomes      │          │
│  │ • Archive    │  │ • Relations  │  │ • Chapitres  │          │
│  │ • Export     │  │ • Médias     │  │ • Scènes     │          │
│  │              │  │ • Voix       │  │ • Références │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Generation   │  │    Assets    │  │   Versions   │          │
│  │              │  │              │  │              │          │
│  │ • Jobs IA    │  │ • Upload     │  │ • Historique │          │
│  │ • Planches   │  │ • Métadonnées│  │ • Branches   │          │
│  │ • Preview    │  │ • Archives   │  │ • Comparison │          │
│  │              │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │   Warnings   │  │   Exports    │                            │
│  │              │  │              │                            │
│  │ • Cohérence  │  │ • JSON       │                            │
│  │ • Timeline   │  │ • ZIP        │                            │
│  │ • Personnage │  │ • PDF/CBZ    │                            │
│  │              │  │              │                            │
│  └──────────────┘  └──────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Stack technique détaillée

| Couche | Technologie | Version | Rôle |
|--------|-------------|---------|------|
| **Runtime** | Bun | 1.1+ | Runtime JavaScript/TypeScript ultra-performant |
| **Backend Framework** | ElysiaJS | 1.0+ | Framework web optimisé pour Bun |
| **ORM** | Prisma | 5.x | Modélisation et accès base de données |
| **Database** | PostgreSQL | 15+ | Base de données relationnelle |
| **Auth** | Better Auth | 1.x | Authentification complète (sessions, OAuth, 2FA) |
| **Cache** | BentoCache | 1.x | Cache multi-niveau (L1 Memory / L2 Redis) |
| **Workflows** | Inngest | 3.x | Exécution durable de workflows |
| **Frontend Framework** | React Router | 7.x | Framework full-stack React |
| **State Server** | TanStack Query | 5.x | Gestion état serveur (cache, invalidation) |
| **State Client** | Zustand | 4.x | Gestion état client (UI, contexte local) |
| **UI Components** | shadcn/ui | 2.x | Bibliothèque composants base Radix + Tailwind |
| **Styling** | Tailwind CSS | 3.x | Utilitaires CSS |
| **i18n** | i18next | 23.x | Internationalisation |
| **Éditeur** | Lexical | 0.16+ | Éditeur riche (Meta/Facebook) |

## Structure des données

### Project
```
Project
├── Characters[]
│   ├── VoiceSamples[]
│   ├── Images[]
│   └── Relations[]
├── Tomes[]
│   └── Chapters[]
│       └── Scenes[]
│           └── References[]
├── Assets[]
├── GenerationJobs[]
│   └── Steps[]
├── Warnings[]
├── Versions[]
└── Exports[]
```

## Points clés

1. **OpenAPI comme contrat** - Le backend expose Swagger UI, le frontend génère son SDK automatiquement
2. **Type safety end-to-end** - Les types Prisma sont partagés, Zod valide les entrées/sorties
3. **Local-first** - Tout est stocké localement dans `kuti-data/`
4. **Durable execution** - Les jobs longs (génération IA) utilisent Inngest pour survive aux redémarrages
5. **Modularité** - Chaque domaine métier est un module Elysia autonome avec ses routes, DTOs et controllers
