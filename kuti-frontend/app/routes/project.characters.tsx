import { useLoaderData, useNavigate } from "react-router";
import { getProject } from "../lib/api";
import { Badge, Button, Card, EmptyState, Separator } from "../components/ui";
import { WorkspaceFrame } from "../components/layout/workspace-frame";

export async function clientLoader({ params }: { params: { projectId: string } }) {
  return getProject(params.projectId);
}

clientLoader.hydrate = true as const;

export default function ProjectCharactersRoute() {
  const project = useLoaderData() as Awaited<ReturnType<typeof getProject>>;
  const navigate = useNavigate();

  return (
    <WorkspaceFrame
      eyebrow="Character workspace"
      title="Characters"
      description="Maintain editorial sheets, relationships, scene links, and voice notes in a dense but readable master-detail layout."
      toolbar={<Button onClick={() => navigate(`/projects/${project.id}/story`)}>Open linked scenes</Button>}
      left={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Cast list</div>
          <div className="space-y-2">
            {project.characters.map((character) => (
              <button key={character.id} type="button" className="w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-3 text-left transition hover:border-[rgb(var(--primary)/0.28)]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{character.name}</div>
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">{character.alias}</div>
                  </div>
                  <Badge tone={character.status === "active" ? "active" : character.status === "review" ? "draft" : "archived"}>{character.status}</Badge>
                </div>
              </button>
            ))}
          </div>
        </Card>
      }
      center={
        <>
          {project.characters.slice(0, 1).map((character) => (
            <Card key={character.id} padding="lg" className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Selected character</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight">{character.name}</div>
                  <div className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">{character.role} · {character.alias}</div>
                </div>
                <Badge tone={character.status === "active" ? "active" : character.status === "review" ? "draft" : "archived"}>{character.status}</Badge>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Summary</div>
                  <p className="mt-2 text-sm leading-6 text-[rgb(var(--foreground))]">{character.summary}</p>
                </div>
                <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Narrative arc</div>
                  <p className="mt-2 text-sm leading-6 text-[rgb(var(--foreground))]">{character.arc}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Personality</div>
                  <p className="mt-2 text-sm leading-6 text-[rgb(var(--foreground))]">{character.personality}</p>
                </div>
                <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Voice</div>
                  <p className="mt-2 text-sm leading-6 text-[rgb(var(--foreground))]">{character.voice}</p>
                </div>
              </div>
            </Card>
          ))}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {project.characters.map((character) => (
              <Card key={character.id} padding="md" className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{character.name}</div>
                  <Badge tone="primary">{character.tags.length} tags</Badge>
                </div>
                <div className="text-sm text-[rgb(var(--muted-foreground))]">Scenes {character.scenes.join(", ")}</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {character.tags.map((tag) => <Badge key={tag} tone="muted">{tag}</Badge>)}
                </div>
              </Card>
            ))}
          </div>
        </>
      }
      right={
        <>
          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Relations</div>
            {project.characters[0].relations.map((relation) => (
              <div key={`${relation.target}-${relation.type}`} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{relation.target}</div>
                  <Badge tone={relation.intensity > 60 ? "primary" : "muted"}>{relation.intensity}</Badge>
                </div>
                <div className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">{relation.type}</div>
              </div>
            ))}
          </Card>

          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Linked scenes</div>
            <div className="space-y-2">
              {project.scenes.slice(0, 3).map((scene) => (
                <button key={scene.id} type="button" className="w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-3 text-left">
                  <div className="text-sm font-medium">{scene.title}</div>
                  <div className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">{scene.location}</div>
                </button>
              ))}
            </div>
          </Card>
        </>
      }
    />
  );
}

export function ErrorBoundary() {
  return <EmptyState title="Characters unavailable" description="The character workspace could not be loaded." />;
}
