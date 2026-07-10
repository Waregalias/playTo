# Design — Web responsive (mobile-first → dashboard large)

Date : 2026-07-10
Statut : validé (brainstorming), prêt pour plan d'implémentation.

## Objectif

L'application est aujourd'hui strictement mobile-first : une colonne
`max-width: 520px` centrée sur tout écran (`game.scss`). On veut que **depuis un
navigateur large / une PWA installée sur desktop, l'interface exploite la largeur**
(rail latéral + statusbar pleine largeur + écrans en dashboard multi-colonnes),
tout en **gardant l'expérience mobile actuelle inchangée** sur téléphone (y compris
PWA téléphone).

## Décisions cadrées (brainstorming)

1. **Périmètre = reflow responsive.** Aucune nouvelle feature, aucun nouveau
   panneau, aucune modification de l'API ni du store. On réorganise en CSS le DOM
   existant. Les panneaux visibles dans les maquettes web mais absents du code
   (rail Quêtes, Progression région, Chantiers communautaires, Activité serveur,
   Journal mondial, inventaire rapide, grille des 6 bâtiments du Bastion) sont
   **hors périmètre** (jalon ultérieur).
2. **Détection = largeur de viewport.** Point de rupture unique
   `@media (min-width: 1024px)` (« wide »). Pas de détection `display-mode`.
   Un téléphone est étroit (PWA ou non) → layout mobile ; un desktop est large
   (PWA ou non) → dashboard. Correspond exactement au besoin.
3. **Implémentation = CSS responsive pur.** Un seul arbre de composants, aucun
   template dupliqué, aucun signal `isDesktop`. Tout le passage colonne→dashboard
   se fait via media query + CSS grid.
4. **Deux paliers seulement** (mobile / wide). Pas de palier tablette : sous 1024px,
   la colonne ~520px centrée actuelle est conservée telle quelle.

## Assets

Le reflow validé **ne nécessite aucun nouvel asset** : il ne fait que réagencer le
DOM existant en CSS. Les assets ci-dessous ne concernent que la *fidélité pixel*
totale aux maquettes, qui relève des panneaux hors périmètre — listés ici pour
mémoire, non requis par cette tâche.

Présents : portraits de classes (`blade/arcanist/scout/cantor.png`), portraits
d'ennemis (`soot-wolf/spectral-shepherd/heather-reaper/hollow-knight.png`),
`hero-meadow.webp`, icônes PWA, polices Cinzel + Alegreya Sans (Google Fonts).

Manquants pour la fidélité totale (hors périmètre) :

- **Bannière du Bastion** : silhouette de citadelle en feu (« Bastion de Cendrelune »),
  visible en tête de l'écran Bastion (mobile ET desktop). Seul gap qui toucherait
  un écran existant si on visait la fidélité.
- **Icônes des 6 bâtiments** du Bastion : Forge de Brasfer (enclume), Archives d'Ennor
  (livre), Tableau de Mira (parchemin), Chantre-Major Isolde (mandala/mains), Le beffroi
  du Grand Cairn (blason), L'Hôtel des ventes (balance). → vue « accueil » Bastion future.
- **Vignettes de terrain** (plaine, forêt, colline, marais, ruines, gué, autel) pour
  le panneau d'action de l'hex et les panneaux région.
- **Icônes d'objets / matériaux** (bois, minerai, herbe, potion, flèche, peau, pierre,
  pièces d'équipement) — aujourd'hui rendus en runes-lettres.
- **Icônes de compétences** (Traque, Tir précis, Double tir, Flèche de la lanterne).
- **Tuiles d'hex illustrées** (arbres, ruines, hameaux, rochers) — DESIGN §4 spécifie
  des polygones plats ; les tuiles illustrées seraient une évolution du parti pris.
- **Icônes rail Classements / Codex** — destinations hors périmètre.
- **Icônes de monnaie stylisées** (pièce or, cristal, aile, flamme) — DESIGN §6 impose
  les glyphes Unicode ; upgrade optionnel, pas un gap.
- **Polices auto-hébergées** — TODO prod déjà noté dans DESIGN §2.2 (rendu OK via
  Google Fonts aujourd'hui).

## Architecture technique

### Mixin partagé
`apps/web/src/app/game/_layout.scss` — expose le point de rupture unique :

```scss
@mixin wide { @media (min-width: 1024px) { @content; } }
```

`@use`'d par les fichiers `.scss` de composant qui en ont besoin. Centralise la
valeur 1024px (une seule source de vérité, pas de nombre magique dispersé).

### Shell — `game.scss` (le template `game.html` ne change pas)

En dessous de 1024px : layout actuel intact (flex-colonne, `.app` max 520px centré).

En wide, `.app` :
- `max-width: none`, plafonné à ~1680px et centré (évite l'étirement infini sur
  ultra-large) ;
- CSS grid :

```
grid-template-columns: 220px 1fr;
grid-template-rows: auto auto 1fr;
grid-template-areas:
  "status status"
  "nav    queue"
  "nav    main";
```

Placement des éléments existants via `grid-area` :
- `.statusbar` → `status` (pleine largeur en haut) ;
- `nav` → `nav` ;
- `.queuebar` → `queue` ;
- `main` → `main`.

Transformations CSS en wide :
- **`nav`** (barre basse → rail vertical) : `flex-direction: column`,
  `justify-content: flex-start`, bordure droite (`border-right`) au lieu du haut ;
  chaque bouton `flex-direction: row`, icône + label alignés à gauche, padding
  confortable ; état actif = texte `--g-ember-glow` + fond `--g-ember-bg` + accent
  gauche braise. `padding-bottom: env(safe-area-inset-bottom)` neutralisé en wide.
- **`.statusbar`** : s'étale ; jauges plus larges ; bourse poussée à droite. Le bouton
  chat reste. **Pas** de boutons notif/settings (hors périmètre, sans handler).
- **`.queuebar`, `main`, `.toast`** : inchangés structurellement.

### Reflow par écran (CSS grid en wide, mêmes templates/DOM)

- **`hero-screen.scss`** — sous-onglet *personnage* : `:host` devient grid 2 colonnes
  `[≈340px] [1fr]`. `subnav` et `herohead` en pleine largeur (`grid-column: 1/-1`),
  carte stats en col 1, carte équipement/inventaire en col 2. Sous-onglet *skills* :
  seul `app-skill-tree` (+ subnav) est présent → géré dans `skill-tree.scss`.
- **`skill-tree.scss`** — en wide : liste des compétences | panneau de détail côte à côte.
- **`map-screen.scss`** — en wide : grid `[1fr] [≈340px]` avec `grid-template-areas`
  `"head head" / "map panel"`. Grande carte SVG à gauche, `.panel` (action de l'hex)
  en colonne droite `position: sticky`.
- **`bastion-screen.scss`** — en wide : la liste de quêtes passe en grille multi-colonnes
  (2–3) ; largeur de contenu max centrée. Project/market centrés sur largeur max.
- **`project-panel.scss` / `market-panel.scss`** — grilles multi-colonnes / largeur max.
- **`character-creation.scss`** — largeur max centrée en wide (déjà proche).

### Overlays

- **`combat-overlay.scss`** — reste plein écran ; en wide, la carte modale plafonnée
  (~440px) et centrée (proche de la maquette FIGHT).
- **`chat-drawer.scss`** — reste un drawer *togglé* par le bouton chat ; en wide, docké
  à droite (max ~380px). Pas reconstruit en rail permanent.

## Mise à jour de la spec (obligatoire)

`docs/DESIGN.md` :
- **§7** dit « l'app est une colonne max 520px centrée sur desktop (assumé, genre
  Hordes) ». → Remplacer par une règle responsive : mobile/PWA-étroit = colonne 520
  centrée ; à partir de 1024px = dashboard pleine largeur (rail latéral, statusbar
  pleine largeur, écrans multi-colonnes, largeur de contenu plafonnée ~1680px).
- **§3** (Nav basse) : préciser qu'au-delà de 1024px la nav devient un **rail vertical
  à gauche** (mêmes destinations, même sémantique d'état actif).

## Vérification (définition de « terminé »)

1. `pnpm lint && pnpm build` passent.
2. Tests web passent — les specs ciblent des `data-testid`, insensibles au CSS ;
   aucune régression attendue.
3. Preview (`ng serve`) : captures à **1280px** (dashboard) et **375px** (mobile) sur
   Carte / Bastion / Héros (+ combat, chat) :
   - à 1280 : rail latéral visible, statusbar pleine largeur, écrans multi-colonnes ;
   - à 375 : rendu **identique** à l'actuel (aucune régression mobile) ;
   - `prefers-reduced-motion` respecté, zones tactiles ≥ 44px préservées.
4. Aucune chaîne française en dur ajoutée dans le code (aucun texte nouveau de toute façon).

## Hors périmètre (rappel)

Nouveaux panneaux des maquettes web (quêtes, région, chantiers, activité serveur,
journal mondial, inventaire rapide, grille 6 bâtiments), nouvelles destinations
(Classements, Codex), nouveaux assets illustrés, refonte des runes-lettres en icônes.
Chacun relève d'un jalon ultérieur avec sa propre boucle spec → plan.
