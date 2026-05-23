# Plan: Migration assets vers public/ + Suppression kuti-data

## Contexte
Assets actuellement dans `kuti-data/projects/{slug}/generation/...` avec endpoint API pour servir les fichiers.
Objectif: migrer vers `public/` avec serving static direct.

## Decisions
- Dossiers: `projectId` (UUID) - `public/projects/{id}/`
- Route: Direct via static plugin - `http://localhost:8000/projects/{id}/generation/character_images/...`
- Donnees: Repartir d'un etat propre (pas de migration des images existantes)
- rootPath: Garder temporairement pendant la transition

---

## Structure finale

```
kuti-backend/
├── public/                      # Assets servis directement
│   └── projects/
│       └── {projectId}/
│           ├── generation/
│           │   ├── character_images/
│           │   └── boards/
│           └── assets/
└── kuti-data/                   # SUPPRIMÉ ultérieurement
```

## Plan detaille

### 1. Prisma Schema

Fichier: `prisma/schema.prisma`

```prisma
model CharacterImage {
  id              String    @id @default(uuid())
  projectId       String    @map("project_id")
  characterId     String    @map("character_id")
  filePath        String    @map("file_path")
  publicUrl       String    @map("public_url")  // NOUVEAU
  fileName        String    @map("file_name")
  fileSize        Int?      @map("file_size")
  mimeType        String    @default("image/png") @map("mime_type")
  prompt          String    @default("")
  strategy        String?
  style           String?
  variationIndex  Int?      @map("variation_index")
  createdAt       DateTime  @default(now()) @map("created_at")

  project         Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  character       Character @relation(fields: [characterId], references: [id], onDelete: Cascade)

  @@unique([characterId, fileName])
  @@index([projectId])
  @@index([characterId])
  @@map("character_images")
}
```

Run: `bun run db:migrate`

### 2. Config

Fichier: `src/lib/config.ts`

```typescript
// Schema
assetsDir: z.string().default("./public"),
dataDir: z.string().default("./kuti-data"),  // Garde temporairement

// Parsing
assetsDir: process.env.ASSETS_DIR,

// Helper
export function getAssetsDir(): string {
  return config.assetsDir;
}
```

### 3. Paths

Fichier: `src/lib/paths.ts`

```typescript
// Nouvelles fonctions projectId-based
export function getCharacterImagesDir(projectId: string): string {
  return `public/projects/${projectId}/generation/character_images`;
}

export function getCharacterImagePublicUrl(projectId: string, fileName: string): string {
  return `/projects/${projectId}/generation/character_images/${fileName}`;
}

// Garder temporairement pour compat
export function getProjectDir(projectSlug: string): string {
  return `${config.dataDir}/projects/${projectSlug}`;
}
```

### 4. Filesystem

Fichier: `src/lib/filesystem.ts`

```typescript
export async function saveCharacterImage(
  projectId: string,  // CHANGÉ: projectId au lieu de slug
  characterId: string,
  imageData: Buffer,
  strategy: string,
  style?: string,
  variationIndex?: number
): Promise<{ 
  filePath: string;
  publicUrl: string;
  fileName: string; 
  fileSize: number 
}> {
  const { getCharacterImagesDir } = require("./paths");
  const { randomUUIDv7 } = require("bun");
  
  const dir = getCharacterImagesDir(projectId);
  const suffix = style ? `_${style}` : "";
  const varSuffix = variationIndex !== undefined ? `_v${variationIndex + 1}` : "";
  const fileName = `char_${characterId}_${strategy}${suffix}${varSuffix}_${randomUUIDv7("base64url")}.png`;
  const filePath = `${dir}/${fileName}`;
  
  await writeFile(filePath, imageData);
  const stats = await getFileStats(filePath);

  return {
    filePath: `projects/${projectId}/generation/character_images/${fileName}`,
    publicUrl: `/projects/${projectId}/generation/character_images/${fileName}`,
    fileName,
    fileSize: stats.size,
  };
}
```

### 5. Inngest

Fichier: `src/lib/inngest/generate-image.ts`

```typescript
await db.characterImage.create({
  data: {
    projectId,
    characterId,
    filePath: saved.filePath,
    publicUrl: saved.publicUrl,  // NOUVEAU
    fileName: saved.fileName,
    fileSize: saved.fileSize,
    mimeType: "image/png",
    prompt: buildCharacterPrompt(character, strategy, style),
    strategy,
    style,
    variationIndex: img.variationIndex,
  },
});
```

### 6. DTOs

Fichier: `src/modules/characters/dto.ts`

```typescript
export const characterImageResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  characterId: z.string(),
  fileName: z.string(),
  publicUrl: z.string().nullable(),  // NOUVEAU
  filePath: z.string(),
  fileSize: z.number().nullable(),
  mimeType: z.string(),
  prompt: z.string(),
  strategy: z.string().nullable(),
  style: z.string().nullable(),
  variationIndex: z.number().nullable(),
  createdAt: z.string().datetime(),
});
```

### 7. Static Plugin

Verifier dans `src/index.ts`:

```typescript
import { staticPlugin } from '@elysia/static';

app.use(staticPlugin({
  assets: './public',
  prefix: '/',
}));
```

## URLs d'acces

| Ressource | URL |
|-----------|-----|
| Image personnage | `http://localhost:8000/projects/{projectId}/generation/character_images/{fileName}` |

## Fichiers modifies

1. `prisma/schema.prisma` - Ajouter `publicUrl`
2. `src/lib/config.ts` - Ajouter `assetsDir`
3. `src/lib/paths.ts` - Fonctions projectId-based
4. `src/lib/filesystem.ts` - Modifier `saveCharacterImage()`
5. `src/lib/inngest/generate-image.ts` - Sauvegarder avec `publicUrl`
6. `src/modules/characters/dto.ts` - Ajouter `publicUrl` au schema

## Post-migration
- Supprimer endpoint `/file` (optionnel)
- Supprimer `kuti-data/` (future phase)
- Supprimer `Project.rootPath` (future phase)
