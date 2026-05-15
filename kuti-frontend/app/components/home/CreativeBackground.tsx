"use client";

import { useMemo } from "react";
import { clsx } from "clsx";

interface CreativeBackgroundProps {
  images: string[];
  className?: string;
}

export function CreativeBackground({ images, className }: CreativeBackgroundProps) {
  const gridItems = useMemo(() => {
    if (images.length === 0) return [];
    const filledImages = [...images];
    while (filledImages.length < 12) filledImages.push(...images);
    return filledImages.slice(0, 12).map((src, i) => ({
      src,
      id: `${src}-${i}`,
      colSpan: [0, 3, 7, 11].includes(i) ? 2 : 1,
      rowSpan: [1, 5, 9].includes(i) ? 2 : 1,
    }));
  }, [images]);

  if (images.length === 0) {
    return (
      <div className={clsx("fixed inset-0 -z-10 bg-gradient-to-br from-surface via-surface-2 to-surface", className)}>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(var(--accent-rgb),0.03),transparent_50%)]" />
        </div>
      </div>
    );
  }

  return (
    <div className={clsx("fixed inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-surface" />
      <div className="absolute inset-0 grid grid-cols-4 md:grid-cols-6 auto-rows-fr gap-1 p-1 opacity-[0.25] dark:opacity-[0.10]">
        {gridItems.map((item) => (
          <div key={item.id} className={clsx("relative overflow-hidden", item.colSpan === 2 && "col-span-2", item.rowSpan === 2 && "row-span-2")}>
            <img src={item.src} alt="" className="absolute inset-0 w-full h-full object-cover grayscale" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-surface/25 via-surface/15 to-surface/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--surface)_100%)] opacity-15" />
      {/* Warm overlay for light theme */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50/20 via-transparent to-amber-50/10 dark:hidden pointer-events-none" />
    </div>
  );
}
