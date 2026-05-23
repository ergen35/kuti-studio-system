/**
 * Configuration des tâches cron avec @elysiajs/cron
 * Remplace le thread background orphan_checker du backend v1
 */

import { cron } from "@elysiajs/cron";
import { sendCheckOrphanImagesEvent } from "./inngest";

// ============================================================================
// Cron: Orphan Checker
// Vérifie les images de personnages où le fichier est manquant mais la DB entry existe
// ============================================================================

export const orphanCheckerCron = cron({
  name: "orphan-checker",
  pattern: "0 * * * *", // Toutes les heures
  protected: true, // Ne pas exécuter si le précédent n'est pas terminé
  async run() {
    console.log("[OrphanChecker] Starting scheduled check...");
    
    try {
      // Déclencher le check via Inngest pour bénéficier de la retry logic
      await sendCheckOrphanImagesEvent({});
      
      console.log("[OrphanChecker] Check event sent to Inngest");
    } catch (error) {
      console.error("[OrphanChecker] Failed to send check event:", error);
    }
  },
});

// ============================================================================
// Cron: Cleanup (optionnel - pour nettoyer les vieux fichiers temporaires)
// ============================================================================

export const cleanupCron = cron({
  name: "cleanup-temp-files",
  pattern: "0 3 * * *", // Tous les jours à 3h du matin
  protected: true,
  async run() {
    console.log("[Cleanup] Starting daily cleanup...");
    
    // TODO: Implémenter le nettoyage des fichiers temporaires
    // - Vieux jobs failed
    // - Fichiers d'export temporaires
    // - Cache images expiré
    
    console.log("[Cleanup] Cleanup completed");
  },
});

// ============================================================================
// Export de tous les crons pour l'enregistrement dans l'app
// ============================================================================

export const allCrons = [orphanCheckerCron, cleanupCron];
