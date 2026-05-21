# Workflows Inngest

Documentation des workflows durables implémentés avec Inngest.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ARCHITECTURE INNGEST                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Backend                    Inngest Cloud                     Workers  │
│   ───────                    ───────────                     ────────   │
│                                                                         │
│   ┌─────────────┐           ┌─────────────┐           ┌─────────────┐   │
│   │   Trigger   │──────────►│   Event     │──────────►│   Function  │   │
│   │   (HTTP)    │           │   Queue     │           │   Executor  │   │
│   └─────────────┘           └─────────────┘           └─────────────┘   │
│         │                           │                         │         │
│         │                           │                         │         │
│         ▼                           ▼                         ▼         │
│   ┌─────────────┐           ┌─────────────┐           ┌─────────────┐   │
│   │  sendEvent()│           │   State     │◄──────────│   step.*()  │   │
│   │             │           │   Store     │           │             │   │
│   └─────────────┘           └─────────────┘           └─────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration

### Client Inngest

Configuration dans `src/lib/inngest-client.ts` :

```typescript
import { Inngest } from "inngest";
import { config } from "./config";

export const inngest = new Inngest({
  id: "kuti-studio",
  eventKey: config.inngestEventKey,
  signingKey: config.inngestSigningKey,
});
```

### Endpoint webhook

Dans `src/modules/inngest/index.ts` :

```typescript
import { serve } from "inngest/bun";

export const inngestModule = new Elysia({ prefix: "/api/inngest" })
  .use(serve({
    client: inngest,
    functions: [runGenerationJob, assembleBoard, createExport],
  }));
```

## Types de workflows

### 1. Generation Job - Génération d'images IA

**Événement** : `generation/job.run`

**Cas d'usage** :
- Génération d'images pour un personnage
- Génération de planches manga pour une scène
- Génération vidéo

** Étapes** :

```typescript
export const runGenerationJob = inngest.createFunction(
  {
    id: "run-generation-job",
    name: "Run Generation Job",
    retries: 3,
  },
  { event: "generation/job.run" },
  async ({ event, step }) => {
    const { jobId } = event.data;

    // 1. Récupérer le job
    const job = await step.run("fetch-job", async () => {
      return db.generationJob.findUnique({ where: { id: jobId } });
    });

    // 2. Mettre à jour le status
    await step.run("mark-running", async () => {
      await db.generationJob.update({
        where: { id: jobId },
        data: { status: "running" },
      });
    });

    // 3. Décomposer en étapes
    const steps = await step.run("create-steps", async () => {
      return createGenerationSteps(job);
    });

    // 4. Exécuter chaque étape
    for (const stepData of steps) {
      await step.run(`step-${stepData.id}`, async () => {
        // Appel API au provider (GPT Images, etc.)
        const result = await callImageProvider(stepData.prompt);

        // Sauvegarder le résultat
        await db.generationJobStep.update({
          where: { id: stepData.id },
          data: {
            status: "ready",
            artifactPath: result.path,
          },
        });

        return result;
      });
    }

    // 5. Finaliser
    await step.run("finalize", async () => {
      await db.generationJob.update({
        where: { id: jobId },
        data: {
          status: "ready",
          progress: 100,
          completedAt: new Date(),
        },
      });
    });

    return { jobId, status: "completed" };
  }
);
```

### 2. Assemble Board - Assemblage de planches manga

**Événement** : `generation/board.assemble`

**Cas d'usage** :
- Assembler les panels sélectionnés en planche finale
- Générer les fichiers de sortie (PNG, PDF)

**Étapes** :

```typescript
export const assembleBoard = inngest.createFunction(
  {
    id: "assemble-board",
    name: "Assemble Manga Board",
    retries: 2,
  },
  { event: "generation/board.assemble" },
  async ({ event, step }) => {
    const { boardId } = event.data;

    // 1. Récupérer le board et ses panels
    const { board, panels } = await step.run("fetch-board", async () => {
      const board = await db.generationBoard.findUnique({
        where: { id: boardId },
        include: { panels: { orderBy: { orderIndex: "asc" } } },
      });
      const selectedPanels = board.panels.filter(p => p.status === "selected");
      return { board, panels: selectedPanels };
    });

    // 2. Télécharger les images
    const images = await step.run("download-images", async () => {
      return Promise.all(
        panels.map(async (panel) => {
          const buffer = await readFile(panel.imagePath);
          return { panel, buffer };
        })
      );
    });

    // 3. Assembler la planche
    const assembledPath = await step.run("assemble", async () => {
      return await assembleMangaBoard(images, board.strategy);
    });

    // 4. Mettre à jour le board
    await step.run("update-board", async () => {
      await db.generationBoard.update({
        where: { id: boardId },
        data: {
          status: "validated",
          artifactPath: assembledPath,
          validatedAt: new Date(),
        },
      });
    });

    return { boardId, path: assembledPath };
  }
);
```

### 3. Create Export - Création d'exports

**Événement** : `exports/create`

**Cas d'usage** :
- Export JSON du projet
- Export ZIP avec assets
- Export PDF/CBZ de publication

**Étapes** :

```typescript
export const createExport = inngest.createFunction(
  {
    id: "create-export",
    name: "Create Project Export",
    retries: 2,
  },
  { event: "exports/create" },
  async ({ event, step }) => {
    const { exportId } = event.data;

    // 1. Récupérer la configuration d'export
    const exportRecord = await step.run("fetch-export", async () => {
      return db.exportRecord.findUnique({ where: { id: exportId } });
    });

    // 2. Récupérer les données du projet
    const projectData = await step.run("fetch-project-data", async () => {
      return db.project.findUnique({
        where: { id: exportRecord.projectId },
        include: {
          characters: true,
          tomes: { include: { chapters: { include: { scenes: true } } } },
          assets: true,
        },
      });
    });

    // 3. Générer l'export selon le format
    let outputPath: string;

    switch (exportRecord.format) {
      case "json":
        outputPath = await step.run("export-json", async () => {
          return await exportToJson(projectData, exportRecord);
        });
        break;

      case "zip":
        outputPath = await step.run("export-zip", async () => {
          return await exportToZip(projectData, exportRecord);
        });
        break;

      case "pdf":
        outputPath = await step.run("export-pdf", async () => {
          return await exportToPdf(projectData, exportRecord);
        });
        break;

      default:
        throw new Error(`Format non supporté: ${exportRecord.format}`);
    }

    // 4. Finaliser
    await step.run("finalize", async () => {
      const stats = await stat(outputPath);
      await db.exportRecord.update({
        where: { id: exportId },
        data: {
          status: "ready",
          artifactPath: outputPath,
          sizeBytes: stats.size,
          completedAt: new Date(),
        },
      });
    });

    return { exportId, path: outputPath };
  }
);
```

## Gestion des erreurs

### Retries automatiques

Inngest retry automatiquement les fonctions en cas d'échec :

```typescript
{
  retries: 3,  // Nombre de tentatives
  // Délai exponentiel: 1s, 2s, 4s, 8s...
}
```

### Gestion d'erreurs personnalisée

```typescript
async ({ event, step }) => {
  try {
    await step.run("risky-operation", async () => {
      return await riskyCall();
    });
  } catch (error) {
    // Log l'erreur
    await step.run("log-error", async () => {
      await db.generationJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          errorMessage: error.message,
          failedAt: new Date(),
        },
      });
    });

    // Rethrow pour que Inngest gère le retry
    throw error;
  }
}
```

## Step utilities

### step.run()

Exécute du code et sauvegarde le résultat :

```typescript
const result = await step.run("step-name", async () => {
  // Code à exécuter
  return computeSomething();
});

// Result est automatiquement sauvegardé
// En cas de retry, cette étape sera skipée
```

### step.sleep()

Pause le workflow pour une durée :

```typescript
// Attendre 5 minutes
await step.sleep("wait-5-min", "5m");

// Attendre jusqu'à une date
await step.sleep("wait-until", new Date("2024-12-25"));
```

### step.waitForEvent()

Attend un événement externe :

```typescript
const approval = await step.waitForEvent("approval-received", {
  event: "generation/approved",
  timeout: "24h",
  if: "event.data.jobId == async.data.jobId",
});

if (approval === null) {
  // Timeout - pas d'approbation reçue
  await cancelJob(jobId);
}
```

### step.invoke()

Appelle une autre fonction :

```typescript
const result = await step.invoke("call-other-function", {
  function: otherFunction,
  data: { key: "value" },
});
```

## Déclenchement des workflows

### Depuis le backend

```typescript
import { inngest } from "@lib/inngest-client";

// Démarrer un job de génération
await inngest.send({
  name: "generation/job.run",
  data: { jobId: "uuid" },
});

// Assembler un board
await inngest.send({
  name: "generation/board.assemble",
  data: { boardId: "uuid" },
});

// Créer un export
await inngest.send({
  name: "exports/create",
  data: { exportId: "uuid" },
});
```

### Depuis un endpoint HTTP

```typescript
// POST /api/v1/projects/:id/generation
.post("/", async ({ body, params }) => {
  // Créer le job en base
  const job = await createGenerationJob(params.id, body);

  // Déclencher le workflow
  await inngest.send({
    name: "generation/job.run",
    data: { jobId: job.id },
  });

  return { jobId: job.id, status: "pending" };
}, {
  body: createGenerationBodySchema,
  response: generationJobResponseSchema,
});
```

## Monitoring

### Dashboard Inngest

Accès : `https://app.inngest.com`

Fonctionnalités :
- Liste des runs en cours/completés/échoués
- Logs détaillés par étape
- Timeline d'exécution
- Métriques de performance

### Logs locaux

```bash
# Démarrer le dev server Inngest
inngest dev

# Les logs apparaissent dans la console
```

### Tracing

Chaque step est automatiquement tracé :

```
[INNGEST] Run started: run-generation-job
[INNGEST] Step: fetch-job (200ms)
[INNGEST] Step: mark-running (50ms)
[INNGEST] Step: create-steps (100ms)
[INNGEST] Step: step-1 (5000ms)
[INNGEST] Step: step-2 (5000ms)
[INNGEST] Step: finalize (100ms)
[INNGEST] Run completed: run-generation-job (10450ms)
```

## Bonnes pratiques

1. **Idempotence** : Les steps doivent être idempotents (même résultat si réexécutés)
2. **Petites étapes** : Découper en steps logiques pour de meilleures retries
3. **Pas de side effects dans les steps** : Utiliser `step.run()` pour tout I/O
4. **Timeouts** : Définir des timeouts raisonnables pour `waitForEvent()`
5. **Error handling** : Toujours catcher et log les erreurs avant de rethrow
6. **Progress tracking** : Mettre à jour la progression dans la base pour l'UI

## Dépannage

### Workflow bloqué

```bash
# Voir les runs en cours
inngest run list --status running

# Annuler un run
inngest run cancel <run-id>
```

### Retry manuel

```typescript
// Dans le dashboard Inngest, cliquer "Replay"
// OU
await inngest.send({
  name: "generation/job.run",
  data: { jobId: "uuid", forceRetry: true },
});
```
