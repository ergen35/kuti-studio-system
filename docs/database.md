# Base de données - Schéma Prisma

Documentation du schéma de données Prisma pour Kuti Studio.

## Vue d'ensemble

Le schéma Prisma définit 25+ modèles répartis en plusieurs domaines métier :

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOMAINE AUTH (Better Auth)                  │
├─────────────────────────────────────────────────────────────────┤
│  User ──► Session                                               │
│       ──► Account                                               │
│                                                                 │
│  Verification                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DOMAINE PROJET                              │
├─────────────────────────────────────────────────────────────────┤
│  Project ──► Characters ──► CharacterRelation                   │
│          │  │              VoiceSample                          │
│          │  │              CharacterImage                       │
│          │                                                      │
│          ├──► Tomes ──► Chapters ──► Scenes ──► StoryReference  │
│          │         │              │                             │
│          │         └──────────────┘                             │
│          │                                                      │
│          ├──► Assets ──► AssetLink                              │
│          │                                                      │
│          ├──► GenerationJob ──► GenerationJobStep               │
│          │                 └──► GenerationBoard ──► Panel       │
│          │                                                      │
│          ├──► SceneGenerationConfig                             │
│          ├──► SceneMangaPage                                    │
│          ├──► Warning                                           │
│          ├──► Version                                           │
│          └──► ExportRecord                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Modèles principaux

### Modèles Better Auth

Générés automatiquement et utilisés tels quels.

| Modèle | Description |
|--------|-------------|
| `User` | Utilisateur (id, email, name, role, banned) |
| `Session` | Sessions actives (token, expiresAt) |
| `Account` | Comptes OAuth liés (providerId, accountId) |
| `Verification` | Codes de vérification (email, password reset) |

### Projects

Un projet est le conteneur principal de toutes les données narratives.

```prisma
model Project {
  id            String        @id @default(uuid())
  name          String
  slug          String        @unique
  status        ProjectStatus @default(draft)
  rootPath      String        
  settingsJson  Json          @default("{}")
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  lastOpenedAt  DateTime?
  archivedAt    DateTime?
}
```

**Status possibles :**
- `draft` - Projet en création
- `active` - Projet actif et éditable
- `archived` - Projet archivé (lecture seule)
- `maintenance` - Mode maintenance

### Characters

Fiches de personnages avec leurs attributs et médias.

```prisma
model Character {
  id                  String          @id @default(uuid())
  slug                String          // unique par projet
  name                String
  alias               String?
  narrativeRole       String?         // rôle dans l'histoire
  description         String          @default("")
  physicalDescription String          @default("")
  colorPaletteJson    Json            @default("[]"
  costumeElementsJson Json            @default("[]")
  keyTraitsJson       Json            @default("[]")
  personality         String          @default("")
  narrativeArc        String          @default("")
  tagsJson            Json            @default("[]")
  status              CharacterStatus @default(active)
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
  archivedAt          DateTime?
}
```

**Status possibles :** `active`, `draft`, `archived`

### Structure narrative (Story)

Hiérarchie stricte : **Project → Tome → Chapter → Scene**

```prisma
model Tome {
  id          String      @id @default(uuid())
  title       String
  slug        String      // unique par projet
  synopsis    String      @default("")
  status      StoryStatus @default(draft)
  orderIndex  Int         @default(0)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model Chapter {
  id          String      @id @default(uuid())
  title       String
  slug        String      // unique par projet
  synopsis    String      @default("")
  status      StoryStatus @default(draft)
  orderIndex  Int         @default(0)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model Scene {
  id              String      @id @default(uuid())
  title           String
  slug            String      // unique par projet
  sceneType       String      @default("")
  location        String      @default("")
  summary         String      @default("")
  content         String      @default("")
  notes           String      @default("")
  charactersJson  Json        @default("[]")
  tagsJson        Json        @default("[]")
  status          StoryStatus @default(draft)
  orderIndex      Int         @default(0)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```

**Status possibles :** `active`, `draft`, `archived`

### StoryReference

Système de références typées dans le contenu des scènes.

```prisma
model StoryReference {
  id            String    @id @default(uuid())
  referenceKind String    // chara, environment, file
  targetSlug    String    // slug de l'entité cible
  rawToken      String    // token original @type:slug
  createdAt     DateTime  @default(now())
}
```

**Types de références :**
- `chara` - Référence à un personnage (@chara:Jack_Vespers)
- `environment` - Référence à un environnement (@environment:Moon_Docks)
- `file` - Référence à un fichier (@file:reference.png)

### Generation

Jobs de génération IA avec leur suivi d'étapes.

```prisma
model GenerationJob {
  id              String              @id @default(uuid())
  sourceKind      GenerationSourceKind
  sourceId        String
  sourceVersionId String?
  strategy        GenerationStrategy
  entrypoint      String              @default("gpt-2-images")
  title           String
  prompt          String              @default("")
  summary         String              @default("")
  status          GenerationJobStatus @default(pending)
  progress        Int                 @default(0)
  metadataJson    Json                @default("{}")
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  completedAt     DateTime?
  failedAt        DateTime?
  errorMessage    String?
}

model GenerationJobStep {
  id            String              @id @default(uuid())
  orderIndex    Int                 @default(0)
  title         String
  status        GenerationStepStatus @default(pending)
  prompt        String              @default("")
  outputText    String              @default("")
  artifactPath  String?
  artifactName  String?
  metadataJson  Json                @default("{}")
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  completedAt   DateTime?
  failedAt      DateTime?
  errorMessage  String?
}
```

**Status Job :** `pending`, `running`, `ready`, `validated`, `failed`
**Status Step :** `pending`, `running`, `ready`, `failed`

### GenerationBoard

Board de planches manga générées avec sélection de panels.

```prisma
model GenerationBoard {
  id            String              @id @default(uuid())
  sourceKind    GenerationSourceKind
  strategy      GenerationStrategy
  title         String
  summary       String              @default("")
  status        GenerationBoardStatus @default(draft)
  artifactPath  String?
  artifactName  String?
  metadataJson  Json                @default("{}")
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  validatedAt   DateTime?
}

model GenerationBoardPanel {
  id            String              @id @default(uuid())
  orderIndex    Int                 @default(0)
  title         String
  caption       String              @default("")
  prompt        String              @default("")
  status        GenerationPanelStatus @default(draft)
  imagePath     String
  imageName     String
  metadataJson  Json                @default("{}")
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}
```

**Status Panel :** `draft`, `selected`, `rejected`, `replaced`

### Variantes

Les champs de type tableau ou objet complexe sont stockés en JSON :

| Champ | Type | Exemple |
|-------|------|---------|
| `colorPaletteJson` | string[] | `["#FF0000", "#00FF00"]` |
| `charactersJson` | string[] | `["char-1", "char-2"]` |
| `tagsJson` | string[] | `["hero", "villain"]` |
| `metadataJson` | object | `{ "key": "value" }` |
| `settingsJson` | object | `{ "theme": "dark" }` |

## Conventions de nommage

### Tables
- Pluriel des noms (ex: `projects`, `characters`)
- Snake_case pour les noms de table mappés

### Champs
- camelCase pour les noms de champs Prisma
- snake_case pour les colonnes SQL (via `@map()`)
- Suffixe `Json` pour les champs JSON
- Suffixe `At` pour les timestamps (`createdAt`, `updatedAt`)

### Relations
- Nom explicite de la relation (ex: `sourceRelations`, `targetRelations`)
- Clé étrangère avec suffixe `Id`

### Indexes
```prisma
@@index([projectId])
@@index([slug])
@@unique([projectId, slug])  // Contrainte d'unicité composée
```

## Guide des migrations

### Créer une migration

```bash
cd kuti-backend

# Générer automatiquement depuis le schéma
bun run db:migrate -- --name add_character_field

# Ou avec Prisma directement
bunx prisma migrate dev --name add_character_field
```

### Workflow typique

1. **Modifier le schéma** (`prisma/schema.prisma`)

```prisma
model Character {
  // ... champs existants
  newField String?  // Ajouter champ
}
```

2. **Générer la migration**

```bash
bun run db:migrate
```

3. **Générer le client Prisma** (si nécessaire)

```bash
bun run db:generate
```

4. **Vérifier en base**

```bash
bun run db:studio
```

### Commandes utiles

```bash
# Voir l'état des migrations
bunx prisma migrate status

# Reset de la base (⚠️ DESTRUCTIF)
bunx prisma migrate reset

# Régénérer le client
bun run db:generate

# Ouvrir Prisma Studio
bun run db:studio

# Formater le schéma
bunx prisma format
```

## Bonnes pratiques

1. **Toujours utiliser `@map()`** pour les champs et tables en base
2. **Définir les relations** avec `onDelete: Cascade` quand approprié
3. **Ajouter des indexes** sur les champs fréquemment recherchés
4. **Utiliser `@default()`** pour les champs avec valeur par défaut
5. **Stocker les tableaux/objets en JSON** pour la flexibilité
6. **Contraintes d'unicité** sur les slugs (par projet) pour les URLs propres
