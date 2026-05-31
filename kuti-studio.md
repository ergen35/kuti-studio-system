# Kuti Studio - Cahier des charges technique v2

## 1. Vision produit

`kuti-studio` est un studio de production local pour concevoir des oeuvres longues de type bande dessinee, manga et univers narratif multimodal. L'application doit centraliser l'ecriture, la conception des personnages, l'organisation des scenes, la generation d'images et la preparation des exports de publication. Le produit est organise en deux applications locales separees: `kuti-backend` et `kuti-frontend`.

Le produit doit fonctionner comme un veritable environnement de production, avec:

- gestion de projets isoles
- suivi des versions
- verification de coherence
- generation assistee par IA
- previsualisation et validation humaine avant export final

Le tout doit fonctionner en local-first, avec une experience utilisable sur une machine de travail locale. La plateforme peut exposer une couche d'authentification pour securiser les sessions et preparer des deploiements controles, mais le coeur produit reste centre sur un usage local et non collaboratif.

### 1.1 Portee de ce document

Ce document conserve l'intention produit de Kuti Studio: un studio narratif local-first pour ecrire, organiser, generer, valider et exporter une oeuvre manga. Il precise maintenant les specifications techniques attendues pour l'implementation actuelle du depot `kuti-studio-system`.

Les sections fonctionnelles restent formulees comme un cahier des charges produit. Les sections techniques decrivent les choix d'architecture, les contrats API, les modules, les workflows IA et les contraintes d'exploitation locale a respecter pendant le developpement.

## 2. Objectifs

### 2.1 Objectif principal

Permettre a un auteur ou a une petite equipe locale de concevoir et produire une oeuvre sequentielle complete:

- personnages
- univers
- tomes
- chapitres
- scenes
- planches manga
- videos de style drama coreen issues des planches validees
- exports de travail et de publication

### 2.2 Objectifs secondaires

- garder un historique exploitable des creations
- proposer des aides a la redaction via agentique locale
- detecter les incoherences de continuite
- preparer des sorties publication pretes a consommer
- transformer les planches manga validees en sequences video de style drama coreen
- rendre les projets portables et exportables

## 3. Contraintes produit

- usage local-first, non collaboratif par defaut
- authentification applicative disponible via Better Auth pour les sessions locales ou les deploiements controles
- interface traduite en francais et anglais
- langue par defaut de l'interface: anglais
- stockage applicatif dans un dossier `kuti-data` a cote des dossiers applicatifs `kuti-backend` et `kuti-frontend`
- backend local en Bun + ElysiaJS
- base de donnees PostgreSQL pilotee par Prisma
- generation OpenAPI cote backend avec Swagger UI sur `/openapi`
- frontend en React Router v7
- SDK frontend genere depuis l'OpenAPI du backend avec Hey API
- UI basee sur shadcn/ui avec design system custom
- TanStack Query pour le server state
- Zustand pour les stores UI et contexte local
- jobs longs et workflows durables via Inngest
- cache applicatif via BentoCache, avec Redis optionnel pour un niveau L2
- completion narrative configurable pour les champs de tome, chapitre et scene
- theme clair et theme sombre obligatoires
- le produit est compose de deux applications locales separees: `kuti-backend` et `kuti-frontend`

### 3.1 Architecture technique cible

| Couche | Technologie | Version du depot | Role |
| --- | --- | --- | --- |
| Runtime backend | Bun | 1.x | Execution TypeScript locale, scripts et serveur backend |
| Framework backend | ElysiaJS | 1.4.28 | API HTTP modulaire, validation et OpenAPI |
| OpenAPI | `@elysiajs/openapi` | 1.4.15 | Swagger UI et contrat JSON pour le SDK frontend |
| ORM | Prisma | 7.8.0 | Schema, migrations et client type PostgreSQL |
| Base de donnees | PostgreSQL | 15+ cible | Persistance relationnelle locale ou controlee |
| Authentification | Better Auth | 1.6.11 | Sessions, utilisateurs et preparation des droits |
| Workflows | Inngest | 4.4.0 | Generation IA, exports et operations longues |
| Cache | BentoCache | 1.6.1 | Cache L1 memoire, Redis optionnel en L2 |
| Frontend | React + React Router | React 19.2.3 / Router 7.15.0 | Application React routee en framework mode |
| Server state | TanStack Query | 5.100.10 | Cache, invalidation et mutations API |
| Client state | Zustand | 5.0.13 | Etat UI local et preferences d'interface |
| SDK API | Hey API OpenAPI TS | 0.97.2 | Client TypeScript et helpers TanStack generes depuis OpenAPI |
| Fetch API | `@hey-api/client-fetch` | 0.13.1 | Client HTTP centralise du SDK |
| UI | shadcn/ui, Radix, Tailwind CSS | Radix 1.4.3 / Tailwind 4.3.0 | Primitives accessibles et design system |
| i18n | i18next + react-i18next | 26.1.0 / 17.0.7 | Interface anglais/francais |
| Editeur | Lexical | 0.44.0 | Edition riche et blocs structures |
| Visualisations | PixiJS, GSAP | Pixi 8.18.1 / GSAP 3.15.0 | Interactions visuelles, graphes et experiences animees |

La specification technique cible doit rester proche des dependances declarees dans `kuti-backend/package.json` et `kuti-frontend/package.json`. Toute montee de version majeure doit etre documentee avec ses impacts sur OpenAPI, le SDK genere, les migrations Prisma et les routes React Router.

### 3.2 Organisation technique du monorepo

Le produit est maintenu dans un espace de travail compose de deux applications principales et d'un dossier de donnees local:

```text
kuti-studio-system/
+-- kuti-backend/   # API Bun + ElysiaJS + Prisma
+-- kuti-frontend/  # React Router v7 + TanStack Query
+-- kuti-data/      # Donnees locales, projets et fichiers lourds
+-- docs/           # Documentation technique
```

Le backend expose les modules metier sous `/api/*` et quelques endpoints legacy sous `/api/v1/*`. Le frontend consomme le contrat via le SDK genere dans `kuti-frontend/app/lib/backend/`.

#### 3.2.1 Structure backend attendue

Le backend doit rester organise par modules autonomes Elysia. Chaque domaine metier expose son fichier de routes, son controller et ses DTO publics.

```text
kuti-backend/src/
+-- index.ts                    # bootstrap Elysia, CORS, OpenAPI, modules
+-- lib/
|   +-- auth.ts                  # configuration Better Auth
|   +-- config.ts                # validation Zod des variables d'environnement
|   +-- db/                      # client Prisma genere et helpers
|   +-- inngest/                 # fonctions durables Inngest
|   +-- model-providers.ts       # routage image, video, audio, texte
|   +-- story-completion.ts      # completion OpenAI-compatible des champs narratifs
|   +-- storage.ts, files.ts     # stockage et fichiers locaux
|   +-- paths.ts                 # chemins projet dans kuti-data
|   +-- logger.ts                # journalisation
|   +-- bento-cache/             # cache applicatif
|   +-- cron.ts                  # jobs periodiques locaux
+-- modules/
    +-- authentication/
    +-- projects/
    +-- characters/
    +-- story/
    +-- scene-generation/
    +-- drama-videos/
    +-- generation/
    +-- assets/
    +-- versions/
    +-- warnings/
    +-- exports/
    +-- inngest/
    +-- upload/
    +-- users/
```

Regles backend:

- le contrat public est declare dans les DTO Elysia/Zod du module
- chaque route publique possede un `operationId` stable
- les controllers manipulent Prisma et les services de `src/lib/`, pas le frontend
- les fichiers lourds ne doivent pas etre exposes par chemin local brut quand une route de streaming peut etre fournie
- les operations longues creent ou mettent a jour des `GenerationJob` et passent par Inngest

#### 3.2.2 Structure frontend attendue

Le frontend reste une application React Router v7 en framework mode. Les pages sont des routes plates par projet et les composants metier sont ranges par domaine.

```text
kuti-frontend/app/
+-- routes.ts                   # declaration des routes React Router
+-- routes/                     # pages: home, project, story, scene, etc.
+-- components/
|   +-- ui/                      # primitives shadcn/ui generees
|   +-- ui.tsx                   # facade temporaire de compatibilite
|   +-- home/
|   +-- characters/
|   +-- story/
|   +-- scene/
|   +-- editor/
+-- lib/
|   +-- backend/                 # SDK Hey API genere
|   +-- backend-client.ts        # client fetch centralise
|   +-- query.ts                 # configuration TanStack Query
|   +-- schemas.ts               # schemas partages frontend si necessaire
+-- hooks/
+-- stores/
+-- locales/                    # namespaces i18n en/fr
```

Regles frontend:

- les appels API passent par `~/lib/backend/@tanstack/react-query.gen` ou par les fonctions SDK generees quand un hook n'est pas adapte
- les types API viennent de `~/lib/backend/types.gen` ou de la facade `~/lib/backend`
- les composants UI composent les primitives de `app/components/ui/`
- toute chaine visible utilise i18n; l'anglais reste la langue par defaut
- les invalidations TanStack Query doivent suivre les mutations qui creent, modifient ou terminent des jobs IA

### 3.3 Contrats API et conventions

- Les contrats publics sont en `camelCase` uniquement.
- Les colonnes SQL peuvent rester en `snake_case` via Prisma `@map(...)`.
- Les routes backend doivent declarer un `operationId` stable pour la generation du SDK.
- Le contrat OpenAPI est consultable sur `/openapi` et exporte sur `/openapi/api-doc.json` en developpement.
- Le frontend utilise en priorite les hooks et options TanStack Query generes par Hey API.
- Le client fetch centralise configure l'URL API via `VITE_KUTI_API_URL`, avec `http://127.0.0.1:8000` comme valeur locale par defaut.
- Les DTO Elysia/Zod restent la source du contrat public. Apres ajout ou modification d'endpoint, le SDK frontend doit etre regenere avec `yarn api:generate`.
- Les secrets de providers IA restent dans l'environnement backend. Le frontend ne manipule que des cles de modele, des statuts et des identifiants de jobs.

Sources de verite techniques:

| Sujet | Source de verite |
| --- | --- |
| Contrat HTTP public | DTO des modules Elysia + OpenAPI genere |
| Types consommes par le frontend | SDK Hey API genere dans `kuti-frontend/app/lib/backend/` |
| Schema relationnel | `kuti-backend/prisma/schema.prisma` et migrations Prisma |
| Configuration runtime | `kuti-backend/src/lib/config.ts` et variables d'environnement |
| Routes frontend | `kuti-frontend/app/routes.ts` |
| Traductions UI | `kuti-frontend/app/locales/{en,fr}/` |

#### 3.3.1 Contrat des artefacts IA

Les artefacts lourds generes par l'IA restent sous controle backend. Le frontend ne doit pas reconstruire un chemin disque a partir d'une metadata interne.

Regles:

- une image, une page manga ou une video exposee dans l'interface doit etre fournie par une URL API ou une URL publique explicitement retournee par le backend
- les chemins locaux tels que `kuti-data/...` restent internes au backend
- les reponses publiques peuvent contenir `imageUrl`, `videoUrl`, `thumbnailUrl`, `mimeType`, `width`, `height`, `durationSeconds`, `status` et `metadata`, mais pas de secret provider ni de chemin local sensible
- les helpers frontend resolvent les URL API relatives avec `VITE_KUTI_API_URL`
- une suppression ou regeneration d'artefact doit mettre a jour la ressource metier rattachee pour eviter les references orphelines

### 3.4 Configuration technique

Variables backend structurantes:

| Variable | Role |
| --- | --- |
| `DATABASE_URL` | Connexion PostgreSQL utilisee par Prisma |
| `KUTI_DATA_DIR` | Racine locale de stockage des projets et artefacts lourds |
| `ASSETS_DIR` | Dossier public optionnel pour assets exposes directement |
| `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` | Configuration Better Auth |
| `TRUSTED_ORIGINS` | Origines autorisees pour le frontend local |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Execution durable et verification Inngest |
| `REDIS_URL` | Cache L2 optionnel |
| `GPT_IMAGES_1_5_*`, `GPT_IMAGES_2_*` | Providers image configurables pour les generations manga |
| `SORA_2_*`, `SEEDANCE_2_*` | Providers video optionnels, incluant les chemins d'API configurables |
| `ELEVEN_LABS_*` | Provider audio optionnel |
| `STORY_COMPLETION_*` | Completion OpenAI-compatible des champs narratifs |

Variables frontend structurantes:

| Variable | Role |
| --- | --- |
| `VITE_KUTI_API_URL` | URL du backend, par defaut `http://127.0.0.1:8000` en local |

La completion narrative utilise par defaut un endpoint OpenAI-compatible configure par `STORY_COMPLETION_ENDPOINT`. Les modeles autorises sont configures par `STORY_COMPLETION_MODELS` et exposes au frontend par l'API, sans exposer la cle API. La cle de completion reste strictement cote backend.

Catalogue de modeles attendu:

| Cle publique | Type | Usage |
| --- | --- | --- |
| `gpt_images_1_5` | image | Provider image alternatif ou legacy |
| `gpt_images_2` | image | Provider image principal pour les pages manga |
| `sora_2` | video | Provider video configurable |
| `seedance_2` | video | Provider video configurable |
| `eleven_labs` | audio | Voix et samples audio optionnels |
| `story_completion` | text | Completion narrative OpenAI-compatible |

L'endpoint `/api/models` expose uniquement les informations publiques: cle, type, nom d'affichage, activation et etat de configuration. Il ne doit jamais exposer les secrets.

### 3.5 Modules backend et endpoints

| Module | Base URL |
| --- | --- |
| Health et configuration | `/api/health`, `/api/healthz`, `/api/config`, `/api/models` |
| Authentification | `/api/auth/*` |
| Projets | `/api/projects` |
| Personnages | `/api/projects/:projectId/characters` |
| Storyline | `/api/projects/:projectId/story/*` |
| Generation | `/api/projects/:projectId/generation` |
| Generation de scene | `/api/projects/:projectId/story/scenes/:sceneId/*` |
| Completion narrative | `/api/projects/:projectId/story/completion-models`, `/api/projects/:projectId/story/complete-field` |
| Videos drama | `/api/projects/:projectId/drama-videos`, `/api/projects/:projectId/story/scenes/:sceneId/drama-videos`, `/api/projects/:projectId/story/scenes/:sceneId/manga-pages/:pageId/drama-videos` |
| Assets | `/api/projects/:projectId/assets` |
| Versions | `/api/projects/:projectId/versions` |
| Warnings | `/api/projects/:projectId/warnings` |
| Exports | `/api/projects/:projectId/exports` |
| Inngest | `/api/inngest` |
| Upload legacy | `/api/v1/files` |
| Users legacy | `/api/v1/users` |

### 3.6 Commandes techniques principales

Backend:

```bash
cd kuti-backend
bun install
bun run db:generate
bun run db:migrate
bun run dev
```

Frontend:

```bash
cd kuti-frontend
yarn install
yarn api:generate
yarn dev
```

Validation:

```bash
cd kuti-backend && bun run typecheck
cd kuti-frontend && yarn typecheck
```

Services locaux attendus en developpement:

| Service | URL par defaut | Role |
| --- | --- | --- |
| Backend API | `http://127.0.0.1:8000` | API Elysia, OpenAPI, streaming d'artefacts |
| Swagger UI | `http://127.0.0.1:8000/openapi` | Exploration du contrat backend |
| Frontend | `http://localhost:3000` | Application React Router |
| Inngest Dev Server | `http://localhost:8288` | Debug et execution locale des workflows |
| PostgreSQL | selon `DATABASE_URL` | Persistance Prisma |

Les services peuvent tourner sur d'autres ports si l'environnement local l'impose, mais ces valeurs restent les references documentaires et les valeurs par defaut a privilegier.

### 3.7 Donnees techniques et artefacts IA

La base PostgreSQL conserve les metadonnees structurees. Le filesystem `kuti-data` conserve les artefacts lourds: images sources, generations intermediaires, pages manga, videos, exports et fichiers importes.

Entites techniques majeures:

| Entite | Role |
| --- | --- |
| `Project` | Racine fonctionnelle et technique d'un espace de creation |
| `Character`, `CharacterImage`, `CharacterRelation` | Identite, references visuelles et relations narratives |
| `Tome`, `Chapter`, `Scene` | Structure editoriale principale |
| `GenerationJob`, `GenerationJobStep` | Suivi durable des generations IA et de leurs etapes |
| `GenerationBoard`, `GenerationBoardPanel` | Board de generation et panels d'une scene manga |
| `SceneMangaPage` | Page manga produite et rattachee a une scene |
| `DramaVideo` | Video de style drama coreen produite depuis une page manga |
| `Asset` | Media importe ou gere dans la bibliotheque projet |
| `Version`, `Warning`, `Export` | Historique, coherence et sorties de travail/publication |

Regles de stockage:

- les chemins locaux internes peuvent etre stockes en base pour l'exploitation backend
- les reponses API exposent des URL d'acces ou de streaming quand un artefact doit etre affiche dans le frontend
- les artefacts generes doivent conserver assez de metadata pour etre consultables apres coup: source, modele, prompt, taille, mime type, statut, erreur eventuelle
- les suppressions fonctionnelles doivent preferer l'archivage ou le detachement avant purge physique

### 3.8 Workflows Inngest

Les workflows durables servent a decoupler l'interface des operations longues. Une action frontend cree ou met a jour une ressource API, puis le backend envoie un evenement Inngest.

| Evenement | Fonction | Usage |
| --- | --- | --- |
| `kuti/generate-image` | `Generate Character Image` | Generation d'images de personnages |
| `kuti/generate-scene-manga` | `Generate Scene Manga` | Generation des panels et pages manga d'une scene |
| `kuti/drama-video.generate` | `Generate Korean Drama Video` | Creation d'une video drama depuis une page manga |
| `kuti/export-project` | `Export Project` | Export portable ou publication |
| `kuti/delete-project` | `Delete Project` | Suppression controlee d'un projet |
| `kuti/job.cancel` | `Cancel Generation Job` | Annulation d'un job de generation |
| `kuti/job.relaunch` | `Relaunch Generation Job` | Relance d'un job de generation |
| `kuti/check-orphan-images` | `Check Orphan Images` | Detection des images orphelines |

Contraintes workflow:

- chaque workflow doit mettre a jour `GenerationJob.status`, `progress`, `summary`, `errorMessage`, `completedAt` ou `failedAt` selon le resultat
- chaque etape significative doit etre visible via `GenerationJobStep`
- les prompts et modeles utilises doivent etre conserves pour audit et relance
- les retries Inngest ne doivent pas creer de doublons d'artefacts sans lien avec le job source

### 3.9 Pipeline IA attendu

#### Completion narrative

La completion narrative s'applique aux champs editables de tome, chapitre et scene. Le frontend demande d'abord les modeles via `/api/projects/:projectId/story/completion-models`, puis envoie une demande a `/api/projects/:projectId/story/complete-field`.

Champs minimum supportes:

- `title`
- `sceneType`
- `location`
- `synopsis`
- `summary`
- `content`
- `notes`
- `charactersJson`
- `tagsJson`

Le backend construit le contexte depuis le projet, la structure narrative, la scene courante et les personnages disponibles. La completion retourne une proposition; elle ne sauvegarde pas automatiquement le contenu en base.

#### Generation manga

La generation manga se fait depuis une scene via `/api/projects/:projectId/story/scenes/:sceneId/generate` et peut etre precedee d'un preview via `/preview-prompt`.

Contraintes:

- le modele image est choisi par `modelKey`, avec `gpt_images_2` comme valeur par defaut
- le nombre de panels doit pouvoir etre explicite et borne par l'UI
- les images de personnages selectionnees ou disponibles doivent enrichir les prompts
- la galerie scene doit recuperer les pages via `/manga-pages` et afficher les URLs publiques de panel/page

#### Videos drama coreen

Une video drama est generee depuis une page manga par `POST /api/projects/:projectId/story/scenes/:sceneId/manga-pages/:pageId/drama-videos`.

Contraintes:

- la video garde le style preset `korean_drama` par defaut
- le prompt, le modele, la page source, la scene source et les metadata techniques doivent etre conserves
- le fichier video pret est consulte via une route de streaming, jamais par chemin local brut
- la page projet `/projects/:projectId/drama-videos` liste toutes les videos du projet, tandis que la scene liste les videos contextuelles
- les chemins d'API video sont configurables par provider (`SORA_2_VIDEOS_PATH`, `SORA_2_RESPONSES_PATH` legacy, `SEEDANCE_2_GENERATE_PATH`, `SEEDANCE_2_POLL_PATH`) afin de suivre les variantes de providers OpenAI-compatibles
- si un provider video refuse la page source ou echoue temporairement, le backend peut produire une preview drama locale en MP4 depuis la page manga; ce fallback doit etre marque en metadata et visible dans l'UI

### 3.10 Criteres de conformite technique

Une evolution du produit est consideree conforme aux specs techniques si elle respecte les points suivants:

- le backend typecheck avec `bun run typecheck`
- le frontend typecheck avec `yarn typecheck`
- toute modification de contrat API est suivie d'une regeneration du SDK frontend
- les nouvelles routes backend ont un `operationId` stable et un schema de response explicite
- les nouvelles chaines visibles sont ajoutees dans les namespaces i18n anglais et francais
- les reponses API publiques restent en `camelCase`
- les workflows longs passent par Inngest et exposent un statut consultable
- les artefacts lourds sont servis par URL/API, pas par chemin local brut
- les secrets et cles de provider ne sortent jamais du backend
- les migrations Prisma accompagnent toute evolution de schema relationnel

## 4. Perimetre fonctionnel

### 4.1 Project Hub

L'application s'ouvre sur un espace permettant:

- creer un projet
- ouvrir un projet
- charger un projet existant
- cloner un projet
- archiver un projet
- exporter un projet

Chaque projet est reference dans PostgreSQL et rattache a une arborescence locale dans `kuti-data`, exploitable depuis le backend Bun/Elysia.

#### Checklist fonctionnelle

- [ ] Afficher la liste des projets disponibles avec recherche simple
- [ ] Permettre la creation rapide d'un projet avec nom minimal
- [ ] Generer automatiquement l'identifiant, le slug et le dossier racine
- [ ] Afficher l'etat du projet: actif, archive, brouillon, en maintenance
- [ ] Ouvrir un projet depuis la liste sans etape intermediaire
- [ ] Cloner un projet en dupliquant la structure et les references utiles
- [ ] Archiver un projet sans suppression immediate des donnees
- [ ] Exporter le projet en dossier JSON et en archive portable
- [ ] Afficher les dernieres modifications et le dernier acces
- [ ] Garder un acces direct a la configuration globale locale

#### Etats de l'interface

- etat vide si aucun projet n'existe
- etat de chargement pendant l'ouverture d'un projet
- etat d'erreur si le stockage local est inaccessible
- etat confirme avant suppression logique ou archivage

### 4.2 Chara Design

La section Chara Design permet de creer et maintenir les fiches de personnages.

Fonctions attendues:

- creation, edition, suppression logique et archivage de personnages
- attributs du personnage:
  - nom
  - alias
  - role narratif
  - description
  - personnalite
  - arc narratif
  - tags
  - statut
- medias associes:
  - images de reference
  - photos
  - vues sous divers angles
  - profil
  - expressions
  - timbre de voix
  - 3 samples audio de voix
- gestion des relations entre personnages
- vue relationnelle optionnelle
- representation graphique des personnages sous forme de cartes de style tarot reliees entre elles
- visualisation de graphe relationnel, pouvant utiliser `three.js`

La vue relationnelle doit montrer:

- personnages comme noeuds/cartes
- relations comme liens
- intensite de relation
- type de relation
- dependances narratives

#### Checklist fonctionnelle

- [ ] Creer, modifier, dupliquer et archiver une fiche personnage
- [ ] Editer les attributs textuels du personnage dans un formulaire clair
- [ ] Associer des tags libres et filtrables
- [ ] Gerer un statut de vie du personnage: actif, secondaire, archive, supprimable
- [ ] Ajouter et trier les medias de reference du personnage
- [ ] Lier des samples audio de voix et des notes de voix
- [ ] Visualiser les personnages sous forme de cartes illustrables
- [ ] Afficher un panneau detaille avec resume, timeline et relations
- [ ] Creer, modifier et supprimer des relations entre personnages
- [ ] Representer l'intensite et le type de relation dans le graphe
- [ ] Ouvrir une vue relationnelle plein ecran
- [ ] Naviguer rapidement vers les scenes et references impliquant un personnage
- [ ] Marquer un personnage comme utilise, orphelin ou non reference

#### Donnees visibles dans l'UI

- identite du personnage
- resume narratif
- statut narratif et editorial
- images liees
- relations principales
- scenes ou il apparait
- warnings de coherence associes

### 4.3 Storyline

La Storyline est le coeur de l'ecriture.

Structure imposee:

- une oeuvre contient plusieurs tomes
- un tome contient plusieurs chapitres
- un chapitre contient plusieurs scenes

Chaque niveau doit disposer de statuts:

- brouillon
- valide
- genere
- publie

Fonctions attendues:

- creation et edition de tomes, chapitres et scenes
- editeur riche Markdown avec blocs structures
- metadonnees visibles dans l'UI
- liens vers personnages, environnements, fichiers et autres references du projet
- autocomplete contextuel
- navigation rapide entre tomes, chapitres, scenes et entites liees

#### Checklist fonctionnelle

- [ ] Creer un tome avec titre, resume, statut et objectifs narratifs
- [ ] Creer un chapitre rattachable a un tome existant
- [ ] Creer une scene rattachable a un chapitre existant
- [ ] Reordonner tomes, chapitres et scenes par glisser-deposer ou actions explicites
- [ ] Inserer des blocs Markdown enrichis dans l'editor
- [ ] Afficher les metadonnees de la scene dans un panneau lateral
- [ ] Ouvrir rapidement les entites associees depuis la scene courante
- [ ] Valider le contenu a chaque changement important sans bloquer l'ecriture
- [ ] Conserver une navigation arborescente et une navigation par cartes
- [ ] Permettre la recherche full text dans la storyline
- [ ] Signaler les scenes incompletes ou non reliees
- [ ] Gerer des notes editoriales sans polluer le texte principal

#### 4.3.1 Syntaxe de reference

L'editor doit permettre d'inserer des references typees avec `@`.

Exemples:

- `@chara:Jack_Vespers`
- `@environment:Moon_Docks`
- `@file:reference_panel_03.png`
- `@scene:chapter_2_scene_4`

Types de references minimum:

- `chara:`
- `environment:`
- `file:`

L'autocomplete doit proposer les entites disponibles dans le projet a partir du prefixe saisi.

#### Checklist reference `@`

- [ ] Detecter les debuts de reference apres `@`
- [ ] Filtrer les suggestions par type et par saisie partielle
- [ ] Inserer la reference typee sans casser le texte Markdown
- [ ] Permettre la navigation vers l'entite cible
- [ ] Afficher un badge ou un style distinct pour chaque type
- [ ] Valider les references orphelines ou inconnues
- [ ] Mettre a jour automatiquement les references lors de renommages assistes

#### 4.3.2 Metadonnees de scene

Une scene peut contenir:

- intention narrative
- personnages presents
- lieu
- duree
- ton
- rythme
- contraintes visuelles
- notes de mise en scene
- statut
- references croisees

#### Checklist metadonnees

- [ ] Saisir et modifier les metadonnees sans ouvrir une page secondaire
- [ ] Afficher les personnages presents sous forme de chips ou de tags
- [ ] Lier le lieu a une entite environnement
- [ ] Renseigner une duree approximative
- [ ] Parametrer ton et rythme avec des valeurs lisibles
- [ ] Ajouter des contraintes visuelles et de mise en scene
- [ ] Lister les references croisees de la scene
- [ ] Marquer la scene comme a revoir, validee ou prete a generer

### 4.4 Generation de scenes et planches

Une scene ecrite peut declencher une generation.

Modes de generation supportes:

- scene par scene
- chapitre par chapitre
- tome complet

Le systeme doit automatiquement decomposer le travail en jobs plus petits.

La generation passe par le routage de modeles du backend. Les providers configurables incluent notamment `gpt_images_2` pour l'image, ainsi que des providers video et audio optionnels selon les variables d'environnement disponibles.

La completion des champs narratifs utilise un endpoint OpenAI-compatible configurable. Les modeles de completion actifs sont `gpt-5.4-nano`, `kimi-k2.5` et `gtp-5.4-mini`, exposes au frontend via `/story/completion-models`.

Deux strategies de sortie doivent etre supportees, configurables au niveau du projet:

- generation d'images intermediaires puis selection manuelle pour composer la planche manga
- generation directe de planches manga

Pour `kuti-studio`, le format de sortie cible est une bande manga japonaise.

#### Checklist generation

- [ ] Lancer une generation depuis une scene, un chapitre ou un tome
- [ ] Decomposer la demande en sous-jobs explicites
- [ ] Afficher la progression par etape et par lot
- [ ] Enregistrer les parametres de generation utilises
- [ ] Archiver les sorties intermediaires
- [ ] Permettre la selection manuelle des images retenues
- [ ] Associer les sorties a la scene source et aux assets produits
- [ ] Preparer la planche finale a partir des images valides
- [ ] Garder un historique des generations et de leurs prompts

#### 4.4.1 Completion narrative par champ

Chaque champ editable important doit pouvoir appeler un modele de completion configurable a partir du contexte existant du projet.

Champs concernes au minimum:

- tome: titre, synopsis
- chapitre: titre, synopsis
- scene: titre, type, lieu, resume, contenu, personnages, tags, notes

Comportement attendu:

- un bouton lie au champ declenche la generation
- le modele peut etre choisi parmi les modeles configures
- la proposition remplit le champ sans sauvegarder automatiquement
- l'utilisateur garde le controle de la sauvegarde finale
- le backend construit le contexte depuis le projet, le tome, le chapitre, la scene et les personnages disponibles

#### Checklist completion narrative

- [ ] Exposer les modeles de completion disponibles au frontend
- [ ] Completer un champ sans modifier directement la base
- [ ] Utiliser le contexte narratif existant pour guider la generation
- [ ] Permettre le choix du modele depuis l'interface
- [ ] Garder le contrat API en `camelCase`
- [ ] Afficher clairement l'etat de chargement du bouton de generation

### 4.5 Preview manga

Avant publication, l'utilisateur doit pouvoir:

- previsualiser le rendu quasi final
- reordonner les cases si necessaire
- valider les images intermediaires
- generer une planche finale a partir des images retenues

#### Checklist preview

- [ ] Afficher une previsualisation paginee
- [ ] Presenter les cases dans l'ordre de lecture cible
- [ ] Permettre de faire remonter ou descendre une case
- [ ] Valider, rejeter ou remplacer une image intermediaire
- [ ] Marquer une planche comme prete pour export
- [ ] Comparer version brouillon et version quasi finale

#### 4.5.1 Videos drama coreen depuis les planches

Une planche ou page manga validee peut servir de source a une generation video de style drama coreen.

Le systeme doit conserver:

- la page manga source
- le prompt video utilise
- le modele video utilise
- le style preset, par defaut `korean_drama`
- le statut de generation
- le chemin ou l'URL de la video produite
- les erreurs et metadata techniques
- l'indication explicite d'un fallback local si le provider video externe n'a pas produit l'artefact final

#### Checklist videos drama

- [ ] Creer une demande video depuis une page manga selectionnee
- [ ] Construire un prompt video a partir du contenu narratif et visuel disponible
- [ ] Utiliser un provider video configurable
- [ ] Produire une preview drama locale tracable si le provider video externe echoue
- [ ] Suivre les statuts: brouillon, en file, en cours, pret, erreur, archive
- [ ] Conserver le lien entre video, projet et page manga source
- [ ] Afficher la video generee dans le contexte de la scene ou de la generation

### 4.6 Agentique et coherence

Des agents locaux assistent l'auteur dans:

- l'ecriture
- le suivi d'avancement
- la verification de coherence
- la suggestion d'enrichissements
- l'identification de conflits narratifs

Les verifications doivent pouvoir etre activees ou desactivees dans les reglages du projet.

Les warnings doivent couvrir au minimum:

- personnage absent ou incoherent
- lieu contradictoire
- timeline incoherente
- objet ou fait impossible
- tonalite ou continuite cassee

Les warnings ne bloquent pas l'ecriture.

#### Checklist coherence

- [ ] Lancer une verification manuelle sur demande
- [ ] Lancer une verification automatique apres certaines modifications
- [ ] Enregistrer les warnings avec gravite et source
- [ ] Lier un warning a une scene, un personnage ou un chapitre
- [ ] Marquer un warning comme traite, ignore ou a revalider
- [ ] Afficher les warnings dans un centre dedie et dans le contexte de travail
- [ ] Permettre la desactivation partielle des regles de coherence

### 4.7 Versioning

Le systeme doit versionner le contenu.

Regles:

- 3 versions conservees pour chaque branche active
- possibilite de branches alternatives pour tomes, chapitres et scenes
- detection reguliere de branches orphelines ou non exploitees
- proposition d'archivage ou de suppression differree

#### Checklist versioning

- [ ] Creer une version a chaque validation importante
- [ ] Conserver les 3 dernieres versions par branche active
- [ ] Lister les versions avec metadata, date et auteur local
- [ ] Comparer deux versions du meme objet
- [ ] Restaurer une version precedente
- [ ] Detecter les branches orphelines
- [ ] Suggester archivage ou suppression differee

### 4.8 Import et archivage des medias

Les imports de medias se font depuis un dossier local.

Comportement attendu:

- import de fichiers locaux dans le projet
- copie physique dans `kuti-data` pour garantir la portabilite
- archivage avant suppression definitive
- suppression differree par defaut
- possibilite de detacher un asset sans supprimer le fichier immediatement

#### Checklist assets

- [ ] Importer un ou plusieurs fichiers depuis le disque local
- [ ] Copie physique dans l'arborescence de projet
- [ ] Enregistrer les metadata du fichier source et de la copie
- [ ] Afficher les usages du media dans le projet
- [ ] Detacher un asset sans suppression immediate
- [ ] Deplacer un asset vers une zone d'archive avant purge
- [ ] Lancer une suppression definitive seulement avec confirmation

### 4.9 Exports

Deux familles d'exports doivent exister.

#### Export travail

Destine au partage entre auteurs.
Il doit inclure:

- donnees du projet
- structure narrative
- medias necessaires
- references
- etats de version

#### Export publication

Destine aux lecteurs et a la diffusion finale.
Formats supportes:

- images paginees
- PDF
- CBZ
- EPUB

Le format prioritaire pour la publication est:

1. images paginees
2. PDF

L'export doit permettre de choisir le ou les formats souhaites.

#### Checklist exports

- [ ] Exporter le projet en dossier JSON portable
- [ ] Exporter une arborescence de fichiers coherente
- [ ] Produire une archive ZIP complete
- [ ] Inclure les assets requis dans l'export travail
- [ ] Produire des exports publication en images paginees
- [ ] Produire un PDF de lecture
- [ ] Garder un historique des exports generes
- [ ] Associer chaque export a un projet et a une version source

## 5. Organisation fonctionnelle de l'interface

L'ouverture de l'app affiche d'abord un projet ou une selection de projet.

L'interface projet est organisee en cartes ou sections principales:

- Chara Design
- Storyline
- Generation Studio
- Drama Videos
- Tasks
- Warnings Center
- Version History
- Assets Library
- Exports
- Project Settings

Chaque section doit etre accessible rapidement depuis le tableau de bord du projet.

### Principes d'organisation

- navigation persistante par sidebar ou rail
- en-tete projet avec nom, statut et raccourcis
- zones de travail en panneaux redimensionnables quand necessaire
- actions primaires visibles sans surcharge visuelle
- etats de chargement et d'erreur explicites

## 6. Reglages projet

Chaque projet doit posseder ses reglages propres:

- strategie de generation
- mode de preview
- niveau de validation humaine
- options de coherence
- formats d'export autorises
- langue de travail du contenu si necessaire
- comportement de suppression des assets
- politique de versioning

### Checklist reglages

- [ ] Modifier les regles d'un projet sans toucher aux autres projets
- [ ] Choisir la strategie de generation par defaut
- [ ] Definir le niveau de validation humaine requis
- [ ] Activer ou desactiver les warnings de coherence
- [ ] Limiter les formats d'export disponibles
- [ ] Definir le comportement de suppression et d'archivage des medias
- [ ] Regler la politique de retention des versions

## 7. Langues et i18n

L'interface de l'application doit etre localisee en:

- anglais par defaut
- francais

Le contenu du projet n'a pas besoin d'etre traduit automatiquement par l'application.
Seule l'interface doit etre i18n-ready des le debut.

### Checklist i18n

- [ ] Definir des cles de traduction stables
- [ ] Fournir au moins `en` et `fr`
- [ ] Utiliser l'anglais comme langue par defaut
- [ ] Permettre le changement de langue dans l'interface
- [ ] Laisser le contenu utilisateur intact
- [ ] Ne pas casser les routes ou les actions au changement de langue

## 8. Stockage et export de projet

Le projet local est stocke dans PostgreSQL pour les metadonnees structurees et dans `kuti-data` pour les fichiers lourds, artefacts de generation, medias importes et exports.

Le projet doit etre exportable sous forme de:

- dossier JSON
- arborescence de fichiers
- archive zip

L'archive zip doit etre un export portable du projet.

### Checklist stockage

- [ ] Stocker les metadonnees dans PostgreSQL via Prisma
- [ ] Stocker les fichiers lourds dans l'arborescence locale
- [ ] Garantir la portabilite du dossier `kuti-data`
- [ ] Gerer les chemins relatifs et absolus de facon coherente
- [ ] Eviter les donnees orphelines apres suppression
- [ ] Permettre une restauration complete depuis l'export

## 9. MVP

Le MVP doit couvrir en priorite:

- gestion des personnages
- ecriture de la storyline
- structure tomes / chapitres / scenes
- references `@`
- metadonnees visibles
- stockage local
- base PostgreSQL pilotee par Prisma
- i18n de l'interface
- fondations d'export
- fondations de versioning

La generation image, le preview manga avance et les exports publication complets viennent juste apres le noyau MVP, mais doivent etre prevus dans l'architecture des le depart.

### Checklist MVP

- [ ] Ouvrir et gerer un projet local
- [ ] Creer et modifier des personnages
- [ ] Creer tomes, chapitres et scenes
- [ ] Inserer des references `@` typees
- [ ] Afficher les metadonnees de scene
- [ ] Sauvegarder les metadonnees dans PostgreSQL et les fichiers dans `kuti-data`
- [ ] Basculer l'interface entre anglais et francais
- [ ] Exporter une base de travail simple
- [ ] Conserver un historique minimal de versions

## 10. Principes de conception

- local-first
- extensible
- lisible
- versionnable
- portable
- coherent
- oriente production
- controle par l'utilisateur
- jamais opaque sur les transformations faites par l'IA

## 11. Resultat attendu

`kuti-studio` doit devenir un studio de production narratif local capable de:

- organiser un projet complet
- structurer une oeuvre longue
- assister l'ecriture
- generer et valider des images
- produire des planches manga
- transformer des planches validees en videos de style drama coreen
- exporter un travail de qualite publication

## 12. Experience d'interface globale

L'interface doit etre pensee comme un outil de production et non comme une simple app de saisie.

### Principes UX

- afficher le projet actif en permanence
- donner une priorite claire a la structure narrative
- separer les actions de creation, d'edition et d'export
- rendre les warnings visibles mais non intrusifs
- conserver un vocabulaire stable entre les ecrans
- limiter les changements de contexte inutiles
- proposer des etats vides utiles avec actions directes

### Checklist UX globale

- [ ] Garder le contexte du projet visible partout
- [ ] Rendre les actions principales accessibles en un clic ou deux
- [ ] Eviter les pages sans issue ou sans lien de retour
- [ ] Rendre les changements de statut explicites
- [ ] Visualiser la progression du travail editorial
- [ ] Afficher des messages d'aide precis et operationnels

## 13. Pages du produit

### 13.0 Routage frontend actuel

Le frontend React Router v7 expose aujourd'hui les routes principales suivantes. Les nouvelles pages produit doivent rester alignees sur ce schema de routage plat par projet.

| Page | Route |
| --- | --- |
| Project Hub | `/` |
| Project Dashboard | `/projects/:projectId` |
| Chara Design | `/projects/:projectId/characters` |
| Detail personnage | `/projects/:projectId/characters/:characterId` |
| Storyline | `/projects/:projectId/story` |
| Detail tome | `/projects/:projectId/story/:tomeId` |
| Detail chapitre | `/projects/:projectId/story/:tomeId/chapters/:chapterId` |
| Detail scene | `/projects/:projectId/story/:tomeId/scenes/:sceneId` |
| Assets Library | `/projects/:projectId/assets` |
| Generation Studio | `/projects/:projectId/generation` |
| Drama Videos | `/projects/:projectId/drama-videos` |
| Tasks | `/projects/:projectId/tasks` |
| Warnings Center | `/projects/:projectId/warnings` |
| Version History | `/projects/:projectId/versions` |
| Exports | `/projects/:projectId/exports` |
| Project Settings | `/projects/:projectId/settings` |

### 13.1 Project Hub (`/`)

Page d'entree de l'application front. Elle sert a identifier rapidement un projet a ouvrir ou a creer.

Contenu attendu:

- liste des projets recents et disponibles
- bouton de creation de projet
- bouton d'import ou ouverture d'un projet existant
- actions rapides: cloner, archiver, exporter
- recherche et filtrage simples

Comportement:

- si un seul projet est present, il peut etre propose comme entree prioritaire
- si aucun projet n'existe, un etat vide guide vers la creation
- les actions destructives demandent confirmation

Checklist de page:

- [ ] Afficher une vue liste et une vue cartes si utile
- [ ] Montrer les informations essentielles de chaque projet
- [ ] Proposer creation, ouverture, clonage, archivage et export
- [ ] Gerer les etats vide, charge et erreur
- [ ] Supporter la navigation clavier

### 13.2 Project Dashboard (`/projects/:projectId`)

Tableau de bord du projet. C'est la page de synthese et de navigation principale.

Contenu attendu:

- resume du projet
- dernieres activites
- acces direct aux modules clefs
- etat global du projet
- warnings recents
- versions recentes

Checklist de page:

- [ ] Afficher les metadonnees du projet
- [ ] Offrir des tuiles ou cartes vers chaque module
- [ ] Presenter les dernieres modifications
- [ ] Afficher les prochains travaux suggerees
- [ ] Alerter sur les warnings non traites

### 13.3 Chara Design (`/projects/:projectId/characters`)

Page dediee a la creation et a la maintenance des personnages.

Contenu attendu:

- liste des personnages
- carte detaillee du personnage selectionne
- formulaire d'edition
- panneau des relations
- galerie des medias associes
- option de graphe relationnel

Checklist de page:

- [ ] Lister les personnages avec tri et filtrage
- [ ] Creer et modifier un personnage
- [ ] Acceder aux relations et aux references de scene
- [ ] Visualiser les assets associes
- [ ] Proposer un graphe relationnel optionnel
- [ ] Supporter l'edition rapide et l'archivage

### 13.4 Storyline (`/projects/:projectId/story`)

Page centrale de l'ecriture.

Contenu attendu:

- arbre tomes / chapitres / scenes
- editeur Markdown structure
- metadonnees de la scene
- references `@`
- navigation laterale
- panneau de coherence contextuel

Checklist de page:

- [ ] Afficher l'arborescence narrative
- [ ] Ouvrir une scene sans perdre le contexte
- [ ] Editer le texte avec references typees
- [ ] Montrer les metadonnees de la scene
- [ ] Naviguer entre les entites liees
- [ ] Mettre en avant les scenes a completer
- [ ] Lier la scene aux personnages et fichiers utilises

### 13.5 Generation Studio (`/projects/:projectId/generation`)

Page de suivi et de lancement des generations.

Contenu attendu:

- lancement des jobs de generation
- liste des generations en cours et terminees
- parametres du mode de generation
- historique des prompts et resultats
- vue des etapes de job

Checklist de page:

- [ ] Lancer une generation par scene, chapitre ou tome
- [ ] Visualiser le decoupage en jobs plus petits
- [ ] Suivre la progression en temps reel ou rafraichie
- [ ] Afficher les sorties intermediaires
- [ ] Permettre la relance ou l'annulation si supportee
- [ ] Lier la generation a la version source

### 13.5.1 Drama Videos (`/projects/:projectId/drama-videos`)

Page de consultation des videos drama coreen generees depuis les pages manga validees du projet.

Contenu attendu:

- liste des videos par statut et par scene source
- preview video quand le fichier est disponible
- lien vers la page manga source et la scene source
- metadata de generation: modele, preset, prompt, duree, resolution et erreurs
- actions de relance ou archivage quand supportees

Checklist de page:

- [ ] Lister toutes les videos d'un projet via `/api/projects/:projectId/drama-videos`
- [ ] Filtrer par statut, modele et scene source
- [ ] Ouvrir rapidement la scene et la page manga source
- [ ] Afficher les videos pretes sans exposer les chemins internes sensibles
- [ ] Conserver la generation effective dans les endpoints scene/page manga

### 13.5.2 Tasks (`/projects/:projectId/tasks`)

Page de suivi operationnel des travaux editoriaux, techniques et de generation rattaches au projet.

Contenu attendu:

- liste ou arbre de taches
- filtres par statut, priorite et type
- detail lateral d'une tache
- progression et dependances
- lien vers l'entite source si la tache concerne une scene, un personnage, un warning ou une generation

Checklist de page:

- [ ] Afficher les taches sous forme exploitable et filtrable
- [ ] Ouvrir un detail sans perdre la liste courante
- [ ] Montrer la progression et le statut de chaque tache
- [ ] Relier une tache aux entites projet concernees
- [ ] Supporter les workflows de suivi sans bloquer l'ecriture

### 13.6 Assets Library (`/projects/:projectId/assets`)

Bibliotheque des medias et fichiers du projet.

Contenu attendu:

- liste des assets
- import depuis le disque local
- details de fichier
- usages dans le projet
- archivage et suppression differree

Checklist de page:

- [ ] Importer des fichiers locaux
- [ ] Afficher les previews ou icones de type
- [ ] Montrer les usages et references
- [ ] Distinguer actifs, archives et orphelins
- [ ] Detacher un asset sans supprimer le fichier
- [ ] Gerer les suppressions avec confirmation

### 13.7 Exports (`/projects/:projectId/exports`)

Page de generation et de consultation des exports.

Contenu attendu:

- export travail
- export publication
- historique des exports
- selection des formats
- details de contenu exporte

Checklist de page:

- [ ] Lancer un export travail complet
- [ ] Lancer un export publication
- [ ] Choisir le ou les formats de sortie
- [ ] Visualiser le contenu inclus dans l'export
- [ ] Lister les exports precedents avec statut
- [ ] Ouvrir ou localiser un export genere

### 13.8 Project Settings (`/projects/:projectId/settings`)

Reglages specifiques au projet.

Contenu attendu:

- strategie de generation
- preview
- coherence
- versioning
- export
- langue de travail
- gestion des assets

Checklist de page:

- [ ] Afficher les parametres en sections logiques
- [ ] Pre-remplir les valeurs par defaut
- [ ] Sauvegarder sans recharger toute l'application
- [ ] Marquer clairement les changements non sauvegardes
- [ ] Revenir aux valeurs de reference si necessaire

### 13.9 Warnings Center (`/projects/:projectId/warnings`)

Centre de suivi des warnings de coherence et de structure.

Contenu attendu:

- liste des warnings
- filtres par gravite, statut, origine et entite
- detail contextuel du warning
- actions de traitement

Checklist de page:

- [ ] Afficher les warnings en liste exploitable
- [ ] Filtrer les warnings par type et priorite
- [ ] Ouvrir le contexte source du warning
- [ ] Marquer un warning comme traite ou ignore
- [ ] Conserver l'historique des warnings

### 13.10 Version History (`/projects/:projectId/versions`)

Historique des versions et des branches.

Contenu attendu:

- arbre de branches
- liste des versions
- comparaison
- restauration
- branches orphelines

Checklist de page:

- [ ] Afficher les versions par objet et par branche
- [ ] Comparer deux versions
- [ ] Restaurer une version precedente
- [ ] Identifier les branches inutilisees
- [ ] Suggester nettoyage ou archivage

## 14. Composants UI transverses

Les composants transverses doivent etre reutilisables sur toutes les pages.

Liste des composants attendus:

- shell global de l'application
- navigation projet
- header de contexte
- barre d'actions primaires
- panneaux lateraux
- cartes de synthese
- dialogs de confirmation
- toasts et alerts
- badges de statut
- table ou liste virtuelle si necessaire
- composants de recherche et filtre

### Checklist composants

- [ ] Standardiser les etats de chargement
- [ ] Standardiser les etats vides
- [ ] Standardiser les confirmations destructives
- [ ] Standardiser la presentation des statuts
- [ ] Standardiser les erreurs de formulaire
- [ ] Reutiliser les memes patterns de navigation

## 15. Regles d'interaction et d'etats

- aucune action destructrice sans confirmation explicite
- toute sauvegarde importante doit produire un retour visible
- toute generation doit afficher sa progression
- les warnings ne doivent pas interrompre l'ecriture
- la navigation doit conserver le contexte de projet
- les etats vide doivent proposer une action directe

### Checklist interaction

- [ ] Gerer les erreurs reseau locales ou de backend
- [ ] Gerer les erreurs de validation sans bloquer inutilement
- [ ] Gerer les chargements longs sans freeze de l'UI
- [ ] Afficher les toasts seulement pour les retours utiles
- [ ] Garder les confirmations courtes et explicites

## 16. Criteres de finition du MVP produit

Le MVP est considere comme termine si:

- un projet peut etre cree et ouvert localement
- les personnages peuvent etre geres
- la storyline est editable en tomes, chapitres et scenes
- les references `@` fonctionnent
- les metadonnees sont visibles
- les donnees sont stockees localement et de facon portable
- l'interface est disponible en anglais et francais
- la base de versioning est en place
- les exports de travail existent
- les pages principales sont accessibles depuis le shell

### Checklist finale MVP

- [ ] Project Hub fonctionnel
- [ ] Dashboard projet fonctionnel
- [ ] Chara Design fonctionnel
- [ ] Storyline fonctionnelle
- [ ] Generation Studio structure
- [ ] Assets Library structure
- [ ] Exports structure
- [ ] Settings projet fonctionnel
- [ ] Warnings Center fonctionnel
- [ ] Version History fonctionnel
