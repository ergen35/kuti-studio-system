# Kuti Studio - Roadmap ordonnee

Ce document suit l'ordre du parcours utilisateur et des dependances metier: projet -> personnages -> histoire -> scene -> planche manga -> export.

> Statut: points implementes coches d'apres l'analyse du codebase au 2026-06-04, avec typechecks backend/frontend passes.

## Regles transversales

- Toute modification d'API publique reste en `camelCase`.
- Toute modification de contrat API declenche une regeneration du SDK frontend.
- Tout traitement long ou durable passe par Inngest.
- Les artefacts lourds restent sous `kuti-data`.
- Chaque checkpoint se termine par au minimum: typecheck backend, typecheck frontend si le frontend a bouge, et smoke test manuel du flux principal.
- Chaque lot se conclut par une verification fonctionnelle locale ou une demo.

## Checkpoint 1 - Projet, espace de travail et navigation

Priorite: `P0`

Objectif: permettre a un utilisateur de creer un projet, l'ouvrir, le retrouver et garder un workspace stable.

Backlog:

- [x] Creer un projet depuis le hub d'entree.
- [x] Ouvrir un projet existant depuis la liste ou le dashboard.
- [x] Importer ou rouvrir un projet local existant.
- [x] Conserver les donnees du projet dans un espace isole sous `kuti-data`.
- [x] Afficher le projet actif partout ou le contexte est utile.
- [x] Gerer l'archivage, le clonage et la suppression controlee.
- [x] Stabiliser le routage frontend autour du hub projet et du dashboard projet.
- [x] Poser les bases i18n pour les ecrans `common` et `project`.
- [x] Garder une base technique compatible avec les sessions locales et les deploiements controles.

Validation:

- [x] Creer un projet, le fermer, puis le rouvrir sans perte de contexte.
- [x] Ouvrir deux projets differents et verifier que leurs donnees restent isolees.
- [x] Revenir sur l'application apres rechargement et retrouver le projet actif.
- [x] Verifier les checks de base backend et frontend sur le parcours projet.

## Checkpoint 2 - Personnages et identite visuelle

Priorite: `P0`

Objectif: permettre la creation de personnages, la gestion de leur role narratif et la generation de leur base visuelle.

Backlog:

- [x] Creer, modifier, dupliquer et archiver un personnage.
- [x] Gerer `narrativeRole` comme une valeur texte stable avec un catalogue de roles predefinis et custom.
- [x] Permettre la recherche par combobox et la creation d'un role custom depuis la saisie.
- [x] Exposer un brouillon structure de fiche personnage a partir d'une description minimale.
- [x] Remplir automatiquement les champs de fiche utiles: `description`, `physicalDescription`, `keyTraitsJson`, `colorPaletteJson`, `costumeElementsJson`, `personality` et `tagsJson`.
- [x] Garder le brouillon editable avant validation finale.
- [x] Generer une planche `character_sheet` unique et active par personnage.
- [x] Gerer `free_image` comme une galerie illimitee alimentee par la sheet active ou par les donnees texte seules.
- [x] Stocker les metadonnees de provenance des images: source, prompt, style, variation et statut actif/inactif.
- [x] Afficher les images en grand dans une modale image-only, sans panneau prompt inutile.
- [x] Regenerer le SDK frontend apres toute modification de contrat.

Validation:

- [x] Un role narratif custom peut etre cree, relu et resolu depuis le catalogue.
- [x] Une fiche personnage peut etre generee a partir d'une description minimale.
- [x] Une sheet active peut etre remplacee par une nouvelle generation.
- [x] Une image libre peut etre ajoutee sans remplacer les precedentes.
- [x] La lightbox affiche uniquement l'image sur desktop et mobile.

## Checkpoint 3 - Storyline structuree

Priorite: `P0`

Objectif: permettre d'ecrire une histoire structuree en tomes, chapitres et scenes, avec metadonnees editables et completion narrative.

Backlog:

- [x] Creer un tome rattache a un projet.
- [x] Creer un chapitre rattache a un tome.
- [x] Creer une scene rattachee a un chapitre.
- [x] Gerer le reordonnancement des tomes, chapitres et scenes.
- [x] Donner a la scene un statut, un ordre, un resume, un contenu, des notes et des tags.
- [x] Definir une longueur cible ou un budget de pages pour une scene.
- [x] Exposer un editeur riche avec blocs Markdown structures.
- [x] Rendre visibles les metadonnees de la scene dans l'UI.
- [x] Permettre la navigation rapide entre tomes, chapitres, scenes et entites liees.
- [x] Exposer une completion narrative configurable pour les champs de tome, chapitre et scene.
- [x] Permettre la recherche full text dans la storyline.

Validation:

- [x] Construire une oeuvre avec plusieurs tomes, chapitres et scenes.
- [x] Reordonner la structure sans casser les liens.
- [x] Ouvrir une scene et retrouver son contenu, ses metadonnees et son statut.
- [x] Completer un champ narratif sans sauvegarde automatique.
- [x] Retrouver une scene par recherche textuelle dans la storyline.

## Checkpoint 4 - References, autocomplete et coherence de scene

Priorite: `P0`

Objectif: rendre la scene referencable, verifiable et exploitable par les generations futures.

Backlog:

- [x] Detecter les references `@` dans l'editeur de scene.
- [x] Proposer un autocomplete pour personnages, environnements, fichiers et scenes.
- [x] Inserer une reference typee sans casser le Markdown existant.
- [x] Resolver label -> slug -> label de facon stable.
- [x] Importer et exposer les assets de reference utiles a la scene.
- [x] Lier un warning a une scene, un personnage ou un chapitre.
- [x] Signaler les references orphelines, les personnages absents et les incoherences de contexte.
- [x] Marquer une scene comme a revoir, validee ou prete a generer.
- [x] Exposer les references de scene de facon exploitable par la generation manga.

Validation:

- [x] Taper `@` dans une scene propose les bonnes entites du projet.
- [x] Une reference inconnue est signalee avant generation.
- [x] Une scene validee ne peut pas partir en generation si des references critiques manquent.
- [x] Un asset de reference peut etre retrouve et cible depuis la scene.

## Checkpoint 5 - Generation de planches manga

Priorite: `P0`

Objectif: transformer une scene validee en une ou plusieurs planches manga coherentes, avec la bonne consistance visuelle des personnages.

Backlog:

- [x] Lancer une generation depuis une scene validee.
- [x] Analyser le texte de scene et detecter les references et contraintes.
- [x] Recuperer les character sheets actives, les assets et les donnees de scene.
- [x] Generer automatiquement une character sheet manquante avant la planche manga.
- [x] Construire un prompt d'image a partir du contexte de scene, des references et des character sheets.
- [x] Supporter une scene produisant une ou plusieurs pages ou planches.
- [x] Inclure les bulles de dialogue dans la composition finale.
- [x] Persister le prompt, le modele, la source, les references et les statuts de generation.
- [x] Exposer la progression du job via Inngest et `GenerationJob`.
- [x] Conserver un historique des generations et des artefacts intermediaires.

Validation:

- [x] Une scene validee produit une planche manga lisible.
- [x] Une scene longue peut produire plusieurs pages.
- [x] Un personnage sans sheet force d'abord la generation de sa sheet.
- [x] Les bulles de dialogue sont presentes dans le rendu.
- [x] La consistance visuelle des personnages est conservee entre scene et planche.

## Checkpoint 6 - Preview, assemblage et export

Priorite: `P1`

Objectif: assembler les sorties de scene dans le bon ordre, les previsualiser et les exporter sans perdre les metadonnees de production.

Backlog:

- [x] Previsualiser les planches dans l'ordre de lecture cible.
- [x] Reordonner ou remplacer les cases et images intermediaires si necessaire.
- [x] Assembler les pages d'une scene dans le bon ordre.
- [x] Assembler les scenes d'un chapitre, puis les chapitres d'un tome.
- [x] Marquer une planche comme prete pour export.
- [x] Exposer les artefacts via des URLs API ou publiques, jamais via des chemins locaux bruts.
- [x] Exporter un travail de production et un travail de publication.
- [x] Conserver les metadonnees de sortie utiles: source, modele, taille, statut et erreurs.

Validation:

- [x] Un chapitre assemble les pages de ses scenes dans l'ordre attendu.
- [x] Un tome reprend l'ordre des chapitres sans intervention manuelle.
- [x] Une planche peut etre previsualisee avant export.
- [x] Un export ne demande pas de manipulation manuelle de la base de donnees.

## Checkpoint 7 - Coherence, versioning et operations durables

Priorite: `P1`

Objectif: rendre le systeme robuste face aux incoherences, conserver l'historique et securiser les jobs longs.

Backlog:

- [x] Lancer des warnings de coherence manuellement et automatiquement.
- [x] Couvrir au minimum: personnage absent ou incoherent, lieu contradictoire, timeline incoherente, objet impossible et tonalite cassee.
- [x] Lier un warning a une scene, un personnage ou un chapitre.
- [x] Voir les warnings dans un centre dedie et dans le contexte de travail.
- [x] Versionner les projets, la storyline, les scenes et les generations.
- [x] Permettre la navigation entre versions et la comparaison des changements.
- [x] Suivre les jobs durables avec relance, annulation et reprise.
- [x] Detecter et traiter les artefacts orphelins.

Validation:

- [x] Un warning peut etre ouvert, traite ou ignore.
- [x] Une version precedente peut etre inspectee sans perdre le projet courant.
- [x] Un job de generation survit a un rechargement ou a un redemarrage local.
- [x] Les artefacts orphelins sont identifies sans casser les references de travail.

## Checkpoint 8 - Post-MVP et extensions

Priorite: `P2`

Objectif: ajouter les sorties secondaires et les automatismes avances apres stabilisation du noyau produit.

Backlog:

- [x] Generer des videos drama coreen a partir de planches validees.
- [x] Conserver la page source, le prompt video, le modele et le fallback local eventuel.
- [x] Ajouter des vues de consultation pour les videos, les exports et les archives.
- [ ] Etendre l'automatisation si des besoins de collaboration ou de publication apparaissent.

Validation:

- [x] Une page validee peut produire une video traceable.
- [x] Les metadonnees de video restent consultables sans exposer les secrets du provider.

## Definition de done globale

- [x] Le flux complet projet -> personnages -> histoire -> scene -> planche manga fonctionne localement.
- [x] Les contrats publics restent en camelCase.
- [x] Les artefacts lourds restent sous `kuti-data`.
- [x] Les jobs longs passent par Inngest.
- [x] Les typecheck backend et frontend passent.
- [ ] Smoke test manuel du flux principal.
