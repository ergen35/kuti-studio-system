# IMPLEMENTATION_PLAN — Kuti Studio

## État actuel de l'implémentation

### Date d'analyse
2025-01-XX

### Version
- Backend: 0.1.0
- Frontend: non versionnée (package privé)

---

## 1. Analyse de l'existant

### 1.1 Backend (`kuti-backend`)

#### ✅ Déjà implémenté

**Infrastructure de base**
- ✅ FastAPI app avec CORS configuré
- ✅ Settings management via `pydantic-settings`
- ✅ SQLAlchemy database layer avec SQLite
- ✅ Alembic configuré pour les migrations
- ✅ Structure modulaire par domaine
- ✅ Erreurs API centralisées (`api/errors.py`)
- ✅ Point d'entrée centralisé (`api/main.py`)
- ✅ Routeur global (`api/routes.py`)

**Endpoints opérationnels**
- ✅ `GET /api/health` - health check
- ✅ `GET /api/config` - configuration backend
- ✅ `GET /api/models` - liste des providers de modèles
- ✅ Routes projects complètes
- ✅ Routes characters complètes
- ✅ Routes story (tomes, chapters, scenes, references)
- ✅ Routes assets
- ✅ Routes warnings
- ✅ Routes versions
- ✅ Routes exports
- ✅ Routes generation (jobs, steps, boards, panels)

**Modèles SQLAlchemy**
- ✅ `Project` avec statuts et settings JSON
- ✅ `Character` avec relations, physical_description, color_palette, costume, key_traits
- ✅ `CharacterRelation` avec strength et narrative_dependency
- ✅ `VoiceSample` pour les échantillons audio
- ✅ `Tome`, `Chapter`, `Scene` avec ordre et statuts
- ✅ `StoryReference` pour les références `@`
- ✅ `Asset` avec slug, checksum, storage_path
- ✅ `AssetLink` pour lier assets aux entités
- ✅ `Warning` avec fingerprint, severity, status
- ✅ `Version` avec branch_name et version_index
- ✅ `Export` avec kind, format, artifact tracking
- ✅ `GenerationJob`, `GenerationStep`, `GenerationBoard`, `GenerationBoardPanel`

**Schémas Pydantic**
- ✅ Schémas Read/Create/Update pour tous les domaines
- ✅ Validation des payloads
- ✅ Serialization JSON cohérente

**Repositories**
- ✅ Pattern repository implémenté pour tous les domaines
- ✅ Queries typées et testables
- ✅ Gestion des relations et jointures

#### ⚠️ Partiellement implémenté

**Generation**
- ✅ Structure des jobs et boards
- ⚠️ Providers configurables mais intégration réelle avec `gpt-2-images` à finaliser
- ⚠️ Orchestration des jobs à compléter
- ⚠️ Découpage automatique en sous-jobs à implémenter
- ⚠️ Gestion des retries et erreurs à renforcer

**Coherence / Warnings**
- ✅ Structure de persistence
- ⚠️ Règles de détection à implémenter
- ⚠️ Scan automatique après modifications à brancher
- ⚠️ Types de warnings à enrichir

**Versioning**
- ✅ Persistence des versions
- ⚠️ Branching logic à finaliser
- ⚠️ Restauration et comparaison à tester
- ⚠️ Nettoyage des branches orphelines à automatiser

**Exports**
- ✅ Structure tracking
- ⚠️ Génération réelle JSON/tree/zip à implémenter
- ⚠️ Formats publication (PDF, CBZ, EPUB) à développer
- ⚠️ Manifest generation à finaliser

**Assets**
- ✅ Import et metadata tracking
- ⚠️ Copie physique dans `kuti-data` à valider
- ⚠️ Suppression logique et archivage à tester
- ⚠️ Détection d'orphelins à implémenter

#### ❌ Non implémenté

**OpenAPI export**
- ❌ Endpoint dédié pour télécharger `openapi.json`
- ❌ Script de génération pour pipeline CI/CD
- ❌ Documentation des schémas enrichie

**Environments**
- ❌ Modèle `Environment` manquant (lieux narratifs)
- ❌ Routes `/projects/:id/environments`
- ❌ Liaison avec scenes via `environment_id`

**Boards avancés**
- ❌ Composition de planches manga depuis panels validés
- ❌ Layouts configurables
- ❌ Preview final avant export

**Jobs queue**
- ❌ Système de queue pour jobs asynchrones
- ❌ Progress tracking en temps réel
- ❌ Annulation de jobs

**i18n backend**
- ❌ Messages d'erreur localisables
- ❌ Aide contextuelle multilingue

**Tests**
- ⚠️ Tests unitaires minimaux présents
- ❌ Tests d'intégration manquants
- ❌ Coverage insuffisant

**Migrations**
- ⚠️ Alembic configuré mais migrations initiales à générer
- ❌ Seed data pour développement

---

### 1.2 Frontend (`kuti-frontend`)

#### ✅ Déjà implémenté

**Infrastructure**
- ✅ React Router 7 en framework mode (SPA sans SSR)
- ✅ Tailwind CSS 4 configuré avec Vite plugin
- ✅ Adobe Spectrum S2 intégré
- ✅ React Query (`@tanstack/react-query`) configuré
- ✅ Zustand store pour UI (theme, density, panels)
- ✅ Client API custom avec transformation des données backend
- ✅ Formatters pour dates et relatives

**Shell et Layout**
- ✅ `AppShell` avec navigation persistante
- ✅ `WorkspaceFrame` pour layout maître/détail
- ✅ Theming light/dark fonctionnel
- ✅ Density comfortable/compact
- ✅ Persistance locale via Zustand + localStorage

**Routes et pages**
- ✅ `/` - Project Hub complet et fonctionnel
- ✅ `/projects/:projectId` - Dashboard projet (layout parent)
- ✅ `/projects/:projectId/characters` - stub route
- ✅ `/projects/:projectId/story` - stub route
- ✅ `/projects/:projectId/generation` - stub route
- ✅ `/projects/:projectId/assets` - stub route
- ✅ `/projects/:projectId/exports` - stub route
- ✅ `/projects/:projectId/warnings` - stub route
- ✅ `/projects/:projectId/versions` - stub route
- ✅ `/projects/:projectId/settings` - stub route

**API Layer**
- ✅ Client HTTP avec gestion d'erreurs (`ApiError`)
- ✅ Fonctions typed pour tous les endpoints backend
- ✅ Transformation des données backend → cards frontend
- ✅ Calcul de stats, progress, activity, accents
- ✅ `getProjects()`, `getProject()`, `createProject()`, `updateProject()`
- ✅ Helpers pour création scene, asset import, job generation, export, warnings scan

**Composants UI**
- ✅ Composants primitifs Spectrum S2 utilisés (Button, Card, Badge, Input, SearchField, Separator)
- ✅ `EmptyState`, `StatTile`, `ActionDialog`
- ✅ `WorkspaceFrame` pour layout trois colonnes

**Theming**
- ✅ Variables CSS Spectrum + tokens Kuti
- ✅ Typographie IBM Plex Sans/Mono recommandée (à confirmer dans CSS)
- ✅ Modes light/dark synchronisés

**Query hooks**
- ✅ `useLoaderData` avec clientLoader pour Project Hub
- ✅ Revalidation après mutations
- ✅ Cache invalidation via `refreshWorkspaceData`

#### ⚠️ Partiellement implémenté

**Pages workspaces**
- ⚠️ Routes définies mais contenu stub uniquement
- ⚠️ Pas de workspace Characters détaillé
- ⚠️ Pas d'éditeur Storyline
- ⚠️ Pas de Generation Studio UI
- ⚠️ Pas de Assets Library UI
- ⚠️ Pas de Warnings Center UI
- ⚠️ Pas de Version History UI
- ⚠️ Settings page stub

**Composants métier**
- ⚠️ `EntityList`, `EntityHeader`, `StatusPill`, `InspectorPanel` manquants
- ⚠️ `JobStatusCard`, `DiffViewer`, `Timeline`, `ValidationBanner` à créer
- ⚠️ `NarrativeOutline`, `BoardPreview`, `PanelPreview` absents

**Navigation**
- ⚠️ Breadcrumb présent dans le shell mais non fonctionnel
- ⚠️ Command Palette non implémentée
- ⚠️ Navigation mobile repliable à finaliser

**États feedback**
- ⚠️ `LoadingState`, `ErrorState` présents mais à généraliser
- ⚠️ Skeletons non utilisés
- ⚠️ Toasts non branchés

#### ❌ Non implémenté

**SDK généré**
- ❌ Pas de génération via `@hey-api/openapi-ts`
- ❌ Client API fait main au lieu de SDK typé

**Éditeur ProseMirror**
- ❌ `NarrativeSceneEditor` absent
- ❌ Plugin autocomplétion `@` non développé
- ❌ Blocs structurés Markdown non implémentés

**Graphe relationnel 3D**
- ❌ `CharacterRelationGraph` absent
- ❌ Three.js / React Three Fiber non intégré
- ❌ react-force-graph non installé

**Composants avancés**
- ❌ `ResizablePanelGroup` non utilisé
- ❌ Panels redimensionnables absents
- ❌ Inspector contextuel droit non fonctionnel
- ❌ Barre de statut inférieure non branchée

**Overlays**
- ❌ Global Search / Command Palette
- ❌ Compare view pour versions
- ❌ Dialogs de confirmation génériques
- ❌ Import project dialog

**i18n**
- ❌ Pas de système i18n
- ❌ Pas de dictionnaires en/fr
- ❌ Interface en anglais hard-codé

**Tests**
- ❌ Aucun test frontend

---

## 2. Priorisation MVP

### 2.1 Critères MVP définis dans les specs

Le MVP doit permettre :
- ✅ Créer et ouvrir un projet local
- ⚠️ Gérer des personnages (CRUD basique)
- ⚠️ Écrire la storyline (tomes/chapitres/scènes)
- ❌ Insérer des références `@` typées
- ⚠️ Afficher les métadonnées de scène
- ✅ Sauvegarder dans SQLite et `kuti-data`
- ❌ Basculer l'interface entre anglais et francais
- ⚠️ Exporter une base de travail simple
- ⚠️ Conserver un historique minimal de versions

### 2.2 Phase MVP recommandée

**Backend MVP** (2-3 semaines)
1. ✅ Valider structure existante
2. 🔧 Générer migrations Alembic initiales
3. 🔧 Implémenter modèle `Environment`
4. 🔧 Finaliser détection warnings basiques
5. 🔧 Implémenter export JSON portable
6. 🔧 Ajouter endpoint `/api/openapi.json` pour export spec
7. 🔧 Tester couverture endpoints CRUD
8. 🔧 Seed data pour développement

**Frontend MVP** (3-4 semaines)
1. 🔧 Générer SDK via `@hey-api/openapi-ts`
2. 🔧 Remplacer client API manuel par SDK
3. 🔧 Implémenter page Characters avec liste + form
4. 🔧 Implémenter page Storyline avec arbre tomes/chapitres/scènes
5. 🔧 Créer éditeur de scène basique (textarea enrichi)
6. 🔧 Ajouter système i18n (en/fr)
7. 🔧 Créer composants `EntityList`, `EntityHeader`, `InspectorPanel`
8. 🔧 Implémenter Warnings Center basique
9. 🔧 Implémenter Version History basique
10. 🔧 Finaliser Settings page

---

## 3. Roadmap détaillée

### Phase 0 : Stabilisation de la base (1 semaine)

#### Backend
- [ ] Générer et appliquer migrations Alembic complètes
- [ ] Créer script de seed data (`dev_seed.py`)
- [ ] Ajouter endpoint `GET /api/openapi.json` avec export spec
- [ ] Valider tous les endpoints CRUD avec tests manuels
- [ ] Documenter variables d'environnement dans `.env.example`
- [ ] Créer `scripts/generate_openapi.py` pour export automatisé

#### Frontend
- [ ] Installer `@hey-api/openapi-ts`
- [ ] Créer script `npm run generate:api` pour générer SDK
- [ ] Configurer `openapi-ts` dans `package.json`
- [ ] Ajouter `kuti-frontend/app/lib/api/generated/` dans `.gitignore`

---

### Phase 1 : SDK et API typée (1 semaine)

#### Backend
- [ ] Enrichir les docstrings OpenAPI des endpoints
- [ ] Ajouter `tags` aux routes pour grouping
- [ ] Valider les schémas Pydantic avec `examples`
- [ ] Exporter `openapi.json` stable

#### Frontend
- [ ] Générer SDK depuis `openapi.json` backend
- [ ] Créer wrapper React Query au-dessus du SDK
- [ ] Créer hooks custom : `useProjects`, `useProject`, `useCharacters`, etc.
- [ ] Migrer `api.ts` manuel vers SDK généré
- [ ] Garder les transformations métier dans `lib/transform.ts`
- [ ] Tester invalidation de cache après mutations

**Livrables**
- SDK TypeScript généré et fonctionnel
- Client API remplacé par SDK
- Hooks React Query typés

---

### Phase 2 : Characters workspace (1 semaine)

#### Backend
- [ ] Valider routes characters complètes
- [ ] Ajouter filtres et tri dans `GET /projects/:id/characters`
- [ ] Ajouter endpoint `GET /projects/:id/characters/:id/scenes` pour scènes liées

#### Frontend
- [ ] Implémenter layout Characters avec `ResizablePanelGroup`
- [ ] Colonne gauche : liste filtrable des personnages
- [ ] Colonne centrale : formulaire édition personnage
- [ ] Colonne droite : relations, assets, scènes liées
- [ ] Créer composant `CharacterCard`
- [ ] Créer composant `CharacterForm` avec tous les champs
- [ ] Brancher mutations Create/Update/Archive
- [ ] Ajouter états loading/empty/error
- [ ] Créer dialog création rapide personnage

**Livrables**
- Page Characters complète et fonctionnelle
- CRUD personnages avec UI
- Relations visibles (liste simple, pas graphe 3D pour MVP)

---

### Phase 3 : Storyline workspace (2 semaines)

#### Backend
- [ ] Valider routes story complètes
- [ ] Ajouter endpoint `GET /projects/:id/story/outline` pour arbre complet
- [ ] Ajouter filtres et recherche sur scènes
- [ ] Valider parsing des références `@` dans scene content

#### Frontend
- [ ] Implémenter layout Storyline avec trois colonnes
- [ ] Colonne gauche : arbre tomes → chapitres → scènes (Accordion ou Tree)
- [ ] Colonne centrale : éditeur de scène
- [ ] Colonne droite : métadonnées et références
- [ ] Créer composant `NarrativeOutline` pour l'arbre
- [ ] Créer composant `SceneEditorBasic` (textarea + metadata form)
- [ ] Brancher création/édition tomes, chapitres, scènes
- [ ] Ajouter réordonnancement par drag & drop (optionnel MVP)
- [ ] Afficher les références `@` détectées (readonly pour MVP)
- [ ] Créer composant `SceneMetadataPanel`

**Livrables**
- Page Storyline complète
- Arbre narratif navigable
- Éditeur de scène basique fonctionnel
- Métadonnées visibles et éditables

---

### Phase 4 : Warnings et Versions (1 semaine)

#### Backend
- [ ] Implémenter scan basique de warnings :
  - Références `@` orphelines
  - Personnages cités mais non existants
  - Scènes sans chapitre
- [ ] Ajouter endpoint `POST /projects/:id/warnings/scan`
- [ ] Enrichir les métadonnées warnings
- [ ] Tester restauration de versions

#### Frontend
- [ ] Implémenter page Warnings Center
- [ ] Liste des warnings avec filtres par type/severity/status
- [ ] Action "Mark as resolved"
- [ ] Lien vers contexte source (scene, character)
- [ ] Implémenter page Version History
- [ ] Liste des versions par branche
- [ ] Action "Restore version" avec confirmation
- [ ] Comparaison simple (diff textuel basique)

**Livrables**
- Warnings Center fonctionnel
- Version History fonctionnel
- Scan de cohérence basique opérationnel

---

### Phase 5 : Exports et Settings (1 semaine)

#### Backend
- [ ] Implémenter export JSON portable complet
- [ ] Implémenter export tree (dossier structuré)
- [ ] Implémenter export ZIP
- [ ] Tester restauration depuis export

#### Frontend
- [ ] Implémenter page Exports
- [ ] Formulaire de création export (kind, format)
- [ ] Liste des exports avec statut et téléchargement
- [ ] Implémenter page Settings complète
- [ ] Sections : General, Story, Generation, Export, Coherence
- [ ] Formulaire avec sauvegarde

**Livrables**
- Exports JSON/tree/ZIP fonctionnels
- Settings projet complets

---

### Phase 6 : i18n et polish MVP (1 semaine)

#### Frontend
- [ ] Installer `react-i18next` ou alternative
- [ ] Créer dictionnaires `en.json` et `fr.json`
- [ ] Wrapper toutes les strings UI avec `t()`
- [ ] Ajouter language switcher dans topbar
- [ ] Créer composants feedback finaux : `LoadingState`, `ErrorState`, `EmptyState`
- [ ] Standardiser les skeletons
- [ ] Ajouter toasts pour succès/erreurs
- [ ] Valider thème dark complet
- [ ] Responsive mobile basique

**Livrables**
- Interface en/fr complète
- États feedback standardisés
- Thème sombre finalisé
- Mobile utilisable

---

## 4. Post-MVP : Fonctionnalités avancées

### Phase 7 : Éditeur ProseMirror avancé (2 semaines)

- [ ] Intégrer ProseMirror dans `SceneEditor`
- [ ] Créer plugin autocomplétion `@` contextuelle
- [ ] Implémenter détection des préfixes `@chara:`, `@env:`, `@file:`, `@scene:`
- [ ] Filtrage suggestions par type et saisie partielle
- [ ] Insertion de nœuds références typés
- [ ] Navigation vers entité cible au clic
- [ ] Blocs structurés (titre, résumé, contenu, notes)

### Phase 8 : Graphe relationnel 3D (2 semaines)

- [ ] Installer Three.js, React Three Fiber, react-force-graph
- [ ] Créer composant `CharacterRelationGraph`
- [ ] Représenter personnages comme nœuds
- [ ] Représenter relations comme liens colorés
- [ ] Interaction (zoom, pan, focus, sélection)
- [ ] Intensité via épaisseur ou transparence
- [ ] Intégrer dans Characters workspace (fullscreen toggle)

### Phase 9 : Generation Studio (3 semaines)

#### Backend
- [ ] Intégrer réellement `gpt-2-images`
- [ ] Orchestration jobs avec sous-tâches
- [ ] Progress tracking temps réel
- [ ] Queue asynchrone (Celery ou alternative)
- [ ] Retry logic et gestion erreurs
- [ ] Composition boards depuis panels validés

#### Frontend
- [ ] Page Generation Studio complète
- [ ] Formulaire de génération avec choix source/strategy/model
- [ ] Liste des jobs avec progress bars
- [ ] Vue détaillée job avec steps
- [ ] Boards preview avec panels
- [ ] Validation humaine panels
- [ ] Composition planche finale

### Phase 10 : Assets Library avancée (1 semaine)

- [ ] Page Assets Library complète
- [ ] Grille ou table d'assets avec previews
- [ ] Import drag & drop
- [ ] Détails asset avec usages
- [ ] Archivage et suppression logique
- [ ] Détection orphelins

### Phase 11 : Exports publication (2 semaines)

- [ ] Export images paginées
- [ ] Export PDF avec mise en page
- [ ] Export CBZ
- [ ] Export EPUB (optionnel)

### Phase 12 : Command Palette et navigation (1 semaine)

- [ ] Composant Command Palette global
- [ ] Recherche fuzzy tous projets/entités
- [ ] Actions rapides (créer personnage, scène, etc.)
- [ ] Navigation clavier
- [ ] Raccourcis globaux

### Phase 13 : Tests et stabilisation (2 semaines)

- [ ] Tests unitaires backend (coverage > 70%)
- [ ] Tests d'intégration API
- [ ] Tests E2E frontend (Playwright ou Cypress)
- [ ] Performance optimizations
- [ ] Error boundaries complets
- [ ] Logging structuré

---

## 5. Stack technique finale

### Backend
- Python 3.12+ avec `uv`
- FastAPI + Uvicorn
- SQLAlchemy + Alembic
- SQLite local
- Pydantic pour schémas
- OpenAPI auto-généré

### Frontend
- React 19
- React Router 7 (framework mode SPA)
- Tailwind CSS 4
- Adobe Spectrum S2
- React Query (TanStack Query)
- Zustand
- SDK généré via `@hey-api/openapi-ts`
- ProseMirror (post-MVP)
- Three.js + React Three Fiber (post-MVP)
- react-i18next

### DevOps
- `uv` pour Python
- npm pour frontend
- Scripts de génération SDK
- Scripts de seed data
- Migrations Alembic versionnées

---

## 6. Métriques de succès MVP

### Backend
- [ ] Tous les endpoints CRUD testés manuellement
- [ ] Migrations Alembic appliquées sans erreur
- [ ] Seed data fonctionnel
- [ ] OpenAPI spec exportable
- [ ] Warnings basiques détectés
- [ ] Export JSON fonctionnel

### Frontend
- [ ] SDK généré et utilisé
- [ ] Hub projet fonctionnel
- [ ] Characters workspace complet
- [ ] Storyline workspace complet
- [ ] Warnings Center fonctionnel
- [ ] Version History fonctionnel
- [ ] Settings fonctionnel
- [ ] i18n en/fr complet
- [ ] Thème dark/light fonctionnel

### Qualité
- [ ] Aucune erreur console en usage normal
- [ ] États loading/empty/error partout
- [ ] Responsive desktop/tablet acceptable
- [ ] Documentation README à jour
- [ ] Variables d'environnement documentées

---

## 7. Organisation du travail

### Sprints recommandés

**Sprint 1 (Phase 0-1)** : Stabilisation base + SDK
- Durée : 2 semaines
- Objectif : Backend stable, SDK généré, API typée

**Sprint 2 (Phase 2)** : Characters workspace
- Durée : 1 semaine
- Objectif : CRUD personnages fonctionnel

**Sprint 3 (Phase 3)** : Storyline workspace
- Durée : 2 semaines
- Objectif : Écriture tomes/chapitres/scènes fonctionnelle

**Sprint 4 (Phase 4-5)** : Warnings, Versions, Exports, Settings
- Durée : 2 semaines
- Objectif : Écrans secondaires fonctionnels

**Sprint 5 (Phase 6)** : i18n et polish
- Durée : 1 semaine
- Objectif : MVP complet et présentable

**Total MVP : 8 semaines**

### Post-MVP : itérations de 2 semaines

---

## 8. Risques et mitigations

### Risques techniques

**Risque : ProseMirror complexité élevée**
- Mitigation : Commencer par textarea simple, ProseMirror en phase 7 post-MVP
- Alternative : Utiliser un éditeur Markdown existant avec extensions

**Risque : Three.js performance**
- Mitigation : Graphe 3D optionnel, liste simple pour MVP
- Alternative : Utiliser react-force-graph 2D si 3D trop lourd

**Risque : Intégration gpt-2-images**
- Mitigation : Mock les réponses pour MVP, vraie intégration post-MVP
- Alternative : Brancher autre provider en fallback

**Risque : Exports PDF/CBZ complexes**
- Mitigation : MVP = export JSON uniquement, PDF en phase 11
- Alternative : Utiliser librairies Python (reportlab, Pillow)

### Risques organisationnels

**Risque : Scope creep MVP**
- Mitigation : Respecter strictement le périmètre MVP défini
- Règle : Si pas critique pour écriture basique, c'est post-MVP

**Risque : Dépendance SDK généré**
- Mitigation : Valider SDK dès sprint 1, fallback manuel si problème
- Alternative : Garder client API manuel avec types manuels

---

## 9. Prochaines actions immédiates

### Backend (priorité 1)
1. Générer migrations Alembic initiales
2. Créer script `dev_seed.py`
3. Ajouter endpoint `/api/openapi.json`
4. Tester tous les endpoints CRUD

### Frontend (priorité 1)
1. Installer `@hey-api/openapi-ts`
2. Créer script génération SDK
3. Générer SDK depuis backend
4. Créer hooks React Query au-dessus du SDK

### Documentation (priorité 2)
1. Compléter `README.md` backend avec setup instructions
2. Compléter `README.md` frontend avec setup instructions
3. Documenter variables d'environnement
4. Créer `CONTRIBUTING.md` avec workflow

---

## 10. Conclusion

L'implémentation actuelle de Kuti Studio présente une **base solide** côté backend avec une architecture modulaire propre et des modèles SQLAlchemy complets. Le frontend a un **shell fonctionnel** et un **Project Hub abouti**, mais les workspaces métier sont encore à l'état de stubs.

**Le MVP est atteignable en 8 semaines** en se concentrant sur :
1. Génération et utilisation du SDK TypeScript
2. Implémentation des workspaces Characters et Storyline
3. Finalisation des écrans Warnings, Versions, Exports, Settings
4. Ajout de l'i18n et polish final

Les fonctionnalités avancées (ProseMirror, graphe 3D, génération réelle, exports publication) peuvent être développées en **post-MVP** sans bloquer l'usage de l'outil pour un travail narratif basique.

La priorisation proposée respecte les contraintes techniques et permet une **livraison itérative** avec des jalons fonctionnels à chaque sprint.
```