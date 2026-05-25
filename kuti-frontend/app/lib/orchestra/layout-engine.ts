import type { Tome, Chapter, Scene, NodePosition, LayoutConfig } from './types';
import { DEFAULT_LAYOUT_CONFIG } from './types';

/**
 * Calcule les positions 2D des nœuds narratifs dans un layout chronologique linéaire.
 *
 * Structure visuelle:
 * ```
 *        [Tome 1]                       [Tome 2]
 *           |                              |
 *           |                              |
 *       [Chap1.1]                      [Chap2.1]
 *           |                              |
 *           v                              v
 *     [Sc1]---[Sc2]---[Sc3]          [Sc4]---[Sc5]
 *      ↑___________|                    ↑_____|
 *        connexions                      connexions
 *        scene-scene                     scene-scene
 *        (horizontale,                   (horizontale,
 *         ligne continue)                 ligne continue)
 * ```
 *
 * Stratégie:
 * 1. Positionner d'abord toutes les scènes en chronologie (base horizontale)
 * 2. Centrer les chapitres sur leurs scènes
 * 3. Centrer les tomes sur leurs chapitres
 */
export function calculateNodePositions(
  tomes: Tome[],
  chapters: Chapter[],
  scenes: Scene[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();

  const sortedTomes = [...tomes].sort((a, b) => a.orderIndex - b.orderIndex);
  const sceneSpacing = config.sceneSpacing; // 100px
  const chapterToScenes = new Map<string, { firstX: number; lastX: number }>();
  const tomeToChapters = new Map<string, { firstX: number; lastX: number }>();

  let currentX = 0;

  // ═══════════════════════════════════════════════════════════════
  // ÉTAPE 1: Positionner toutes les scènes en chronologie
  // ═══════════════════════════════════════════════════════════════
  for (const tome of sortedTomes) {
    const tomeChapters = chapters
      .filter((c) => c.tomeId === tome.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    for (const chapter of tomeChapters) {
      const chapterScenes = scenes
        .filter((s) => s.chapterId === chapter.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      if (chapterScenes.length === 0) {
        // Chapitre sans scène: allouer un espace minimum
        chapterToScenes.set(chapter.id, { firstX: currentX, lastX: currentX + sceneSpacing });
        currentX += sceneSpacing * 2; // Espace vide
        continue;
      }

      const firstSceneX = currentX;

      for (const scene of chapterScenes) {
        positions.set(scene.id, {
          x: currentX,
          y: config.verticalOffset * 2, // Niveau 2: Scènes
        });
        currentX += sceneSpacing;
      }

      chapterToScenes.set(chapter.id, {
        firstX: firstSceneX,
        lastX: currentX - sceneSpacing,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ÉTAPE 2: Positionner les chapitres (centre de leurs scènes)
  // ═══════════════════════════════════════════════════════════════
  for (const tome of sortedTomes) {
    const tomeChapters = chapters
      .filter((c) => c.tomeId === tome.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    if (tomeChapters.length === 0) continue;

    const firstChapterX = chapterToScenes.get(tomeChapters[0].id)?.firstX ?? 0;
    const lastChapter = tomeChapters[tomeChapters.length - 1];
    const lastChapterX = chapterToScenes.get(lastChapter.id)?.lastX ?? firstChapterX;

    tomeToChapters.set(tome.id, { firstX: firstChapterX, lastX: lastChapterX });

    for (const chapter of tomeChapters) {
      const sceneRange = chapterToScenes.get(chapter.id);
      if (sceneRange) {
        const centerX = (sceneRange.firstX + sceneRange.lastX) / 2;
        positions.set(chapter.id, {
          x: centerX,
          y: config.verticalOffset, // Niveau 1: Chapitres
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ÉTAPE 3: Positionner les tomes (centre de leurs chapitres/scènes)
  // ═══════════════════════════════════════════════════════════════
  for (const tome of sortedTomes) {
    const chapterRange = tomeToChapters.get(tome.id);
    if (chapterRange) {
      const centerX = (chapterRange.firstX + chapterRange.lastX) / 2;
      positions.set(tome.id, {
        x: centerX,
        y: 0, // Niveau 0: Tomes
      });
    }
  }

  return positions;
}

/**
 * Calcule les connexions entre nœuds (Tome→Chapitre, Chapitre→Scène, Scène→Scène)
 */
export function calculateConnections(
  tomes: Tome[],
  chapters: Chapter[],
  scenes: Scene[],
  positions: Map<string, NodePosition>
): Array<{
  id: string;
  startId: string;
  endId: string;
  start: NodePosition;
  end: NodePosition;
  type: 'tome-chapter' | 'chapter-scene' | 'scene-scene';
}> {
  const connections: Array<{
    id: string;
    startId: string;
    endId: string;
    start: NodePosition;
    end: NodePosition;
    type: 'tome-chapter' | 'chapter-scene' | 'scene-scene';
  }> = [];

  // ═══════════════════════════════════════════════════════════════
  // Connexions Tome → Chapitres (existant)
  // ═══════════════════════════════════════════════════════════════
  tomes.forEach((tome) => {
    const tomePos = positions.get(tome.id);
    if (!tomePos) return;

    const tomeChapters = chapters.filter((c) => c.tomeId === tome.id);

    tomeChapters.forEach((chapter) => {
      const chapterPos = positions.get(chapter.id);
      if (!chapterPos) return;

      connections.push({
        id: `${tome.id}-${chapter.id}`,
        startId: tome.id,
        endId: chapter.id,
        start: tomePos,
        end: chapterPos,
        type: 'tome-chapter',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Connexions Chapitre → Première Scène + Scène → Scène
  // ═══════════════════════════════════════════════════════════════
  chapters.forEach((chapter) => {
    const chapterPos = positions.get(chapter.id);
    if (!chapterPos) return;

    const chapterScenes = scenes
      .filter((s) => s.chapterId === chapter.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    for (let i = 0; i < chapterScenes.length; i++) {
      const scene = chapterScenes[i];
      const scenePos = positions.get(scene.id);
      if (!scenePos) continue;

      if (i === 0) {
        // Première scène: connexion depuis le chapitre
        connections.push({
          id: `${chapter.id}-${scene.id}`,
          startId: chapter.id,
          endId: scene.id,
          start: chapterPos,
          end: scenePos,
          type: 'chapter-scene',
        });
      } else {
        // Scènes suivantes: connexion depuis la scène précédente
        const prevScene = chapterScenes[i - 1];
        const prevPos = positions.get(prevScene.id);
        if (prevPos) {
          connections.push({
            id: `${prevScene.id}-${scene.id}`,
            startId: prevScene.id,
            endId: scene.id,
            start: prevPos,
            end: scenePos,
            type: 'scene-scene',
          });
        }
      }
    }
  });

  return connections;
}

/**
 * Récupère la position centrale pour cadrer un nœud spécifique
 */
export function getCameraTargetForNode(
  nodeId: string,
  positions: Map<string, NodePosition>
): NodePosition | null {
  return positions.get(nodeId) ?? null;
}

/**
 * Calcule la bounding box du layout pour le framing initial
 */
export function getLayoutBounds(positions: Map<string, NodePosition>): {
  min: NodePosition;
  max: NodePosition;
  center: NodePosition;
  size: { x: number; y: number };
} | null {
  const values = Array.from(positions.values());
  if (values.length === 0) return null;

  const min = values.reduce(
    (acc, p) => ({
      x: Math.min(acc.x, p.x),
      y: Math.min(acc.y, p.y),
    }),
    { x: Infinity, y: Infinity }
  );

  const max = values.reduce(
    (acc, p) => ({
      x: Math.max(acc.x, p.x),
      y: Math.max(acc.y, p.y),
    }),
    { x: -Infinity, y: -Infinity }
  );

  const center = {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
  };

  const size = {
    x: max.x - min.x,
    y: max.y - min.y,
  };

  return { min, max, center, size };
}
