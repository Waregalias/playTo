# Spec — Tuiles de carte en vue 3D 3/4 (vecteur extrudé)

**Date :** 2026-07-10
**Périmètre :** `apps/web/src/app/game/map/` uniquement — le *rendu* des tuiles hexagonales.
**Objectif :** remplacer le rendu 2D plat actuel (polygones hexagonaux à plat) par des tuiles
hexagonales en relief vues 3/4 du dessus, façon plateau de jeu (réf. maquette 3D fournie),
tout en conservant la palette froide et sobre de `DESIGN.md`.

## Décisions figées (brainstorming)

| Choix | Décision |
|-------|----------|
| Technique | **Vecteur 3D extrudé** (100 % SVG, aucun asset image, aucune texture peinte) |
| Orientation | **Pointy-top** (conserve la géométrie actuelle) |
| Intensité du relief | **Subtil** — parois basses, inclinaison légère, ombres douces |

## Contraintes (non négociables)

1. **Ne modifier que le rendu de la carte.** Aucun changement au flux de données, à l'adjacence,
   au panneau (`hexpanel`), aux interactions (`select`/`move`/`rest`/`search`), ni à l'API.
2. **Coordonnées & logique intactes.** Les coordonnées axiales `(q, r)` et `isAdjacent`
   (package `shared`, autorité serveur) ne changent pas. Seule la **projection écran** change.
   Les voisins restent jointifs.
3. **Aucun asset ni chaîne FR en dur.** Rien n'est ajouté hors des 3 fichiers du composant.
4. `prefers-reduced-motion` respecté. Zones tactiles ≥ 44 px préservées. Accessibilité conservée
   (`role="img"`, `aria-label`).
5. Couleurs de terrain (`TERRAIN_FILLS`) inchangées ; les parois et ombres en sont **dérivées**
   (assombrissement), sans introduire de couleur chaude nouvelle.

## Modèle de rendu

### Projection 3/4
- `center(q, r)` : conserve la formule pointy-top existante, puis **compression verticale**
  du `y` par un facteur `TILT ≈ 0.62` pour simuler l'inclinaison du regard.
- Effet : la grille s'aplatit verticalement → lecture « vue du dessus légèrement inclinée ».

### Extrusion (le volume)
Chaque hex devient un **bloc** composé de 3 groupes de formes, dessinés dans cet ordre :

1. **Ombre portée** — ellipse sombre semi-transparente sous le bloc, pour le décoller du fond.
2. **Parois latérales** — les **deux arêtes inférieures** de l'hex pointy-top (celles adjacentes
   au sommet bas) extrudées vers le bas de `DEPTH ≈ 10 u`. Remplies d'une teinte terrain
   **assombrie** (gradient ou `brightness` réduit) → donne l'épaisseur.
3. **Face du dessus** — l'hexagone plein, rempli avec `TERRAIN_FILLS[terrain]` (inchangé),
   `stroke` fin sombre comme aujourd'hui.

`DEPTH` (hauteur d'extrusion) et `TILT` sont des constantes en tête de fichier, calibrées « subtil ».

### Tri de profondeur
`hexViews()` retourne la liste **triée arrière → avant** (par `r` croissant, puis `q`) afin que
les tuiles proches recouvrent proprement les lointaines. C'est ce tri qui rend l'empilement crédible.

### États (adaptés au relief)
- **Sélection** : liseré `--g-ember-glow` sur la **face du dessus** (comportement actuel conservé).
- **Survol** : `filter: brightness(1.25)` sur le bloc (face + parois).
- **Brouillard (non découvert)** : bloc plus sombre (`#26313D` actuel conservé pour la face,
  parois dérivées) ; le *mist-drift* animé existant flotte au-dessus de la face.
- **Marqueur joueur & glyphes POI** : repositionnés sur la **face du dessus** (léger décalage
  vertical `-DEPTH/…` pour « poser » l'élément sur la tuile, pas dans le vide).

## Surface de changement (3 fichiers, 0 nouveau)

- **`map-screen.ts`**
  - `center()` : ajoute la compression `TILT`.
  - Nouvelles constantes `TILT`, `DEPTH`.
  - `HexView` enrichi : `topPoints`, `wallPoints` (parois), `shadow` (cx/cy/rx/ry),
    couleurs `topFill` / `wallFill`, + coordonnées de face pour marqueur/glyphes.
  - `hexViews()` : calcule les 3 formes par hex **et trie arrière→avant**.
  - `bounds()` : élargit la hauteur pour inclure l'extrusion (`+ DEPTH`) afin d'éviter le rognage.
- **`map-screen.html`**
  - Ordre de dessin : ombre → parois → face → mist → glyphes → joueur.
  - `@for` sur la liste déjà triée ; `(click)` reste sur la **face du dessus**, `data-testid`
    identiques (`hex-{q}-{r}`) → tests inchangés.
- **`map-screen.scss`**
  - Styles `.hex-top`, `.hex-wall`, `.hex-shadow`, ajustement `.sel` / `:hover` sur le bloc.
  - Animations `mist-drift` / `pulse` et bloc `prefers-reduced-motion` conservés.

## Critères de vérification

- **Visuel** : `pnpm dev`, écran Carte → tuiles en relief 3/4, empilement correct
  (proche recouvre lointain), palette DESIGN respectée. Screenshot via preview.
- **Non-régression** : `data-testid` inchangés → tests web existants passent.
- **Interaction** : clic sur une tuile sélectionne toujours le bon hex ; move/rest/search OK.
- `pnpm lint && pnpm build` passent. Aucun rognage des blocs aux bords du viewBox.
- Test manuel `prefers-reduced-motion` : animations coupées, rendu 3D intact.

## Hors périmètre

- Textures peintes / assets `lands/*.png` (scènes verticales encadrées, inadaptées au découpage hex).
- Zoom/pan, nouvelles interactions, changement de palette, changement d'orientation en flat-top.
- Toute modification hors `apps/web/src/app/game/map/`.
