import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, Check, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from '~/hooks/useTranslation';
import { Button } from '~/components/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import type { GetStorySummaryResponse } from '~/lib/backend';

type Tome = GetStorySummaryResponse['tomes'][number];
type Chapter = GetStorySummaryResponse['chapters'][number];
type Scene = GetStorySummaryResponse['scenes'][number];

interface StoryBreadcrumbProps {
  projectId: string;
  tomes: Tome[];
  chapters: Chapter[];
  scenes?: Scene[];
  currentTomeId?: string;
  currentChapterId?: string;
  currentSceneId?: string;
  tomeNumber?: number;
  chapterNumber?: number;
  sceneNumber?: number;
}

interface DropdownItem {
  id: string;
  label: string;
  number: number;
  isActive: boolean;
  onClick: () => void;
}

function BreadcrumbDropdown({
  label,
  items,
  isOpen,
  onOpenChange,
  onClose,
}: {
  label: string;
  items: DropdownItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
}) {
  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={clsx(
            "hidden h-8 max-w-[280px] items-center gap-1.5 rounded-md px-2.5 text-sm lg:flex",
            isOpen
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-primary/8 hover:text-primary"
          )}
        >
          <span className="truncate font-medium">{label}</span>
          <ChevronDown
            size={14}
            className={clsx("shrink-0 transition-transform", isOpen && "rotate-180")}
          />
        </Button>
      </DropdownMenuTrigger>

      <span className="max-w-[260px] truncate text-sm font-medium text-foreground lg:hidden">{label}</span>

      <DropdownMenuContent className="max-h-72 w-64 overflow-y-auto" align="start">
        <DropdownMenuGroup>
          {items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className={clsx(
                "gap-2 py-1.5",
                item.isActive && "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary"
              )}
            >
              <span className="w-8 shrink-0 text-xs text-muted-foreground">#{item.number}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.isActive && <Check size={14} />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StoryBreadcrumb({
  projectId,
  tomes,
  chapters,
  scenes,
  currentTomeId,
  currentChapterId,
  currentSceneId,
  tomeNumber,
  chapterNumber,
  sceneNumber,
}: StoryBreadcrumbProps) {
  const { t } = useTranslation('story');
  const navigate = useNavigate();
  
  const [openDropdown, setOpenDropdown] = useState<'tome' | 'chapter' | 'scene' | null>(null);
  
  // Sort items
  const sortedTomes = [...tomes].sort((a, b) => a.orderIndex - b.orderIndex);

  // Current tome chapters
  const tomeChapters = currentTomeId
    ? chapters
        .filter(c => c.tomeId === currentTomeId)
        .sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  // Current chapter scenes
  const chapterScenes = currentChapterId && scenes
    ? scenes
        .filter(s => s.chapterId === currentChapterId)
        .sort((a, b) => a.orderIndex - b.orderIndex)
    : [];
  
  // Build tome items
  const tomeItems: DropdownItem[] = sortedTomes.map((tome, index) => ({
    id: tome.id,
    label: tome.title,
    number: index + 1,
    isActive: tome.id === currentTomeId,
    onClick: () => navigate(`/projects/${projectId}/story/${tome.id}`),
  }));
  
  // Build chapter items
  const chapterItems: DropdownItem[] = tomeChapters.map((chapter, index) => ({
    id: chapter.id,
    label: chapter.title,
    number: index + 1,
    isActive: chapter.id === currentChapterId,
    onClick: () => navigate(`/projects/${projectId}/story/${currentTomeId}/chapters/${chapter.id}`),
  }));
  
  // Build scene items
  const sceneItems: DropdownItem[] = chapterScenes.map((scene, index) => ({
    id: scene.id,
    label: scene.title,
    number: index + 1,
    isActive: scene.id === currentSceneId,
    onClick: () => navigate(`/projects/${projectId}/story/${currentTomeId}/scenes/${scene.id}`),
  }));
  
  const getCurrentTomeLabel = () => {
    if (!currentTomeId || !tomeNumber) return t('tome.select');
    const tome = sortedTomes.find(t => t.id === currentTomeId);
    return `${t('tome.shortNumber', { number: tomeNumber })}: ${tome?.title || t('tome.fallbackTitle')}`;
  };
  
  const getCurrentChapterLabel = () => {
    if (!currentChapterId || !chapterNumber) return t('chapter.select');
    const chapter = tomeChapters.find(c => c.id === currentChapterId);
    return `${t('chapter.shortNumber', { number: chapterNumber })}: ${chapter?.title || t('chapter.fallbackTitle')}`;
  };
  
  const getCurrentSceneLabel = () => {
    if (!currentSceneId || !sceneNumber) return t('scene.select');
    const scene = chapterScenes.find(s => s.id === currentSceneId);
    return `${t('scene.shortNumber', { number: sceneNumber })}: ${scene?.title || t('scene.fallbackTitle')}`;
  };
  
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm">
      {/* Story root */}
      <Button
        type="button"
        variant="ghost"
        onClick={() => navigate(`/projects/${projectId}/story`)}
        className="h-8 rounded-md px-2.5 text-muted-foreground hover:bg-primary/8 hover:text-primary"
      >
        {t('title')}
      </Button>
      
      <ChevronRight size={14} className="text-muted-foreground" />
      
      {/* Tome dropdown */}
      <BreadcrumbDropdown
        label={getCurrentTomeLabel()}
        items={tomeItems}
        isOpen={openDropdown === 'tome'}
        onOpenChange={(open) => setOpenDropdown(open ? 'tome' : null)}
        onClose={() => setOpenDropdown(null)}
      />
      
      {/* Chapter dropdown (if chapter or scene) */}
      {(currentChapterId || currentSceneId) && (
        <>
          <ChevronRight size={14} className="hidden text-muted-foreground lg:block" />
          <BreadcrumbDropdown
            label={getCurrentChapterLabel()}
            items={chapterItems}
            isOpen={openDropdown === 'chapter'}
            onOpenChange={(open) => setOpenDropdown(open ? 'chapter' : null)}
            onClose={() => setOpenDropdown(null)}
          />
        </>
      )}
      
      {/* Scene dropdown (if scene) */}
      {currentSceneId && (
        <>
          <ChevronRight size={14} className="hidden text-muted-foreground lg:block" />
          <BreadcrumbDropdown
            label={getCurrentSceneLabel()}
            items={sceneItems}
            isOpen={openDropdown === 'scene'}
            onOpenChange={(open) => setOpenDropdown(open ? 'scene' : null)}
            onClose={() => setOpenDropdown(null)}
          />
        </>
      )}
    </nav>
  );
}
