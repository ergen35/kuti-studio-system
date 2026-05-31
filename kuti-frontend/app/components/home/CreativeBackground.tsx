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
      <div className={clsx("fixed inset-0 -z-10 bg-bg", className)}>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--surface)_0%,transparent_28%),radial-gradient(circle_at_18%_8%,color-mix(in_oklab,var(--accent),transparent_90%),transparent_28rem)]" />
      </div>
    );
  }

  return (
    <div className={clsx("fixed inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-bg" />
      <div className="absolute inset-x-0 top-0 grid h-[44vh] grid-cols-4 gap-px opacity-[0.16] grayscale dark:opacity-[0.10] md:grid-cols-6">
        {gridItems.map((item) => (
          <div key={item.id} className={clsx("relative overflow-hidden", item.colSpan === 2 && "col-span-2", item.rowSpan === 2 && "row-span-2")}>
            <img src={item.src} alt="" className="absolute inset-0 w-full h-full object-cover grayscale" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bg),transparent_10%)_0%,var(--bg)_54%),radial-gradient(circle_at_18%_5%,color-mix(in_oklab,var(--accent),transparent_88%),transparent_30rem)]" />
    </div>
  );
}
