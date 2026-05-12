# Kuti Studio - Cahier des charges v1

## 1. Vision produit

`kuti-studio` est un studio de production local pour concevoir des oeuvres longues de type bande dessinee, manga et univers narratif multimodal. L'application doit centraliser l'ecriture, la conception des personnages, l'organisation des scenes, la generation d'images et la preparation des exports de publication. Le produit est organise en deux applications locales separees: `kuti-backend` et `kuti-frontend`. 

Le produit doit fonctionner comme un veritable environnement de production, avec:
- gestion de projets isoles
- suivi des versions
- verification de coherence
- generation assistee par IA
- previsualisation et validation humaine avant export final

Le tout doit fonctionner en local, sans collaboration reseau, sans compte utilisateur, et sans authentification.

## 2. Objectifs

### 2.1 Objectif principal
Permettre a un auteur ou a une petite equipe locale de concevoir et produire une oeuvre sequentielle complete:
- personnages
- univers
- tomes
- chapitres
- scenes
- planches manga
- exports de travail et de publication

### 2.2 Objectifs secondaires
- garder un historique exploitable des creations
- proposer des aides a la redaction via agentique locale
- detecter les incoherences de continuite
- preparer des sorties publication pretes a consommer
- rendre les projets portables et exportables

## 3. Contraintes produit

- application locale uniquement
- aucun schema de collaboration reseau
- un seul environnement de travail par machine
- acces libre sans authentification
- interface traduite en francais et anglais
- langue par defaut de l'interface: anglais
- stockage applicatif dans un dossier `kuti-data` a cote des dossiers applicatifs `kuti-backend` et `kuti-frontend`
- backend local en Python avec FastAPI
- generation OpenAPI cote backend
- frontend en React Router v7 avec SSR desactive
- SDK frontend genere depuis l'OpenAPI du backend
- UI basee sur shadcn/ui avec design system custom
- TanStack Query pour le server state
- Zustand pour les stores UI et contexte local
- theme clair et theme sombre obligatoires
- le produit est compose de deux applications locales separees: `kuti-backend` et `kuti-frontend`

## 4. Perimetre fonctionnel

### 4.1 Project Hub
L'application s'ouvre sur un espace permettant:
- creer un projet
- ouvrir un projet
- charger un projet existant
- cloner un projet
- archiver un projet
- exporter un projet

Chaque projet est un dossier autonome sur disque, reference dans la base locale et exploitable depuis le backend Python.

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
L'editor doit permettre d'inserer des references typpees avec `@`.

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
- [ ] Inserer la reference typpee sans casser le texte Markdown
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

Le bouton de generation utilise directement `gpt-2-images`.

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

Le projet local est stocke dans une base SQLite et des dossiers de fichiers dans `kuti-data`.

Le projet doit etre exportable sous forme de:
- dossier JSON
- arborescence de fichiers
- archive zip

L'archive zip doit etre un export portable du projet.

### Checklist stockage
- [ ] Stocker les metadonnees dans SQLite
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
- base SQLite
- i18n de l'interface
- fondations d'export
- fondations de versioning

La generation image, le preview manga avance et les exports publication complets viennent juste apres le noyau MVP, mais doivent etre prevus dans l'architecture des le depart.

### Checklist MVP
- [ ] Ouvrir et gerer un projet local
- [ ] Creer et modifier des personnages
- [ ] Creer tomes, chapitres et scenes
- [ ] Inserer des references `@` typpees
- [ ] Afficher les metadonnees de scene
- [ ] Sauvegarder dans SQLite et dans `kuti-data`
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
- [ ] Crer et modifier un personnage
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
- [ ] Editer le texte avec reference typpees
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
