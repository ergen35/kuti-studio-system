# Architecture Template - Elysia + React Router 7

> Document de reference pour demarrer ou auditer un projet full-stack avec Elysia en backend et React Router 7 en frontend.
> Ce document est volontairement generique: il ne depend d'aucun domaine metier.

---

## 1. Objectif

Cette architecture sert de socle pour des applications TypeScript composees de:

- un backend Elysia expose en HTTP JSON;
- une authentification Better Auth partagee entre backend et frontend;
- une specification OpenAPI comme contrat public;
- un SDK frontend genere avec `@hey-api/openapi-ts`;
- un frontend React Router 7 en framework mode;
- une interface shadcn/ui customisee par tokens Tailwind.

La regle centrale: le backend publie le contrat, le frontend consomme le SDK genere. Les types API ne sont pas recopies manuellement.

---

## 2. Vue d'ensemble

```text
backend/src/
  index.ts                 # composition Elysia, plugins globaux, modules
  lib/
    auth.ts                # configuration Better Auth serveur
    s3.ts                  # client S3 et helpers presign
    bento-cache/           # configuration BentoCache (L1/L2 caching)
    db/                    # client database / ORM
  modules/
    authentication/        # authModule + authProvider
    upload/                # endpoint presign S3 (route: /api/v1/files)
    <feature>/             # module fonctionnel
      index.ts             # routes Elysia + schemas + OpenAPI metadata
      controller.ts        # ou controller/index.ts - logique applicative
      dto/                 # ou dtos/ - schemas Zod et types DTO

frontend/app/
  root.tsx                 # providers globaux
  routes.ts                # declaration React Router 7
  routes/                  # pages et layouts
  components/ui/           # composants shadcn/ui
  lib/
    auth-client.ts         # Better Auth client
    query-client.ts        # TanStack Query config
    backend/               # SDK genere Hey API, ne pas modifier
```

---

## 3. Backend Elysia

### 3.1 Entry point

`src/index.ts` compose l'application Elysia. Il doit rester declaratif: plugins globaux, modules, healthcheck, demarrage.

```ts
import cors from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { wideEvent } from "elysia-wide-event";
import { randomUUIDv7 } from "bun";

import { authModule } from "@modules/authentication";
import { uploadModule } from "@modules/upload";
import { usersModule } from "@modules/users";

export const app = new Elysia({
  aot: true,
  analytic: true,
  name: "Application API",
})
  .use(wideEvent({
    generateRequestId: () => `req-${randomUUIDv7()}`,
    start: { version: process.env.npm_package_version }
  }))
  .use(cors({
    origin: String(process.env.TRUSTED_ORIGINS || "").split(","),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Client-Key"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }))
  .use(openapi({
    mapJsonSchema: { zod: z.toJSONSchema },
    path: "/openapi",
    specPath: "/openapi/doc.json",
    enabled: process.env.NODE_ENV === "development",
  }))
  .use(authModule)
  .use(uploadModule)
  .use(usersModule)
  .get("/healthz", () => ({ ok: true }))
  .listen(Number(process.env.PORT ?? 3500));
```

Regles:

- `index.ts` ne contient pas de logique metier.
- Chaque domaine est expose par un module Elysia autonome.
- Les routes versionnees utilisent `/api/v1/...`.
- OpenAPI est active en developpement et sert de source de verite au frontend.

### 3.2 Organisation des modules

Un module represente une capacite fonctionnelle. Il contient les routes, les schemas d'entree/sortie et appelle des controllers.

```text
src/modules/users/
  index.ts
  controller.ts        # ou controller/index.ts
  dto/
    index.ts           # ou dtos/index.ts
```

> **Note** : La structure est flexible. Le controller peut être `controller.ts` à la racine ou `controller/index.ts`. Les DTOs peuvent être dans `dto/` ou `dtos/`. L'important est la cohérence au sein d'un module.

Template de module:

```ts
import { Elysia } from "elysia";
import { authProvider } from "@modules/authentication";
import * as UsersController from "./controller";
import {
  listUsersQuerySchema,
  listUsersResponseSchema,
  updateUserBodySchema,
  userResponseSchema,
} from "./dto";

export const usersModule = new Elysia({
  prefix: "/api/v1/users",
  name: "usersModule",
  detail: { tags: ["Users"] },
})
  .use(authProvider)
  .get("/", ({ query }) => UsersController.listUsers(query), {
    accessControl: { roles: ["admin"] },
    query: listUsersQuerySchema,
    response: listUsersResponseSchema,
    detail: {
      operationId: "listUsers",
      summary: "List users",
    },
  })
  .patch("/:id", ({ params, body }) => UsersController.updateUser(params.id, body), {
    accessControl: { roles: ["admin"] },
    body: updateUserBodySchema,
    response: userResponseSchema,
    detail: {
      operationId: "updateUser",
      summary: "Update a user",
    },
  });
```

Regles:

- `index.ts` declare les routes et le contrat HTTP.
- `controller.ts` ou `controller/index.ts` contient la logique applicative et les appels DB/services.
- `dto/index.ts` ou `dtos/index.ts` contient les schemas Zod et les types derives.
- `operationId` est obligatoire et stable: il genere les noms du SDK frontend.
- Les routes privees utilisent toujours `authProvider` et `{ accessControl: { roles: [...], permissions: [] } }`.

### 3.3 DTOs et validation Zod

Zod est le standard de validation. Chaque payload public a un schema explicite.

```ts
import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "member", "viewer"]);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).optional(),
});

export const updateUserBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: userRoleSchema.optional(),
});

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: userRoleSchema,
});

export const listUsersResponseSchema = z.object({
  users: z.array(userResponseSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  totalPages: z.number().int().min(0),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
```

Nommage recommande:

| Besoin | Nom |
| --- | --- |
| Params URL | `<action>ParamsSchema` |
| Query string | `<action>QuerySchema` |
| Body | `<action>BodySchema` |
| Response | `<action>ResponseSchema` |
| Type derive | `z.infer<typeof schema>` |

Les schemas de reponse ne sont pas optionnels. Ils alimentent OpenAPI, le SDK TypeScript, les hooks TanStack Query et les schemas frontend generes.

### 3.4 Better Auth serveur

La configuration Better Auth vit dans `src/lib/auth.ts`.

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { db } from "@lib/db";

export const auth = betterAuth({
  appName: "Application",
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

Le module `authentication` expose deux elements:

```ts
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { auth } from "@lib/auth";

type AccessControlParams = {
  roles?: string[];
  permissions?: string[];
};

export const authModule = new Elysia({ name: "authModule" })
  .use(cors({
    origin: String(process.env.TRUSTED_ORIGINS || "").split(","),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "HEAD"],
  }))
  .mount(auth.handler);

export const authProvider = new Elysia({ name: "authProvider" }).macro(
  "accessControl",
  (acp: AccessControlParams) => ({
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({ headers });

      if (!session || !session.user.role) {
        return status("Unauthorized");
      }

      if (acp.roles && !acp.roles.includes(session.user.role)) {
        return status("Forbidden");
      }

      return {
        authData: session,
      };
    },
  })
);
```

Regles d'access control:

- `authModule` monte les endpoints Better Auth.
- `authProvider` est utilise par les modules applicatifs.
- Une route protegee declare `{ accessControl: { roles: ["admin", "user"], permissions: [] } }`.
- Les roles et permissions sont verifies automatiquement par la macro `accessControl`.
- Les protections frontend ameliorent l'UX mais ne remplacent jamais les controles backend.

### 3.5 Stockage S3 et presigned uploads

Le backend ne recoit pas les fichiers binaires pour les uploads standards. Il genere une URL presignee, puis le frontend upload directement vers S3.

```text
Frontend
  1. POST /api/v1/files/presign { folder, contentType, fileName }
Backend
  2. Genere une cle S3 et une presigned PUT URL
  3. Retourne { presignedUrl, s3Key, fileUrl }
Frontend
  4. PUT direct vers S3 avec le fichier
  5. Enregistre s3Key ou fileUrl dans l'entite metier
```

Helpers backend:

```ts
import { randomUUIDv7, S3Client } from "bun";

export const s3Client = new S3Client({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  bucket: process.env.S3_BUCKET,
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || undefined,
});

export function generateS3Key(folder: string, extension: string) {
  const ext = extension.replace(/^\./, "") || "bin";
  return `${folder}/${randomUUIDv7("base64url")}.${ext}`;
}

export function getS3FileUrl(s3Key: string): string {
  return `${process.env.S3_CDN_URL}/${s3Key}`;
}

export function getS3PresignedUploadUrl(key: string, contentType: string, expiresIn = 3600) {
  const file = s3Client.file(key);
  return file.presign({ method: "PUT", expiresIn, type: contentType });
}

export function getPresignedS3FileUrl(s3Key: string, expiresIn = 3600): string {
  const file = s3Client.file(s3Key);
  return file.presign({ method: "GET", expiresIn });
}
```

Endpoint standard:

```ts
export const uploadModule = new Elysia({
  prefix: "/api/v1/files",
  name: "uploadModule",
  detail: { tags: ["Files"] },
})
  .use(authProvider)
  .post("/presign", ({ body }) => createPresignedUploadUrl(body), {
    accessControl: { roles: ["admin", "user", "teacher"], permissions: [] },
    body: presignBodySchema,
    response: { 200: presignResponseSchema },
    detail: {
      operationId: "createFilePresign",
      summary: "Generate a presigned S3 PUT URL for direct client upload",
    },
  });
```

Regles:

- Les presigned URLs sont temporaires et ne sont jamais stockees en base.
- La base stocke une cle S3 stable ou une URL publique/CDN stable.
- Les folders autorises sont valides par Zod.
- Les endpoints de lecture peuvent retourner des URLs presignees GET si les medias ne sont pas publics.

### 3.6 Caching avec BentoCache

BentoCache fournit une abstraction de caching multi-niveaux (L1 memory, L2 Redis) avec invalidation par bus.

\`\`\`ts
// lib/bento-cache/index.ts
import { BentoCache, bentostore } from 'bentocache';
import { memoryDriver } from 'bentocache/drivers/memory';
import { redisBusDriver, redisDriver } from 'bentocache/drivers/redis';

export const bento = new BentoCache({
  default: 'defaultCache',
  stores: {
    defaultCache: bentostore().useL1Layer(
      memoryDriver({ maxSize: '20mb' })
    ),
    multitier: bentostore()
      .useL1Layer(memoryDriver({ maxSize: '20mb' }))
      .useL2Layer(
        redisDriver({
          connection: { path: String(process.env.REDIS_URL) },
        })
      )
      .useBus(
        redisBusDriver({
          connection: { path: String(process.env.REDIS_URL) },
        })
      ),
  },
});
\`\`\`

Utilisation dans un controller:

\`\`\`ts
import { bento } from "@lib/bento-cache";

export async function getCachedData(key: string) {
  return bento.getOrSet({
    key,
    factory: async () => fetchExpensiveData(),
    ttl: "5m",
  });
}

export async function invalidateCache(key: string) {
  await bento.delete(key);
}
\`\`\`

Configuration:

| Store | L1 (Memory) | L2 (Redis) | Bus (Invalidation) | Usage |
|-------|-------------|------------|-------------------|-------|
| \`defaultCache\` | ✅ 20MB | ❌ | ❌ | Cache local simple |
| \`multitier\` | ✅ 20MB | ✅ | ✅ | Cache distribué multi-instance |

Regles:

- Utiliser \`defaultCache\` pour les données à faible TTL ou peu coûteuses à recalculer.
- Utiliser \`multitier\` pour les données partagées entre instances et nécessitant invalidation.
- Toujours invalider le cache après une mutation de données.
- Définir des TTL raisonnables selon la volatilité des données.


### 3.7 OpenAPI

OpenAPI est le contrat entre backend et frontend.

Chaque route publique ou privee doit fournir:

- un `operationId` unique et stable;
- un `summary` lisible;
- un tag via le module ou la route;
- des schemas `params`, `query`, `body` et `response` quand applicables.

```ts
.get("/:id", ({ params }) => Controller.getById(params.id), {
  params: getResourceParamsSchema,
  response: resourceResponseSchema,
  detail: {
    operationId: "getResourceById",
    summary: "Get a resource by id",
  },
})
```

Le frontend ne doit pas consommer des endpoints non presents dans OpenAPI.

### 3.8 Logging avec elysia-wide-event

`elysia-wide-event` est installe au niveau global pour tracer les requetes.

```ts
.use(wideEvent({
  generateRequestId: () => randomUUIDv7(),
}))
```

Objectifs:

- produire un identifiant de requete stable;
- correler les erreurs applicatives avec les logs HTTP;
- uniformiser les logs de temps de reponse, methode, path et status;
- faciliter le debug des appels generes par le SDK frontend.

---

## 4. Frontend React Router 7

### 4.1 Organisation des routes

Le frontend utilise React Router 7 en framework mode avec `app/routes.ts`.

```ts
import { index, layout, prefix, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),

  layout("routes/dashboard/_layout.tsx", [
    ...prefix("dashboard", [
      index("routes/dashboard/index.tsx"),
      route("settings", "routes/dashboard/settings.tsx"),
    ]),
  ]),

  route("*", "routes/$.tsx"),
] satisfies RouteConfig;
```

Regles:

- Les pages publiques, auth et dashboard sont separees.
- Les routes protegees passent par un layout dedie.
- Les pages ne reimplementent pas la protection si le layout la fournit deja.
- Les loaders/actions React Router sont utilises quand la navigation doit porter le cycle de donnees.
- TanStack Query est privilegie pour les donnees serveur reutilisees et invalidees apres mutation.

### 4.2 Providers globaux

`app/root.tsx` installe les providers transverses.

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { Outlet } from "react-router";
import { queryClient } from "~/lib/query-client";
import { ThemeProvider } from "~/components/theme-provider";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

Configuration TanStack Query:

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
```

### 4.3 UI avec shadcn

shadcn/ui est le socle de composants.

`components.json`:

```json
{
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "css": "app/app.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "~/components",
    "utils": "~/lib/utils",
    "ui": "~/components/ui",
    "lib": "~/lib",
    "hooks": "~/hooks"
  },
  "iconLibrary": "lucide"
}
```

Regles UI:

- Utiliser les composants de `~/components/ui` avant de creer un composant custom.
- Customiser via CSS variables, Tailwind utilities et wrappers locaux.
- Ne pas modifier les fichiers generes shadcn sans raison durable.
- Ne pas utiliser de styles inline pour les couleurs, espacements ou typographies standards.
- Utiliser `lucide-react` pour les icones d'actions.

Pattern de wrapper:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export function SectionCard({ title, className, children }: {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("rounded-lg border-border", className)}>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
```

---

## 5. Frontend API avec Hey API

### 5.1 Generation du SDK

`@hey-api/openapi-ts` genere le client frontend depuis la specification OpenAPI backend.

`openapi-ts.config.ts`:

```ts
import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "http://localhost:3400/openapi/api-doc.json",
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

Commande:

```bash
yarn openapi-ts
```

Fichiers generes:

| Fichier | Usage |
| --- | --- |
| `client.gen.ts` | client HTTP fetch configurable |
| `sdk.gen.ts` | fonctions API brutes |
| `@tanstack/react-query.gen.ts` | options query/mutation et query keys |
| `types.gen.ts` | types TypeScript issus d'OpenAPI |
| `zod.gen.ts` | schemas Zod generes pour formulaires |
| `schemas.gen.ts` | schemas OpenAPI generes |

Regles:

- Ne jamais modifier `app/lib/backend/**/*.gen.ts`.
- Ne jamais recopier un type API deja present dans `types.gen.ts`.
- Regenerer le SDK apres tout changement de route, DTO ou response backend.
- Si un comportement commun est necessaire, creer un wrapper non genere dans `app/lib/backend/helpers.ts`.

### 5.2 Queries

```tsx
import { useQuery } from "@tanstack/react-query";
import { listUsersOptions } from "~/lib/backend/@tanstack/react-query.gen";

export default function UsersPage() {
  const { data, isLoading, isError, error } = useQuery(
    listUsersOptions({ query: { page: 1, limit: 50 } }),
  );

  if (isLoading) return <UsersSkeleton />;
  if (isError) return <ErrorState message={error.message} />;

  return <UsersTable users={data.users} />;
}
```

### 5.3 Mutations

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteUserMutation,
  listUsersQueryKey,
} from "~/lib/backend/@tanstack/react-query.gen";

export function DeleteUserButton({ id }: { id: string }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...deleteUserMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listUsersQueryKey({ query: { page: 1, limit: 50 } }),
      });
    },
  });

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ path: { id } })}
    >
      Delete
    </button>
  );
}
```

Conventions d'appel:

| Donnee | Cle Hey API |
| --- | --- |
| Params URL | `path` |
| Query string | `query` |
| Body JSON | `body` |
| AbortSignal | `signal` |

### 5.4 Upload direct S3

Le presign passe par le SDK genere. Le PUT vers S3 peut utiliser `XMLHttpRequest` ou `fetch` direct pour suivre la progression.

```ts
import { createFilePresign } from "~/lib/backend/sdk.gen";

export async function uploadFile(file: File) {
  const { data } = await createFilePresign({
    body: {
      folder: "documents",
      contentType: file.type,
      fileName: file.name,
    },
    throwOnError: true,
  });

  await fetch(data.presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  return { s3Key: data.s3Key, fileUrl: data.fileUrl };
}
```

---

## 6. Better Auth frontend

### 6.1 Client

`app/lib/auth-client.ts` expose le client Better Auth.

```ts
import type { auth } from "@server/lib/auth";
import { createAuthClient } from "better-auth/react";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL as string,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    adminClient(),
  ],
});

export type Session = typeof authClient.$Infer.Session;
export type AuthUser = typeof authClient.$Infer.Session.user;
```

Regles:

- Utiliser `authClient.useSession()` directement.
- Ne pas creer de hook `useAuth` qui masque les types Better Auth sans besoin clair.
- Utiliser `authClient.signIn.email`, `authClient.signUp.email`, `authClient.signOut` pour les flows standards.

### 6.2 Layout protege

```tsx
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { authClient } from "~/lib/auth-client";

export default function ProtectedLayout() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      navigate("/login");
    }
  }, [isPending, session, navigate]);

  if (isPending) return <FullPageSpinner />;
  if (!session) return null;

  return <Outlet />;
}
```

Pour les roles:

```tsx
const ALLOWED_ROLES = ["admin", "manager"] as const;

if (!ALLOWED_ROLES.includes(session.user.role as never)) {
  navigate("/login");
}
```

Cette verification frontend evite l'affichage d'ecrans interdits, mais le backend doit refaire le controle avec `authProvider`.

---

## 7. Checklist de validation

### Backend

- [ ] Chaque module a un `prefix`, un `name` et des `detail.tags`.
- [ ] Chaque route a un `operationId` stable.
- [ ] Les DTOs sont valides avec Zod et exportent leurs types.
- [ ] Les routes privees utilisent `authProvider` et `{ accessControl: { roles, permissions } }`.
- [ ] Les roles sont controles cote backend.
- [ ] OpenAPI expose toutes les routes consommees par le frontend.
- [ ] Le presign S3 retourne `presignedUrl`, `s3Key` et `fileUrl`.
- [ ] `elysia-wide-event` est installe globalement.

### Frontend

- [ ] Les routes sont declarees dans `app/routes.ts`.
- [ ] Les espaces proteges passent par un layout dedie.
- [ ] Les pages utilisent `authClient.useSession()` pour lire la session.
- [ ] Les appels API utilisent les helpers generes Hey API.
- [ ] Les mutations invalident les `*QueryKey` generes.
- [ ] Les formulaires utilisent les schemas de `zod.gen.ts` quand disponibles.
- [ ] Les composants UI viennent d'abord de shadcn/ui.
- [ ] Les fichiers generes dans `app/lib/backend` ne sont pas modifies manuellement.

### Commandes utiles

```bash
# Backend dev
bun run dev

# Frontend dev
yarn dev

# Regenerer le SDK frontend depuis OpenAPI
yarn openapi-ts

# Verifier les types frontend
yarn typecheck
```

---

## 8. Variables d'environnement

Backend:

```env
NODE_ENV=development
PORT=3500
TRUSTED_ORIGINS=http://localhost:5173

BETTER_AUTH_URL=http://localhost:3500
BETTER_AUTH_SECRET=replace-with-32-chars-minimum

DATABASE_URL=postgresql://user:password@localhost:5432/app

# Redis (pour BullMQ et BentoCache L2/bus)
REDIS_URL=redis://localhost:6379

# S3 Storage (Bun native S3 client)
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=...
S3_ENDPOINT=...
S3_REGION=...
S3_CDN_URL=...
```

Frontend:

```env
VITE_BETTER_AUTH_URL=http://localhost:3500
VITE_API_BASE_URL=http://localhost:3500
```

---

## 9. Principes non negociables

- OpenAPI est la source de verite du contrat API.
- Le SDK frontend est genere, jamais ecrit a la main.
- Les DTOs backend sont valides avec Zod.
- Better Auth gere la session; `authProvider` protege les routes backend.
- Le frontend ne remplace jamais l'access control backend.
- Les uploads fichiers passent par presigned URLs S3.
- shadcn/ui est le socle UI; la customisation passe par tokens, wrappers et composants locaux.
- Les logs de requetes doivent inclure un request id exploitable.
