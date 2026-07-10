# Web Responsive + Asset Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le web `apps/web` responsive (colonne mobile ≤1023px inchangée ; dashboard pleine largeur ≥1024px) et intégrer les assets fournis (bannière Bastion, héros full-body, icônes objets/compétences, vignettes de terrain, vue d'accueil Bastion à 6 bâtiments).

**Architecture :** CSS responsive pur — un seul arbre de composants, un point de rupture `@media (min-width:1024px)` centralisé dans un mixin SCSS partagé, la colonne mobile devient une grille CSS `sidebar | dashboard`. Les assets sont résolus par un utilitaire `id → chemin` avec alias et fallback rune/glyphe. La vue Bastion à 6 bâtiments réutilise les panneaux existants (quêtes/marché/chantier).

**Tech Stack :** Angular 22 (standalone components, signals, `@if/@for`), SCSS (styles de composant), Vitest/Karma pour les tests web, monorepo pnpm. Contenu FR dans `packages/shared/src/content/fr`.

## Global Constraints

- **Angular 22**, standalone components, signals, `@if/@for` — pas de NgModules, pas de NgRx.
- **CSS responsive pur** pour le layout : aucun signal `isDesktop`, aucun template dupliqué (décision de spec).
- **Point de rupture unique** : `@media (min-width: 1024px)` via le mixin `wide` de `apps/web/src/app/game/_layout.scss`. Ne jamais coder 1024px en dur ailleurs.
- **Mobile inchangé** : sous 1024px, le rendu de layout doit rester identique à l'actuel (colonne `max-width: 520px` centrée).
- **Tokens DESIGN.md** : couleurs via les custom properties `--g-*` (jamais de hex hors palette hors valeurs déjà présentes). Couleur chaude rare et signifiante.
- **Zones tactiles ≥ 44×44px** pour toute action ; **focus visible** `outline: 2px solid var(--g-ember-glow); offset: 2px`.
- **`prefers-reduced-motion: reduce`** coupe les animations décoratives (déjà en place — ne pas régresser).
- **Code 100 % anglais** (identifiants, commentaires). **Aucune chaîne FR en dur** : tout texte joueur vit dans `packages/shared/src/content/fr`. Nouveau nom métier ⇒ l'ajouter d'abord à `docs/GLOSSARY.md`.
- **Assets manquants ⇒ fallback** (rune-lettre / glyphe / aucun visuel) ; aucune 404 ne doit casser un écran.
- **Définition de « terminé »** : `pnpm lint && pnpm build` passent, tests web verts, écran conforme à la spec, aucune chaîne FR en dur.

**Répertoire de travail :** monorepo à la racine `/Volumes/macOS/Tech/playTo`. Commandes web : `pnpm --filter web <script>`.

**Vérification visuelle (toutes les tâches CSS)** : les tâches de reflow ne sont pas testables en unitaire. Leur cycle de test est : `pnpm --filter web build` (doit compiler) **puis** preview `ng serve` avec captures à **1280px** et **375px** de l'écran touché. Le critère est explicite dans chaque tâche.

---

## File Structure

**Créés :**
- `apps/web/src/app/game/_layout.scss` — mixin `wide` (point de rupture unique).
- `apps/web/src/app/core/asset-url.ts` — résolveur `id → /assets/...` + alias + fallback `null`.
- `apps/web/src/app/core/asset-url.spec.ts` — tests unitaires du résolveur.
- `packages/shared/src/content/fr/bastion.ts` — noms/descriptions des 6 bâtiments (FR).

**Modifiés :**
- `apps/web/src/app/game/game.scss` — shell : grille dashboard + rail latéral + statusbar large.
- `apps/web/src/app/game/hero/hero-screen.scss` + `.ts` + `.html` — reflow + héros full-body + icônes objets.
- `apps/web/src/app/game/hero/skill-tree.scss` + `.ts` + `.html` — reflow + icônes de compétences.
- `apps/web/src/app/game/map/map-screen.scss` + `.ts` + `.html` — reflow + vignette de terrain.
- `apps/web/src/app/game/bastion/bastion-screen.scss` + `.ts` + `.html` — reflow + bannière + vue 6 bâtiments.
- `apps/web/src/app/game/bastion/project-panel.scss`, `market-panel.scss` — reflow largeur max.
- `apps/web/src/app/game/character-creation.scss` — reflow largeur max.
- `apps/web/src/app/game/combat/combat-overlay.scss` — carte modale centrée plafonnée en wide.
- `apps/web/src/app/game/chat/chat-drawer.scss` — drawer docké à droite en wide.
- `packages/shared/src/content/fr/index.ts` — export du contenu bastion.
- `docs/DESIGN.md` — §3, §4, §7.
- `docs/GLOSSARY.md` — identifiants EN des 6 bâtiments.

---

# PHASE A — Responsive (CSS pur)

## Task A1 : Mixin partagé + shell dashboard (rail + statusbar)

**Files:**
- Create: `apps/web/src/app/game/_layout.scss`
- Modify: `apps/web/src/app/game/game.scss`

**Interfaces:**
- Produces: mixin SCSS `wide` — `@use '../layout' as layout;` puis `@include layout.wide { ... }`. (Le chemin `../layout` depuis un composant `game/<x>/<x>.scss` ; depuis `game/game.scss` c'est `./_layout` → `@use 'layout'`.)

- [ ] **Step 1 : Créer le mixin partagé**

Créer `apps/web/src/app/game/_layout.scss` :

```scss
// Single source of truth for the desktop breakpoint (spec: wide dashboard ≥ 1024px).
@mixin wide {
  @media (min-width: 1024px) {
    @content;
  }
}
```

- [ ] **Step 2 : Passer le shell en grille dashboard en wide**

Dans `apps/web/src/app/game/game.scss`, ajouter en tête (après d'éventuels `@use` existants ; il n'y en a pas aujourd'hui, donc en ligne 1) :

```scss
@use 'layout';
```

Puis ajouter à la fin du fichier le bloc responsive :

```scss
/* ── Desktop dashboard (≥ 1024px) ── */
@include layout.wide {
  .app {
    max-width: 1680px;
    height: 100dvh;
    display: grid;
    grid-template-columns: 220px 1fr;
    grid-template-rows: auto auto 1fr;
    grid-template-areas:
      "status status"
      "nav    queue"
      "nav    main";
  }

  .statusbar { grid-area: status; }
  .queuebar  { grid-area: queue; }
  main       { grid-area: main; }

  nav {
    grid-area: nav;
    flex-direction: column;
    justify-content: flex-start;
    gap: 4px;
    padding: 12px 10px;
    border-top: none;
    border-right: 1px solid var(--g-border);
    overflow-y: auto;

    button {
      flex: 0 0 auto;
      flex-direction: row;
      justify-content: flex-start;
      gap: 12px;
      min-height: 48px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.82rem;
      letter-spacing: 0.04em;

      svg { width: 20px; height: 20px; }

      &.on {
        background: var(--g-ember-bg);
        box-shadow: inset 3px 0 0 var(--g-ember);
      }
    }
  }

  /* La statusbar respire : jauges plus larges, bourse poussée à droite. */
  .statusbar .gauges { max-width: 420px; }
  .statusbar .purse { margin-left: auto; }
}
```

- [ ] **Step 3 : Vérifier la compilation**

Run : `pnpm --filter web build`
Expected : build OK (pas d'erreur SCSS `@use`/`@include`).

- [ ] **Step 4 : Vérifier visuellement (preview)**

Lancer `ng serve` (via l'outil preview), ouvrir l'app connectée avec un personnage.
- À **1280px** : rail vertical à gauche (Carte/Bastion/Héros/Raid, onglet actif surligné braise + accent gauche), statusbar pleine largeur en haut, contenu à droite. Largeur max ~1680px centrée sur écran très large.
- À **375px** : identique à l'actuel (colonne 520, nav en bas).
Expected : les deux rendus conformes ; aucune régression mobile.

- [ ] **Step 5 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/game/_layout.scss apps/web/src/app/game/game.scss
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): dashboard shell + side rail at >=1024px"
```

---

## Task A2 : Reflow Héros + arbre de compétences

**Files:**
- Modify: `apps/web/src/app/game/hero/hero-screen.scss`
- Modify: `apps/web/src/app/game/hero/skill-tree.scss`

**Interfaces:**
- Consumes: mixin `wide` (Task A1).

- [ ] **Step 1 : Reflow Héros (sous-onglet personnage) en 2 colonnes**

Dans `apps/web/src/app/game/hero/hero-screen.scss`, ajouter `@use 'layout';` en ligne 1, puis à la fin :

```scss
@include layout.wide {
  :host { padding: 24px; }

  /* Sous-onglet "personnage" : subnav + herohead pleine largeur, puis 2 colonnes. */
  :host:has(.herohead) {
    display: grid;
    grid-template-columns: minmax(300px, 360px) 1fr;
    grid-template-rows: auto auto auto 1fr;
    gap: 16px 20px;
    align-items: start;
    max-width: 1400px;
  }

  .subnav   { grid-column: 1 / -1; max-width: 420px; }
  .herohead { grid-column: 1 / -1; margin-bottom: 0; }
  .penalty  { grid-column: 1 / -1; margin-bottom: 0; }

  /* La carte stats (1re .card) en colonne gauche, l'équipement en colonne droite. */
  .card:nth-of-type(1) { grid-column: 1; margin-bottom: 0; }
  .card:nth-of-type(2) { grid-column: 2; grid-row: 3 / span 2; margin-bottom: 0; }
}
```

> Note : `:has()` distingue le sous-onglet personnage (présence de `.herohead`) du sous-onglet skills (seul `app-skill-tree` est rendu). Angular 22 cible des navigateurs qui supportent `:has()`.

- [ ] **Step 2 : Reflow arbre de compétences (liste | détail-tabs) en wide**

Dans `apps/web/src/app/game/hero/skill-tree.scss`, ajouter `@use 'layout';` en ligne 1, puis à la fin :

```scss
@include layout.wide {
  :host { display: block; padding: 24px 0; }
  .card { max-width: 900px; }
  .skillrow { padding: 12px 4px; }
  .branchtabs { max-width: 620px; }
}
```

- [ ] **Step 3 : Vérifier la compilation**

Run : `pnpm --filter web build`
Expected : build OK.

- [ ] **Step 4 : Vérifier visuellement**

Preview à **1280px**, onglet Héros :
- sous-onglet Personnage : portrait+stats à gauche, carte équipement/inventaire à droite ;
- sous-onglet Compétences : carte large, lignes aérées.
À **375px** : rendu identique à l'actuel (colonne).
Expected : conforme.

- [ ] **Step 5 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/game/hero/hero-screen.scss apps/web/src/app/game/hero/skill-tree.scss
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): hero + skill tree reflow on wide"
```

---

## Task A3 : Reflow Carte (grande carte + panneau d'action à droite)

**Files:**
- Modify: `apps/web/src/app/game/map/map-screen.scss`

**Interfaces:**
- Consumes: mixin `wide` (Task A1).

- [ ] **Step 1 : Grille carte / panneau en wide**

Dans `apps/web/src/app/game/map/map-screen.scss`, ajouter `@use 'layout';` en ligne 1, puis à la fin :

```scss
@include layout.wide {
  :host {
    display: grid;
    grid-template-columns: 1fr minmax(300px, 360px);
    grid-template-rows: auto 1fr;
    grid-template-areas:
      "head head"
      "map  panel";
    gap: 12px 24px;
    padding: 24px;
    align-items: start;
    height: 100%;
  }

  .eyebrow { grid-area: head; align-self: end; }
  h2 { grid-area: head; } /* h2 suit l'eyebrow ; les deux dans la même zone se placent en flux */

  .mapwrap {
    grid-area: map;
    max-height: calc(100dvh - 220px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
  .mapwrap svg { max-height: calc(100dvh - 220px); width: auto; }

  .panel {
    grid-area: panel;
    position: sticky;
    top: 24px;
    margin: 0;
  }
}
```

> Note : `eyebrow` et `h2` partagent la zone `head` — pour éviter le chevauchement, les envelopper reste inutile car ils sont déjà en flux vertical dans `:host`. Placer plutôt les deux hors grille : voir Step 2.

- [ ] **Step 2 : Corriger le placement du titre (wrapper de tête)**

Le template met `eyebrow` puis `h2` comme frères directs, ce qui, en grid, les met chacun en item. Pour un placement propre, les regrouper. Dans `apps/web/src/app/game/map/map-screen.html`, remplacer les lignes 1-2 :

```html
<span class="eyebrow">{{ regionName() }} · {{ t.mistLevelLabel }} {{ regionMist() }}</span>
<h2>{{ regionName() }}</h2>
```

par :

```html
<header class="maphead">
  <span class="eyebrow">{{ regionName() }} · {{ t.mistLevelLabel }} {{ regionMist() }}</span>
  <h2>{{ regionName() }}</h2>
</header>
```

Puis dans le SCSS du Step 1, remplacer les deux lignes `.eyebrow { grid-area: head; ... }` et `h2 { grid-area: head; }` par :

```scss
  .maphead { grid-area: head; }
```

Et vérifier que le style mobile du titre reste correct : ajouter (hors du bloc `wide`, dans le SCSS de base) rien n'est requis si `.eyebrow`/`h2` gardent leurs styles ; `.maphead` est un simple conteneur en flux.

- [ ] **Step 3 : Vérifier la compilation**

Run : `pnpm --filter web build`
Expected : build OK.

- [ ] **Step 4 : Vérifier visuellement**

Preview à **1280px**, onglet Carte : grande carte hexagonale à gauche, panneau d'action de l'hex sélectionné en colonne droite (sticky). Sélectionner un hex adjacent → le panneau montre coût/temps/bouton.
À **375px** : carte puis panneau en dessous (inchangé).
Expected : conforme.

- [ ] **Step 5 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/game/map/map-screen.scss apps/web/src/app/game/map/map-screen.html
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): map reflow with sticky action panel on wide"
```

---

## Task A4 : Reflow Bastion / project / market / character-creation (largeur max)

**Files:**
- Modify: `apps/web/src/app/game/bastion/bastion-screen.scss`
- Modify: `apps/web/src/app/game/bastion/project-panel.scss`
- Modify: `apps/web/src/app/game/bastion/market-panel.scss`
- Modify: `apps/web/src/app/game/character-creation.scss`

**Interfaces:**
- Consumes: mixin `wide` (Task A1).

- [ ] **Step 1 : Bastion — largeur max + quêtes en grille (le contenu 6 bâtiments arrive en Task C2)**

Dans `apps/web/src/app/game/bastion/bastion-screen.scss`, ajouter `@use 'layout';` en ligne 1, puis à la fin :

```scss
@include layout.wide {
  :host { padding: 24px; }
  .eyebrow, h2, .subnav, .card { max-width: 1100px; margin-left: auto; margin-right: auto; }
  .subnav { max-width: 520px; }
}
```

- [ ] **Step 2 : Project & Market — largeur max centrée**

Dans `apps/web/src/app/game/bastion/project-panel.scss`, ajouter `@use 'layout';` en ligne 1 et à la fin :

```scss
@include layout.wide {
  :host { display: block; max-width: 900px; margin: 0 auto; }
}
```

Faire de même dans `apps/web/src/app/game/bastion/market-panel.scss` :

```scss
@include layout.wide {
  :host { display: block; max-width: 900px; margin: 0 auto; }
}
```

> Vérifier d'abord que `:host` de ces deux composants n'a pas déjà un `display`/`max-width` qui entrerait en conflit ; si oui, adapter en conservant la valeur mobile hors du bloc `wide`.

- [ ] **Step 3 : Character-creation — largeur max centrée**

Dans `apps/web/src/app/game/character-creation.scss`, ajouter `@use 'layout';` en ligne 1 et à la fin :

```scss
@include layout.wide {
  :host { max-width: 720px; margin: 0 auto; }
}
```

> Adapter si `:host` définit déjà `display`/`padding` (conserver la valeur mobile hors `wide`).

- [ ] **Step 4 : Vérifier la compilation**

Run : `pnpm --filter web build`
Expected : build OK.

- [ ] **Step 5 : Vérifier visuellement**

Preview à **1280px** : Bastion (onglets quêtes/projet/marché) et l'écran de création de personnage sont centrés sur une largeur confortable, pas étirés bord à bord.
À **375px** : inchangé.
Expected : conforme.

- [ ] **Step 6 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/game/bastion/bastion-screen.scss apps/web/src/app/game/bastion/project-panel.scss apps/web/src/app/game/bastion/market-panel.scss apps/web/src/app/game/character-creation.scss
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): bastion/project/market/creation max-width on wide"
```

---

## Task A5 : Overlays — combat centré, chat docké à droite

**Files:**
- Modify: `apps/web/src/app/game/combat/combat-overlay.scss`
- Modify: `apps/web/src/app/game/chat/chat-drawer.scss`

**Interfaces:**
- Consumes: mixin `wide` (Task A1).

- [ ] **Step 1 : Combat — carte modale plafonnée et centrée en wide**

Dans `apps/web/src/app/game/combat/combat-overlay.scss`, ajouter `@use 'layout';` en ligne 1 et à la fin :

```scss
@include layout.wide {
  .overlay {
    align-items: center;
  }
  .overlay > * {
    width: 100%;
    max-width: 440px;
  }
  .foe { flex: 0 0 auto; padding-top: 24px; }
}
```

> Vérifier la structure de `combat-overlay.html` : si les enfants directs de `.overlay` ne sont pas les blocs attendus (`.foe`, `.clog`, `.actions`), ajuster le sélecteur `.overlay > *` en conséquence pour ne cibler que le contenu à plafonner.

- [ ] **Step 2 : Chat — docké à droite en wide**

Dans `apps/web/src/app/game/chat/chat-drawer.scss`, ajouter `@use 'layout';` en ligne 1 et à la fin :

```scss
@include layout.wide {
  :host {
    left: auto;
    right: 0;
    bottom: 0;
    top: 0;
    margin: 0;
    max-width: 380px;
    max-height: 100dvh;
    border-top: none;
    border-left: 1px solid var(--g-border);
    border-radius: 0;
    animation: slidein 0.25s ease;
  }

  @keyframes slidein {
    from { transform: translateX(100%); }
    to { transform: none; }
  }
}

@media (prefers-reduced-motion: reduce) {
  :host { animation: none; }
}
```

- [ ] **Step 3 : Vérifier la compilation**

Run : `pnpm --filter web build`
Expected : build OK.

- [ ] **Step 4 : Vérifier visuellement**

Preview à **1280px** :
- Déclencher un combat → overlay plein écran, carte de combat centrée et plafonnée (~440px), grille 2×2 des boutons intacte.
- Cliquer le bouton chat → drawer docké contre le bord droit, pleine hauteur.
À **375px** : combat plein écran classique, chat en drawer bas (inchangé).
Expected : conforme.

- [ ] **Step 5 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/game/combat/combat-overlay.scss apps/web/src/app/game/chat/chat-drawer.scss
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): combat centered + chat right-docked on wide"
```

---

## Task A6 : Mettre à jour DESIGN.md

**Files:**
- Modify: `docs/DESIGN.md` (§3, §4, §7)

- [ ] **Step 1 : §7 — remplacer la règle « colonne 520 sur desktop »**

Dans `docs/DESIGN.md` §7 (Plancher de qualité), remplacer la puce :

```
- Mobile-first, cible 360–520px ; l'app est une colonne max 520px centrée sur desktop (assumé, genre Hordes).
```

par :

```
- Mobile-first. Sous 1024px : colonne max 520px centrée (téléphone, PWA téléphone). À partir de 1024px : dashboard pleine largeur — rail de navigation vertical à gauche, barre de statut pleine largeur, écrans en grille multi-colonnes, contenu plafonné à ~1680px et centré. Point de rupture unique `@media (min-width:1024px)`.
```

- [ ] **Step 2 : §3 — nav basse → rail en wide + composant grille de bâtiments**

Dans le tableau des composants canoniques §3, à la ligne **Nav basse**, remplacer sa cellule « Règles clés » pour ajouter à la fin :

```
Au-delà de 1024px, la nav devient un rail vertical à gauche (mêmes destinations, mêmes états ; actif = texte braise + fond ember-bg + accent gauche).
```

Puis ajouter une ligne au tableau :

```
| **Grille de bâtiments** (accueil Bastion) | Cartes bâtiment : icône (buildings/*) ou fallback rune, nom Cinzel, description, bouton *Entrer* ou cadenas si verrouillé. 2 colonnes mobile, 3 en wide. |
```

- [ ] **Step 3 : §4 — noter la carte 3D différée**

À la fin de la §4 (La carte hexagonale), ajouter :

```
> La conversion en tuiles « 3D vue du dessus » est prévue dans une passe ultérieure (dépend de l'art des tuiles). Tant qu'elle n'est pas livrée, la carte reste en polygones plats décrits ci-dessus.
```

- [ ] **Step 4 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add docs/DESIGN.md
git -C /Volumes/macOS/Tech/playTo commit -m "docs(design): responsive dashboard rules + building grid + map 3d note"
```

---

# PHASE B — Intégration des assets

## Task B1 : Résolveur d'assets `id → chemin` (TDD)

**Files:**
- Create: `apps/web/src/app/core/asset-url.ts`
- Create: `apps/web/src/app/core/asset-url.spec.ts`

**Interfaces:**
- Produces:
  - `itemIconUrl(itemId: string): string | null` — `/assets/items/<cat>/<file>.png` ou `null`.
  - `skillIconUrl(skillId: string): string | null` — `/assets/skills/skill.<name>.png` ou `null`.
  - `terrainVignetteUrl(terrain: string): string | null` — `/assets/lands/<file>.png` ou `null`.
  - `heroFullUrl(klass: string): string | null` — `/assets/heroes/<file>_full.png` ou `null`.

- [ ] **Step 1 : Écrire les tests (échouants)**

Créer `apps/web/src/app/core/asset-url.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { heroFullUrl, itemIconUrl, skillIconUrl, terrainVignetteUrl } from './asset-url';

describe('asset-url', () => {
  it('maps a material id to its icon', () => {
    expect(itemIconUrl('material.shadewood')).toBe('/assets/items/materials/material.shadewood.png');
  });

  it('aliases blade weapons to the "lame" art files', () => {
    expect(itemIconUrl('weapon.blade.t1')).toBe('/assets/items/weapons/weapon.lame.t1.png');
  });

  it('aliases scout weapons to the "scoot" art files', () => {
    expect(itemIconUrl('weapon.scout.t1')).toBe('/assets/items/weapons/weapon.scoot.t1.png');
  });

  it('aliases the ash-potion typo file', () => {
    expect(itemIconUrl('consumable.ash-potion')).toBe('/assets/items/consumables/consumable.ash-potioni.png');
  });

  it('returns null for items without provided art (chain armour)', () => {
    expect(itemIconUrl('armor.chain.t1')).toBeNull();
  });

  it('maps the four provided scout hunt skills, null otherwise', () => {
    expect(skillIconUrl('scout.hunt.1')).toBe('/assets/skills/skill.precise-shot.png');
    expect(skillIconUrl('scout.hunt.3')).toBe('/assets/skills/skill.double-shot.png');
    expect(skillIconUrl('scout.hunt.5')).toBe('/assets/skills/skill.latern-arrow.png');
    expect(skillIconUrl('blade.steel.1')).toBeNull();
  });

  it('maps terrains including shrine->altar, null for ash_road', () => {
    expect(terrainVignetteUrl('plain')).toBe('/assets/lands/plain.png');
    expect(terrainVignetteUrl('shrine')).toBe('/assets/lands/altar.png');
    expect(terrainVignetteUrl('ash_road')).toBeNull();
  });

  it('maps hero full-body art including scout->scoot', () => {
    expect(heroFullUrl('blade')).toBe('/assets/heroes/blade_full.png');
    expect(heroFullUrl('scout')).toBe('/assets/heroes/scoot_full.png');
  });
});
```

- [ ] **Step 2 : Lancer les tests → échec**

Run : `pnpm --filter web test -- asset-url` (ou la commande de test web du repo, voir `apps/web/package.json`)
Expected : FAIL (`asset-url` introuvable).

- [ ] **Step 3 : Implémenter le résolveur**

Créer `apps/web/src/app/core/asset-url.ts` :

```ts
/**
 * Resolve game identifiers to bundled asset paths under /assets.
 * Returns null when no art was provided so callers can fall back to the
 * existing rune-letter / glyph rendering. Alias tables cover the naming
 * mismatches between game ids and delivered file names.
 */

// Item files that exist on disk (public/assets/items/<cat>/<file>.png).
const ITEM_FILES: ReadonlySet<string> = new Set([
  // weapons
  'weapon.arcanist.t1', 'weapon.arcanist.t2',
  'weapon.cantor.t1', 'weapon.cantor.t2', 'weapon.cantor.t3',
  'weapon.lame.t1', 'weapon.lame.t2', 'weapon.lame.t3', 'weapon.lame.t5',
  'weapon.scoot.t1', 'weapon.scoot.t2',
  // armors
  'armor.boots.t1', 'armor.boots.t2', 'armor.bracer.t1',
  'armor.helmet.t1', 'armor.helmet.t2', 'armor.helmet.t3', 'armor.helmet.t4',
  'armor.leather.t1', 'armor.leather.t2', 'armor.shield.t1', 'armor.shield.t2',
  // consumables
  'consumable.ash-potioni', 'consumable.dungeon-key', 'consumable.roast-chicken',
  // materials
  'material.ash-glass', 'material.cloth', 'material.coins', 'material.crystal-ore',
  'material.feather', 'material.lavenders', 'material.mist-essence', 'material.mistborn-hide',
  'material.moor-herbs', 'material.ore', 'material.parchment', 'material.reptile-hide',
  'material.shadewood', 'material.soot-ore', 'material.stone', 'material.wood',
]);

const ITEM_CATEGORY: Record<string, string> = {
  weapon: 'weapons',
  armor: 'armors',
  consumable: 'consumables',
  material: 'materials',
};

// Game id fragment -> delivered file fragment.
const ITEM_ALIASES: Record<string, string> = {
  'weapon.blade': 'weapon.lame',
  'weapon.scout': 'weapon.scoot',
  'consumable.ash-potion': 'consumable.ash-potioni',
};

export function itemIconUrl(itemId: string): string | null {
  const category = ITEM_CATEGORY[itemId.split('.')[0] ?? ''];
  if (!category) return null;
  let file = itemId;
  for (const [from, to] of Object.entries(ITEM_ALIASES)) {
    if (file === from || file.startsWith(`${from}.`)) {
      file = file.replace(from, to);
      break;
    }
  }
  return ITEM_FILES.has(file) ? `/assets/items/${category}/${file}.png` : null;
}

// Provided skill icons keyed by game skill id (only scout hunt branch shipped).
const SKILL_FILES: Record<string, string> = {
  'scout.hunt.1': 'skill.precise-shot',
  'scout.hunt.3': 'skill.double-shot',
  'scout.hunt.5': 'skill.latern-arrow',
  // skill.tracking.png reserved for the passive Traque line if wired later.
};

export function skillIconUrl(skillId: string): string | null {
  const file = SKILL_FILES[skillId];
  return file ? `/assets/skills/${file}.png` : null;
}

const TERRAIN_FILES: Record<string, string> = {
  plain: 'plain', forest: 'forest', hill: 'hill', marsh: 'marsh',
  ruins: 'ruins', ford: 'ford', shrine: 'altar',
  // ash_road: no vignette shipped.
};

export function terrainVignetteUrl(terrain: string): string | null {
  const file = TERRAIN_FILES[terrain];
  return file ? `/assets/lands/${file}.png` : null;
}

const HERO_FULL_FILES: Record<string, string> = {
  blade: 'blade_full', arcanist: 'arcanist_full', scout: 'scoot_full', cantor: 'cantor_full',
};

export function heroFullUrl(klass: string): string | null {
  const file = HERO_FULL_FILES[klass];
  return file ? `/assets/heroes/${file}.png` : null;
}
```

- [ ] **Step 4 : Lancer les tests → succès**

Run : `pnpm --filter web test -- asset-url`
Expected : PASS (tous les cas, y compris `null` pour chain/ash_road/blade.steel.1).

- [ ] **Step 5 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/core/asset-url.ts apps/web/src/app/core/asset-url.spec.ts
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): asset-url resolver with aliases and null fallback"
```

---

## Task B2 : Héros full-body dans l'écran Héros

**Files:**
- Modify: `apps/web/src/app/game/hero/hero-screen.ts`
- Modify: `apps/web/src/app/game/hero/hero-screen.html`
- Modify: `apps/web/src/app/game/hero/hero-screen.scss`

**Interfaces:**
- Consumes: `heroFullUrl` (Task B1).

- [ ] **Step 1 : Câbler le portrait full-body avec fallback**

Dans `apps/web/src/app/game/hero/hero-screen.ts` :
- Ajouter l'import : `import { heroFullUrl } from '../../core/asset-url';` (après les imports existants).
- Le `PORTRAITS` actuel (petits portraits) reste le fallback. Remplacer le computed `portrait` (lignes ~42-45) par :

```ts
  readonly portrait = computed(() => {
    const klass = this.store.character()?.class;
    if (!klass) return null;
    return heroFullUrl(klass) ?? PORTRAITS[klass] ?? null;
  });
```

- [ ] **Step 2 : Adapter la vignette pour l'art full-body en wide**

Dans `apps/web/src/app/game/hero/hero-screen.scss`, dans le bloc `@include layout.wide { ... }` créé en Task A2, ajouter le portrait full-body en grande colonne. Remplacer le contenu de `.herohead` en wide pour un portrait vertical :

```scss
  .herohead { grid-column: 1; flex-direction: column; align-items: flex-start; }
  .portrait { width: 100%; height: auto; aspect-ratio: 3 / 4; border-radius: 12px; }
  .portrait img { object-position: top center; }
```

Et retirer/adapter la règle `.card:nth-of-type(1) { grid-column: 1; }` en la plaçant sous le portrait (même colonne, ligne suivante) — le flux grid s'en charge puisque `.herohead` et `.card:nth-of-type(1)` sont tous deux en `grid-column: 1`.

> Mobile inchangé : `.portrait` reste 76×76px (hors du bloc `wide`).

- [ ] **Step 3 : Vérifier la compilation**

Run : `pnpm --filter web build`
Expected : build OK.

- [ ] **Step 4 : Vérifier visuellement**

Preview à **1280px**, Héros/Personnage : grand portrait full-body du héros (selon la classe) en colonne gauche.
À **375px** : petit portrait dans l'entête (le full-body s'affiche mais contraint à 76px — acceptable ; si trop rogné, garder le petit portrait en mobile via le fallback n'est pas nécessaire car l'image full est juste réduite).
Expected : conforme ; si l'art full-body manque pour une classe, le petit portrait s'affiche.

- [ ] **Step 5 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/game/hero/hero-screen.ts apps/web/src/app/game/hero/hero-screen.html apps/web/src/app/game/hero/hero-screen.scss
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): full-body hero art in hero screen"
```

---

## Task B3 : Icônes d'objets/matériaux dans l'inventaire

**Files:**
- Modify: `apps/web/src/app/game/hero/hero-screen.ts`
- Modify: `apps/web/src/app/game/hero/hero-screen.html`
- Modify: `apps/web/src/app/game/hero/hero-screen.scss`

**Interfaces:**
- Consumes: `itemIconUrl` (Task B1).

- [ ] **Step 1 : Exposer un helper d'icône**

Dans `apps/web/src/app/game/hero/hero-screen.ts` :
- Ajouter l'import : `import { itemIconUrl } from '../../core/asset-url';` (fusionner avec l'import de `heroFullUrl` de Task B2 : `import { heroFullUrl, itemIconUrl } from '../../core/asset-url';`).
- Ajouter une méthode dans la classe :

```ts
  itemIcon(itemId: string): string | null {
    return itemIconUrl(itemId);
  }
```

- [ ] **Step 2 : Afficher l'icône, fallback rune-lettre**

Dans `apps/web/src/app/game/hero/hero-screen.html`, remplacer le bloc `.rune` de l'inventaire (lignes ~68-70) :

```html
        <div class="rune" [class.equipped]="entry.equipped">
          {{ itemName(entry.itemId).charAt(0) }}
        </div>
```

par :

```html
        <div class="rune" [class.equipped]="entry.equipped">
          @if (itemIcon(entry.itemId); as icon) {
            <img [src]="icon" [alt]="itemName(entry.itemId)" (error)="$any($event.target).style.display='none'" />
          } @else {
            {{ itemName(entry.itemId).charAt(0) }}
          }
        </div>
```

- [ ] **Step 3 : Styler l'image dans la rune**

Dans `apps/web/src/app/game/hero/hero-screen.scss`, dans le sélecteur `.rune` existant, ajouter :

```scss
  img { width: 100%; height: 100%; object-fit: contain; display: block; border-radius: 6px; }
```

- [ ] **Step 4 : Vérifier la compilation**

Run : `pnpm --filter web build`
Expected : build OK.

- [ ] **Step 5 : Vérifier visuellement**

Preview (mobile 375 + wide 1280), Héros : les objets d'inventaire disposant d'un asset affichent leur icône ; ceux sans art (ex. mailles) gardent l'initiale. Aucune icône cassée.
Expected : conforme.

- [ ] **Step 6 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/game/hero/hero-screen.ts apps/web/src/app/game/hero/hero-screen.html apps/web/src/app/game/hero/hero-screen.scss
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): item/material icons in inventory with rune fallback"
```

---

## Task B4 : Icônes de compétences

**Files:**
- Modify: `apps/web/src/app/game/hero/skill-tree.ts`
- Modify: `apps/web/src/app/game/hero/skill-tree.html`
- Modify: `apps/web/src/app/game/hero/skill-tree.scss`

**Interfaces:**
- Consumes: `skillIconUrl` (Task B1).

- [ ] **Step 1 : Exposer un helper d'icône**

Dans `apps/web/src/app/game/hero/skill-tree.ts` :
- Ajouter l'import : `import { skillIconUrl } from '../../core/asset-url';`.
- Ajouter une méthode :

```ts
  skillIcon(skillId: string): string | null {
    return skillIconUrl(skillId);
  }
```

- [ ] **Step 2 : Afficher l'icône, fallback rune**

Dans `apps/web/src/app/game/hero/skill-tree.html`, remplacer la ligne 21 :

```html
      <div class="rune" [class.equipped]="row.equipped">{{ row.content.name.charAt(0) }}</div>
```

par :

```html
      <div class="rune" [class.equipped]="row.equipped">
        @if (skillIcon(row.skill.id); as icon) {
          <img [src]="icon" [alt]="row.content.name" (error)="$any($event.target).style.display='none'" />
        } @else {
          {{ row.content.name.charAt(0) }}
        }
      </div>
```

- [ ] **Step 3 : Styler l'image dans la rune**

Dans `apps/web/src/app/game/hero/skill-tree.scss`, dans le sélecteur `.rune`, ajouter :

```scss
  img { width: 100%; height: 100%; object-fit: contain; display: block; border-radius: 6px; }
```

- [ ] **Step 4 : Vérifier la compilation**

Run : `pnpm --filter web build`
Expected : build OK.

- [ ] **Step 5 : Vérifier visuellement**

Preview, Héros/Compétences, classe Éclaireur, branche Traque : Tir précis / Double tir / Flèche de la lanterne affichent leur icône ; les autres compétences gardent l'initiale.
Expected : conforme.

- [ ] **Step 6 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/game/hero/skill-tree.ts apps/web/src/app/game/hero/skill-tree.html apps/web/src/app/game/hero/skill-tree.scss
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): skill icons with rune fallback"
```

---

## Task B5 : Bannière du Bastion

**Files:**
- Modify: `apps/web/src/app/game/bastion/bastion-screen.html`
- Modify: `apps/web/src/app/game/bastion/bastion-screen.scss`

- [ ] **Step 1 : Insérer la bannière en tête**

Dans `apps/web/src/app/game/bastion/bastion-screen.html`, remplacer les lignes 1-2 :

```html
<span class="eyebrow">{{ regionName }} · dernier feu du royaume</span>
<h2>{{ regionName }}</h2>
```

par :

```html
<header class="banner">
  <img src="/assets/banners/cendrelune.png" alt="" (error)="$any($event.target).closest('.banner').classList.add('no-img')" />
  <div class="banner-text">
    <span class="eyebrow">{{ regionName }} · dernier feu du royaume</span>
    <h2>{{ regionName }}</h2>
  </div>
</header>
```

> `dernier feu du royaume` est déjà en dur dans le code existant — hors périmètre de correction ici (ne pas régresser, ne pas ajouter de nouvelle chaîne). Laisser tel quel.

- [ ] **Step 2 : Styler la bannière**

Dans `apps/web/src/app/game/bastion/bastion-screen.scss`, ajouter (avant le bloc `wide`) :

```scss
.banner {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 14px;
  border: 1px solid var(--g-border);

  img {
    width: 100%;
    height: 160px;
    object-fit: cover;
    display: block;
  }

  .banner-text {
    position: absolute;
    left: 16px;
    bottom: 10px;
    text-shadow: 0 2px 8px #000;
  }

  h2 { margin: 2px 0 0; }

  &.no-img {
    img { display: none; }
    .banner-text { position: static; padding: 12px 0; text-shadow: none; }
  }
}
```

Et dans le bloc `@include layout.wide` (Task A4), remplacer la ligne ciblant `.eyebrow, h2` par une qui inclut la bannière :

```scss
  .banner, .subnav, .card { max-width: 1100px; margin-left: auto; margin-right: auto; }
  .banner img { height: 220px; }
```

- [ ] **Step 3 : Vérifier la compilation**

Run : `pnpm --filter web build`
Expected : build OK.

- [ ] **Step 4 : Vérifier visuellement**

Preview (375 + 1280), Bastion : bannière Cendrelune en tête avec titre en surimpression lisible. Si l'image manque, le titre s'affiche en texte simple (classe `no-img`).
Expected : conforme.

- [ ] **Step 5 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/game/bastion/bastion-screen.html apps/web/src/app/game/bastion/bastion-screen.scss
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): cinderlune bastion banner"
```

---

## Task B6 : Vignette de terrain dans le panneau d'hex

**Files:**
- Modify: `apps/web/src/app/game/map/map-screen.ts`
- Modify: `apps/web/src/app/game/map/map-screen.html`
- Modify: `apps/web/src/app/game/map/map-screen.scss`

**Interfaces:**
- Consumes: `terrainVignetteUrl` (Task B1).

- [ ] **Step 1 : Exposer la vignette du terrain sélectionné**

Dans `apps/web/src/app/game/map/map-screen.ts` :
- Ajouter l'import : `import { terrainVignetteUrl } from '../../core/asset-url';`.
- Ajouter un computed (après `panel`) :

```ts
  readonly terrainVignette = computed(() => {
    const view = this.selectedView();
    return view?.hex.discovered ? terrainVignetteUrl(view.hex.terrain) : null;
  });
```

- [ ] **Step 2 : Afficher la vignette dans la carte panneau**

Dans `apps/web/src/app/game/map/map-screen.html`, dans `<div class="card panel">`, juste après `<h3>{{ panel().title }}</h3>` (ligne ~45), insérer :

```html
  @if (terrainVignette(); as vignette) {
    <img class="vignette" [src]="vignette" alt="" (error)="$any($event.target).style.display='none'" />
  }
```

- [ ] **Step 3 : Styler la vignette**

Dans `apps/web/src/app/game/map/map-screen.scss`, ajouter (hors bloc `wide`) :

```scss
.vignette {
  width: 100%;
  height: 110px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--g-border);
  margin: 8px 0;
  display: block;
}
```

- [ ] **Step 4 : Vérifier la compilation**

Run : `pnpm --filter web build`
Expected : build OK.

- [ ] **Step 5 : Vérifier visuellement**

Preview, Carte : sélectionner un hex découvert (plaine, forêt…) → sa vignette s'affiche dans le panneau. Hex `ash_road` ou brouillard → pas de vignette (pas de trou visuel).
Expected : conforme.

- [ ] **Step 6 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/game/map/map-screen.ts apps/web/src/app/game/map/map-screen.html apps/web/src/app/game/map/map-screen.scss
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): terrain vignette in hex action panel"
```

---

# PHASE C — Vue d'accueil Bastion à 6 bâtiments

## Task C1 : Contenu FR des bâtiments + GLOSSARY

**Files:**
- Modify: `docs/GLOSSARY.md`
- Create: `packages/shared/src/content/fr/bastion.ts`
- Modify: `packages/shared/src/content/fr/index.ts`

**Interfaces:**
- Produces: `BUILDINGS_FR: Record<BuildingId, { name: string; description: string }>` et `type BuildingId` exportés depuis `@aldenfer/shared/content/fr`.

- [ ] **Step 1 : Ajouter les identifiants EN au GLOSSARY**

Dans `docs/GLOSSARY.md`, ajouter une section « Bâtiments du Bastion » (près des NPC, §ligne ~104) :

```
### Bâtiments du Bastion

| FR                        | slug (EN)          | ouvre / note              |
| ------------------------- | ------------------ | ------------------------- |
| Forge de Brasfer          | `building.forge`   | chantier communautaire    |
| Archives d'Ennor          | `building.archives`| verrouillé (lore)         |
| Tableau de Mira           | `building.board`   | quêtes                    |
| Chantre-Major Isolde      | `building.sanctum` | verrouillé (bénédictions) |
| Le beffroi du Grand Cairn | `building.belfry`  | verrouillé (raids)        |
| L'Hôtel des ventes        | `building.market`  | marché                    |
```

- [ ] **Step 2 : Créer le contenu FR**

Créer `packages/shared/src/content/fr/bastion.ts` :

```ts
/** Bastion building display names & descriptions (GLOSSARY §Bâtiments du Bastion). */
export type BuildingId =
  | 'building.forge'
  | 'building.archives'
  | 'building.board'
  | 'building.sanctum'
  | 'building.belfry'
  | 'building.market';

export const BUILDINGS_FR: Record<BuildingId, { name: string; description: string }> = {
  'building.board': {
    name: 'Tableau de Mira',
    description: 'Consulte les quêtes et les missions en cours.',
  },
  'building.market': {
    name: 'L’Hôtel des ventes',
    description: 'Échange avec les autres Ravivés.',
  },
  'building.forge': {
    name: 'Forge de Brasfer',
    description: 'Livre tes matériaux au chantier commun.',
  },
  'building.archives': {
    name: 'Archives d’Ennor',
    description: 'Découvre l’histoire d’Aldenfer et les secrets de la Brume.',
  },
  'building.sanctum': {
    name: 'Chantre-Major Isolde',
    description: 'Reçois bénédictions et quêtes sacrées.',
  },
  'building.belfry': {
    name: 'Le beffroi du Grand Cairn',
    description: 'Prépare-toi aux raids et affronte les Gardiens.',
  },
};
```

- [ ] **Step 3 : Exporter depuis l'index de contenu**

Dans `packages/shared/src/content/fr/index.ts`, ajouter la ré-export (suivre le style des exports existants, ex. `export * from './items.js';`) :

```ts
export * from './bastion.js';
```

> Vérifier l'extension utilisée par les autres `export` du fichier (`.js` vs sans extension) et s'y conformer.

- [ ] **Step 4 : Vérifier le build shared**

Run : `pnpm --filter @aldenfer/shared build` (ou `pnpm --filter shared build` selon le nom exact du package — voir `packages/shared/package.json`)
Expected : build OK, `BUILDINGS_FR` et `BuildingId` exportés.

- [ ] **Step 5 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add docs/GLOSSARY.md packages/shared/src/content/fr/bastion.ts packages/shared/src/content/fr/index.ts
git -C /Volumes/macOS/Tech/playTo commit -m "feat(shared): bastion building content + glossary slugs"
```

---

## Task C2 : Vue d'accueil Bastion à 6 bâtiments

**Files:**
- Modify: `apps/web/src/app/game/bastion/bastion-screen.ts`
- Modify: `apps/web/src/app/game/bastion/bastion-screen.html`
- Modify: `apps/web/src/app/game/bastion/bastion-screen.scss`
- Modify: `apps/web/src/app/game/bastion/bastion-screen.spec.ts`

**Interfaces:**
- Consumes: `BUILDINGS_FR`, `BuildingId` (Task C1).

- [ ] **Step 1 : Écrire le test (échouant)**

Dans `apps/web/src/app/game/bastion/bastion-screen.spec.ts`, ajouter un test qui monte le composant et vérifie la vue d'accueil. Suivre le style des tests existants du fichier (même harnais de montage). Test à ajouter :

```ts
it('renders a home grid of 6 buildings and enters the board', async () => {
  // (réutiliser le setup du fichier : store avec un personnage + quêtes)
  const buildings = fixture.nativeElement.querySelectorAll('[data-testid^="building-"]');
  expect(buildings.length).toBe(6);

  // Entrer dans le Tableau de Mira ouvre les quêtes.
  fixture.nativeElement.querySelector('[data-testid="building-building.board"] button')!.click();
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-testid^="quest-"]')).toBeTruthy();

  // Un bâtiment verrouillé n'a pas de bouton d'entrée actif.
  const belfry = fixture.nativeElement.querySelector('[data-testid="building-building.belfry"]');
  expect(belfry.querySelector('.locked')).toBeTruthy();
});
```

> Adapter les noms de variables (`fixture`, setup du store) à ceux déjà présents dans `bastion-screen.spec.ts`.

- [ ] **Step 2 : Lancer le test → échec**

Run : `pnpm --filter web test -- bastion-screen`
Expected : FAIL (pas de `[data-testid^="building-"]`).

- [ ] **Step 3 : Étendre le composant**

Dans `apps/web/src/app/game/bastion/bastion-screen.ts` :
- Importer le contenu : ajouter `BUILDINGS_FR, type BuildingId` à l'import depuis `@aldenfer/shared/content/fr`.
- Élargir le type de vue et l'état :

```ts
type View = 'home' | 'quests' | 'project' | 'market';

interface BuildingVm {
  id: BuildingId;
  name: string;
  description: string;
  icon: string | null;        // /assets/buildings/<file>.png
  opens: View | null;         // null = verrouillé
  badge: number | null;       // pastille (quêtes actives) ou null
}
```

- Remplacer `readonly subTab = signal<SubTab>('quests');` par `readonly view = signal<View>('home');` (et supprimer l'ancien type `SubTab`).
- Ajouter la liste des bâtiments (icônes en dur car ce sont des chemins d'assets, pas des chaînes joueur) :

```ts
  private readonly buildingDefs: ReadonlyArray<{ id: BuildingId; icon: string | null; opens: View | null }> = [
    { id: 'building.board', icon: '/assets/buildings/parchment.png', opens: 'quests' },
    { id: 'building.market', icon: '/assets/buildings/balance.png', opens: 'market' },
    { id: 'building.forge', icon: '/assets/buildings/anvil.png', opens: 'project' },
    { id: 'building.archives', icon: null, opens: null }, // icône livre non fournie → fallback rune
    { id: 'building.sanctum', icon: '/assets/buildings/mandala.png', opens: null },
    { id: 'building.belfry', icon: '/assets/buildings/coat.png', opens: null },
  ];

  readonly buildings = computed<BuildingVm[]>(() => {
    const activeQuests = this.store.quests().filter((q) => q.state === 'active').length;
    return this.buildingDefs.map((def) => ({
      id: def.id,
      name: BUILDINGS_FR[def.id].name,
      description: BUILDINGS_FR[def.id].description,
      icon: def.icon,
      opens: def.opens,
      badge: def.id === 'building.board' && activeQuests > 0 ? activeQuests : null,
    }));
  });

  enter(building: BuildingVm): void {
    if (building.opens) this.view.set(building.opens);
  }
```

- [ ] **Step 4 : Réécrire le template**

Dans `apps/web/src/app/game/bastion/bastion-screen.html`, remplacer le bloc subnav + `@switch (subTab())` par une vue d'accueil + le contenu par bâtiment. Garder la bannière (Task B5) en tête. Structure :

```html
<!-- header banner (Task B5) reste inchangé -->

@switch (view()) {
  @case ('home') {
    <div class="buildings" data-testid="bastion-home">
      @for (b of buildings(); track b.id) {
        <div class="building" [class.locked]="!b.opens" [attr.data-testid]="'building-' + b.id">
          <div class="bicon">
            @if (b.icon) {
              <img [src]="b.icon" alt="" (error)="$any($event.target).style.display='none'" />
            } @else {
              {{ b.name.charAt(0) }}
            }
            @if (b.badge; as badge) { <span class="badge">{{ badge }}</span> }
          </div>
          <b>{{ b.name }}</b>
          <small>{{ b.description }}</small>
          @if (b.opens) {
            <button class="btn" (click)="enter(b)">{{ tCommon.enter }}</button>
          } @else {
            <span class="locked" aria-hidden="true">🔒</span>
          }
        </div>
      }
    </div>
  }
  @case ('quests') {
    <button class="back btn" (click)="view.set('home')">{{ tCommon.back }}</button>
    <!-- (coller ici le bloc <div class="card"> quêtes existant) -->
  }
  @case ('project') {
    <button class="back btn" (click)="view.set('home')">{{ tCommon.back }}</button>
    <app-project-panel />
  }
  @case ('market') {
    <button class="back btn" (click)="view.set('home')">{{ tCommon.back }}</button>
    <app-market-panel />
  }
}
```

Déplacer le bloc `<div class="card">…</div>` des quêtes (actuel `@default`) dans le `@case ('quests')`.

- [ ] **Step 5 : Ajouter les libellés Entrer/Retour (contenu FR)**

Vérifier dans `packages/shared/src/content/fr/ui.ts` s'il existe déjà des libellés « Entrer »/« Retour » (ex. sous `UI_FR.common`). Sinon, les ajouter dans la section commune de `ui.ts` :

```ts
  common: {
    enter: 'Entrer',
    back: '← Retour',
  },
```

Puis dans `bastion-screen.ts`, exposer `readonly tCommon = UI_FR.common;`.

> Si une section commune existe déjà avec d'autres clés, y ajouter `enter`/`back` sans casser l'existant.

- [ ] **Step 6 : Styler la grille de bâtiments**

Dans `apps/web/src/app/game/bastion/bastion-screen.scss`, ajouter (hors bloc `wide`) :

```scss
.buildings {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.building {
  background: var(--g-panel);
  border: 1px solid var(--g-border);
  border-radius: 10px;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;

  b { font-family: var(--g-font-display); color: var(--g-bone); font-size: 0.9rem; }
  small { color: var(--g-mist); font-size: 0.76rem; min-height: 2.4em; }

  &.locked { opacity: 0.6; }
}

.bicon {
  position: relative;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  font-family: var(--g-font-display);
  font-weight: 700;
  color: var(--g-ember-glow);

  img { width: 100%; height: 100%; object-fit: contain; }
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--g-ember);
  color: #1a0e02;
  font-size: 0.7rem;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.building .btn {
  width: 100%;
  min-height: 44px;
  margin-top: auto;
  border-radius: 8px;
  border: 1px solid var(--g-border);
  background: linear-gradient(180deg, #2a3b4c, #1d2a38);
  color: var(--g-bone);
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;

  &:active { transform: scale(0.97); }
  &:focus-visible { outline: 2px solid var(--g-ember-glow); outline-offset: 2px; }
}

.back {
  width: auto;
  padding: 8px 14px;
  margin-bottom: 12px;
  background: none;
  border: 1px solid var(--g-border);
  color: var(--g-mist);
  border-radius: 8px;
  cursor: pointer;
}
```

Et dans le bloc `@include layout.wide`, ajouter :

```scss
  .buildings { grid-template-columns: repeat(3, 1fr); max-width: 1100px; margin: 0 auto; }
```

- [ ] **Step 7 : Lancer le test → succès**

Run : `pnpm --filter web test -- bastion-screen`
Expected : PASS (6 bâtiments, Entrer sur Tableau ouvre les quêtes, Beffroi verrouillé).

- [ ] **Step 8 : Vérifier lint + build**

Run : `pnpm --filter web lint && pnpm --filter web build`
Expected : OK.

- [ ] **Step 9 : Vérifier visuellement**

Preview (375 : 2 colonnes ; 1280 : 3 colonnes), Bastion :
- accueil = 6 cartes bâtiment (icônes ou initiale de fallback pour Archives), pastille sur Tableau si quêtes actives, cadenas sur Archives/Chantre/Beffroi ;
- Entrer sur Tableau → quêtes + bouton Retour ; idem Forge → chantier, Hôtel → marché.
Expected : conforme à la maquette Bastion.

- [ ] **Step 10 : Commit**

```bash
git -C /Volumes/macOS/Tech/playTo add apps/web/src/app/game/bastion/ packages/shared/src/content/fr/ui.ts
git -C /Volumes/macOS/Tech/playTo commit -m "feat(web): bastion 6-building home view"
```

---

# Vérification finale (après toutes les tâches)

- [ ] **Lint + build monorepo**

Run : `pnpm lint && pnpm build`
Expected : OK sur tous les packages.

- [ ] **Tests**

Run : `pnpm test`
Expected : verts (api, shared, web) — dont `asset-url` et `bastion-screen`.

- [ ] **Revue visuelle croisée**

Preview `ng serve`, captures à **1280px** et **375px** de : Carte, Bastion (accueil + un bâtiment), Héros (personnage + compétences), combat, chat. Confirmer :
- ≥1024px : rail latéral, statusbar pleine largeur, écrans multi-colonnes, assets intégrés ;
- ≤1023px : layout identique à l'origine + nouveaux assets ;
- `prefers-reduced-motion` : activer et confirmer que les animations décoratives sont coupées ;
- aucune icône/image cassée (fallbacks propres).

---

## Notes d'exécution

- **Ordre :** A1 d'abord (le mixin est consommé partout). Puis A2–A6 en parallèle possible (fichiers disjoints). B1 avant B2–B6. C1 avant C2.
- **Écart assumé (validé en spec) :** Forge de Brasfer ouvre le chantier communautaire (contenu existant) ; Archives/Chantre/Beffroi restent verrouillés faute de contenu.
- **Hors périmètre :** carte 3D top-down (passe dédiée, attend l'art des tuiles), panneaux web additionnels (rail quêtes, activité serveur, journal…), destinations Classements/Codex.
