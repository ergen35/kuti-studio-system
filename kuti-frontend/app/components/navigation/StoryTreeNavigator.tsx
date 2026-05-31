import { clsx } from "clsx";
import { BookOpen, Book, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "~/hooks/useTranslation";
import { Button } from "~/components/ui";
import { useOrchestraStore } from "~/stores/orchestra";
import type { GetStorySummaryResponse } from '~/lib/backend';

interface StoryTreeNavigatorProps {
  projectId: string;
  tomes: GetStorySummaryResponse['tomes'];
  chapters: GetStorySummaryResponse['chapters'];
  scenes: GetStorySummaryResponse['scenes'];
  currentSceneId?: string;
  onSelectScene: (sceneId: string, chapterId: string, tomeId: string) => void;
}

interface TomeNodeProps {
  tome: GetStorySummaryResponse['tomes'][number];
  chapters: GetStorySummaryResponse['chapters'];
  scenes: GetStorySummaryResponse['scenes'];
  currentSceneId?: string;
  level: number;
  onSelectScene: (sceneId: string, chapterId: string, tomeId: string) => void;
}

interface ChapterNodeProps {
  chapter: GetStorySummaryResponse['chapters'][number];
  scenes: GetStorySummaryResponse['scenes'];
  currentSceneId?: string;
  level: number;
  onSelectScene: (sceneId: string, chapterId: string, tomeId: string) => void;
}

function SceneNode({
  scene,
  isActive,
  level,
  onClick,
}: {
  scene: GetStorySummaryResponse['scenes'][number];
  isActive: boolean;
  level: number;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={clsx(
        "flex h-auto w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-primary/8 hover:text-primary",
        isActive && "bg-primary/10 text-primary ring-1 ring-primary/35"
      )}
      style={{ paddingLeft: `${12 + level * 16}px` }}
    >
      <FileText size={14} className={clsx(isActive ? "text-primary" : "text-muted-foreground")} />
      <span className="flex-1 truncate">{scene.title}</span>
    </Button>
  );
}

function ChapterNode({
  chapter,
  scenes,
  currentSceneId,
  level,
  onSelectScene,
}: ChapterNodeProps) {
  const { expandedChapterIds, toggleChapter, selectChapter, selectedChapterId } = useOrchestraStore();
  const isExpanded = expandedChapterIds.has(chapter.id);
  const chapterScenes = scenes
    .filter((s) => s.chapterId === chapter.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const hasChildren = chapterScenes.length > 0;
  const isSelected = selectedChapterId === chapter.id;

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          toggleChapter(chapter.id);
          selectChapter(chapter.id);
        }}
        className={clsx(
          "flex h-auto w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-primary/8 hover:text-primary",
          isSelected && !currentSceneId && "bg-primary/10 text-primary ring-1 ring-primary/35"
        )}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <span className="flex size-4 items-center justify-center">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground" />
            )
          ) : (
            <span className="size-1 rounded-full bg-muted-foreground" />
          )}
        </span>
        <Book size={14} className={clsx(isSelected ? "text-primary" : "text-muted-foreground")} />
        <span className="flex-1 truncate font-medium">{chapter.title}</span>
        {hasChildren && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
            {chapterScenes.length}
          </span>
        )}
      </Button>

      {isExpanded && chapterScenes.map((scene) => (
        <SceneNode
          key={scene.id}
          scene={scene}
          isActive={scene.id === currentSceneId}
          level={level + 1}
          onClick={() => {
            onSelectScene(scene.id, chapter.id, chapter.tomeId);
          }}
        />
      ))}
    </div>
  );
}

function TomeNode({
  tome,
  chapters,
  scenes,
  currentSceneId,
  level,
  onSelectScene,
}: TomeNodeProps) {
  const { expandedTomeIds, toggleTome, selectTome, selectedTomeId } = useOrchestraStore();
  const isExpanded = expandedTomeIds.has(tome.id);
  const tomeChapters = chapters
    .filter((c) => c.tomeId === tome.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const hasChildren = tomeChapters.length > 0;
  const isSelected = selectedTomeId === tome.id;

  return (
    <div className="mb-1">
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          toggleTome(tome.id);
          selectTome(tome.id);
        }}
        className={clsx(
          "flex h-auto w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-primary/8 hover:text-primary",
          isSelected && !currentSceneId && "bg-primary/10 text-primary ring-1 ring-primary/35"
        )}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <span className="flex size-4 items-center justify-center">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground" />
            )
          ) : (
            <span className="size-1 rounded-full bg-muted-foreground" />
          )}
        </span>
        <BookOpen size={16} className={clsx(isSelected ? "text-primary" : "text-muted-foreground")} />
        <span className="flex-1 truncate font-medium">{tome.title}</span>
        {hasChildren && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
            {tomeChapters.length}
          </span>
        )}
      </Button>

      {isExpanded && tomeChapters.map((chapter) => (
        <ChapterNode
          key={chapter.id}
          chapter={chapter}
          scenes={scenes}
          currentSceneId={currentSceneId}
          level={level + 1}
          onSelectScene={onSelectScene}
        />
      ))}
    </div>
  );
}

export function StoryTreeNavigator({
  projectId,
  tomes,
  chapters,
  scenes,
  currentSceneId,
  onSelectScene,
}: StoryTreeNavigatorProps) {
  const { t } = useTranslation('story');
  const sortedTomes = [...tomes].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">{t('tree.title')}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('tree.stats', { tomes: tomes.length, chapters: chapters.length, scenes: scenes.length })}
        </p>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-2 py-2">
        {sortedTomes.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <BookOpen size={32} className="mx-auto mb-2 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">{t('tree.empty.title')}</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {t('tree.empty.description')}
            </p>
          </div>
        ) : (
          sortedTomes.map((tome) => (
            <TomeNode
              key={tome.id}
              tome={tome}
              chapters={chapters}
              scenes={scenes}
              currentSceneId={currentSceneId}
              level={0}
              onSelectScene={onSelectScene}
            />
          ))
        )}
      </div>

      <div className="border-t border-border px-3 py-2 text-center">
        <p className="text-xs text-muted-foreground">
          {t('tree.hint')}
        </p>
      </div>
    </div>
  );
}
