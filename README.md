# Les Braises d'Aldenfer

Jeu web multijoueur heroic-fantasy (exploration à timers, quêtes, raids communautaires). Monorepo pnpm.

- `apps/api` — Fastify 5 + Drizzle ORM + PostgreSQL 16 (API REST + WebSocket)
- `apps/web` — Angular 22 (standalone, signals)
- `packages/shared` — schémas Zod, constantes de jeu, formules pures (contrat API/WS)

La documentation fait autorité — voir `docs/` (`GDD`, `DESIGN`, `ARCHITECTURE`, `API-SPEC`, `DATA-MODEL`, `GLOSSARY`, specs de jalon) et `CLAUDE.md`.

## Prérequis

- **Node 24** (via [nvm](https://github.com/nvm-sh/nvm) : `nvm install 24 && nvm use 24`)
- **pnpm 11** (via corepack, livré avec Node) :
  ```bash
  corepack enable
  corepack prepare pnpm@11.10.0 --activate
  ```
- **Docker** (pour PostgreSQL en local)

## Démarrage

```bash
# 1. Installer les dépendances (tout le monorepo)
pnpm install

# 2. Créer le fichier d'environnement de l'API (non versionné)
cp apps/api/.env.example apps/api/.env

# 3. Lancer PostgreSQL 16 en local (Docker)
docker compose up -d db

# 4. Appliquer les migrations puis semer les données de jeu
pnpm --filter api db:migrate
pnpm --filter api db:seed

# 5. Lancer l'API (watch) + le front (ng serve) en parallèle
pnpm dev
```

- API : http://localhost:3000
- Front : http://localhost:4200

> L'API lit `apps/api/.env` (gitignoré). Le `DATABASE_URL` par défaut y pointe vers le conteneur Docker ci-dessus — aucune config supplémentaire pour un dev local.

### Lancer les services séparément

```bash
pnpm --filter api dev    # API seule (Fastify, watch) — port 3000
pnpm --filter web start  # Front seul (ng serve)       — port 4200
```

## Base de données

```bash
docker compose up -d db          # démarrer Postgres
docker compose down              # arrêter (les données persistent dans le volume dbdata)
pnpm --filter api db:generate    # générer une migration depuis le schéma Drizzle
pnpm --filter api db:migrate     # appliquer les migrations
pnpm --filter api db:seed        # (ré)injecter régions, hexes, objets, quêtes…
```

## Autres commandes

```bash
pnpm test    # tests (vitest : api, shared, web)
pnpm lint    # typecheck / lint de tous les paquets
pnpm build   # build de production de tous les paquets
```
