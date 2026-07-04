# CLAUDE.md — Les Braises d'Aldenfer

Jeu web multijoueur heroic-fantasy (style Hordes/Ogame) : exploration à timers, quêtes, raids communautaires. Monorepo pnpm. **Lis `docs/` avant toute implémentation** — les specs font autorité :

- `docs/GDD-braises-aldenfer.md` — game design complet (lore, systèmes, formules, contenu)
- `docs/DESIGN.md` — identité visuelle & système UI (source de vérité pour toute UI)
- `docs/ARCHITECTURE.md` — monorepo, stack, principes runtime
- `docs/API-SPEC.md` — contrat REST + WebSocket
- `docs/DATA-MODEL.md` — schéma Drizzle + seed
- `docs/GLOSSARY.md` — correspondance FR↔EN (à consulter pour TOUT nouveau nom)
- `docs/SPEC-M1.md` — jalon en cours
- `docs/maquette-braises-aldenfer.html` — maquette de référence (ouvrable dans un navigateur)

## Stack

- `apps/web` : Angular 22, standalone components, signals, `@if/@for`. Pas de NgModules, pas de NgRx.
- `apps/api` : Fastify 5 + fastify-type-provider-zod, better-auth, Drizzle ORM, PostgreSQL 16.
- `packages/shared` : schémas Zod (contrat API/WS), constantes de jeu, formules pures. `web → shared ← api`, jamais `web → api`.

## Commandes

```bash
pnpm install
docker compose up -d db        # Postgres 16 local
pnpm --filter api db:migrate   # drizzle-kit migrate
pnpm --filter api db:seed
pnpm dev                       # api (watch) + web (ng serve) en parallèle
pnpm test                      # vitest (api, shared) + tests web
pnpm lint && pnpm build
```

## Règles non négociables

1. **Le serveur fait autorité.** Le client envoie des intentions, jamais des résultats. Tout coût, aléa, validation = serveur. Ne JAMAIS faire confiance à une donnée client.
2. **Pas de tick par joueur.** Stamina = `(value, updatedAt)` recalculée via `computeStamina()` (shared). Actions = `endsAt` + résolution paresseuse à la lecture + worker 5 s. `resolveAction()` est idempotente (`UPDATE … WHERE resolved = false RETURNING`).
3. **Transactions** autour de toute écriture touchant monnaies, inventaire, marché, contributions.
4. **Zod partout** : chaque route valide entrée ET sortie avec les schémas de `shared`. Chaque JSONB a son schéma validé avant écriture.
5. **Code 100 % anglais** (identifiants, tables, commentaires). Les termes métier suivent `GLOSSARY.md` — ne jamais inventer une traduction, l'ajouter au glossaire d'abord. Toute chaîne visible par le joueur vit dans `packages/shared/src/content/fr/` (jamais en dur dans les composants ni en DB).
6. **UI** : dériver chaque composant de `DESIGN.md` (tokens CSS custom properties, composants canoniques). Couleur chaude = rare et signifiante. Zones tactiles ≥ 44px. `prefers-reduced-motion` respecté. Le français du jeu tutoie et parle avec la voix du lore.
7. **Les formules de jeu vivent dans `packages/shared/src/formulas/`** en fonctions pures testées (combat, XP, stamina, coûts). Jamais de formule dupliquée ou inline dans un service.
8. **Erreurs API** : enveloppe unique `{ error: { code, message, details? } }` — codes métier listés dans API-SPEC §2, `message` en français prêt à afficher.

## Style de travail

- Simplicité d'abord : pas d'abstraction spéculative, pas de feature hors jalon en cours. Si un système paraît nécessiter Redis/BullMQ/microservices : il ne le nécessite pas au MVP (50–200 joueurs, un process).
- Changements chirurgicaux : ne pas retoucher le code adjacent non concerné.
- Chaque tâche a un critère de vérification (test qui passe, commande qui répond). Écrire le test AVANT pour les formules et la résolution d'actions.
- En cas d'ambiguïté dans une spec : poser la question, ne pas supposer.
- Vérifier les versions exactes des dépendances au bootstrap (Angular 22 / Fastify 5 / better-auth : API susceptibles d'avoir évolué — consulter la doc installée, pas la mémoire).

## Définition de « terminé »

Une tâche est terminée quand : lint + build passent, les tests couvrent le chemin nominal et les cas d'erreur métier (codes 409), la route/le composant respecte la spec correspondante, et aucune chaîne française n'est en dur dans le code.
