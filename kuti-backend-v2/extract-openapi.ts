// Script pour extraire le OpenAPI JSON du backend Elysia
import { app } from "./src/index";

// @elysiajs/swagger stocke le schéma OpenAPI dans l'app
// Nous devons le récupérer après que l'app soit initialisée
async function extractOpenApi() {
  // Attendre que l'app soit prête
  const server = app.listen(0);
  
  // Le schéma OpenAPI est normalement accessible via le routeur
  // @ts-ignore
  const openApiSchema = app._routes?.swagger || app.swagger;
  
  console.log("OpenAPI Schema:", JSON.stringify(openApiSchema, null, 2));
  
  server.stop();
}

extractOpenApi().catch(console.error);
