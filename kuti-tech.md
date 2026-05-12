# Kuti Studio - Architecture technique, modele SQLite et arborescence `kuti-data`

## 1. Objectif technique

Definir une base technique locale, robuste et evolutive pour `kuti-studio`, avec un backend Python avec FastAPI, un frontend React Router v7, un SDK TypeScript genere, et une architecture prete pour la generation, la coherence narrative, le versioning et l'export. Le backend expose son schema OpenAPI et le frontend le consomme via SDK genere.

Le socle doit privilegier:
- local-first
- deux applications locales separees: `kuti-backend` et `kuti-frontend`
- portabilite des donnees
- API documentee et typable
- frontend standardise par composants reutilisables
- separation nette entre domaine, stockage, API et UI

## 2. Stack technique cible

### Backend
- Python 3.12+ gere via `uv`
- FastAPI pour l'API locale
- Uvicorn comme serveur d'execution
- base SQLite locale
- couche stockage via SQLAlchemy ou SQLModel
- schemas Pydantic et serialisation JSON pour l'API
- generation du schema OpenAPI via FastAPI, les schemas Pydantic et un export de spec cote backend
- migrations gerees via Alembic
- systeme de jobs locaux pour generation et export
- modules internes decoupes par domaine

### Frontend
- React Router v7
- SSR desactive
- Adobe Spectrum S2 comme base de composants
- design system custom au-dessus des primitives
- React Query pour les requetes, mutations et invalidations
- Zustand pour les etats UI, la selection courante et le contexte editeur
- SDK frontend genere depuis OpenAPI avec `@hey-api/openapi-ts`
- i18n frontend en `en` et `fr`

### Generation
- `gpt-2-images` comme point d'entree de generation
- jobs decoupes en sous-etapes explicites
- possibilite de brancher plus tard d'autres moteurs
- stockage des prompts, sorties et artefacts intermediaires

### Visualisation avancee
- graphes relationnels cote personnages et coherence
- possibilité d'utiliser `three.js` ou une alternative canvas/webgl plus tard
- composants visuels prepares pour les cartes, graphs et previsualisations manga

## 3. Architecture logique

### 3.1 Couche UI
La couche UI regroupe le shell de l'application, la navigation, les pages metier et les composants visuels.

Responsabilites:
- navigation par projet
- affichage des etats metier
- edition de contenu
- validation utilisateur
- consultation des warnings, versions, exports et assets

### 3.2 Couche API locale
La couche API expose toutes les operations applicatives localement.

Responsabilites:
- exposer des endpoints JSON stables
- publier le document OpenAPI
- valider les payloads d'entree
- encapsuler les use cases metier
- retourner des erreurs lisibles et typables

### 3.3 Couche domaine
La couche domaine contient les modeles, statuts et regles metier.

Responsabilites:
- definir les entites du projet
- definir les statuts autorises
- porter les invariants
- centraliser les types de references et de branches
- structurer les payloads d'export et de generation

### 3.4 Couche stockage
La couche stockage gere SQLite et les fichiers locaux.

Responsabilites:
- ouvrir et migrer la base
- lire et ecrire les entites
- gerer les chemins locaux
- conserver les assets dans `kuti-data`
- assurer la portabilite du projet

### 3.5 Couche jobs
La couche jobs orchestre les generations, exports et verifications lourdes.

Responsabilites:
- decouper le travail en sous-jobs
- suivre les etats d'execution
- persister les etapes
- rendre l'avancement visible a l'UI

### 3.6 Couche SDK frontend et data access
Le frontend ne parle pas directement au backend par du code artisanal dispersé. Il consomme un SDK genere depuis l'OpenAPI.

Responsabilites:
- generer les clients typables
- centraliser les appels HTTP
- brancher les requetes sur React Query
- garder les mutations predictibles
- exposer des hooks et helpers de domaine

## 4. Flux applicatif

### 4.1 Ouverture de l'application
1. Le backend est lance avec `uv`.
2. Le dossier `kuti-data` est resolu a cote des dossiers `kuti-backend` et `kuti-frontend`, ou via configuration.
3. La base SQLite locale est ouverte ou creee.
4. Les migrations sont appliquees.
5. Le serveur HTTP local demarre.
6. Le frontend charge le projet courant ou le Project Hub.

### 4.2 Ouverture d'un projet
1. L'utilisateur selectionne un projet.
2. Le backend charge la racine du projet et les donnees associees.
3. Le frontend recupere les donnees via le SDK genere.
4. Le contexte de projet est stocke dans Zustand.
5. Les queries React Query sont alimentees par les endpoints du projet.

### 4.3 Ecriture
1. L'utilisateur edite une entite.
2. Le frontend met a jour l'etat local du formulaire.
3. Une mutation envoie la modification via le SDK.
4. Le backend valide et persiste.
5. Les caches concernes sont invalides.
6. Une version peut etre creee selon la politique du projet.

### 4.4 Generation
1. L'utilisateur declenche une generation.
2. Le backend cree un job principal.
3. Le job est decoupe en sous-jobs.
4. Les etapes sont persistees.
5. Les sorties sont stockees dans `kuti-data`.
6. Le frontend suit la progression et permet la selection humaine.

### 4.5 Export
1. L'utilisateur demande un export travail ou publication.
2. Le backend rassemble les donnees, assets et versions utiles.
3. Le package est genere dans un dossier d'export.
4. L'export est journalise dans SQLite.
5. Le frontend affiche le statut et l'emplacement du resultat.

## 5. Modele de donnees SQLite

Le schema ci-dessous sert de base au MVP et aux evolutions de production.

### 5.1 `projects`
Table racine des projets locaux.

Champs conseilles:
- `id`
- `name`
- `slug`
- `root_path`
- `status`
- `settings_json`
- `created_at`
- `updated_at`
- `archived_at`

Usage:
- liste des projets
- ouverture du contexte projet
- export global
- archivage

### 5.2 `characters`
Fiches personnages.

Champs conseilles:
- `id`
- `project_id`
- `name`
- `alias`
- `narrative_role`
- `description`
- `personality`
- `narrative_arc`
- `tags_json`
- `status`
- `avatar_asset_id`
- `created_at`
- `updated_at`
- `archived_at`

### 5.3 `character_relations`
Relations entre personnages.

Champs conseilles:
- `id`
- `project_id`
- `source_character_id`
- `target_character_id`
- `relation_type`
- `strength`
- `narrative_dependency`
- `notes`
- `created_at`
- `updated_at`

### 5.4 `environments`
Lieux et environnements narratifs.

Champs conseilles:
- `id`
- `project_id`
- `name`
- `slug`
- `description`
- `tags_json`
- `status`
- `created_at`
- `updated_at`

### 5.5 `tomes`
Niveau superieur de la storyline.

Champs conseilles:
- `id`
- `project_id`
- `title`
- `summary`
- `order_index`
- `status`
- `notes`
- `created_at`
- `updated_at`

### 5.6 `chapters`
Chapitres appartenant a un tome.

Champs conseilles:
- `id`
- `project_id`
- `tome_id`
- `title`
- `summary`
- `order_index`
- `status`
- `notes`
- `created_at`
- `updated_at`

### 5.7 `scenes`
Scenes narratives.

Champs conseilles:
- `id`
- `project_id`
- `chapter_id`
- `title`
- `body_md`
- `intent`
- `characters_present_json`
- `environment_id`
- `duration_hint`
- `tone`
- `rhythm`
- `visual_constraints`
- `staging_notes`
- `status`
- `cross_references_json`
- `order_index`
- `created_at`
- `updated_at`

### 5.8 `story_references`
References typpees `@` extraites ou indexes.

Champs conseilles:
- `id`
- `project_id`
- `source_entity_type`
- `source_entity_id`
- `reference_type`
- `target_entity_id`
- `raw_value`
- `created_at`

### 5.9 `assets`
Fichiers locaux importes ou generes.

Champs conseilles:
- `id`
- `project_id`
- `kind`
- `file_name`
- `relative_path`
- `mime_type`
- `size_bytes`
- `checksum`
- `status`
- `source_path`
- `archived_at`
- `created_at`
- `updated_at`

### 5.10 `asset_links`
Liens entre assets et entites metier.

Champs conseilles:
- `id`
- `project_id`
- `asset_id`
- `entity_type`
- `entity_id`
- `usage_type`
- `created_at`

### 5.11 `voice_samples`
Samples audio associes aux personnages.

Champs conseilles:
- `id`
- `project_id`
- `character_id`
- `asset_id`
- `label`
- `created_at`

### 5.12 `generation_jobs`
Jobs de generation.

Champs conseilles:
- `id`
- `project_id`
- `scope_type`
- `scope_id`
- `mode`
- `strategy`
- `status`
- `prompt_json`
- `result_json`
- `created_at`
- `started_at`
- `finished_at`
- `error_message`

### 5.13 `generation_job_steps`
Etapes detaillees des jobs.

Champs conseilles:
- `id`
- `job_id`
- `step_key`
- `label`
- `status`
- `progress`
- `output_json`
- `created_at`
- `updated_at`

### 5.14 `boards`
Planches ou ensembles de cases.

Champs conseilles:
- `id`
- `project_id`
- `scene_id`
- `title`
- `status`
- `layout_json`
- `created_at`
- `updated_at`

### 5.15 `board_panels`
Cases de planches.

Champs conseilles:
- `id`
- `board_id`
- `asset_id`
- `order_index`
- `caption`
- `status`
- `created_at`
- `updated_at`

### 5.16 `versions`
Historique versionne des entites.

Champs conseilles:
- `id`
- `project_id`
- `entity_type`
- `entity_id`
- `branch_key`
- `version_number`
- `payload_json`
- `created_at`
- `created_by`

### 5.17 `warnings`
Warnings de coherence et de structure.

Champs conseilles:
- `id`
- `project_id`
- `entity_type`
- `entity_id`
- `warning_type`
- `severity`
- `message`
- `status`
- `details_json`
- `created_at`
- `resolved_at`

### 5.18 `exports`
Journal des exports.

Champs conseilles:
- `id`
- `project_id`
- `export_type`
- `formats_json`
- `output_path`
- `status`
- `metadata_json`
- `created_at`
- `finished_at`
- `error_message`

## 6. Statuts metier

Statuts projet:
- `draft`
- `active`
- `archived`

Statuts ecriture:
- `draft`
- `validated`
- `generated`
- `published`

Statuts assets:
- `active`
- `detached`
- `archived`
- `deleted_pending`

Statuts jobs:
- `queued`
- `running`
- `waiting_validation`
- `succeeded`
- `failed`
- `cancelled`

Statuts warnings:
- `open`
- `acknowledged`
- `resolved`
- `ignored`

## 7. Arborescence `kuti-data`

### 7.1 Structure racine
Le dossier `kuti-data` vit a cote des dossiers applicatifs.

Structure generale:
- `kuti-data/db/`
- `kuti-data/projects/`
- `kuti-data/exports/`
- `kuti-data/cache/`
- `kuti-data/logs/`
- `kuti-data/tmp/`
- `kuti-data/backups/`

### 7.2 Dossiers projet
Chaque projet dispose d'un sous-dossier autonome.

Exemple:
- `kuti-data/projects/<project-id>/db/`
- `kuti-data/projects/<project-id>/assets/`
- `kuti-data/projects/<project-id>/exports/`
- `kuti-data/projects/<project-id>/versions/`
- `kuti-data/projects/<project-id>/generation/`
- `kuti-data/projects/<project-id>/archives/`
- `kuti-data/projects/<project-id>/metadata/`

### 7.3 Detail projet
Le sous-dossier projet peut contenir:
- `project.json`
- `project.sqlite`
- `assets/original/`
- `assets/derived/`
- `assets/archive/`
- `exports/work/`
- `exports/publication/`
- `versions/`
- `generation/jobs/`
- `generation/renders/`

## 8. Strategie de stockage des fichiers

### 8.1 Principe
La base SQLite stocke les metadata et le systeme de fichiers stocke les fichiers lourds.

### 8.2 Separation logique
- SQLite pour structure, relations, historiques et statuts
- filesystem pour images, audios, exports et artefacts intermediaires
- chemins toujours relatifs au projet quand c'est possible

### 8.3 Suppression
- suppression logique par defaut
- archivage avant purge
- suppression definitive seulement sur action explicite
- journalisation de toute operation destructive

## 9. Gestion des jobs de generation

### 9.1 Types de jobs
- generation scene
- generation chapitre
- generation tome
- validation coherence
- export travail
- export publication

### 9.2 Decoupage
Un job principal doit etre decoupe en sous-etapes explicites:
- analyse du scope
- preparation du contexte
- generation des prompts
- execution du moteur
- tri des sorties
- validation humaine
- persistence finale

### 9.3 Etats de job
- file d'attente
- en cours
- en attente de validation
- termine avec succes
- echec
- annule

## 10. Coherence narrative

La coherence narrative doit rester non bloquante pour l'ecriture.

Regles de base:
- un personnage present ou cite doit exister dans le projet
- un lieu reference doit exister ou etre signale
- une scene doit appartenir a un chapitre
- un chapitre doit appartenir a un tome
- les conflits de timeline doivent etre marques et pas supprimes automatiquement

## 11. Versioning

### 11.1 Regle principale
Chaque branche active conserve au maximum 3 versions recentes.

### 11.2 Branches
Branches possibles:
- principale
- alternative
- experimentee
- archivee

### 11.3 Nettoyage
- detection de branches orphelines
- proposition d'archivage
- suppression differee
- conservation des points de restauration utiles

## 12. i18n

L'interface est en anglais par defaut et en francais.

Principes:
- cles stables
- contenu utilisateur non traduit
- labels, aides et erreurs localisables
- switch de langue sans rechargement complet quand possible

## 13. Frontend

### 13.1 Principes UI
- shell clair et constant
- composants shadcn sur-mesure
- design system au-dessus des primitives
- pages orientees production
- interactions rapides et lisibles

### 13.2 Composants majeurs
- cards projet et cartes personnage
- sidebars et dialogs
- forms structurees
- tables/lists de synthese
- badge de statut
- warnings inline
- timeline/version viewer
- editor Markdown structure

## 14. Backend Python FastAPI

Le backend doit etre structure en modules nets.

Regles:
- handlers fins
- logique metier dans des services ou stores
- validation explicite des payloads
- erreurs de domaine typables
- OpenAPI comme contrat source pour le frontend et comme artefact exportable du backend

## 15. MVP technique

Le MVP technique doit livrer:
- socle backend Python FastAPI
- OpenAPI fonctionnelle
- frontend React Router v7 sans SSR
- SDK genere via `@hey-api/openapi-ts`
- React Query branche sur le SDK
- Zustand pour le contexte UI
- SQLite locale
- `kuti-data` portable
- pages principales accessibles
- stockage des entites principales

## 16. Resultat attendu

Un studio local operable sans reseau, capable d'organiser un projet narratif long et de preparer les futures couches de generation et de publication.

## 17. Structure du depot

Proposition de structure:
- `kuti-backend/`
- `kuti-backend/app/`
- `kuti-backend/config/`
- `kuti-backend/db/`
- `kuti-backend/domain/`
- `kuti-backend/project/`
- `kuti-backend/assets/`
- `kuti-backend/story/`
- `kuti-backend/versioning/`
- `kuti-backend/coherence/`
- `kuti-backend/generation/`
- `kuti-backend/boards/`
- `kuti-backend/exports/`
- `kuti-backend/i18n/`
- `kuti-backend/logging/`
- `kuti-backend/api/`
- `kuti-frontend/src/app/`
- `kuti-frontend/src/routes/`
- `kuti-frontend/src/components/`
- `kuti-frontend/src/styles/`
- `kuti-frontend/src/i18n/`
- `kuti-frontend/src/lib/`
- `kuti-frontend/src/api/`
- `kuti-frontend/src/stores/`

## 18. Decoupage des modules Python

### 18.1 `kuti-backend`
Point d'entree du backend local.

### 18.2 `kuti-backend/app`
Assemblage des services et cycle de vie.

### 18.3 `kuti-backend/config`
Resolution des chemins, env et parametres de runtime.

### 18.4 `kuti-backend/db`
Ouverture SQLite, migrations et helpers de connexion.

### 18.5 `kuti-backend/domain`
Types metier, statuts, erreurs et payloads partages.

### 18.6 `kuti-backend/project`
Gestion des projets et de leurs settings.

### 18.7 `kuti-backend/assets`
Import, archivage, suppression et metadata des fichiers.

### 18.8 `kuti-backend/story`
Tomes, chapitres, scenes, references et edition.

### 18.9 `kuti-backend/versioning`
Branches, versions, snapshots et restauration.

### 18.10 `kuti-backend/coherence`
Warnings de coherence et regles d'analyse.

### 18.11 `kuti-backend/generation`
Jobs de generation et orchestration des sorties.

### 18.12 `kuti-backend/boards`
Planches, cases et preview publication.

### 18.13 `kuti-backend/exports`
Exports travail et publication.

### 18.14 `kuti-backend/i18n`
Cles internes, erreurs localisables et aides.

### 18.15 `kuti-backend/logging`
Journalisation structurable et lisible.

### 18.16 `kuti-backend/api`
Serveur HTTP, routes, OpenAPI et schemas.

## 19. Decoupage frontend

### 19.1 `kuti-frontend/src/app`
Boot React, providers et shell global.

### 19.2 `kuti-frontend/src/routes`
Definition des routes React Router v7.

### 19.3 `kuti-frontend/src/components`
Components reutilisables shadcn-based.

### 19.4 `kuti-frontend/src/styles`
Tokens, variables CSS, themes et layout system.

### 19.5 `kuti-frontend/src/i18n`
Dictionnaires et helpers de localisation.

### 19.6 `kuti-frontend/src/lib`
Helpers metier et utilitaires UI.

### 19.7 `kuti-frontend/src/api`
Client genere OpenAPI et wrappers.

### 19.8 `kuti-frontend/src/stores`
Stores Zustand pour projet, UI, editeur et preferences.

## 20. Contrat API local

L'API doit etre la source de verite du frontend.

Regles:
- documenter tous les endpoints en OpenAPI
- exposer JSON coherent et stable
- utiliser des identifiants explicites
- fournir des erreurs structurees
- garder les routes locales sous `/api`

Endpoints pivots prevus:
- `GET /api/health`
- `GET /api/openapi.json`
- `GET /api/config`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{id}`
- `PATCH /api/projects/{id}`
- routes de personnages, story, warnings, versions, exports, generation

## 21. Frontend build

Le frontend et le backend sont livres comme deux applications locales distinctes, avec un build frontend independant du backend.

Contraintes:
- SSR desactive
- build compatible production locale
- bundles stables
- SDK genere avant build si necessaire
- pas de dependance reseau au runtime

## 22. Frontend editor

L'editeur Markdown structure doit supporter:
- texte riche
- blocs metier
- references `@`
- metadata de scene
- navigation contextuelle
- validation non bloquante

## 23. Regles d'implementation

- ne pas faire de logique domaine dans les composants React
- ne pas contourner l'OpenAPI pour un appel direct arbitraire
- garder les stores Zustand limites au contexte UI
- garder React Query pour l'asynchrone serveur
- gerer les mutations par use-case explicite
- ne jamais perdre la portabilite locale

## 24. Ordre conseille d'implementation

1. socle API OpenAPI
2. generation SDK frontend
3. shell React Router et theme
4. Project Hub
5. Project Dashboard
6. Characters
7. Storyline
8. Assets
9. Versions et Warnings
10. Exports
11. Generation Studio
12. stabilisation

## 25. Decoupage de livraison

### Phase 1
- API stable
- frontend branché
- gestion des projets
- projet actif local

### Phase 2
- personnages
- storyline
- references `@`
- metadonnees

### Phase 3
- coherence
- versioning
- warnings
- historique exploitable

### Phase 4
- assets
- exports
- socle generation
- preview manga

## 26. Frontend Spectrum S2

La couche UI doit etre basee sur les primitives Adobe Spectrum S2, avec une personnalisation forte.

Principes:
- composants generatifs standards, pas de design system exogene lourd
- tokens CSS centralises
- variantes de boutons, cards, inputs et dialogs
- theme clair et sombre complets
- accesibilite native autant que possible

## 27. Shell et Navigation

Le shell doit assurer le contexte et la navigation.

Composants attendus:
- sidebar projet
- topbar contexte
- breadcrumb ou fil d'Ariane
- boutons d'action rapide
- switch de langue
- switch de theme
- menu utilisateur local ou preferences

## 28. Pages detaillees

### 28.1 Project Hub (`/`)
- liste des projets
- creation
- clonage
- archivage
- export rapide
- recherche

### 28.2 Project Dashboard (`/projects/:projectId`)
- resume projet
- sections principales
- activites recentes
- warnings recents
- versions recentes

### 28.3 Chara Design (`/projects/:projectId/characters`)
- listing personnages
- fiche detaillee
- relations
- medias
- graphe relationnel

### 28.4 Storyline (`/projects/:projectId/story`)
- arbre narrative
- editeur markdown
- metadonnees scene
- references `@`
- navigation rapide

### 28.5 Generation Studio (`/projects/:projectId/generation`)
- jobs
- etapes
- prompts
- sorties
- preview intermediaire

### 28.6 Assets Library (`/projects/:projectId/assets`)
- import
- previews
- usages
- archivage
- detachement

### 28.7 Exports (`/projects/:projectId/exports`)
- export travail
- export publication
- formats
- historique

### 28.8 Project Settings (`/projects/:projectId/settings`)
- generation
- preview
- coherence
- export
- versioning
- assets

### 28.9 Warnings Center (`/projects/:projectId/warnings`)
- warnings de coherence
- filtres
- contextes
- resolution

### 28.10 Version History (`/projects/:projectId/versions`)
- versions
- branches
- comparaison
- restauration

## 29. Features transverses

- notifications et toasts
- dialogs de confirmation
- empty states utiles
- loading states
- error boundaries
- permission locale inexistante mais controle de destruction
- navigation clavier et raccourcis de base

## 30. SDK frontend et etat de donnees

Le backend Python avec FastAPI doit exposer et generer OpenAPI, puis le frontend doit generer le SDK avec `@hey-api/openapi-ts`. L'environnement backend est pilote avec `uv`.

Chaîne recommandee:
1. backend FastAPI publie `openapi.json`
2. `openapi-ts` genere `kuti-frontend/src/api/generated`
3. un wrapper `kuti-frontend/src/api` expose les hooks et clients utiles
4. React Query gere le cache serveur
5. Zustand gere les selections, panneaux, themes et preferences editoriales

## 31. Plan d'implementation

### Phase 0 - Contrat API et socle frontend
- stabiliser l'OpenAPI
- exporter le schema OpenAPI depuis le backend
- generer le SDK frontend
- brancher React Query et Zustand
- creer le shell et les routes de base

### Phase 1 - Socle projet
- creer/ouvrir/lister les projets
- persister le contexte local
- page dashboard
- settings de projet

### Phase 2 - Personnages et ecriture
- CRUD personnages
- storyline tomes/chapitres/scenes
- editor Markdown
- references `@`
- metadata de scene

### Phase 3 - Coherence et memoire
- warnings
- versioning
- comparaison/restauration
- historique exploitable

### Phase 4 - Medias et export
- assets
- archivage
- export travail
- export publication fondation

### Phase 5 - Generation et preview
- jobs de generation
- preview manga
- validation humaine

### Phase 6 - Stabilisation
- correction des cas limites
- durcissement des stores et de la persistence
- tests de non regression
- polish UI et accessibilite
