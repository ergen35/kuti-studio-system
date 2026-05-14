import { useMemo } from 'react';

interface CharacterAvatarProps {
  name: string;
  colorPalette?: string[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-12 h-12 text-sm',
  md: 'w-20 h-20 text-lg',
  lg: 'w-32 h-32 text-2xl',
  xl: 'w-48 h-48 text-3xl',
};

// Generate a deterministic gradient from a color palette or name
function generateGradient(name: string, palette?: string[]): string {
  if (palette && palette.length >= 2) {
    const colors = palette.slice(0, 4);
    const angle = (name.length * 45) % 360;
    if (colors.length === 2) {
      return `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]})`;
    }
    return `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]} 50%, ${colors[2]})`;
  }
  
  // Fallback: hash-based warm gradient
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hues = [
    (hash * 137) % 360,
    (hash * 149) % 360,
    (hash * 163) % 360,
  ];
  const angle = (hash % 4) * 45;
  return `linear-gradient(${angle}deg, hsl(${hues[0]} 60% 55%), hsl(${hues[1]} 50% 45%))`;
}

// Generate initials from name (max 2 chars)
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CharacterAvatar({ name, colorPalette, size = 'md', className = '' }: CharacterAvatarProps) {
  const initials = useMemo(() => getInitials(name), [name]);
  const gradient = useMemo(() => generateGradient(name, colorPalette), [name, colorPalette]);
  
  return (
    <div
      className={`
        ${sizeClasses[size]}
        relative flex items-center justify-center
        rounded-full shadow-lg
        font-bold text-white uppercase tracking-wider
        transition-transform duration-300
        ${className}
      `}
      style={{ background: gradient }}
      aria-label={`Avatar de ${name}`}
    >
      <span className="drop-shadow-md">{initials}</span>
      {/* Decorative ring */}
      <div 
        className="absolute inset-0 rounded-full border-2 border-white/30"
        aria-hidden="true"
      />
    </div>
  );
}
