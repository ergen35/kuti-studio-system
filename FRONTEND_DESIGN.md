# FRONTEND_DESIGN — Kuti Studio

## Objectif
Définir une structure frontend complète, sobre et utile pour Kuti Studio, en respectant la stack imposée :

- React Router 7 en **framework mode**
- **SPA sans SSR**
- **Tailwind CSS**
- **Adobe Spectrum S2** pour le design system
- **theming** centralisé et extensible
- **React Query** (`@tanstack/react-query`) pour l'etat serveur et le caching
- backend local FastAPI comme source de vérité

Le but n’est pas de produire un simple tableau de bord, mais un **workspace éditorial de production** capable d’accompagner un travail long, dense, narratif et itératif.

---

## 1. Vision d’ensemble

Kuti Studio doit être pensé comme un **atelier de création narrative** et non comme un SaaS décoratif.

### Principes directeurs
- **sobriété** : pas de fioritures visuelles inutiles
- **densité utile** : beaucoup d’information, mais hiérarchisée
- **continuité** : le contexte doit rester visible pendant le travail
- **rapidité** : navigation, création et modification doivent être immédiates
- **traçabilité** : versions, warnings, jobs et exports doivent être compréhensibles
- **cohérence** : les écrans doivent reprendre les mêmes patterns
- **progressive disclosure** : n’afficher les détails qu’au moment utile

### Idée produit
L’interface doit fonctionner comme un **studio de production** avec :
- un **shell persistant**
- un **workspace par projet**
- une **navigation latérale stable**
- un **inspecteur contextuel**
- des **overlays** pour les actions ponctuelles
- des **états** impeccables : chargement, vide, erreur, sauvegarde, validation

---

## 2. Stack frontend obligatoire

### 2.1 Fondations techniques
- React Router 7 framework mode
- SPA sans SSR
- Tailwind CSS
- Adobe Spectrum S2 comme base du design system
- React Query (`@tanstack/react-query`) pour l’état serveur
- Zustand pour l’état UI local
- client API consommant le backend FastAPI local

### 2.2 Répartition des responsabilités
- **React Router** : structure des routes, layouts, loaders, actions, navigation
- **React Query** : cache, refetch, invalidation, synchronisation server-state
- **Zustand** : thème, densité, panneau inspecteur, sélection, palette de commandes
- **Adobe Spectrum S2** : primitives UI accessibles et cohérentes
- **Tailwind CSS** : composition, spacing, responsive, variantes visuelles

### 2.3 Contraintes React Router
Le bootstrap doit respecter la doc officielle :
- `react-router.config.ts` configuré en SPA
- `root.tsx` pour le shell global
- route modules modulaires et lisibles
- loaders/actions/fetchers pour le flux de données
- `useFetcher` pour les mutations inline
- `Form` pour les mutations non destructrices
- états pending exploitant les APIs de navigation

### 2.4 Règles importantes
- éviter les formulaires gérés manuellement par `onSubmit` si un `<Form>` React Router convient
- éviter les layouts CSS dispersés et non structurés
- éviter de dupliquer la logique de chargement entre routes et composants
- garder la logique d’interface séparée de la logique métier

---

## 3. Direction de design

### 3.1 Aesthetic direction
L’interface doit adopter un style **éditorial utilitaire** :
- fond neutre
- surfaces nettes
- hiérarchie typographique stricte
- accent discret mais reconnaissable
- motion minimale et fonctionnelle
- composition claire, presque architecturale

### 3.2 Ce qu’il faut éviter
- le faux “dashboard premium” avec gradients décoratifs
- les cartes inutiles en cascade
- les composants trop arrondis et génériques
- les couleurs trop nombreuses
- les animations gratuites
- les interfaces qui semblent faites pour montrer des métriques plutôt que pour travailler

### 3.3 Intentions visuelles
- structure en grille rigoureuse
- zones maître/détail
- panneaux redimensionnables
- tableaux lisibles
- badges de statut utiles
- accents réservés aux actions et aux états
- surface de travail stable et calme

---

## 4. Theming

Le theming doit être traité comme un **système complet**.

### 4.1 Architecture de thème
Le thème doit reposer sur des variables CSS sémantiques compatibles avec Adobe Spectrum S2, puis être enrichi par des tokens métier Kuti.

#### Tokens Spectrum S2 à définir
- `--background`
- `--foreground`
- `--card`
- `--card-foreground`
- `--popover`
- `--popover-foreground`
- `--primary`
- `--primary-foreground`
- `--secondary`
- `--secondary-foreground`
- `--muted`
- `--muted-foreground`
- `--accent`
- `--accent-foreground`
- `--destructive`
- `--destructive-foreground`
- `--border`
- `--input`
- `--ring`

#### Tokens métier Kuti
- `--kuti-surface-1`
- `--kuti-surface-2`
- `--kuti-surface-3`
- `--kuti-sidebar`
- `--kuti-canvas`
- `--kuti-inspector`
- `--kuti-editor`
- `--kuti-warning`
- `--kuti-success`
- `--kuti-draft`
- `--kuti-active`
- `--kuti-archived`
- `--kuti-open`
- `--kuti-resolved`
- `--kuti-job-running`
- `--kuti-job-failed`
- `--kuti-job-done`

#### Accents projet
Chaque projet peut disposer d’un accent local, mais il doit rester discret et ne jamais briser la sobriété globale.

### 4.2 Modes de thème
#### Light
- idéal pour l’écriture et l’édition longue
- surfaces lisibles
- contraste modéré
- ambiance papier / atelier

#### Dark
- utile pour la génération, la revue tardive et les longues sessions
- fond graphite / ink
- surfaces plates
- accents contrôlés

#### Modes optionnels
- densité `comfortable` / `compact`
- contraste `normal` / `high`

### 4.3 Gestion technique du thème
- persistance locale via Zustand + localStorage
- synchronisation du thème sur `document.documentElement`
- classe `dark` pour aligner le mode sombre Spectrum S2
- attributs optionnels :
  - `data-theme="light"`
  - `data-theme="dark"`
  - `data-density="compact"`

### 4.4 Placement du switch
Le switch de thème doit être disponible :
- dans la barre supérieure globale
- dans les réglages projet
- éventuellement dans la palette de commandes

### 4.5 Typographie
Pour éviter une esthétique générique, la typographie doit être plus éditoriale que standard.

Recommandation :
- texte UI : `IBM Plex Sans`
- mono / identifiants / métadonnées : `IBM Plex Mono`

---

## 5. Architecture de l’interface

### 5.1 Shell persistant
L’application doit garder un shell cohérent sur l’ensemble du produit.

#### Barre latérale gauche
- navigation vers les sections du projet
- projet courant
- retour au hub
- accès rapide aux warnings et aux versions

#### Barre supérieure
- breadcrumb
- titre du projet
- recherche globale
- actions contextuelles
- bascule thème / densité

#### Zone centrale
- workspace métier
- listes
- éditeur
- previews
- tables
- timelines

#### Inspecteur droit
- détail de l’entité sélectionnée
- métadonnées
- relations
- actions rapides
- validation / état

#### Barre d’état inférieure
- autosave
- jobs en cours
- erreurs
- warnings actifs
- statut de connexion locale

### 5.2 Layout maître/détail
Le pattern principal doit être :
- colonne gauche : navigation et listes
- colonne centrale : travail principal
- colonne droite : inspecteur

Ce pattern doit rester stable sur les écrans métier.

### 5.3 Responsive design
#### Desktop
- modèle principal
- plein potentiel des panneaux
- optimisation du multitâche

#### Tablet
- sidebars repliables
- inspecteur en drawer si nécessaire

#### Mobile
- navigation en sheet / drawer
- inspecteur en bottom sheet
- priorité au contenu principal

---

## 6. Système de composants

### 6.1 Composants Spectrum S2 à utiliser
- `Button`
- `Input`
- `Textarea`
- `Select`
- `Checkbox`
- `RadioGroup`
- `Switch`
- `Tabs`
- `Dialog`
- `AlertDialog`
- `Sheet`
- `DropdownMenu`
- `Popover`
- `Tooltip`
- `Command`
- `Table`
- `Card`
- `Badge`
- `Skeleton`
- `Toast`
- `Progress`
- `Separator`
- `Accordion`
- `ScrollArea`
- `Avatar`
- `ResizablePanelGroup`

### 6.2 Composants métier à construire
- `AppShell`
- `ProjectSwitcher`
- `GlobalSearchCommand`
- `WorkspaceLayout`
- `InspectorPanel`
- `EntityList`
- `EntityHeader`
- `StatusPill`
- `EmptyState`
- `ErrorState`
- `LoadingState`
- `ValidationBanner`
- `JobStatusCard`
- `DiffViewer`
- `Timeline`
- `EntityMetaGrid`
- `LinkedResourcesPanel`
- `NarrativeOutline`
- `BoardPreview`
- `PanelPreview`

### 6.3 Règles de conception des composants
- réutilisables
- typés
- accessibles
- composables
- peu d’effets cachés
- variants claires
- états `disabled`, `loading`, `error`, `selected`, `active` systématiques

---

## 7. Structure de routes recommandée

### 7.1 Routes principales
```txt
/
  → Project Hub

/projects/:projectId
  → Dashboard

/projects/:projectId/characters
  → Characters workspace

/projects/:projectId/story
  → Story workspace

/projects/:projectId/generation
  → Generation studio

/projects/:projectId/assets
  → Assets library

/projects/:projectId/exports
  → Exports

/projects/:projectId/warnings
  → Warnings center

/projects/:projectId/versions
  → Version history

/projects/:projectId/settings
  → Project settings
```

### 7.2 Routes de détail optionnelles
À conserver uniquement si elles apportent une valeur réelle de deep-linking :
- `/projects/:projectId/characters/:characterId`
- `/projects/:projectId/story/tomes/:tomeId`
- `/projects/:projectId/story/chapters/:chapterId`
- `/projects/:projectId/story/scenes/:sceneId`
- `/projects/:projectId/generation/jobs/:jobId`
- `/projects/:projectId/generation/boards/:boardId`
- `/projects/:projectId/generation/boards/:boardId/panels/:panelId`
- `/projects/:projectId/assets/:assetId`
- `/projects/:projectId/warnings/:warningId`
- `/projects/:projectId/versions/compare`

### 7.3 Règle de routage
Les routes profondes doivent être réservées aux objets souvent partagés, comparés ou restaurés. Sinon, les drawers et sheets sont préférables.

---

## 8. Inventaire complet des écrans

## 8.1 Project Hub — `/`

### Rôle
Point d’entrée de l’application.

### Objectifs
- reprendre un projet vite
- retrouver les projets récents
- créer un nouveau projet
- importer un projet local

### Contenu
- recherche de projet
- liste des projets récents
- tri / filtres
- bouton nouveau projet
- bouton import
- projet favori / épinglé
- état du stockage local

### Composants
- `Card`
- `Button`
- `Input`
- `Command`
- `Badge`
- `EmptyState`
- `Skeleton`

### États
- aucun projet
- chargement de la liste
- projet corrompu ou inaccessible
- stockage local manquant

---

## 8.2 Project Dashboard — `/projects/:projectId`

### Rôle
Cockpit du projet.

### Contenu
- résumé du projet
- dernière activité
- progression narrative
- nombre de personnages / scènes / assets / versions / warnings
- jobs récents
- exports récents
- raccourcis d’action

### Blocs recommandés
- résumé
- activité récente
- alertes importantes
- lancement rapide
- état de santé du projet

### Composants
- `Card`
- `Badge`
- `Progress`
- `Table`
- `Skeleton`

### États
- projet vide
- projet nouvellement créé
- projet avec warnings
- projet avec jobs actifs

---

## 8.3 Characters — `/projects/:projectId/characters`

### Rôle
Gérer les personnages et leurs liens narratifs.

### Layout
- gauche : liste filtrable des personnages
- centre : fiche du personnage sélectionné
- droite : relations, voix, assets liés, scènes liées

### Sections de la fiche
- identité
- rôle narratif
- description
- apparence
- palette colorimétrique
- costume
- traits clés
- personnalité
- arc narratif
- tags

### Fonctions clés
- création rapide
- duplication
- archivage
- renommage de slug stable
- liaison avec scènes et assets
- gestion des relations interpersonnelles

### Composants
- `ResizablePanelGroup`
- `Tabs`
- `Input`
- `Textarea`
- `Badge`
- `Dialog`
- `Sheet`
- `Popover`
- `Command`
- `ScrollArea`

### États
- aucun personnage
- personnage incomplet
- conflit de slug
- relation manquante
- référence orpheline
- personnage archivé

---

## 8.4 Storyline — `/projects/:projectId/story`

### Rôle
Écrire et structurer l’histoire.

### Layout
- gauche : tomes / chapitres / scènes
- centre : éditeur de scène
- droite : références, cohérence, warnings, aperçu narratif

### Modes de travail
1. structure
2. écriture
3. lecture
4. validation

### Contenu de l’éditeur de scène
- titre
- résumé
- contenu narratif
- lieu
- personnages présents
- ordre
- références `@`
- notes éditoriales

### Composants
- `Tabs`
- `Textarea`
- `Accordion`
- `Badge`
- `Alert`
- `ScrollArea`
- `Separator`
- `Button`

### États
- tome vide
- chapitre vide
- scène vide
- référence invalide
- localisation inconnue
- incohérence temporelle

---

## 8.5 Generation Studio — `/projects/:projectId/generation`

### Rôle
Créer et piloter les jobs de génération.

### Layout
- gauche : choix de la source + historique des jobs
- centre : formulaire de génération + progression + preview
- droite : board, panels, validation, résultats

### Fonctions clés
- génération à partir d’une scène
- génération à partir d’un chapitre ou d’un tome
- génération à partir d’un panel existant
- choix du modèle
- choix de la stratégie
- mode grille / direct / intermédiaire
- suivi du job
- validation du board
- sélection de panel

### Composants
- `Select`
- `RadioGroup`
- `Button`
- `Card`
- `Progress`
- `Dialog`
- `Sheet`
- `Toast`
- `Tabs`

### États
- modèle non configuré
- provider indisponible
- job en cours
- job échoué
- board partiellement généré
- panel en attente de validation

---

## 8.6 Assets Library — `/projects/:projectId/assets`

### Rôle
Gérer les médias locaux et leurs usages.

### Layout
- gauche : filtres / catégories / recherche
- centre : grille ou table d’assets
- droite : aperçu, métadonnées, usages, actions

### Fonctions clés
- import d’assets
- affichage des fichiers
- archivage
- suppression
- lien vers personnages, scènes, boards
- suivi des usages

### Composants
- `Table`
- `Card`
- `Badge`
- `DropdownMenu`
- `Dialog`
- `ScrollArea`
- `Button`

### États
- aucune ressource
- ressource archivée
- ressource orpheline
- fichier manquant
- collision de slug

---

## 8.7 Exports — `/projects/:projectId/exports`

### Rôle
Créer, historiser et télécharger les exports.

### Contenu
- choix du kind : work / publication
- choix du format : JSON / tree / zip
- liste des exports
- détails du manifest
- téléchargement
- statut d’export

### Composants
- `Card`
- `Table`
- `Badge`
- `Button`
- `Dialog`
- `Toast`

### États
- export en cours
- export prêt
- export échoué
- export obsolète

---

## 8.8 Warnings Center — `/projects/:projectId/warnings`

### Rôle
Centraliser le contrôle qualité.

### Contenu
- warnings ouverts
- warnings résolus
- filtres par type
- accès à la source
- note de résolution
- statut

### Types de warnings à gérer
- référence manquante
- lieu invalide
- incohérence temporelle
- référence orpheline
- asset manquant
- job échoué
- modèle non configuré

### Composants
- `Table`
- `Badge`
- `Alert`
- `Tabs`
- `Button`
- `Dialog`

### États
- aucun warning
- warnings multiples
- warning résolu
- warning récurrent

---

## 8.9 Version History — `/projects/:projectId/versions`

### Rôle
Visualiser, comparer et restaurer les jalons du projet.

### Contenu
- timeline des versions
- branches
- label
- summary
- comparaison
- restauration

### Composants
- `Card`
- `Badge`
- `Dialog`
- `Tabs`
- `Table`
- `Timeline` custom

### États
- aucune version
- branche linéaire
- branche active
- restauration réussie
- restauration bloquée

---

## 8.10 Project Settings — `/projects/:projectId/settings`

### Rôle
Centraliser les paramètres projet.

### Contenu
- nom
- description
- langue
- statut
- réglages de story
- réglages de génération
- réglages d’export
- préférences de cohérence
- stockage local

### Composants
- `Tabs`
- `Input`
- `Textarea`
- `Select`
- `Switch`
- `Separator`

### États
- réglage par défaut
- réglage personnalisé
- configuration incomplète

---

## 9. Overlays et écrans transverses

### 9.1 Nouveau projet
Peut être une page ou un dialog selon le flux.

#### Champs
- nom
- description
- langue
- dossier
- modèle initial
- option de thème local

### 9.2 Import projet
- sélection de dossier
- validation
- aperçu du contenu importable
- gestion des conflits

### 9.3 Global Search / Command Palette
Très importante dans un outil de production.

#### Actions typiques
- ouvrir un projet
- créer un personnage
- créer une scène
- aller à une version
- ouvrir un warning
- lancer un export
- lancer un job
- changer le thème

### 9.4 Compare view
Écran de comparaison générique pour :
- versions
- personnages
- scènes
- exports
- boards

### 9.5 Dialogs de confirmation
Utiliser `AlertDialog` pour :
- supprimer
- archiver
- restaurer
- écraser
- relancer
- réindexer

### 9.6 Error states globaux
Prévoir des écrans clairs pour :
- backend indisponible
- route inconnue
- projet manquant
- artefact manquant
- chargement cassé

---

## 10. Loading, empty et error states

Chaque écran doit gérer proprement ses états.

### États obligatoires
- loading
- empty
- error
- partial data
- dirty
- saving
- success
- offline
- provider unavailable
- validation warning
- selection multiple

### Règle UX
Un état vide n’est jamais neutre : il doit expliquer pourquoi il est vide et comment avancer.

### Pattern recommandé
- titre clair
- description courte
- action principale
- action secondaire
- illustration minimale si utile

---

## 11. Data loading et mutations

### 11.1 Chargement
- loaders au niveau route pour les collections principales
- React Query pour cache et synchronisation
- prefetch au hover sur les éléments très utilisés
- clientLoader si la donnée est principalement UI-local

### 11.2 Mutations
- `useFetcher` pour les mutations inline
- `<Form>` React Router pour les opérations standard
- invalidation ciblée de cache après mutation
- toast de succès ou d’échec
- réconciliation immédiate de l’UI

### 11.3 Règles pratiques
- pas de double logique entre composants et loaders
- pas de state server dupliqué dans Zustand
- garder les mutations compréhensibles et traçables

---

## 12. Design system et layout tokens

### 12.1 Grille et espacement
- base 4px
- rythmes réguliers
- panneaux alignés
- marges strictes

### 12.2 Rayons et ombres
- rayons modérés
- ombres légères
- priorité aux séparations de surface plutôt qu’aux effets forts

### 12.3 États visuels
- `selected`
- `active`
- `hover`
- `focus-visible`
- `disabled`
- `danger`
- `success`
- `warning`
- `muted`

### 12.4 Motion
- animations courtes
- transitions discrètes
- pas de motion décorative excessive
- utiliser la motion pour clarifier les changements d’état

---

## 13. Organisation des dossiers frontend

Structure recommandée :

```txt
app/
  root.tsx
  routes/
  components/
    ui/
    layout/
    feedback/
    data-display/
    overlays/
  features/
    projects/
    characters/
    story/
    generation/
    assets/
    exports/
    warnings/
    versions/
    settings/
  lib/
    api/
    query/
    utils/
    formatters/
  stores/
  styles/
    globals.css
    theme.css
```

### Règles d’organisation
- `components/ui` : composants shadcn localisés
- `components/layout` : shell, sidebar, inspector
- `components/feedback` : loading, empty, error, skeleton
- `components/data-display` : tables, timeline, diff, cards métier
- `features/*` : logique métier par domaine
- `stores` : état UI local uniquement
- `styles` : tokens, globals, theming

---

## 14. Stratégie de navigation

### 14.1 Navigation globale
- hub de projets
- projet courant
- sections projet
- recherche globale
- palette de commandes

### 14.2 Navigation de workspace
- listes filtrables
- tabs par sous-section
- liens profonds vers les objets importants
- drawers pour l’édition secondaire

### 14.3 Navigation contextuelle
- aller à l’objet lié depuis un warning
- ouvrir une scène depuis un personnage
- ouvrir un asset depuis un board
- restaurer une version à partir d’un diff

---

## 15. Plan d’implémentation recommandé

### Phase 1 — socle
- bootstrap React Router 7 SPA
- intégration Tailwind CSS
- installation Adobe Spectrum S2
- mise en place du thème
- shell global
- navigation persistante

### Phase 2 — fondations métier
- Project Hub
- Project Dashboard
- Command Palette
- loading / empty / error states

### Phase 3 — cœur narratif
- Characters
- Storyline
- Warnings Center

### Phase 4 — médias et traçabilité
- Assets Library
- Exports
- Version History

### Phase 5 — production assistée
- Generation Studio
- boards
- panels
- provider states
- job tracking

### Phase 6 — finition
- compare views
- densité compacte
- theming final
- accessibilité
- responsive polish
- micro-interactions

---

## 16. Critères de qualité frontend

L’interface est considérée comme bonne si elle permet :
- de retrouver un projet en moins de quelques secondes
- de comprendre l’état du projet en un coup d’œil
- de modifier une scène sans perdre le contexte
- de corriger un warning sans naviguer à l’aveugle
- de lancer un job de génération sans ambiguïté
- de restaurer une version sans peur
- d’exporter un projet sans se poser de questions

### Critères de finition
- lisibilité excellente
- hiérarchie visuelle claire
- états complets partout
- navigation fluide
- cohérence des composants
- accessibilité correcte
- thème stable
- pas de bruit visuel inutile

---

## 17. Conclusion

Le frontend de Kuti Studio doit être structuré comme un **workspace de production éditoriale**, pas comme un dashboard générique.

La bonne base est :
- **React Router 7 framework mode en SPA**
- **Tailwind CSS** pour la composition
- **Adobe Spectrum S2** pour les composants
- **un vrai système de theming**
- **un shell persistant**
- **des workspaces maître/détail**
- **des overlays pour les actions rapides**
- **une gestion rigoureuse des états**

L’objectif final est une interface **sobre, utile, avancée**, capable de supporter un travail narratif intensif sans jamais devenir confuse ou paresseuse.
