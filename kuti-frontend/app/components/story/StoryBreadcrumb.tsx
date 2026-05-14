import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, Check, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from '~/hooks/useTranslation';
import type { Tome, Chapter, Scene } from '~/lib/api';

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
  onToggle,
  onClose,
}: {
  label: string;
  items: DropdownItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className={clsx(
          "hidden lg:flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors",
          isOpen 
            ? "bg-accent/10 text-accent" 
            : "hover:bg-surface-2/50 text-ink"
        )}
      >
        <span className="font-medium">{label}</span>
        <ChevronDown 
          size={14} 
          className={clsx("transition-transform", isOpen && "rotate-180")} 
        />
      </button>
      
      {/* Mobile: just show text */}
      <span className="lg:hidden text-sm text-ink font-medium">{label}</span>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 max-h-64 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg z-50">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className={clsx(
                "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                item.isActive 
                  ? "bg-accent/10 text-accent" 
                  : "hover:bg-surface-2/50 text-ink"
              )}
            >
              <span className="text-xs text-muted w-8">#{item.number}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.isActive && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
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
  const sortedTomes = [...tomes].sort((a, b) => a.order_index - b.order_index);
  
  // Current tome chapters
  const tomeChapters = currentTomeId 
    ? chapters
        .filter(c => c.tome_id === currentTomeId)
        .sort((a, b) => a.order_index - b.order_index)
    : [];
  
  // Current chapter scenes
  const chapterScenes = currentChapterId && scenes
    ? scenes
        .filter(s => s.chapter_id === currentChapterId)
        .sort((a, b) => a.order_index - b.order_index)
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
    if (!currentTomeId || !tomeNumber) return t('tome.select') || 'Sélectionner un tome';
    const tome = sortedTomes.find(t => t.id === currentTomeId);
    return `${t('tome.shortNumber', { number: tomeNumber })}: ${tome?.title || 'Tome'}`;
  };
  
  const getCurrentChapterLabel = () => {
    if (!currentChapterId || !chapterNumber) return t('chapter.select') || 'Sélectionner un chapitre';
    const chapter = tomeChapters.find(c => c.id === currentChapterId);
    return `${t('chapter.shortNumber', { number: chapterNumber })}: ${chapter?.title || 'Chapitre'}`;
  };
  
  const getCurrentSceneLabel = () => {
    if (!currentSceneId || !sceneNumber) return t('scene.select') || 'Sélectionner une scène';
    const scene = chapterScenes.find(s => s.id === currentSceneId);
    return `${t('scene.shortNumber', { number: sceneNumber })}: ${scene?.title || 'Scène'}`;
  };
  
  return (
    <nav className="flex items-center gap-1 text-sm mb-4 flex-wrap">
      {/* Story root */}
      <button 
        onClick={() => navigate(`/projects/${projectId}/story`)}
        className="px-2 py-1 rounded-md hover:bg-surface-2/50 text-muted hover:text-ink transition-colors"
      >
        {t('title')}
      </button>
      
      <ChevronRight size={14} className="text-muted" />
      
      {/* Tome dropdown */}
      <BreadcrumbDropdown
        label={getCurrentTomeLabel()}
        items={tomeItems}
        isOpen={openDropdown === 'tome'}
        onToggle={() => setOpenDropdown(openDropdown === 'tome' ? null : 'tome')}
        onClose={() => setOpenDropdown(null)}
      />
      
      {/* Chapter dropdown (if chapter or scene) */}
      {(currentChapterId || currentSceneId) && (
        <>
          <ChevronRight size={14} className="text-muted hidden lg:block" />
          <BreadcrumbDropdown
            label={getCurrentChapterLabel()}
            items={chapterItems}
            isOpen={openDropdown === 'chapter'}
            onToggle={() => setOpenDropdown(openDropdown === 'chapter' ? null : 'chapter')}
            onClose={() => setOpenDropdown(null)}
          />
        </>
      )}
      
      {/* Scene dropdown (if scene) */}
      {currentSceneId && (
        <>
          <ChevronRight size={14} className="text-muted hidden lg:block" />
          <BreadcrumbDropdown
            label={getCurrentSceneLabel()}
            items={sceneItems}
            isOpen={openDropdown === 'scene'}
            onToggle={() => setOpenDropdown(openDropdown === 'scene' ? null : 'scene')}
            onClose={() => setOpenDropdown(null)}
          />
        </>
      )}
    </nav>
  );
}
