import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getProject, importAsset } from "../lib/api";
import { Badge, Button, Card, EmptyState, Input } from "../components/ui";
import { WorkspaceFrame } from "../components/layout/workspace-frame";
import { refreshWorkspaceData } from "../lib/query";
import { ActionDialog } from "../components/action-dialog";

export async function clientLoader({ params }: { params: { projectId: string } }) {
  return getProject(params.projectId);
}

clientLoader.hydrate = true as const;

export default function ProjectAssetsRoute() {
  const project = useLoaderData() as Awaited<ReturnType<typeof getProject>>;
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [sourcePath, setSourcePath] = useState(project.rootPath);
  const [assetName, setAssetName] = useState("");

  const importAssetMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof importAsset>[1]) => importAsset(project.id, payload),
    onSuccess: async () => {
      await refreshWorkspaceData(queryClient);
      revalidator.revalidate();
    },
  });

  function handleImportAsset() {
    setSourcePath(project.rootPath);
    setAssetName("");
    setImportDialogOpen(true);
  }

  return (
    <>
      <ActionDialog
        isOpen={importDialogOpen}
        title="Import asset"
        description="Register a local file or folder into the asset library."
        confirmLabel="Import asset"
        isPending={importAssetMutation.isPending}
        confirmDisabled={!sourcePath.trim()}
        onDismiss={() => setImportDialogOpen(false)}
        onConfirm={() => {
          const trimmedSourcePath = sourcePath.trim();
          if (!trimmedSourcePath) {
            return;
          }

          const defaultName = trimmedSourcePath.split("/").filter(Boolean).at(-1) ?? "Imported asset";
          setImportDialogOpen(false);
          importAssetMutation.mutate({
            source_path: trimmedSourcePath,
            name: assetName.trim() || defaultName,
            description: `Imported from ${trimmedSourcePath}`,
            tags_json: [],
          });
        }}
      >
        <div className="space-y-3">
          <Input value={sourcePath} onChange={setSourcePath} placeholder="/path/to/asset" />
          <Input value={assetName} onChange={setAssetName} placeholder="Asset name" />
        </div>
      </ActionDialog>

      <WorkspaceFrame
      eyebrow="Assets library"
      title="Assets"
      description="Browse the local media inventory, usage links, and missing files without leaving the project context."
      toolbar={
        <Button variant="secondary" onClick={handleImportAsset} isDisabled={importAssetMutation.isPending}>
          Import asset
        </Button>
      }
      left={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Filters</div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="muted">Images</Badge>
            <Badge tone="muted">Text</Badge>
            <Badge tone="muted">Audio</Badge>
            <Badge tone="muted">Orphaned</Badge>
          </div>
        </Card>
      }
      center={
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {project.assets.map((asset) => (
            <Card key={asset.id} padding="md" className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{asset.name}</div>
                  <div className="text-xs text-[rgb(var(--muted-foreground))]">{asset.kind}</div>
                </div>
                <Badge tone={asset.status === "active" ? "active" : asset.status === "review" ? "warning" : "draft"}>{asset.status}</Badge>
              </div>
              <div className="text-sm text-[rgb(var(--muted-foreground))]">{asset.size}</div>
              <div className="flex flex-wrap gap-2">
                {asset.tags.map((tag) => <Badge key={tag} tone="muted">{tag}</Badge>)}
              </div>
            </Card>
          ))}
        </div>
      }
      right={
        <>
          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Usage</div>
            {project.assets.slice(0, 2).map((asset) => (
              <div key={asset.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-3">
                <div className="text-sm font-medium">{asset.name}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {asset.usage.map((usage) => <Badge key={usage} tone="primary">{usage}</Badge>)}
                </div>
              </div>
            ))}
          </Card>
        </>
      }
      />
    </>
  );
}

export function ErrorBoundary() {
  return <EmptyState title="Assets unavailable" description="The asset library could not be loaded." />;
}
