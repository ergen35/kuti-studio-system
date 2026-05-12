import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createScene, getProject } from "../lib/api";
import { Badge, Button, Card, EmptyState, Input, Separator, Textarea } from "../components/ui";
import { WorkspaceFrame } from "../components/layout/workspace-frame";
import { refreshWorkspaceData } from "../lib/query";
import { ActionDialog } from "../components/action-dialog";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "scene";
}

export async function clientLoader({ params }: { params: { projectId: string } }) {
  return getProject(params.projectId);
}

clientLoader.hydrate = true as const;

export default function ProjectStoryRoute() {
  const project = useLoaderData() as Awaited<ReturnType<typeof getProject>>;
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();
  const [sceneDialogOpen, setSceneDialogOpen] = useState(false);
  const [sceneTitle, setSceneTitle] = useState("New scene");

  const createSceneMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof createScene>[1]) => createScene(project.id, payload),
    onSuccess: async () => {
      await refreshWorkspaceData(queryClient);
      revalidator.revalidate();
    },
  });

  function handleAddScene() {
    setSceneTitle("New scene");
    setSceneDialogOpen(true);
  }

  return (
    <>
      <ActionDialog
        isOpen={sceneDialogOpen}
        title="Add scene"
        description="Create a new scene in the first tome and chapter, using the current story structure."
        confirmLabel="Add scene"
        isPending={createSceneMutation.isPending}
        confirmDisabled={!sceneTitle.trim()}
        onDismiss={() => setSceneDialogOpen(false)}
        onConfirm={() => {
          const title = sceneTitle.trim();
          const tome = project.story.tomes[0];
          const chapter = project.story.chapters[0];

          if (!title || !tome || !chapter) {
            return;
          }

          setSceneDialogOpen(false);
          createSceneMutation.mutate({
            tome_id: tome.id,
            chapter_id: chapter.id,
            title,
            slug: slugify(title),
            summary: "",
            content: "",
            notes: "",
            characters_json: [],
            tags_json: [],
            status: "draft",
            order_index: project.scenes.length,
          });
        }}
      >
        <Input autoFocus value={sceneTitle} onChange={setSceneTitle} placeholder="Scene title" />
      </ActionDialog>

      <WorkspaceFrame
        eyebrow="Story workspace"
        title="Story"
        description="Structure tomes, chapters, and scenes with the narrative editor in the center and coherence checks at the edge."
        toolbar={
          <Button variant="secondary" onClick={handleAddScene} isDisabled={createSceneMutation.isPending}>
            Add scene
          </Button>
        }
        left={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Structure</div>
          <div className="space-y-3">
            {project.scenes.map((scene) => (
              <div key={scene.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{scene.title}</div>
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">{scene.tome} · {scene.chapter}</div>
                  </div>
                  <Badge tone={scene.status === "draft" ? "draft" : scene.status === "review" ? "warning" : "active"}>{scene.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
        }
        center={
        <Card padding="lg" className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Scene editor</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">{project.scenes[0].title}</div>
            </div>
            <Badge tone={project.scenes[0].status === "active" ? "active" : project.scenes[0].status === "review" ? "warning" : "draft"}>{project.scenes[0].status}</Badge>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Summary</div>
              <p className="mt-2 text-sm leading-6">{project.scenes[0].summary}</p>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Intention</div>
              <p className="mt-2 text-sm leading-6">{project.scenes[0].intention}</p>
            </div>
          </div>

          <Textarea defaultValue={project.scenes[0].notes} aria-label="Scene notes" />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-3 text-sm sm:p-4"><div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]">Location</div><div className="mt-1 font-medium">{project.scenes[0].location}</div></div>
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-3 text-sm sm:p-4"><div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]">Duration</div><div className="mt-1 font-medium">{project.scenes[0].duration}</div></div>
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-3 text-sm sm:p-4"><div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]">Pace</div><div className="mt-1 font-medium">{project.scenes[0].pace}</div></div>
          </div>
        </Card>
        }
        right={
        <>
          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">References</div>
            <div className="space-y-3">
              {project.scenes[0].references.map((reference) => (
                <div key={`${reference.kind}-${reference.value}`} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">@{reference.kind}:{reference.value}</div>
                    <Badge tone={reference.valid ? "resolved" : "danger"}>{reference.valid ? "ok" : "orphan"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Characters</div>
            <div className="flex flex-wrap gap-2">
              {project.scenes[0].characters.map((character) => <Badge key={character} tone="primary">{character}</Badge>)}
            </div>
          </Card>
        </>
      }
      />
    </>
  );
}

export function ErrorBoundary() {
  return <EmptyState title="Story unavailable" description="The story workspace could not be loaded." />;
}
