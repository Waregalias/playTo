# ARCHITECTURE.md — Les Braises d'Aldenfer

## 1. Vue d'ensemble

```
                    ┌──────────────────────────────┐
                    │  apps/web — Angular 22 (PWA) │
                    │  SPA · SVG hexmap · signals  │
                    └──────┬───────────────┬───────┘
                     HTTPS │REST           │ WSS (événements)
                    ┌──────▼───────────────▼───────┐
                    │  apps/api — Fastify 5        │
                    │  Zod · better-auth · @fastify/websocket
                    └──────┬───────────────┬───────┘
                           │ Drizzle       │
                    ┌──────▼──────┐  ┌─────▼─────────────┐
                    │ PostgreSQL  │  │ Resolver worker    │
                    │             │◄─┤ (actions échues,   │
                    └─────────────┘  │  fenêtres de raid) │
                                     └───────────────────┘
```

## 2. Monorepo (pnpm workspaces)

```
braises-aldenfer/
├── pnpm-workspace.yaml
├── package.json                 # scripts racine (dev, build, test, lint)
├── CLAUDE.md                    # instructions agent
├── docs/                        # GDD, DESIGN, specs (ce pack)
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── server.ts        # bootstrap Fastify
│   │   │   ├── plugins/         # auth, db, websocket, rate-limit
│   │   │   ├── modules/         # 1 dossier = 1 domaine
│   │   │   │   ├── characters/  #   routes.ts, service.ts, service.test.ts
│   │   │   │   ├── map/
│   │   │   │   ├── actions/     # file d'actions + résolution
│   │   │   │   ├── combat/
│   │   │   │   ├── quests/
│   │   │   │   ├── projects/
│   │   │   │   ├── raids/
│   │   │   │   ├── market/
│   │   │   │   └── chat/
│   │   │   ├── worker/          # resolver.ts (boucle de résolution)
│   │   │   └── db/              # schema.ts, migrations/, seed/
│   │   └── drizzle.config.ts
│   └── web/
│       ├── src/app/
│       │   ├── core/            # ApiClient, WsClient, stores (signals), guards
│       │   ├── shared/          # ui/ (gauge, card, button, toast…), pipes
│       │   └── features/
│       │       ├── map/         # hexmap SVG, hex-panel
│       │       ├── bastion/
│       │       ├── hero/
│       │       ├── raid/
│       │       ├── combat/      # overlay
│       │       └── auth/
│       └── public/              # manifest, icônes PWA
└── packages/
    └── shared/                  # AUCUNE dépendance runtime lourde
        └── src/
            ├── schemas/         # Zod : intentions API + payloads WS (source de vérité)
            ├── types/           # types dérivés (z.infer)
            ├── constants/       # coûts d'actions, terrains, courbe XP
            └── formulas/        # combat, stamina — fonctions pures partagées
```

Règle de dépendance : `web → shared ← api`. Jamais `web → api`. `shared` est le contrat : tout ce que le client envoie ou reçoit y est décrit en Zod ; l'API valide avec, le front type avec (`z.infer`).

## 3. Stack (versions à figer au bootstrap)

| Couche | Choix | Notes |
|---|---|---|
| Front | Angular 22, standalone components, signals, nouvelle syntaxe de contrôle de flux (`@if/@for`) | Pas de NgModules. Zoneless si stable dans la version installée — vérifier au bootstrap. |
| State | Signals + services injectables (`CharacterStore`, `MapStore`, `RaidStore`) | Pas de NgRx : inutile à cette échelle. |
| PWA | `@angular/pwa` (service worker) + Web Push | Notifications « expédition arrivée », « le Gardien riposte ». |
| API | Fastify 5, `fastify-type-provider-zod` | Validation systématique entrée/sortie. |
| Auth | better-auth (sessions cookie httpOnly) | Plugin Fastify ; le front ne voit jamais de token. |
| DB | PostgreSQL 16, Drizzle ORM + drizzle-kit | Migrations versionnées, seed idempotent. |
| Temps réel | `@fastify/websocket` | Un seul process au MVP (voir §6). |
| Jobs | Worker in-process (`setInterval` 5 s) au MVP | Extractible vers BullMQ + Redis si besoin — ne pas l'introduire avant. |
| Tests | Vitest (api + shared), Angular testing (web) | Les formules et la résolution d'actions sont testées en priorité. |
| Qualité | ESLint + Prettier config racine | |

## 4. Principes runtime (non négociables)

1. **Le serveur fait autorité.** Le client n'envoie que des *intentions* (`POST /actions`, `POST /combat/:id/turn`…). Le serveur valide : coûts, adjacence, prérequis, fenêtres temporelles. Toute donnée affichée vient du serveur.
2. **Aucun tick par joueur.** L'endurance est stockée `(valeur, updatedAt)` et recalculée à la lecture (`computeStamina()` dans `shared/formulas`). Les actions ont `startsAt/endsAt`.
3. **Résolution paresseuse + worker.** Toute lecture de l'état d'un personnage résout d'abord ses actions échues (dans une transaction). Le worker balaie en plus `action_queue WHERE resolved = false AND ends_at <= now()` toutes les 5 s pour les joueurs hors-ligne (notifications push, effets de monde). Les deux chemins passent par la même fonction `resolveAction()` — idempotente, protégée par `UPDATE … WHERE resolved = false RETURNING` (verrou optimiste).
4. **Le hasard est serveur.** Tout aléa (dégâts, butin, fuite) est tiré côté serveur et journalisé dans les logs de combat (rejouables).
5. **Transactions autour de tout ce qui touche aux monnaies/inventaire.** Jamais de double écriture sans transaction.

## 5. Flux type : déplacement

```
1. web  → POST /api/v1/actions        { type:"move", targetHexId }
2. api  : resolveDueActions(char) → valide (adjacence, stamina, file < 3)
          → débite stamina → INSERT action_queue (endsAt = now + durée)
          ← 201 { action } ; le front affiche le compte à rebours (endsAt)
3. à échéance : resolver (ou prochaine lecture) → resolveAction()
          → position mise à jour, découvertes insérées
          → WS `character:{id}` : { type:"action.resolved", ... }
          → si hors-ligne : push notification
```

## 6. WebSocket

Canaux : `global` (bandeaux serveur, paliers de raid), `region:{id}` (chat + événements de région), `company:{id}`, `character:{id}` (résolutions personnelles). Abonnement à la connexion selon l'état du personnage ; ré-abonnement au changement de région.

MVP mono-process : la diffusion est un simple registre en mémoire. Si multi-process un jour → adaptateur Redis pub/sub, mais **pas avant d'en avoir besoin** (50–200 joueurs tiennent largement sur un process).

## 7. Environnements & déploiement

- `.env` par app, validé par Zod au boot (`env.ts`) : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `WEB_ORIGIN`, `PUSH_VAPID_*`.
- Dev local : `docker compose up db` (Postgres 16) puis `pnpm dev` (api + web en parallèle).
- Production (aligné sur l'existant) : EC2, PM2 (`api` en fork ×1), Nginx en reverse proxy (`/` → web statique, `/api` + `/ws` → Fastify), certbot. Migrations Drizzle exécutées au déploiement, jamais au boot.
- Sauvegarde DB quotidienne (pg_dump) — c'est un jeu persistant, la base EST le jeu.

## 8. Sécurité & anti-triche

- Rate-limit par route (`@fastify/rate-limit`) : écritures 20/min, chat 10/min, assaut de raid contrôlé en plus par la règle métier (1/4 h).
- Validation Zod sur 100 % des entrées ; erreurs au format unique (voir API-SPEC §2).
- CORS restreint à `WEB_ORIGIN` ; cookies `httpOnly, secure, sameSite=lax`.
- Contraintes d'intégrité en base (CHECK stamina ≥ 0, qty > 0, unicité position de file) : la DB est le dernier rempart.
- fail2ban + headers Nginx standards (déjà en place chez toi).
