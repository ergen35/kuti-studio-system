"use client";

import { useMemo } from "react";
import { clsx } from "clsx";

interface CreativeBackgroundProps {
  images: string[];
  className?: string;
}

export function CreativeBackground({
  images,
  className,
}: CreativeBackgroundProps) {
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
        {/* Spectrum 2 style gradient mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_oklab,var(--accent),transparent_92%),transparent),radial-gradient(ellipse_60%_40%_at_80%_0%,color-mix(in_oklab,var(--success),transparent_96%),transparent),radial-gradient(ellipse_50%_30%_at_10%_10%,color-mix(in_oklab,var(--warning),transparent_97%),transparent)]" />
        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />
      </div>
    );
  }

  return (
    <div className={clsx("fixed inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-bg" />
      <div className="absolute inset-x-0 top-0 grid h-[44vh] grid-cols-4 gap-0.5 opacity-[0.12] grayscale dark:opacity-[0.08] md:grid-cols-6">
        {gridItems.map((item) => (
          <div
            key={item.id}
            className={clsx(
              "relative overflow-hidden",
              item.colSpan === 2 && "col-span-2",
              item.rowSpan === 2 && "row-span-2",
            )}
          >
            <img
              src={item.src}
              alt=""
              className="absolute inset-0 w-full h-full object-cover grayscale"
            />
          </div>
        ))}
      </div>
      {/* Spectrum 2 style overlay with gradient mesh */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bg),transparent_5%)_0%,var(--bg)_50%),radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--accent),transparent_90%),transparent)]" />
    </div>
  );
}
