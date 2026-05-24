# Plan: Boîte de Dialogue Détails de Tâche

## Vue d'ensemble

Ajouter une boîte de dialogue modale affichant les détails d'une tâche avec informations détaillées (step, type, temps écoulé) et contrôles pour stopper/relancer la tâche.

## Fichiers concernés

| Fichier | Action | Description |
|---------|--------|-------------|
| `app/components/tasks/TaskDetailDialog.tsx` | Créer | Boîte de dialogue modale avec détails et contrôles |
| `app/components/tasks/TaskTreeItem.tsx` | Modifier | Remplacer navigation par ouverture dialog |
| `app/components/tasks/TaskList.tsx` | Modifier | Propager onOpenDetail |
| `app/components/tasks/index.ts` | Modifier | Exporter TaskDetailDialog |
| `app/stores/tasks.ts` | Modifier | Ajouter état dialog sélectionné |
| `app/lib/tasks/types.ts` | Modifier | Ajouter types pour task details |

---

## Partie 1: Store - État du Dialog

### Modifications `app/stores/tasks.ts`

```typescript
interface TasksState {
  // ... existing state
  
  // Selected task for detail view
  selectedTaskId: string | null;
  setSelectedTask: (taskId: string | null) => void;
}

// Implémentation
selectedTaskId: null,
setSelectedTask: (taskId) => set({ selectedTaskId: taskId }),
```

---

## Partie 2: Types Étendus

### Modifications `app/lib/tasks/types.ts`

```typescript
// Extended task with step/timing info
export interface TaskDetail extends TaskItem {
  currentStep?: string;
  stepNumber?: number;
  totalSteps?: number;
  startedAt?: string;
  elapsedTime?: string; // formatted: "2m 34s"
  estimatedRemaining?: string;
  logs?: string[];
  canStop: boolean;
  canRelaunch: boolean;
}

// API types for stop/relaunch
export interface StopTaskRequest {
  projectId: string;
  jobId: string;
}

export interface RelaunchTaskRequest {
  projectId: string;
  jobId: string;
}

export interface TaskActionResponse {
  success: boolean;
  message: string;
  jobId: string;
}

// Calculate elapsed time
export function formatElapsedTime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diff = now - start;
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${seconds}s`;
}
```

---

## Partie 3: Composant TaskDetailDialog

### `app/components/tasks/TaskDetailDialog.tsx`

```typescript
interface TaskDetailDialogProps {
  task: TaskItem;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Structure du dialog:
┌─────────────────────────────────────────────────────────────┐
│  🔄 Génération: Chapitre "Le voyage"              [X]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  STATUS        TYPE           TEMPS ÉCOULÉ         │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │   │
│  │  🟢 Running    Chapter        2m 34s               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PROGRÈS                                           │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │   │
│  │  Step 3 sur 8: "Génération scène 3 - Le marché"   │   │
│  │                                                     │   │
│  │  [████████████████░░░░░░░░░░░░░░░░] 37.5%         │   │
│  │                                                     │   │
│  │  3/8 scènes complétées                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  DÉTAILS                                           │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │   │
│  │  ID: job_abc123xyz                                  │   │
│  │  Source: Chapter "Le voyage" (ID: chap_456)        │   │
│  │  Stratégie: direct                                  │   │
│  │  Modèle: flux-dev                                   │   │
│  │  Créé: 24 mai 2025 à 14:32                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  LOGS RÉCENTS                                      │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │   │
│  │  [14:33:45] Démarrage génération scène 3...        │   │
│  │  [14:33:42] Scène 2 complétée ✓                   │   │
│  │  [14:32:18] Scène 1 complétée ✓                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│       ┌────────────┐    ┌────────────┐                     │
│       │  🛑 Stop   │    │  🔄 Retry  │                     │
│       └────────────┘    └────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Partie 4: Intégration Composants Existants

### Modification `TaskTreeItem.tsx`

```typescript
interface TaskTreeItemProps {
  task: TaskItem;
  level?: number;
  onOpenDetail?: (task: TaskItem) => void; // NEW
  showProgressBar?: boolean;
  compact?: boolean;
}

// Remplacer navigation par:
const handleClick = () => {
  if (hasChildren) {
    toggleExpanded(task.id);
  } else {
    onOpenDetail?.(task); // Ouvrir dialog au lieu de naviguer
  }
};
```

### Modification `TaskList.tsx`

```typescript
interface TaskListProps {
  tasks: TaskItem[];
  isLoading: boolean;
  onOpenDetail?: (task: TaskItem) => void; // NEW
  showProgressBar?: boolean;
  compact?: boolean;
  emptyMessage?: string;
}

// Passer onOpenDetail à TaskTreeItem
<TaskTreeItem
  key={task.id}
  task={task}
  onOpenDetail={onOpenDetail}
  // ...
/>
```

### Modification `TaskSideSheet.tsx`

```typescript
const { setSelectedTask } = useTasksStore();

const handleOpenDetail = (task: TaskItem) => {
  setSelectedTask(task.id);
  // Garder side sheet ouvert en arrière-plan
};

// Rendre TaskDetailDialog
{selectedTaskId && (
  <TaskDetailDialog
    task={tasks.find(t => t.id === selectedTaskId)!}
    projectId={projectId}
    isOpen={!!selectedTaskId}
    onClose={() => setSelectedTask(null)}
  />
)}
```

### Modification `routes/tasks.tsx`

```typescript
const { selectedTaskId, setSelectedTask } = useTasksStore();

// Dans le JSX
<TaskList
  tasks={tasks}
  isLoading={isLoading}
  onOpenDetail={(task) => setSelectedTask(task.id)}
  // ...
/>

{selectedTaskId && (
  <TaskDetailDialog
    task={tasks.find(t => t.id === selectedTaskId)!}
    projectId={projectId}
    isOpen={!!selectedTaskId}
    onClose={() => setSelectedTask(null)}
  />
)}
```

---

## Partie 5: API Endpoints

### Vérification endpoints existants

Selon `types.gen.ts`, vérifier si ces endpoints existent:

```typescript
// GET /api/projects/{projectId}/generation/jobs/{jobId}
// DELETE /api/projects/{projectId}/generation/jobs/{jobId} (stop)
// POST /api/projects/{projectId}/generation/jobs/{jobId}/relaunch

// Si non existants, utiliser mutations avec SDK:
const stopTask = useMutation({
  mutationFn: async ({ projectId, jobId }: { projectId: string; jobId: string }) => {
    const { data } = await client.delete(`/api/projects/${projectId}/generation/jobs/${jobId}`);
    return data;
  },
});

const relaunchTask = useMutation({
  mutationFn: async ({ projectId, jobId }: { projectId: string; jobId: string }) => {
    const { data } = await client.post(`/api/projects/${projectId}/generation/jobs/${jobId}/relaunch`);
    return data;
  },
});
```

---

## Partie 6: Design Détaillé du Dialog

### Layout

```typescript
// Header avec titre et badge statut
<DialogHeader>
  <div className="flex items-center gap-3">
    <Icon size={24} className={statusColor} />
    <div>
      <h2 className="text-lg font-semibold">{task.title}</h2>
      <Badge tone={task.status}>{task.status}</Badge>
    </div>
  </div>
</DialogHeader>

// Grid 3 colonnes: Status | Type | Temps
<div className="grid grid-cols-3 gap-4">
  <StatCard label="Statut" value={statusLabel} icon={StatusIcon} />
  <StatCard label="Type" value={sourceKindLabel} icon={TypeIcon} />
  <StatCard label="Temps écoulé" value={elapsedTime} icon={ClockIcon} />
</div>

// Section Progress avec step courant
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span className="text-muted">{currentStepLabel}</span>
    <span className="font-medium">{progress}%</span>
  </div>
  <ProgressBar value={progress} className="h-2" />
  {hierarchyProgress && (
    <p className="text-xs text-muted">{hierarchyProgress.label}</p>
  )}
</div>

// Section Détails (collapsible)
<Collapsible>
  <CollapsibleTrigger>Détails techniques</CollapsibleTrigger>
  <CollapsibleContent>
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <dt className="text-muted">ID Job</dt>
      <dd className="font-mono">{task.id}</dd>
      <dt className="text-muted">Source ID</dt>
      <dd className="font-mono">{task.sourceId}</dd>
      <dt className="text-muted">Stratégie</dt>
      <dd>{strategy}</dd>
      <dt className="text-muted">Créé le</dt>
      <dd>{formatDate(task.createdAt)}</dd>
    </dl>
  </CollapsibleContent>
</Collapsible>

// Section Logs (si disponible)
{logs && logs.length > 0 && (
  <div className="max-h-40 overflow-y-auto bg-ink/5 rounded p-2 text-xs font-mono space-y-1">
    {logs.map((log, i) => (
      <div key={i} className="text-muted">{log}</div>
    ))}
  </div>
)}

// Footer avec boutons d'action
<DialogFooter>
  {task.canStop && (
    <Button variant="danger" onClick={handleStop} disabled={isStopping}>
      {isStopping ? <Spinner size="sm" /> : <Square size={16} />}
      Arrêter
    </Button>
  )}
  {task.canRelaunch && (
    <Button variant="primary" onClick={handleRelaunch} disabled={isRelaunching}>
      {isRelaunching ? <Spinner size="sm" /> : <RefreshCw size={16} />}
      Relancer
    </Button>
  )}
  <Button variant="ghost" onClick={onClose}>Fermer</Button>
</DialogFooter>
```

---

## Partie 7: États des Boutons

### Logique canStop / canRelaunch

```typescript
const canStop = ['pending', 'running'].includes(task.status);
const canRelaunch = ['ready', 'validated', 'failed'].includes(task.status);

// Mutation hooks
const stopMutation = useMutation({
  mutationFn: stopTask,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['listGenerationJobs'] });
    toast.success('Tâche arrêtée');
  },
  onError: (error) => {
    toast.error(`Erreur: ${error.message}`);
  },
});

const relaunchMutation = useMutation({
  mutationFn: relaunchTask,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['listGenerationJobs'] });
    toast.success('Tâche relancée');
  },
  onError: (error) => {
    toast.error(`Erreur: ${error.message}`);
  },
});
```

---

## Résumé Implémentation

```
Phase 1: Store & Types
  └─ Modifier stores/tasks.ts (selectedTaskId)
  └─ Modifier lib/tasks/types.ts (TaskDetail, helpers)

Phase 2: Dialog Composant
  └─ Créer TaskDetailDialog.tsx
  └─ Intégrer dans TaskSideSheet.tsx
  └─ Intégrer dans routes/tasks.tsx

Phase 3: Composants Existants
  └─ Modifier TaskTreeItem.tsx (onOpenDetail prop)
  └─ Modifier TaskList.tsx (prop drilling)
  └─ Modifier index.ts (exports)

Phase 4: API Mutations
  └─ Créer hooks/useTaskActions.ts
  └─ Implémenter stop/relaunch mutations
```

---

## UX Considerations

1. **Click behavior**: Simple click = ouvrir dialog, expand arrow = toggle children
2. **Keyboard**: Escape = fermer dialog, Entrée = activer bouton principal
3. **Loading states**: Spinner sur boutons pendant mutation
4. **Feedback**: Toast notifications pour succès/erreur
5. **Real-time**: Dialog se met à jour via polling global
