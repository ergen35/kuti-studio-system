# Conventions API

Standards et conventions pour l'API REST de Kuti Studio.

## Structure des endpoints

### Versionning

Toutes les routes publiques utilisent le préfixe `/api/v1/`.

```
/api/v1/projects
/api/v1/projects/:id
/api/v1/projects/:id/characters
```

### Organisation

| Domaine | Base URL |
|---------|----------|
| Santé | `/api/v1/health` |
| Authentification | `/api/v1/auth/*` |
| Projets | `/api/v1/projects` |
| Personnages | `/api/v1/projects/:projectId/characters` |
| Storyline | `/api/v1/projects/:projectId/story/*` |
| Génération | `/api/v1/projects/:projectId/generation` |
| Assets | `/api/v1/projects/:projectId/assets` |
| Versions | `/api/v1/projects/:projectId/versions` |
| Warnings | `/api/v1/projects/:projectId/warnings` |
| Exports | `/api/v1/projects/:projectId/exports` |
| Upload | `/api/v1/upload` |
| Users | `/api/v1/users` |

## Méthodes HTTP

| Méthode | Usage | Exemple |
|---------|-------|---------|
| `GET` | Lire une ou plusieurs ressources | `GET /projects` |
| `POST` | Créer une ressource | `POST /projects` |
| `PUT` | Remplacer une ressource complète | `PUT /projects/:id` |
| `PATCH` | Modifier partiellement une ressource | `PATCH /projects/:id` |
| `DELETE` | Supprimer une ressource | `DELETE /projects/:id` |

## Format des réponses

### Réponse succès (200 OK)

```json
{
  "id": "uuid",
  "name": "Mon Projet",
  "slug": "mon-projet",
  "status": "active",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Réponse liste (200 OK)

```json
{
  "projects": [
    { "id": "...", "name": "Projet 1" },
    { "id": "...", "name": "Projet 2" }
  ],
  "total": 42,
  "page": 1,
  "totalPages": 5
}
```

### Réponse création (201 Created)

```json
{
  "id": "uuid",
  "name": "Nouveau Projet",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Codes d'erreur

### Structure d'erreur

```json
{
  "type": "validation_error",
  "message": "Invalid input data",
  "code": "VALIDATION_ERROR",
  "status": 400,
  "details": [
    {
      "field": "name",
      "message": "Name is required"
    }
  ]
}
```

### Codes standards

| Code HTTP | Code interne | Description |
|-----------|--------------|-------------|
| 400 | `VALIDATION_ERROR` | Payload invalide |
| 401 | `UNAUTHORIZED` | Non authentifié |
| 403 | `FORBIDDEN` | Authentifié mais pas autorisé |
| 404 | `NOT_FOUND` | Ressource inexistante |
| 409 | `CONFLICT` | Conflit (ex: slug existant) |
| 422 | `UNPROCESSABLE_ENTITY` | Erreur métier |
| 429 | `RATE_LIMITED` | Trop de requêtes |
| 500 | `INTERNAL_ERROR` | Erreur serveur |

## Authentification et autorisation

### Header d'authentification

```
Authorization: Bearer <session_token>
```

Ou via cookie de session (Better Auth).

### Rôles

| Rôle | Description |
|------|-------------|
| `admin` | Accès complet |
| `user` | Utilisateur standard |
| `viewer` | Lecture seule |

### Protection des routes

```typescript
// Route publique (pas de protection)
.get("/healthz", () => ({ ok: true }))

// Route privée (authentification requise)
.get("/projects", handler, {
  accessControl: {},  // Juste auth
})

// Route admin (rôle requis)
.get("/admin/users", handler, {
  accessControl: { roles: ["admin"] },
})

// Route avec permission spécifique
.post("/projects/:id/delete", handler, {
  accessControl: { roles: ["admin"], permissions: ["project:delete"] },
})
```

## Pagination

### Paramètres de requête

```
GET /projects?page=2&limit=25
```

| Paramètre | Défaut | Max | Description |
|-----------|--------|-----|-------------|
| `page` | 1 | - | Numéro de page |
| `limit` | 50 | 100 | Éléments par page |

### Réponse paginée

```json
{
  "projects": [...],
  "pagination": {
    "total": 250,
    "page": 2,
    "limit": 25,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": true
  }
}
```

## Filtrage

### Syntaxe

```
GET /projects?status=active&search=mon projet
GET /characters?status=active&tags=hero,villain
```

### Opérateurs

| Opérateur | Exemple | Description |
|-----------|---------|-------------|
| `eq` | `status=active` | Égal |
| `ne` | `status!=archived` | Différent |
| `in` | `tags=hero,villain` | Dans la liste |
| `like` | `search=mon pro` | Recherche texte |
| `gt`, `gte` | `createdAt>2024-01-01` | Supérieur (à) |
| `lt`, `lte` | `updatedAt<2024-01-01` | Inférieur (à) |

## Tri

```
GET /projects?sort=-createdAt,name
```

| Syntaxe | Description |
|---------|-------------|
| `sort=field` | Tri ascendant |
| `sort=-field` | Tri descendant |
| `sort=field1,field2` | Tri multiple |

## Champs JSON

Les champs JSON (ex: `metadata`, `settings`) acceptent des objets arbitraires :

```json
{
  "name": "Mon Projet",
  "settingsJson": {
    "theme": "dark",
    "language": "fr",
    "autoSave": true
  }
}
```

## Webhooks Inngest

### Endpoint

```
POST /api/inngest
```

Utilisé par Inngest pour invoquer les workflows.

### Événements

| Événement | Description |
|-----------|-------------|
| `generation/job.run` | Démarrer un job de génération |
| `generation/board.assemble` | Assembler un board |
| `exports/create` | Créer un export |

## Spécification OpenAPI

### Accès

- **Swagger UI** : `http://localhost:8000/openapi`
- **JSON Spec** : `http://localhost:8000/openapi/doc.json`

### Conventions

Chaque route doit définir :

```typescript
.get("/:id", handler, {
  params: getParamsSchema,      // Validation params URL
  query: getQuerySchema,        // Validation query string
  body: postBodySchema,         // Validation body
  response: responseSchema,     // Validation réponse
  detail: {
    operationId: "getProjectById",  // ID unique et stable
    summary: "Get a project by ID", // Description courte
    description: "Detailed desc",   // Description longue
    tags: ["Projects"],             // Tag pour regroupement
  },
})
```

### Tags utilisés

- `Health` - Santé et configuration
- `Authentication` - Auth Better Auth
- `Projects` - Gestion des projets
- `Characters` - Personnages
- `Story` - Structure narrative
- `Generation` - Génération IA
- `Assets` - Bibliothèque de médias
- `Scene Generation` - Génération planches manga
- `Versions` - Versionning
- `Warnings` - Warnings de cohérence
- `Exports` - Exports

## Exemples complets

### Créer un projet

Request:
```bash
POST /api/v1/projects
Content-Type: application/json

{
  "name": "Mon Manga",
  "description": "Un super manga"
}
```

Response (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Mon Manga",
  "slug": "mon-manga",
  "description": "Un super manga",
  "status": "draft",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Lister les personnages

Request:
```bash
GET /api/v1/projects/{projectId}/characters?status=active&sort=-createdAt&limit=10
```

Response (200):
```json
{
  "characters": [
    {
      "id": "...",
      "name": "Jack Vespers",
      "slug": "jack-vespers",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 10,
  "totalPages": 2
}
```

### Erreur de validation

Request:
```bash
POST /api/v1/projects
Content-Type: application/json

{
  "name": ""  // Vide = invalide
}
```

Response (400):
```json
{
  "type": "validation_error",
  "message": "Invalid input data",
  "code": "VALIDATION_ERROR",
  "status": 400,
  "details": [
    {
      "field": "name",
      "message": "Name is required",
      "code": "too_small"
    }
  ]
}
```
