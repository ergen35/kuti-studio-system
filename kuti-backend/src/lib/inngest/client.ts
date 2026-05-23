/**
 * Client Inngest - Séparé pour éviter les dépendances circulaires
 */

import { Inngest } from "inngest";
import { config } from "../config";

export const inngest = new Inngest({
  id: "kuti-studio",
  eventKey: config.inngestEventKey,
  signingKey: config.inngestSigningKey,
});
