/**
 * Module Inngest - Endpoint pour recevoir les événements
 * Rend le serveur accessible comme worker Inngest
 */

import { inngest, inngestFunctions } from "@lib/inngest";
import { Elysia } from "elysia";
import { serve } from "inngest/bun";

// ============================================================================
// Handler Inngest
// ============================================================================

const inngestHandler = serve({
  client: inngest,
  functions: inngestFunctions,
});

// ============================================================================
// Module
// ============================================================================

export const inngestModule = new Elysia({
  prefix: "/api/inngest",
  name: "inngestModule",
})
  // GET - Sync/register le worker avec Inngest Cloud
  .get("/", async ({ request }) => {
    return inngestHandler(request);
  })

  // POST - Recevoir les événements
  .post("/", async ({ request }) => {
    return inngestHandler(request);
  })

  // PUT - Pour les mises à jour
  .put("/", async ({ request }) => {
    return inngestHandler(request);
  });
