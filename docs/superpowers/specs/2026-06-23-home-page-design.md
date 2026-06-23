# Home Page — Design Spec

**Date :** 2026-06-23
**Projet :** Cozy Kingdom (playTo)
**Scope :** Home page + modale de connexion par jeton

---

## Contexte

Application web Angular 22 pour un jeu de type "cozy town builder" médiéval. La home page est la vitrine publique du jeu : elle présente l'univers, incite à rejoindre, et donne accès au compte via un jeton de connexion.

---

## Structure des fichiers

```
src/
  app/
    home/
      home.ts
      home.html
      home.scss
      login-modal/
        login-modal.ts
        login-modal.html
    game/
      game.ts
      game.html
    app.routes.ts
    app.ts
  styles.scss
```

---

## Routing

| Chemin | Composant | Chargement |
|---|---|---|
| `/` | `HomeComponent` | eager |
| `/game` | `GameComponent` | lazy (`loadComponent`) |

---

## Composants

### HomeComponent

Composant standalone, page principale. Contient :

- **Hero section** : image placeholder plein-écran (rapport ~16:9), logo "Cozy Kingdom" centré avec sous-titre "Create, Relax, and Thrive", bouton "Sign up".
- **Features section** : 3 colonnes (`@for` sur un tableau de données), chargées en `@defer` (below the fold). Chaque item : titre en small caps, image circulaire placeholder, séparateur, texte descriptif.
- **Quote section** : citation centrée en italique grand format, attribution en dessous.

Signals utilisés :
- `isModalOpen = signal(false)` — contrôle l'affichage de la modale

Données des features (tableau readonly) :
```ts
{
  title: string;
  description: string;
  imagePlaceholder: string; // couleur de fond ou URL future
}
```

### LoginModalComponent

Composant standalone, enfant de `HomeComponent`. Affiché via `@if (isModalOpen())`.

- Overlay plein-écran sombre semi-transparent (backdrop), cliquable pour fermer.
- Carte centrée aux bords arrondis, thème parchemin.
- Champ `input[type=text]` lié à un signal `token = signal('')`.
- Bouton de soumission "Entrer dans le royaume" : actif uniquement si `token()` non vide → appelle `Router.navigate(['/game'])`.
- Bouton fermeture (×) en coin haut-droit.

Inputs/Outputs :
- `@input isOpen: InputSignal<boolean>`
- `@output closed: OutputEmitterRef<void>`

### GameComponent

Placeholder minimal. Affiche un titre "Bienvenue dans le royaume" avec un lien retour vers `/`.

---

## Thème visuel

### Typographies (Google Fonts)

| Font | Usage |
|---|---|
| Cinzel | Titres, logo, small caps de section |
| Lora | Corps de texte, citations |

Importées dans `styles.scss` via `@import` Google Fonts.

### Palette Tailwind (extension dans `tailwind.config.js`)

| Token | Valeur | Usage |
|---|---|---|
| `parchment` | `#f5f0e8` | Fond principal, carte modale |
| `parchment-dark` | `#ede7d9` | Séparateurs, hover léger |
| `burgundy` | `#6b2d5e` | Boutons, accents |
| `burgundy-dark` | `#501f47` | Hover bouton |
| `gold` | `#c9a84c` | Séparateurs décoratifs, icônes |
| `stone` | `#9c8fa0` | Textes secondaires |

### Tailwind

Intégré via `ng add @angular/tailwind` (ou équivalent). Directives `@tailwind base/components/utilities` dans `styles.scss`.

---

## Angular 22 — features utilisées

| Feature | Où |
|---|---|
| `signal()` | `isModalOpen`, `token`, données features |
| `@if` | Affichage conditionnel de la modale |
| `@for` | Rendu des cartes de features |
| `@defer` | Chargement différé de la section features |
| Standalone components | Tous les composants |
| `loadComponent` | Lazy loading de GameComponent |
| `Router.navigate()` | Navigation post-soumission token |
| `input()` / `output()` | Communication HomeComponent ↔ LoginModalComponent |

---

## Comportement de la modale

1. Clic sur "Sign up" → `isModalOpen.set(true)`
2. Clic backdrop ou bouton × → `isModalOpen.set(false)`, `token.set('')`
3. Saisie token + clic "Entrer dans le royaume" → `Router.navigate(['/game'])` (validation : token non vide)
4. Pas de vérification côté serveur pour l'instant — la logique réelle sera branchée ultérieurement

---

## Contraintes

- Aucun commentaire mentionnant "claude" ou "ai" dans les fichiers.
- Pas d'images réelles — utiliser des placeholders colorés (`bg-*`) pour l'instant.
- Aucune librairie UI externe hormis Tailwind CSS.
