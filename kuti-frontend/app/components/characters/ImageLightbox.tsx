import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { ListCharacterImagesResponse } from '~/lib/backend';
import { Button } from '~/components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Badge } from '~/components/ui/badge';
import { useTranslation } from '~/hooks/useTranslation';
import { characterImageUrlFromData, type CharacterImageWithUrl } from '~/lib/image-urls';

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
  const { t } = useTranslation('characters');
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

  // Get image URL using publicUrl or fallback
  const getImageUrl = (img: CharacterImageWithUrl) => characterImageUrlFromData(img);

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
      const response = await fetch(getImageUrl(image));
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

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  return (
    <Dialog open={isOpen && Boolean(image)} onOpenChange={(open) => !open && onClose()}>
      {image && (
        <DialogContent className="max-h-[92vh] max-w-[min(96vw,1200px)] overflow-hidden bg-ink text-white" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>{t('generation.lightbox.title')}</DialogTitle>
            <DialogDescription>{t('generation.lightbox.description')}</DialogDescription>
          </DialogHeader>

      <Button
        type="button"
        variant="ghost"
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:bg-white/10"
        title={t('generation.lightbox.close')}
      >
        <X />
      </Button>

      {/* Navigation - Previous */}
      {hasPrev && onNavigate && (
        <Button
          type="button"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex - 1);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
          title={t('generation.lightbox.previous')}
        >
          <ChevronLeft />
        </Button>
      )}

      {/* Navigation - Next */}
      {hasNext && onNavigate && (
        <Button
          type="button"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex + 1);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
          title={t('generation.lightbox.next')}
        >
          <ChevronRight />
        </Button>
      )}

      <div className="flex max-h-[86vh] flex-col items-center">
        <img
          src={getImageUrl(image)}
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
                <Badge variant="secondary" className="bg-white/10 text-white">
                  {String(image.strategy)}
                </Badge>
              )}
              {!!image.style && (
                <Badge variant="secondary" className="bg-white/10 text-white">
                  {String(image.style)}
                </Badge>
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
            <Button
              type="button"
              variant="ghost"
              onClick={handleDownload}
              className="text-white hover:bg-white/10"
            >
              <Download />
              {t('generation.download')}
            </Button>
            
            {images.length > 1 && (
              <span className="text-sm text-white/60">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>
        </div>
      </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
