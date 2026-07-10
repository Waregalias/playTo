# Design — Web responsive + intégration des assets maquette

Date : 2026-07-10
Statut : validé (brainstorming), prêt pour plan d'implémentation.

## Objectif

Deux volets liés :

1. **Responsive.** L'app est aujourd'hui mobile-first : colonne `max-width: 520px`
   centrée sur tout écran. On veut que **depuis un navigateur large / PWA desktop,
   l'interface exploite la largeur** (rail latéral + statusbar pleine largeur +
   écrans en dashboard multi-colonnes), tout en **gardant l'expérience mobile
   actuelle inchangée** (téléphone, PWA téléphone).
2. **Fidélité maquette.** Le joueur a fourni les assets manquants ; on les intègre
   pour rapprocher l'UI des maquettes (bannière Bastion, héros full-body, icônes
   objets/matériaux/compétences, vignettes de terrain, vue d'accueil Bastion à
   6 bâtiments).

## Décisions cadrées (brainstorming)

1. **Détection = largeur de viewport.** Point de rupture unique
   `@media (min-width: 1024px)` (« wide »). Pas de `display-mode`. Téléphone étroit
   → mobile ; desktop large → dashboard, PWA comprise.
2. **Implémentation responsive = CSS pur.** Un seul arbre de composants, aucun
   template dupliqué, aucun signal `isDesktop`. Media query + CSS grid.
3. **Deux paliers** (mobile / wide). Pas de palier tablette : sous 1024px, la
   colonne ~520px centrée est conservée telle quelle.
4. **Carte 3D différée.** La conversion de la carte hexagonale en tuiles « 3D vue
   du dessus » se fera dans une **passe dédiée**, quand l'esthétique des tuiles
   sera fournie. Ce lot rend seulement la carte actuelle (hex plats, DESIGN §4)
   responsive.
5. **Vue Bastion à 6 bâtiments** construite (voir Phase C).

## Assets fournis (`apps/web/public/assets`)

- `banners/cendrelune.png` — bannière de tête du Bastion.
- `heroes/{blade,arcanist,scout,cantor}.png` (portraits) + `*_full.png` (full-body ;
  **`scoot_full.png` = typo pour scout** → alias).
- `buildings/{anvil,parchment,mandala,coat,balance}.png` + `full-builds.png`
  (planche). **Icône Archives d'Ennor (livre) manquante** → fallback provisoire.
- `lands/{plain,forest,hill,marsh,ruins,ford,altar}.png` (+ `lands.png` planche).
  `shrine`→`altar` ; **`ash_road` sans vignette** → fallback.
- `items/{weapons,armors,consumables,materials}/*.png` — nommage quasi aligné sur
  les IDs de jeu, avec exceptions à aliaser : `blade`↔`lame`, `scout`↔`scoot`,
  `consumable.ash-potion`↔`ash-potioni` (typo) ; **`armor.chain.t1` sans art** →
  fallback. Les 6 matériaux du jeu ont tous leur icône.
- `skills/{skill.tracking,skill.precise-shot,skill.double-shot,skill.latern-arrow}.png`
  — **seulement 4 icônes** (branche Traque de l'Éclaireur). Les 56 autres
  compétences gardent la rune-lettre.

### Résolveur d'assets
Un utilitaire front (`apps/web/src/app/core/asset-url.ts`) mappe un identifiant de
jeu (itemId, skillId, terrain, classe) vers un chemin `/assets/...`, applique la
table d'alias ci-dessus, et **renvoie `null` quand l'art manque** pour que le
composant retombe sur le rendu rune-lettre / glyphe existant. Aucun asset manquant
ne casse un écran.

## Architecture technique

### Mixin partagé
`apps/web/src/app/game/_layout.scss` — point de rupture unique :

```scss
@mixin wide { @media (min-width: 1024px) { @content; } }
```

`@use`'d par les `.scss` de composant concernés (une seule source pour 1024px).

### Phase A — Responsive (CSS pur, templates inchangés sauf mention)

**Shell — `game.scss`** (le DOM de `game.html` ne change pas). Sous 1024px : intact.
En wide, `.app` : `max-width: none`, plafonné ~1680px centré ; CSS grid :

```
grid-template-columns: 220px 1fr;
grid-template-rows: auto auto 1fr;
grid-template-areas:
  "status status"
  "nav    queue"
  "nav    main";
```

`grid-area` : `.statusbar`→status, `nav`→nav, `.queuebar`→queue, `main`→main.
- **`nav`** barre basse → rail vertical : `flex-direction: column`, bordure droite,
  boutons `flex-direction: row` (icône + label alignés à gauche), actif = texte
  `--g-ember-glow` + fond `--g-ember-bg` + accent gauche braise. `safe-area` neutralisé.
- **`.statusbar`** s'étale, jauges plus larges, bourse à droite. Bouton chat conservé ;
  pas de notif/settings (sans handler).
- `.queuebar`, `main`, `.toast` inchangés structurellement.

**Reflow par écran** (CSS grid en wide, mêmes templates) :
- `hero-screen.scss` — sous-onglet *personnage* : grid 2 colonnes `[≈360px] [1fr]`
  (portrait+stats | équipement/inventaire) ; `subnav`/`herohead` pleine largeur.
- `skill-tree.scss` — liste des compétences | panneau de détail côte à côte.
- `map-screen.scss` — grid `"head head" / "map panel"` : grande carte à gauche,
  `.panel` (action d'hex) en colonne droite `position: sticky`.
- `bastion-screen.scss` — contenu centré sur largeur max ; listes en grille multi-colonnes.
- `project-panel.scss` / `market-panel.scss` / `character-creation.scss` — grilles /
  largeur max centrée.

**Overlays** :
- `combat-overlay.scss` — reste plein écran ; en wide, carte modale plafonnée
  (~440px) et centrée.
- `chat-drawer.scss` — reste un drawer togglé ; en wide, docké à droite (~380px).

### Phase B — Intégration d'assets dans les écrans existants

- **Bannière Bastion** : `banners/cendrelune.png` en tête de `bastion-screen`
  (mobile + wide).
- **Héros full-body** : `hero-screen` affiche `heroes/{class}_full.png` (alias
  scout→scoot) dans la colonne portrait ; fallback sur le portrait actuel si absent.
- **Icônes objets/matériaux** : `hero-screen` inventaire — la rune-lettre devient
  l'icône `items/.../{id}.png` via le résolveur, fallback rune si `null`.
- **Icônes de compétences** : `skill-tree` — icône `skills/skill.*.png` via résolveur
  (4 dispo), fallback rune.
- **Vignette de terrain** : `map-screen` panneau d'hex — miniature `lands/{terrain}.png`
  (shrine→altar), fallback aucun visuel si absent.
- L'avatar de la statusbar reste l'initiale (DESIGN §3) — inchangé.

### Phase C — Vue d'accueil Bastion à 6 bâtiments (nouvelle vue)

Nouvelle **vue d'accueil** de `bastion-screen` remplaçant la `subnav` actuelle par
une grille de 6 cartes bâtiment (icône + nom + description + bouton *Entrer* ou
cadenas), suivie de la bannière en tête. Entrer dans un bâtiment affiche le panneau
correspondant avec un retour vers l'accueil. Reflow : 3 colonnes en wide, 2 sur
mobile (comme la maquette).

**Routage (existant réutilisé ; hypothèse à valider en revue) :**
| Bâtiment | Icône | État | Ouvre |
|---|---|---|---|
| Tableau de Mira | parchment | actif (badge = nb quêtes) | quêtes |
| L'Hôtel des ventes | balance | actif | marché |
| Forge de Brasfer | anvil | actif | chantier communautaire (`project`) |
| Archives d'Ennor | *(manquante → fallback)* | verrouillé | — (lore, pas de contenu) |
| Chantre-Major Isolde | mandala | verrouillé | — (bénédictions, pas de contenu) |
| Le beffroi du Grand Cairn | coat | verrouillé | — (raids, pas de contenu) |

> Écart assumé vs maquette : la Forge ouvre le chantier communautaire (contenu
> existant) au lieu du craft (inexistant) ; Archives/Chantre restent verrouillés
> faute de contenu. À corriger en revue de spec si le routage souhaité diffère.

**Contenu & nommage (règles CLAUDE.md 5) :** les noms/descriptions de bâtiments sont
des chaînes joueur → nouvelle entrée dans `packages/shared/src/content/fr/`
(p.ex. `bastion.ts`), **jamais** en dur dans le composant. Chaque bâtiment a un
identifiant EN à ajouter à `docs/GLOSSARY.md` avant usage (NPC déjà présents :
`npc.mira/brasfer/ennor/isolde`).

## Mise à jour de la spec DESIGN.md (obligatoire)

- **§7** : remplacer « colonne max 520px centrée sur desktop » par la règle
  responsive (mobile/PWA-étroit = colonne 520 ; ≥1024px = dashboard pleine largeur,
  rail latéral, statusbar pleine largeur, contenu plafonné ~1680px).
- **§3** (Nav basse) : préciser rail vertical au-delà de 1024px.
- **§3** : ajouter la ligne « Grille de bâtiments (accueil Bastion) » aux composants
  canoniques ; noter que runes-lettres / glyphes restent le fallback quand l'asset
  manque.
- **§4** : noter que la carte 3D top-down est prévue dans une passe ultérieure
  (l'actuel reste polygones plats).

## Vérification (définition de « terminé »)

1. `pnpm lint && pnpm build` passent.
2. Tests web passent (specs sur `data-testid`, insensibles au CSS). Ajouter un test :
   la vue d'accueil Bastion rend 6 bâtiments et *Entrer* sur Tableau ouvre les quêtes.
3. Preview (`ng serve`) — captures à **1280px** et **375px** sur Carte / Bastion
   (accueil + un bâtiment) / Héros (+ combat, chat) :
   - 1280 : rail latéral, statusbar pleine largeur, écrans multi-colonnes ;
   - 375 : rendu identique à l'actuel côté layout, plus les nouveaux assets ;
   - `prefers-reduced-motion` respecté, zones ≥ 44px préservées.
4. Assets manquants → fallback propre (rune/glyphe), aucun écran cassé, aucune 404
   bloquante.
5. Aucune chaîne française en dur ajoutée (noms de bâtiments dans la couche contenu).

## Hors périmètre

- **Carte 3D top-down** (passe dédiée, dépend de l'art des tuiles).
- Panneaux des maquettes web encore sans données : rail Quêtes latéral, Progression
  région, Chantiers communautaires sur carte/héros, Activité serveur, Journal mondial,
  inventaire rapide.
- Destinations Classements / Codex (rail).
- Contenu des bâtiments verrouillés (craft/forge, lore Archives, bénédictions Chantre,
  raids Beffroi).
