# Checklist de développement

Checklist pour garantir la qualité du code et la cohérence du projet.

## Avant de commencer une feature

- [ ] Lire la documentation du module concerné dans `docs/`
- [ ] Vérifier que la base de données est à jour (`bun run db:migrate`)
- [ ] Vérifier que le SDK frontend est à jour (`yarn openapi-ts`)
- [ ] Identifier les routes/API nécessaires
- [ ] Créer une branche git descriptive (`feature/nom-feature`)

## Pendant le développement - Backend

### Structure du module

- [ ] Créer le module dans `src/modules/<feature>/`
- [ ] Structure : `index.ts`, `controller.ts` (ou `controller/index.ts`), `dto/index.ts`
- [ ] Enregistrer le module dans `src/index.ts`

### Routes et API

- [ ] Définir un `operationId` unique et stable pour chaque route
- [ ] Ajouter un `summary` descriptif
- [ ] Assigner le bon `tag` pour le regroupement Swagger
- [ ] Utiliser le préfixe `/api/v1/`

### Validation

- [ ] Créer les schémas Zod dans `dto/index.ts`
- [ ] Valider `params`, `query`, `body` selon les besoins
- [ ] Définir le schéma de `response`
- [ ] Nommer les schémas selon la convention (`<action>BodySchema`, etc.)

### Authentification

- [ ] Importer `authProvider` dans le module
- [ ] Ajouter `.use(authProvider)` avant les routes protégées
- [ ] Définir `accessControl` avec les rôles requis
- [ ] Vérifier la session dans les controllers si nécessaire

### Base de données

- [ ] Utiliser Prisma Client depuis `db`
- [ ] Gérer les erreurs (ressource non trouvée, conflit, etc.)
- [ ] Invalider le cache après les mutations
- [ ] Utiliser des transactions pour opérations multiples

### Code quality

- [ ] Typer toutes les fonctions et variables
- [ ] Gérer les erreurs avec try/catch appropriés
- [ ] Logger les erreurs importantes
- [ ] Pas de `console.log` en production (utiliser le logger)

## Pendant le développement - Frontend

### Routes

- [ ] Ajouter la route dans `app/routes.ts`
- [ ] Créer le fichier de page dans `app/routes/`
- [ ] Utiliser les layouts quand approprié
- [ ] Gérer les params dynamiques (`:projectId`, etc.)

### Data fetching

- [ ] Utiliser TanStack Query pour le server state
- [ ] Importer les options depuis `@tanstack/react-query.gen`
- [ ] Gérer les états `isLoading`, `isError`
- [ ] Implémenter les mutations avec invalidation de cache

### Mutations

```typescript
// Pattern standard
const mutation = useMutation({
  ...createProjectMutation(),
  onSuccess: () => {
    // Invalider les queries concernées
    queryClient.invalidateQueries({
      queryKey: listProjectsQueryKey(),
    });
    // Afficher toast de succès
    toast.success("Projet créé !");
  },
  onError: (error) => {
    // Afficher erreur
    toast.error(error.message);
  },
});
```

### UI/UX

- [ ] Utiliser les composants de `~/components/ui`
- [ ] Gérer les états de chargement (skeletons)
- [ ] Gérer les états d'erreur
- [ ] Afficher les états vides avec CTA
- [ ] Respecter le design system (espacements, couleurs)

### Internationalisation

- [ ] Ajouter les clés de traduction dans `locales/en/` et `locales/fr/`
- [ ] Utiliser le hook `useTranslation(namespace)`
- [ ] Ne pas hardcoder de texte dans les composants
- [ ] Vérifier les deux langues

### Formulaires

- [ ] Utiliser les schémas Zod générés (`zod.gen.ts`)
- [ ] Valider côté client avant soumission
- [ ] Afficher les erreurs de validation
- [ ] Désactiver le bouton submit pendant la mutation
- [ ] Reset du formulaire après succès si nécessaire

## Tests

### Backend

- [ ] Écrire des tests unitaires pour les controllers
- [ ] Écrire des tests d'intégration pour les routes
- [ ] Mocker les appels externes (API IA, S3)
- [ ] Vérifier la couverture de code

```bash
# Lancer les tests
bun run test

# Avec couverture
bun run test:coverage
```

### Frontend

- [ ] Tester les composants critiques
- [ ] Tester les hooks personnalisés
- [ ] Mock les appels API

## Avant de commit

### Validation backend

```bash
cd kuti-backend-v2

# Vérifier les types
bun run typecheck

# Linter
bun run lint

# Tests
bun run test

# Formater le code
bun run format
```

### Validation frontend

```bash
cd kuti-frontend

# Vérifier les types
yarn typecheck

# Linter
yarn lint

# Tests
yarn test

# Formater
yarn format
```

### Git

- [ ] Message de commit descriptif (conventionnal commits)
- [ ] Un seul changement logique par commit
- [ ] Pas de fichiers temporaires/commités par erreur

```
feat(characters): ajout de la génération d'images

- Ajout endpoint POST /characters/:id/generate
- Intégration avec GPT Images 2
- UI galerie d'images générées
```

## Avant de merger

### Code Review

- [ ] PR reviewée par un autre développeur
- [ ] Les commentaires sont résolus
- [ ] Pas de console.log ou debug code
- [ ] Pas de code commenté inutile

### Documentation

- [ ] Mettre à jour le README si nécessaire
- [ ] Mettre à jour AGENTS.md si changement majeur
- [ ] Documenter les nouvelles variables d'environnement
- [ ] Mettre à jour CHANGELOG.md

### Tests complémentaires

- [ ] Tests passent en CI
- [ ] Pas de régression sur les features existantes
- [ ] Testé localement (backend + frontend ensemble)
- [ ] Vérifié sur différentes tailles d'écran (frontend)

### Base de données

- [ ] Migration créée si changement de schéma
- [ ] Migration testée (up + down)
- [ ] Données de seed à jour si nécessaire

### API

- [ ] Regénérer le SDK frontend (`yarn openapi-ts`)
- [ ] Vérifier que le SDK compile sans erreur
- [ ] Documenter les changements de breaking changes

## Déploiement

### Préparation

- [ ] Variables d'environnement à jour
- [ ] Migrations prêtes à être appliquées
- [ ] Assets (images, fonts) uploadés si S3
- [ ] README de déploiement à jour

### Vérifications post-déploiement

- [ ] Health check répond 200
- [ ] Swagger UI accessible
- [ ] Authentication fonctionne
- [ ] Fonctionnalités critiques testées

## Checklist rapide - Nouvelle route API

```markdown
- [ ] Schéma Zod pour params/query/body
- [ ] Schéma Zod pour response
- [ ] Controller avec logique métier
- [ ] Route définie avec operationId
- [ ] authProvider + accessControl si privée
- [ ] Tag approprié
- [ ] Testé avec Swagger UI
- [ ] Regénérer SDK frontend
```

## Checklist rapide - Nouvelle page

```markdown
- [ ] Route ajoutée dans routes.ts
- [ ] Page créée avec export default
- [ ] TanStack Query pour data fetching
- [ ] États loading/error/empty gérés
- [ ] Composants shadcn/ui utilisés
- [ ] Traductions i18n ajoutées
- [ ] Responsive (mobile/desktop)
```

## Commandes essentielles

```bash
# Backend
cd kuti-backend-v2
bun run dev                 # Dev server
bun run db:migrate          # Migrations
bun run db:studio           # Prisma Studio
bun run typecheck           # Type checking

# Frontend
cd kuti-frontend
yarn dev                    # Dev server
yarn openapi-ts             # Regénérer SDK
yarn typecheck              # Type checking
yarn build                  # Build production
```
