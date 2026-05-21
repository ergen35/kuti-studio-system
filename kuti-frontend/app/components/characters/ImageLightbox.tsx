import { useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { ListCharacterImagesResponse } from '~/lib/backend';
import { characterImageUrl } from '~/lib/image-urls';

interface ImageLightboxProps {
  image: ListCharacterImagesResponse[number] | null;
  isOpen: boolean;
  onClose: () => void;
  images?: ListCharacterImagesResponse[number][];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  projectId: string;
  characterId: string;
}

export function ImageLightbox({ 
  image, 
  isOpen, 
  onClose, 
  images = [], 
  currentIndex = 0, 
  onNavigate,
  projectId,
  characterId,
}: ImageLightboxProps) {
  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft' && onNavigate && currentIndex > 0) {
      onNavigate(currentIndex - 1);
    } else if (e.key === 'ArrowRight' && onNavigate && currentIndex < images.length - 1) {
      onNavigate(currentIndex + 1);
    }
  }, [isOpen, onClose, onNavigate, currentIndex, images.length]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  // Get image URL - use the character image file endpoint
  const getImageUrl = (imageId: string) => characterImageUrl(projectId, characterId, imageId);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Download image
  const handleDownload = async () => {
    if (!image) return;
    
    try {
      const response = await fetch(getImageUrl(image.id));
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  if (!isOpen || !image) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-surface/10 text-white/80 hover:bg-surface/20 hover:text-white transition-colors"
      >
        <X size={24} />
      </button>

      {/* Navigation - Previous */}
      {hasPrev && onNavigate && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex - 1);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-surface/10 text-white/80 hover:bg-surface/20 hover:text-white transition-colors"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {/* Navigation - Next */}
      {hasNext && onNavigate && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex + 1);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-surface/10 text-white/80 hover:bg-surface/20 hover:text-white transition-colors"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Main image */}
      <div 
        className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={getImageUrl(image.id)}
          alt={image.fileName}
          className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
        />
        
        {/* Info panel */}
        <div className="mt-4 max-w-2xl px-4 text-center">
          <p className="text-sm text-white/60 mb-2">
            {formatDate(image.createdAt)}
          </p>
          
          {(!!image.strategy || !!image.style) && (
            <div className="flex items-center justify-center gap-2 mb-3">
              {!!image.strategy && (
                <span className="px-2 py-1 rounded-full text-xs bg-accent/30 text-white">
                  {String(image.strategy)}
                </span>
              )}
              {!!image.style && (
                <span className="px-2 py-1 rounded-full text-xs bg-accent/30 text-white">
                  {String(image.style)}
                </span>
              )}
            </div>
          )}
          
          {image.prompt && (
            <p className="text-sm text-white/80 line-clamp-3">
              {image.prompt}
            </p>
          )}
          
          {/* Actions */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface/20 text-white/80 hover:bg-surface/30 hover:text-white transition-colors text-sm"
            >
              <Download size={16} />
              Télécharger
            </button>
            
            {images.length > 1 && (
              <span className="text-sm text-white/60">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
