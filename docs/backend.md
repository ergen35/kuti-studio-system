# Backend - ElysiaJS & Prisma

Documentation du backend Kuti Studio construit avec ElysiaJS, Prisma et Better Auth.

## Structure d'un module

Chaque module métier suit une structure standardisée :

```
src/modules/<feature>/
├── index.ts          # Déclaration des routes et contrat HTTP
├── controller.ts     # Logique applicative (optionnel: controller/index.ts)
└── dto/
    └── index.ts      # Schémas Zod et types DTO
```

### Exemple: Module Projects

```typescript
// index.ts
import { Elysia } from "elysia";
import { authProvider } from "@modules/authentication";
import * as ProjectsController from "./controller";
import { createProjectBodySchema, projectResponseSchema } from "./dto";

export const projectsModule = new Elysia({
  prefix: "/api/v1/projects",
  name: "projectsModule",
  detail: { tags: ["Projects"] },
})
  .use(authProvider)  // Protection auth
  .post("/", ({ body }) => ProjectsController.createProject(body), {
    body: createProjectBodySchema,
    response: projectResponseSchema,
    detail: {
      operationId: "createProject",
      summary: "Create a new project",
    },
  });
```

```typescript
// controller.ts
import { db } from "@lib/db";
import { generateSlug } from "@lib/utils";
import type { CreateProjectBody } from "./dto";

export async function createProject(body: CreateProjectBody) {
  const slug = generateSlug(body.name);

  const project = await db.project.create({
    data: {
      name: body.name,
      slug,
      rootPath: `projects/${slug}`,
      status: "draft",
    },
  });

  return project;
}
```

```typescript
// dto/index.ts
import { z } from "zod";

export const projectStatusSchema = z.enum(["draft", "active", "archived", "maintenance"]);

export const createProjectBodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const projectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: projectStatusSchema,
  createdAt: z.string().datetime(),
});

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
```

## Conventions de code

### Nommage des schémas

| Type | Convention | Exemple |
|------|------------|---------|
| Params URL | `<action>ParamsSchema` | `getProjectParamsSchema` |
| Query string | `<action>QuerySchema` | `listProjectsQuerySchema` |
| Body | `<action>BodySchema` | `createProjectBodySchema` |
| Response | `<action>ResponseSchema` | `projectResponseSchema` |
| Enum | `<nom>Schema` | `projectStatusSchema` |

### Routes

- **Versioning** : Toutes les routes publiques utilisent `/api/v1/`
- **RESTful** : Utiliser les méthodes HTTP appropriées (GET, POST, PUT, PATCH, DELETE)
- **operationId** : Obligatoire et stable (utilisé pour générer le SDK frontend)
- **Tags** : Grouper les routes par domaine métier

### Exemple complet de route

```typescript
.get("/:id", ({ params }) => Controller.getById(params.id), {
  params: getProjectParamsSchema,      // Validation params URL
  response: projectResponseSchema,      // Validation réponse
  detail: {
    operationId: "getProjectById",      // Identifiant unique
    summary: "Get a project by id",     // Description Swagger
  },
})
```

## Authentification Better Auth

La configuration Better Auth se trouve dans `src/lib/auth.ts` :

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { db } from "@lib/db";

export const auth = betterAuth({
  appName: "Kuti Studio",
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  plugins: [admin()],
  trustedOrigins: String(process.env.TRUSTED_ORIGINS || "").split(","),
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
});
```

### Protection des routes

Deux éléments sont exportés du module `authentication` :

1. **`authModule`** : Monte les endpoints Better Auth (`/api/v1/auth/*`)
2. **`authProvider`** : Macro pour protéger les routes applicatives

```typescript
import { authProvider } from "@modules/authentication";

export const protectedModule = new Elysia({
  prefix: "/api/v1/secure",
})
  .use(authProvider)  // Active la macro accessControl
  .get("/admin-only", () => "Secret", {
    accessControl: { roles: ["admin"] },  // Vérification des rôles
  });
```

> **Important** : Le frontend peut masquer les UI non autorisées, mais le backend DOIT toujours revérifier les permissions.

## Gestion des erreurs

Elysia gère automatiquement les erreurs Zod. Pour les erreurs métier :

```typescript
// Dans un controller
import { status } from "elysia";

export async function getProject(id: string) {
  const project = await db.project.findUnique({ where: { id } });

  if (!project) {
    // Retourner une erreur 404
    throw status(404, "Project not found");
  }

  if (project.status === "archived") {
    // Retourner une erreur 403
    throw status(403, "Project is archived");
  }

  return project;
}
```

### Codes d'erreur standard

| Code | Usage |
|------|-------|
| 400 | Payload invalide (Zod valide automatiquement) |
| 401 | Non authentifié |
| 403 | Authentifié mais non autorisé |
| 404 | Ressource non trouvée |
| 409 | Conflit (ex: slug déjà existant) |
| 422 | Erreur métier (données incohérentes) |
| 500 | Erreur serveur inattendue |

## Configuration

Les variables d'environnement sont validées avec Zod dans `src/lib/config.ts` :

```typescript
const configSchema = z.object({
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  port: z.coerce.number().default(8000),
  databaseUrl: z.string(),
  dataDir: z.string().default("./kuti-data"),
  // ... autres variables
});
```

### Variables requises

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://user:pass@localhost:5432/kuti` |
| `KUTI_DATA_DIR` | Dossier stockage local | `./kuti-data` |

### Variables optionnelles

| Variable | Description |
|----------|-------------|
| `BETTER_AUTH_URL` | URL base Better Auth |
| `BETTER_AUTH_SECRET` | Secret pour les sessions |
| `INNGEST_EVENT_KEY` | Clé API Inngest |
| `GPT_IMAGES_2_API_KEY` | Clé API pour génération images |
| `REDIS_URL` | Cache Redis (L2) |

## Stockage de fichiers

### Dossiers standards

```typescript
// src/lib/config.ts
export function getProjectDataDir(slug: string): string {
  return `${config.dataDir}/projects/${slug}`;
}

export function getGenerationDir(projectSlug: string, jobId: string): string {
  return `${config.dataDir}/projects/${projectSlug}/generation/${jobId}`;
}

export function getAssetsDir(projectSlug: string): string {
  return `${config.dataDir}/projects/${projectSlug}/assets`;
}

export function getExportsDir(projectSlug: string): string {
  return `${config.dataDir}/projects/${projectSlug}/exports`;
}
```

### Exemple d'écriture fichier

```typescript
import { mkdir } from "node:fs/promises";
import { writeFile } from "@lib/files";

export async function saveAsset(projectSlug: string, filename: string, data: Buffer) {
  const dir = getAssetsDir(projectSlug);
  await mkdir(dir, { recursive: true });

  const filepath = `${dir}/${filename}`;
  await writeFile(filepath, data);

  return { filepath, filename };
}
```

## Cache avec BentoCache

Configuration dans `src/lib/bento-cache/index.ts` :

```typescript
import { BentoCache, bentostore } from "bentocache";
import { memoryDriver } from "bentocache/drivers/memory";

export const bento = new BentoCache({
  default: "defaultCache",
  stores: {
    defaultCache: bentostore().useL1Layer(
      memoryDriver({ maxSize: "20mb" })
    ),
  },
});
```

Utilisation :

```typescript
import { bento } from "@lib/bento-cache";

// Lecture avec cache
const data = await bento.getOrSet({
  key: `project:${id}`,
  factory: () => fetchExpensiveData(id),
  ttl: "5m",
});

// Invalidation
await bento.delete(`project:${id}`);
```

## Logging

Le logging utilise `elysia-wide-event` au niveau global :

```typescript
// src/index.ts
.use(wideEvent({
  generateRequestId: () => `req-${randomUUIDv7()}`,
  start: { version: config.appVersion },
}))
```

Chaque requête est tracée avec :
- Request ID unique
- Méthode et path
- Status code
- Temps de réponse
- Headers pertinents

## Commandes utiles

```bash
# Développement
bun run dev                 # Démarrer avec hot reload

# Base de données
bun run db:generate        # Régénérer Prisma Client
bun run db:migrate         # Appliquer migrations
bun run db:studio          # Ouvrir Prisma Studio

# Validation
bun run typecheck          # Vérifier types TypeScript
bun run test               # Lancer tests
```
