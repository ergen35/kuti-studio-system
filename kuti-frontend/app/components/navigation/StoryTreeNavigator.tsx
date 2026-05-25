import { clsx } from "clsx";
import { BookOpen, Book, FileText, ChevronDown, ChevronRight } from "lucide-react";
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
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors rounded-md",
        "hover:bg-surface-2",
        isActive && "bg-accent/10 text-accent ring-1 ring-accent/50"
      )}
      style={{ paddingLeft: `${12 + level * 16}px` }}
    >
      <FileText size={14} className={clsx(isActive ? "text-accent" : "text-muted")} />
      <span className="truncate flex-1">{scene.title}</span>
    </button>
  );
}

function ChapterNode({
  chapter,
  scenes,
  currentSceneId,
  level,
  onSelectScene,
}: ChapterNodeProps) {
  const { expandedChapterIds, toggleChapter, expandChapter, selectChapter, selectedChapterId } = useOrchestraStore();
  const isExpanded = expandedChapterIds.has(chapter.id);
  const chapterScenes = scenes
    .filter((s) => s.chapterId === chapter.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const hasChildren = chapterScenes.length > 0;
  const isSelected = selectedChapterId === chapter.id;

  return (
    <div>
      <button
        onClick={() => {
          toggleChapter(chapter.id);
          selectChapter(chapter.id);
        }}
        className={clsx(
          "w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors rounded-md",
          "hover:bg-surface-2",
          isSelected && !currentSceneId && "bg-surface-2 text-ink ring-1 ring-line"
        )}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <span className="w-4 h-4 flex items-center justify-center">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} className="text-muted" />
            ) : (
              <ChevronRight size={14} className="text-muted" />
            )
          ) : (
            <span className="w-1 h-1 rounded-full bg-muted" />
          )}
        </span>
        <Book size={14} className={clsx(isSelected ? "text-accent" : "text-muted")} />
        <span className="truncate flex-1 font-medium">{chapter.title}</span>
        {hasChildren && (
          <span className="text-xs text-muted bg-surface-2 px-1.5 py-0.5 rounded">
            {chapterScenes.length}
          </span>
        )}
      </button>

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
  const { expandedTomeIds, toggleTome, expandTome, selectTome, selectedTomeId } = useOrchestraStore();
  const isExpanded = expandedTomeIds.has(tome.id);
  const tomeChapters = chapters
    .filter((c) => c.tomeId === tome.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const hasChildren = tomeChapters.length > 0;
  const isSelected = selectedTomeId === tome.id;

  return (
    <div className="mb-1">
      <button
        onClick={() => {
          toggleTome(tome.id);
          selectTome(tome.id);
        }}
        className={clsx(
          "w-full flex items-center gap-2 px-2 py-2 text-left text-sm transition-colors rounded-md",
          "hover:bg-surface-2",
          isSelected && !currentSceneId && "bg-surface-2 text-ink ring-1 ring-line"
        )}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <span className="w-4 h-4 flex items-center justify-center">
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} className="text-muted" />
            ) : (
              <ChevronRight size={14} className="text-muted" />
            )
          ) : (
            <span className="w-1 h-1 rounded-full bg-muted" />
          )}
        </span>
        <BookOpen size={16} className={clsx(isSelected ? "text-accent" : "text-muted")} />
        <span className="truncate flex-1 font-medium">{tome.title}</span>
        {hasChildren && (
          <span className="text-xs text-muted bg-surface-2 px-1.5 py-0.5 rounded">
            {tomeChapters.length}
          </span>
        )}
      </button>

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
  const sortedTomes = [...tomes].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="h-full flex flex-col bg-surface border-l border-line">
      <div className="px-4 py-3 border-b border-line">
        <h3 className="text-sm font-medium text-ink">Structure narrative</h3>
        <p className="text-xs text-muted mt-0.5">
          {tomes.length} tome{tomes.length > 1 ? 's' : ''} · {chapters.length} chapitre{chapters.length > 1 ? 's' : ''} · {scenes.length} scène{scenes.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 custom-scrollbar">
        {sortedTomes.length === 0 ? (
          <div className="text-center py-8 px-4">
            <BookOpen size={32} className="mx-auto text-muted/50 mb-2" />
            <p className="text-sm text-muted">Aucun tome</p>
            <p className="text-xs text-muted/70 mt-1">
              Commencez par créer un tome dans la section Storyline
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

      <div className="px-3 py-2 border-t border-line text-center">
        <p className="text-xs text-muted">
          Double-cliquez un nœud pour centrer
        </p>
      </div>
    </div>
  );
}
