# DESIGN.md — Les Braises d'Aldenfer

Identité visuelle et système d'interface. Ce document fait autorité : toute UI produite doit en dériver. La maquette de référence est `maquette-braises-aldenfer.html`.

---

## 1. Concept directeur

**La braise contre la brume.** Toute l'identité repose sur ce conflit : un monde froid, bleu-gris, désaturé (la Brume) percé par des points chauds orange-or (les Braises, la flammèche du joueur, les actions positives). Règle absolue : **la couleur chaude est rare et signifiante**. Elle marque ce qui est vivant, actionnable ou précieux — jamais décorative.

Corollaires pratiques :

- Les CTA primaires, jauges d'endurance, monnaie rare, marqueur joueur, lueurs = gamme braise.
- Les fonds, panneaux, textes secondaires, ennemis, zones verrouillées = gamme nuit/brume.
- Le danger (PV, boss) est un rouge éteint, jamais saturé — le monde est mourant, pas criard.

## 2. Tokens

### 2.1 Couleurs (CSS custom properties, source de vérité)

```css
:root {
  /* Gamme nuit (fonds) */
  --color-night: #0c1219; /* fond app */
  --color-abyss: #060a0f; /* fond hors-app, overlays */
  --color-panel: #17212c; /* cartes, panneaux */
  --color-panel-2: #1e2a38; /* éléments imbriqués */
  --color-border: #2c3b4b; /* tous les liserés */

  /* Gamme brume (contenus froids) */
  --color-mist: #7e93a6; /* texte secondaire, icônes inactives */
  --color-bone: #e9dfc9; /* texte principal (os/parchemin) */

  /* Gamme braise (rare, signifiante) */
  --color-ember: #e07a28; /* accent principal, CTA */
  --color-ember-glow: #ffc46b; /* highlights, valeurs, focus */
  --color-ember-deep: #b85f13; /* dégradés de CTA */
  --color-ember-bg: #241c11; /* fonds d'éléments "braise" (onglet actif, rune) */

  /* Sémantiques */
  --color-danger: #c05248; /* PV, boss, échec — rouge éteint */
  --color-success: #7fa98c; /* validation — vert-de-gris */
}
```

Interdits : blanc pur `#FFF` (sauf texte sur jauge avec text-shadow), noir pur, toute couleur saturée hors gamme, dégradés multicolores.

### 2.2 Typographie

| Rôle    | Police                          | Usage                                                                                                                                                          |
| ------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display | **Cinzel** (500/700)            | Titres d'écran, noms propres (Gardiens, régions), runes de compétences, initiales d'avatars. Avec retenue : jamais en corps de texte. `letter-spacing: .04em`. |
| Corps   | **Alegreya Sans** (400/500/700) | Tout le reste. Italique pour les citations de PNJ.                                                                                                             |
| Eyebrow | Alegreya Sans 400               | `.68rem`, `letter-spacing: .22em`, uppercase, `--color-mist`. Contexte au-dessus des titres (« Région 1 · Brume niveau 2 »).                                   |

Échelle : 16px base · titres d'écran 1.25rem · titres de carte .92rem · corps .85–.9rem · métadonnées .72–.8rem. Chiffres de jauges/timers : `font-variant-numeric: tabular-nums`.

Chargement : Google Fonts avec `display=swap`, fallbacks `serif` / `system-ui, sans-serif`. Auto-héberger les fontes en production (perf + RGPD).

### 2.3 Espacements, formes, élévation

- Grille d'espacement : 4px (gaps usuels 6/8/10/12/14).
- Rayons : panneaux 10px, boutons/inputs 8px, runes/faces PNJ 8px, jauges = hauteur/2, portrait joueur 12px.
- Pas d'ombres portées de « profondeur matérielle ». L'élévation s'exprime par les liserés (`--color-border`) et de rares lueurs (`box-shadow` orange translucide sur CTA primaire et éléments braise).

## 3. Composants canoniques

Tous existent dans la maquette ; les répliquer, pas les réinventer.

| Composant                                 | Règles clés                                                                                                                                                                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Barre de statut** (persistante, haut)   | Avatar cerclé de braise, jauges PV (danger) + endurance (braise), bourse 3 monnaies alignée à droite. Toujours visible : c'est le tableau de bord du joueur.                                                                                       |
| **Barre de file d'actions** (sous statut) | Une ligne : point pulsant braise + libellé + compte à rebours en `--color-ember-glow`. État vide : « Aucune action en cours — la flammèche attend. »                                                                                               |
| **Carte (card)**                          | `--color-panel`, liseré, rayon 10, padding 12–14px. Titre .92rem + contenu.                                                                                                                                                                        |
| **Bouton**                                | Secondaire : dégradé panel, liseré. Primaire : dégradé braise, texte quasi-noir `#1A0E02`, lueur orange. Coût d'action toujours affiché dans le libellé : « Lancer un assaut (⚡25) ». `disabled` = opacité .45. `transform: scale(.97)` au press. |
| **Jauges**                                | Fond `#0A1016` + liseré, remplissage en dégradé de la gamme sémantique, label centré avec text-shadow. Transition `width .5–.6s ease`.                                                                                                             |
| **Nav basse** (4 onglets)                 | Carte · Bastion · Héros · Raid. Icônes SVG trait 1.7, actif = `--color-ember-glow` + drop-shadow. `padding-bottom: env(safe-area-inset-bottom)`.                                                                                                   |
| **Toast**                                 | Pilule `--color-ember-bg` + liseré braise, bas d'écran au-dessus de la nav, 2.4s. Une seule à la fois.                                                                                                                                             |
| **Rangée PNJ / compétence**               | Face ou rune 38–44px à gauche (initiale Cinzel), nom + description, action ou coût à droite. Séparateur 1px `#202D3B`. Compétence acquise : rune fond `--color-ember-bg` liseré braise ; verrouillée : gamme froide.                               |
| **Overlay combat**                        | Plein écran au-dessus de tout. Ennemi centré, jauges au-dessus/en dessous, log 88px scrollable, **grille 2×2 de gros boutons** (min 44px de haut, sous-libellé d'info). Aucune contrainte de temps.                                                |

## 4. La carte hexagonale (élément signature)

- SVG, hexagones **pointe en haut**, coordonnées axiales `(q, r)`, rayon 22 unités de viewBox.
- Couleurs de terrain (fill) : plain `#8E9C6B` · forest `#4F6B4A` · hill `#8A7B5C` · marsh `#5E6E63` · ruins `#6E6A72` · ash_road `#3D4854` · shrine `#B0885A`. Contour `#0A1119` 1.5px. Sélection : contour `--color-ember-glow` 2.5px.
- **Brouillard** : hexagones non découverts en `#26313D` + deux ellipses de brume (`#7E93A6` / `#5A6B7A`) animées en translation lente alternée (14s et 22s). Une Braise non atteinte perce la brume : cercle orange pulsant (2.4s).
- Marqueur joueur : disque `--color-ember-glow` cerclé sombre + anneau pulsant. POI : glyphe ✦, shrine : ⌂.
- Interaction : tap = sélection → panneau d'action sous la carte (jamais de popup sur la carte elle-même). `touch-action: manipulation`.

## 5. Mouvement

Peu, et signifiant : pulsations de braise (2.4s ease-in-out), dérive de brume (14–22s linear alternate), transitions de jauges (.5–.6s), fade-in d'écran (.25s), recul d'ennemi touché (.14s). **`prefers-reduced-motion: reduce` coupe toutes les animations décoratives** (brume, pulsations) et conserve les transitions de jauges.

## 6. Voix & rédaction (UI en français)

- **Tutoiement**, présent de l'indicatif, phrases courtes. Le jeu parle au joueur comme un compagnon de route, pas comme un système.
- Les messages système empruntent au lore sans jargonner : « Ta flammèche est trop faible — repose-toi. » plutôt que « Endurance insuffisante ».
- Les boutons disent l'action exacte et son coût : « Se mettre en route », « Fouiller (⚡10) », « Livrer 25 bois d'ombre (⚡5) ».
- Erreurs : cause + remède, jamais d'excuses, jamais vagues.
- Glyphes de monnaies/ressources : ◉ écus · ✦ fragments · ⚑ gloire · ⚡ endurance · ⏳ temps.
- Le code est en anglais ; **toute chaîne visible vit dans la couche contenu/i18n française** (voir GLOSSARY.md).

## 7. Plancher de qualité

- Mobile-first, cible 360–520px ; l'app est une colonne max 520px centrée sur desktop (assumé, genre Hordes).
- Zones tactiles ≥ 44×44px pour toute action de jeu.
- Focus visible : `outline: 2px solid var(--color-ember-glow); offset: 2px`.
- Contrastes : bone sur night ≈ 12:1 ; mist sur panel ≥ 4.5:1 pour tout texte informatif (la brume décorative peut descendre en dessous).
- `100dvh`, `env(safe-area-inset-bottom)` sur nav et overlay combat.
- L'état de jeu survit à la fermeture (combat compris) : aucune interaction ne dépend d'une animation ou d'un temps de réaction.
