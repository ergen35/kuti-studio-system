"use client";

import { Plus, Sparkles } from "lucide-react";
import { Button } from "~/components/ui";

interface HeroSectionProps {
  projectName: string;
  onProjectNameChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function HeroSection({
  projectName,
  onProjectNameChange,
  onSubmit,
  isLoading,
  error,
}: HeroSectionProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectName.trim()) {
      onSubmit();
    }
  };

  return (
    <div className="relative">
      {/* Glassmorphism container */}
      <div className="relative rounded-2xl bg-surface/80 backdrop-blur-md border border-line/50 p-8 md:p-12 shadow-2xl">
        {/* Decorative accent */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 via-transparent to-accent/5 pointer-events-none" />
        
        <div className="relative text-center max-w-2xl mx-auto">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-6">
            <Sparkles size={32} className="text-accent" />
          </div>
          
          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ink tracking-tight mb-4">
            Kuti Studio
          </h1>
          
          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted mb-8">
            Studio narratif pour œuvres multimédias
          </p>
          
          {/* Create form */}
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <input
              type="text"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="Nom du nouveau projet..."
              className="flex-1 min-h-12 px-4 rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
              disabled={isLoading}
            />
            <Button 
              variant="primary" 
              disabled={isLoading || !projectName.trim()}
              className="min-h-12 px-6"
            >
              <Plus size={20} className="mr-2" />
              {isLoading ? "Création..." : "Créer"}
            </Button>
          </form>
          
          {error && (
            <p className="mt-3 text-sm text-danger">{error}</p>
          )}
        </div>
      </div>
      
      {/* Subtle glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 via-accent/5 to-accent/20 rounded-2xl blur-xl opacity-50 -z-10" />
    </div>
  );
}
