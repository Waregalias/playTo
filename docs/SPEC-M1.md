# SPEC-M1.md — Jalon 1 « Marcher »

Objectif : un joueur crée un compte et un personnage, voit la carte des Landes de Vellebrune, se déplace d'hexagone en hexagone avec coûts d'endurance et timers réels, découvre la carte, se repose aux autels — sur mobile. **Aucun combat, aucune quête, aucun contenu communautaire dans ce jalon.**

Critère de sortie global : 5 testeurs traversent les Landes depuis leur téléphone sans assistance.

## Périmètre

### Inclus

- Bootstrap monorepo complet (pnpm workspaces, lint/format/test/CI locale).
- Auth better-auth (email + mot de passe), création de personnage (nom + classe), écran de connexion/création.
- Schéma DB : `regions`, `hexes`, `characters`, `discoveries`, `action_queue` + migrations + seed régions 0–1.
- `shared` : constantes (terrains, coûts, multiplicateurs de Brume), formules `computeStamina()`, `moveCost()`, schémas Zod des routes M1.
- API : `POST/GET characters`, `GET map/regions`, `GET map/regions/:id/hexes`, `GET/POST/DELETE actions` (types `move` et `rest` uniquement), résolution paresseuse + worker.
- Web : shell applicatif (barre de statut, barre de file, nav basse conforme DESIGN.md), écran Carte complet (hexmap SVG, sélection, panneau d'action, brouillard), écrans Bastion/Héros/Raid en placeholder « à venir ».
- PWA de base : manifest + service worker (installable ; le push attendra M5).

### Exclu (ne pas implémenter, même « tant qu'on y est »)

Combat, POI/fouille, inventaire, quêtes, chat/WS (le front peut poller `GET /actions` toutes les 30 s en M1), monnaies (affichées à 0), compétences.

## User stories & critères d'acceptation

**US1 — Créer son Ravivé.**
Étant nouveau, je m'inscris, je choisis un nom (3–24 chars, unique) et une classe, et j'apparais à la Salle des Cendres (hex de spawn, région 0).

- ✓ `POST /characters` refuse un 2ᵉ personnage (`409`), un nom pris (`409`), un nom invalide (`400`).
- ✓ Les stats de départ correspondent au GDD §4 selon la classe.

**US2 — Voir le monde à ma mesure.**
Je ne vois que les hexagones découverts + leurs adjacents en silhouette ; le spawn et ses adjacents sont découverts d'office.

- ✓ `GET /map/regions/:id/hexes` n'expose ni terrain ni POI des hexes non découverts.
- ✓ La carte SVG affiche brouillard animé (brume dérivante) et hexes découverts selon DESIGN §4 ; `prefers-reduced-motion` coupe la dérive.

**US3 — Me déplacer avec un coût.**
Je sélectionne un hex adjacent, je vois coût (⚡) et durée (⏳) — multiplicateur de Brume inclus — je confirme, mon endurance est débitée, un timer démarre.

- ✓ `POST /actions {move}` : `409 NOT_ADJACENT` si non adjacent (en tenant compte de la file : l'adjacence s'évalue depuis la destination de la dernière action en file), `409 INSUFFICIENT_STAMINA`, `409 QUEUE_FULL` au-delà de 3, `409 HEX_LOCKED` vers une région verrouillée.
- ✓ Coûts exacts : table GDD §3.1 × multiplicateur de Brume (×1/1.25/1.5/2) — testés unitairement dans `shared`.
- ✓ À échéance : position mise à jour, hex + adjacents découverts, `result` rempli.

**US4 — Empiler jusqu'à 3 actions.**
Je programme un itinéraire de 3 cases ; je peux annuler une action non commencée (remboursement stamina).

- ✓ `DELETE /actions/:id` : `204` + remboursement si `position > 0` ; `409` si l'action est en cours (position 0 et `startsAt` passé).

**US5 — Reprendre des forces.**
Sur un hex `shrine`, je lance `rest` (30 min → +75 stamina, cap 100). Ma stamina se régénère aussi passivement (1/6 min, ×2 en région 0).

- ✓ `computeStamina()` testée : régén passive, cap, multiplicateurs bastion/shrine.
- ✓ Le front affiche l'endurance recalculée localement entre deux réponses serveur (même formule de `shared` — mais la valeur serveur écrase toujours).

**US6 — Jouer au pouce.**
Toute l'expérience M1 fonctionne sur un écran 360px, installable en PWA.

- ✓ Zones tactiles ≥ 44px, `100dvh`, safe-area sur la nav.
- ✓ Fermer/rouvrir l'app en plein timer restaure l'état exact (le timer d'affichage se recale sur `endsAt`).

## Ordre d'implémentation (avec vérifications)

```
1. Bootstrap monorepo + docker compose db + CI locale (lint/test/build)
   → verify: pnpm dev lance api (GET /health = 200) + web (page blanche Angular)
2. shared : constantes + computeStamina/moveCost + schémas Zod M1
   → verify: vitest — cas nominaux + bornes (cap 100, brume ×2, terrain ford)
3. db : schema M1 + migrations + seed régions 0–1 (hexes déclaratifs)
   → verify: db:migrate + db:seed idempotents ; SELECT count(hexes) = 52
4. api : better-auth + POST/GET characters
   → verify: tests d'intégration (signup → create → me) + les 3 cas 409/400 de US1
5. api : map (hexes filtrés par découvertes)
   → verify: test — un perso frais ne voit que spawn + adjacents
6. api : actions move/rest + résolution paresseuse + worker + annulation
   → verify: tests avec horloge simulée (vi.useFakeTimers + injection de `now`)
     couvrant US3/US4/US5 ; double résolution impossible (idempotence)
7. web : shell (statut, file, nav) + auth + création de perso
   → verify: parcours manuel mobile (devtools 360px)
8. web : écran carte (SVG, sélection, panneau, brouillard) branché sur l'API
   → verify: US2/US3/US6 en manuel + le timer survit à un refresh
9. PWA manifest + service worker
   → verify: installable (Lighthouse PWA pass)
```

## Décisions déjà tranchées (ne pas rouvrir)

- Polling 30 s en M1, WebSocket en M3.
- Pas de librairie de rendu (PixiJS/Kaplay) : SVG pur, généré depuis les données de `GET hexes`, math hexagonale (axial, pointy-top, rayon 22) reprise de la maquette.
- L'injection du temps (`now()`) est un paramètre des services — jamais `new Date()` inline — pour la testabilité des timers.
- Un seul personnage par compte au MVP.

## Questions ouvertes (à trancher avec Etude 2 avant M2)

1. Régén d'endurance : 1/6 min donne ~2–3 vraies sessions/jour. Trop généreux ? Trop punitif ? → mesurer avec les 5 testeurs M1.
2. Faut-il un déplacement « multi-hex » en une intention (le serveur décompose en file) pour le confort mobile ? (UX meilleure, code un peu plus complexe.)
3. Nom de domaine / hébergement cible pour la bêta fermée.
