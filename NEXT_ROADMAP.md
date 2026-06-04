# Kuti Studio - Backlog de rattrapage roadmap

Ce document transforme la diff entre la codebase actuelle et `kuti-studio.md` en backlog actionnable. Il couvre les ecarts prioritaires et secondaires a traiter avant la cloture de la roadmap.

## Mode de validation

- Tu peux accéder au visuel sur l'adresse: <http://localhost:3000> afin de mieux travailler en visualisant.
- Chaque lot doit se terminer par une demo ou une verification fonctionnelle locale.
- Toute modification de contrat API doit conserver le camelCase et declencher une regeneration du SDK frontend.
- Tout traitement long ou durable doit passer par Inngest.
- Les changements doivent rester local-first et stocker les artefacts dans `kuti-data`.
- Chaque lot doit inclure au minimum: typecheck backend, typecheck frontend si le frontend est touche, et smoke test manuel du flux principal.

## Priorites

- `P0` : bloque un flux produit majeur de la roadmap.
- `P1` : flux present mais incomplet ou trop superficiel pour valider le MVP produit.
- `P2` : amelioration importante, mais non bloquante pour la boucle principale ecriture -> generation -> export.

## Checkpoint 1 - Fiche de personnage, roles narratifs et generation d'images

Priorite: `P0`

Objectif: transformer la fiche personnage en surface de production complete, avec un champ de role narratif plus riche, une generation de contenu textuel structuree et deux familles d'images clairement distinguees.

Backlog:

- Installer et utiliser le composant shadcn `Combobox` pour le champ `narrativeRole` afin d'avoir un select recherchable a la saisie.
- Conserver le champ `narrativeRole` sur `Character` comme valeur textuelle, sans relation Prisma directe avec la table des roles narratifs.
- Ajouter une table de catalogue `NarrativeRole` pour stocker les roles custom, avec un `code` slugifie servant de cle fonctionnelle.
- Definir une liste de roles narratifs predefinis exposee dans le combobox, puis fusionner cette liste avec les roles custom stockes en base.
- Gerer la creation d'un role custom depuis le select: si la valeur saisie n'existe pas, la normaliser, la slugifier, la dedoublonner et la persister dans la table des roles narratifs.
- Prevoir la resolution label -> code -> label dans l'UI pour afficher un libelle lisible tout en sauvegardant une valeur stable.
- Ajouter une migration Prisma, les DTO et les routes backend necessaires pour lister et creer des roles narratifs.
- Ajouter un bouton d'action `Generer une fiche personnage` sur la page personnage et dans le modal d'edition.
- Ouvrir une boite de dialogue dediee avec un seul champ `description minimale` et une action `Generer`.
- Brancher cette action sur un flux backend qui retourne un brouillon structure, pas un simple texte libre.
- Utiliser la description minimale pour remplir automatiquement les champs `description`, `physicalDescription`, `keyTraitsJson`, `colorPaletteJson`, `costumeElementsJson`, `personality` et `tagsJson`.
- Garder le brouillon genere editable avant validation finale afin d'eviter un ecrasement silencieux des donnees existantes.
- Refactoriser le flux d'images personnage en deux types distincts: `character_sheet` et `free_image`.
- Modeliser `character_sheet` comme une unique planche active par personnage, avec remplacement de l'ancienne lors d'une nouvelle generation.
- Modeliser `free_image` comme une serie illimitee d'images ajoutees a partir de la planche active ou, a defaut, des donnees textuelles seules.
- Ajouter dans le modele image les donnees de provenance utiles: type d'image, image source utilisee comme reference, prompt, style, variation et statut actif/inactif.
- Reutiliser automatiquement la planche active comme input de generation pour les images libres quand elle existe.
- Prevoir un fallback text-only si aucun visuel actif n'est disponible pour le personnage.
- Garder le prompt canonique de character sheet pour la generation active: `Une planche de character design complete, style concept art AAA, avec turnaround (face/profil/dos), expressions faciales, decomposition de l'equipement, palette de couleurs, poses de reference et aperçu de l'univers.`
- Adapter la surface UI de generation pour distinguer clairement la generation de fiche, la planche de character design et la galerie d'images libres.
- Regenerer le SDK frontend et les types exposes apres modification des schemas et des routes.
- Ajouter des tests backend sur la creation des roles custom, la generation de fiche et la logique sheet/free images.
- Ajouter des tests frontend ou smoke tests sur le combobox, la boite de dialogue de generation et la galerie d'images.

Validation:

- Saisir un role narratif custom dans le combobox, le selectionner, puis verifier qu'il est persiste sous forme slugifiee dans le catalogue.
- Recharger la fiche personnage et verifier que le role affichable est resolu depuis le catalogue sans relation directe avec le personnage.
- Ouvrir la boite de dialogue `Generer une fiche personnage`, saisir une description minimale et constater que les champs cibles sont pre-remplis.
- Verifier que le flux de generation produit bien les champs `description`, `physicalDescription`, `keyTraitsJson`, `colorPaletteJson`, `costumeElementsJson`, `personality` et `tagsJson`.
- Generer une planche de character design, puis regenerer une seconde planche et constater que la precedente n'est plus la planche active.
- Generer une image libre sans planche active et verifier que le flux utilise uniquement les donnees textuelles.
- Generer une image libre avec planche active et verifier que la planche active est utilisee comme reference.
- Verifier que la galerie accepte plusieurs images libres sans remplacer les precedentes.
- Verifier les typecheck backend et frontend, puis faire un smoke test manuel de la page personnage et des actions de generation.

Zones probables:

- `kuti-backend/prisma/schema.prisma`
- `kuti-backend/src/modules/characters/`
- `kuti-backend/src/modules/generation/`
- `kuti-backend/src/modules/narrative-roles/`
- `kuti-backend/src/lib/model-router.ts`
- `kuti-frontend/app/routes/character.tsx`
- `kuti-frontend/app/components/characters/`
- `kuti-frontend/app/components/ui/combobox.tsx`
- `kuti-frontend/app/locales/fr/characters.json`
- `kuti-frontend/app/locales/en/characters.json`

## Definition de done globale

- [x] Les ecarts P0 sont fermes avec validation locale.
- [x] Les ecarts P1 sont soit fermes, soit explicitement reportes avec justification produit.
- [x] Les ecarts P2 sont classes en post-MVP si non traites.
- [x] La boucle principale ecriture -> coherence -> generation -> validation -> export fonctionne sans manipulation manuelle de base de donnees.
- [x] Les artefacts restent portables sous `kuti-data`.
- [x] Les contrats publics restent en camelCase.
