# API-SPEC.md — Contrat REST & WebSocket

Base : `/api/v1`. Auth : session better-auth (cookie httpOnly) sur toutes les routes sauf `/auth/*` et `/health`. Tous les schémas d'entrée/sortie vivent dans `packages/shared/src/schemas` (Zod) — ce document décrit les formes, le code Zod fait foi.

## 1. Conventions

- JSON uniquement. Dates en ISO 8601 UTC. Identifiants : UUID (entités), slugs (contenu statique : quêtes, objets, compétences).
- Le serveur renvoie toujours l'état **recalculé** (stamina à jour, actions échues résolues) — le client ne calcule jamais un état, seulement des comptes à rebours d'affichage à partir de `endsAt`.
- Pagination : `?cursor=<id>&limit=<n≤50>` → `{ items, nextCursor }`.

## 2. Enveloppe d'erreur (unique)

```json
{
  "error": {
    "code": "INSUFFICIENT_STAMINA",
    "message": "Ta flammèche est trop faible — repose-toi.",
    "details": { "required": 25, "current": 12 }
  }
}
```

Codes HTTP : 400 validation (`VALIDATION_ERROR` + issues Zod), 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 règle métier violée, 429 `RATE_LIMITED`.

Codes métier (409) : `INSUFFICIENT_STAMINA`, `QUEUE_FULL`, `NOT_ADJACENT`, `HEX_LOCKED`, `POI_ALREADY_SEARCHED`, `ASSAULT_COOLDOWN`, `RAID_CLOSED`, `INSUFFICIENT_FUNDS`, `INVENTORY_FULL`, `REQUIREMENT_NOT_MET`, `DEATH_PENALTY_ACTIVE`, `COMBAT_ALREADY_ACTIVE`.

`message` est la chaîne française prête à afficher (voix du jeu, cf. DESIGN §6) ; `code` sert à la logique client.

## 3. Endpoints

### Auth (délégué à better-auth, monté sur `/api/auth/*`)

Sign-up/sign-in email+password au MVP. Le front utilise le client better-auth.

### Characters

| Méthode | Route                            | Corps → Réponse                                                                       |
| ------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| POST    | `/characters`                    | `{ name, class }` → `201 Character` (1 seul par compte, stats de départ selon classe) |
| GET     | `/characters/me`                 | → `Character` (stamina recalculée, actions résolues, `activeCombatId?`)               |
| POST    | `/characters/me/attributes`      | `{ str?, dex?, wil?, vit?, fer? }` (somme ≤ points dispo) → `Character`               |
| POST    | `/characters/me/skills`          | `{ skillId }` → `Character` (valide points + fragments + tier précédent)              |
| PUT     | `/characters/me/skills/equipped` | `{ slot1?, slot2? }` → `Character`                                                    |

`Character` : `{ id, name, class, level, xp, xpNext, attributes:{str,dex,wil,vit,fer}, attributePoints, skillPoints, hp, hpMax, stamina, staminaMax, deathPenaltyUntil?, hexId, regionId, currencies:{ashCrowns,emberFragments,gloryMarks}, skills:[{skillId,equippedSlot?}] }`

### Map

| Méthode | Route                    | Réponse                                                                                                                                                                                                         |
| ------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/map/regions`           | Régions : `{ id, slug, name, unlocked, mistLevel, emberLit }[]`                                                                                                                                                 |
| GET     | `/map/regions/:id/hexes` | Hexes **découverts par le perso** + adjacents (silhouette) : `{ id, q, r, terrain?, mistLevel?, poi?:{type,searchedToday}, discovered }[]` — les non découverts n'exposent que `{ id, q, r, discovered:false }` |
| POST    | `/map/share-survey`      | Verse les relevés aux Archives → `{ ashCrownsEarned }`                                                                                                                                                          |

### Actions (file)

| Méthode | Route          | Corps → Réponse                                                                                                           |
| ------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/actions`     | → `{ items: Action[] }` (file courante, max 3)                                                                            |
| POST    | `/actions`     | `{ type:"move", targetHexId }` \| `{ type:"search" }` \| `{ type:"rest" }` \| `{ type:"craft", recipeId }` → `201 Action` |
| DELETE  | `/actions/:id` | Annule si non commencée (position > 0) → `204` ; stamina remboursée                                                       |

`Action` : `{ id, type, payload, position, startsAt, endsAt, resolved }`. Les coûts (stamina, durée) viennent de `shared/constants` et sont appliqués serveur avec les multiplicateurs de Brume et de compétences.

### Combat

Le combat est une ressource persistée (on peut fermer l'app en plein tour).

| Méthode | Route              | Corps → Réponse                                                                                                                                                                             |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST    | `/combat`          | `{ source:"encounter" }` (déclenché par résolution de move/search côté serveur → en pratique créé par le serveur ; cette route sert au re-engage volontaire sur un hex) → `201 CombatState` |
| GET     | `/combat/current`  | → `CombatState \| null`                                                                                                                                                                     |
| POST    | `/combat/:id/turn` | `{ action:"attack" \| "skill" \| "item" \| "flee", skillId?, itemId? }` → `CombatState` (inclut la riposte)                                                                                 |

`CombatState` : `{ id, foe:{slug,name,hp,hpMax}, playerHp, turn, cooldowns:{[skillId]:n}, log:[{turn,actor,text,dmg?}], status:"active"|"won"|"lost"|"fled", rewards? }`

### Quests

| Méthode | Route                      | Réponse                                                                                                        |
| ------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET     | `/quests`                  | `{ items: CharacterQuest[] }` (actives + disponibles)                                                          |
| POST    | `/quests/:questId/accept`  | → `CharacterQuest`                                                                                             |
| POST    | `/quests/:questId/advance` | `{ stepId, choice? }` → `CharacterQuest` (valide les conditions de l'étape ; `choice` pour les embranchements) |
| GET     | `/quests/daily`            | Contrats du jour `{ items:[{id,label,progress,goal,rewards,done}] }`                                           |

### Community projects

| Méthode | Route                      | Corps → Réponse                                                                                             |
| ------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET     | `/projects?regionId=`      | `{ items: Project[] }` — `Project`: `{ id, name, goals, progress, completedAt? }`                           |
| POST    | `/projects/:id/contribute` | `{ resource, qty }` → `{ project, character }` (débite l'inventaire + 5 stamina, XP + écus au contributeur) |

### Raids

| Méthode | Route                | Corps → Réponse                                                                                                                                        |
| ------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET     | `/raids/current`     | → `{ raid: Raid \| null }` — `Raid`: `{ id, bossSlug, hpMax, hpCurrent, opensAt, closesAt, status, participants, myNextAssaultAt }`                    |
| POST    | `/raids/:id/assault` | → `201 CombatState` (combat de projection : 25 stamina, cooldown 4 h vérifié) — à la fin du combat, les dégâts infligés sont soustraits de `hpCurrent` |
| GET     | `/raids/:id/log`     | Chronique paginée `{ items:[{characterName, damage, at, event?}] }`                                                                                    |

### Market (hôtel des ventes)

| Méthode | Route                              | Corps                                                 |
| ------- | ---------------------------------- | ----------------------------------------------------- |
| GET     | `/market/listings?itemId=&cursor=` |                                                       |
| POST    | `/market/listings`                 | `{ itemId, qty, unitPrice }` (retire de l'inventaire) |
| POST    | `/market/listings/:id/buy`         | `{ qty }` (taxe 5 %, transaction)                     |
| DELETE  | `/market/listings/:id`             | annulation par le vendeur                             |

### Inventory

| Méthode | Route                                   | Corps                        |
| ------- | --------------------------------------- | ---------------------------- |
| GET     | `/inventory`                            | → `{ items, capacity }`      |
| POST    | `/inventory/:entryId/equip` / `unequip` |                              |
| POST    | `/inventory/:entryId/use`               | consommables hors combat     |
| POST    | `/inventory/repair`                     | `{ entryId }` → coût en écus |

### Divers

`GET /health` (public), `GET /leaderboards?kind=exploration|contribution|raid&week=` , `GET /content/{items|skills|quests|npcs}` (contenu statique versionné, cacheable, sert au front pour libellés/描 descriptions — étag + cache long).

## 4. WebSocket `/ws`

Connexion authentifiée par le cookie de session. Messages JSON `{ channel, type, data, at }`.

Client → serveur : `{ type:"chat.send", channel:"region:1"|"company:<id>"|"global", body }` (≤ 500 chars, rate-limit 10/min).

Serveur → client, par canal :

| Canal            | Types                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `character:{id}` | `action.resolved` (données de résolution : nouvelle position, butin, rencontre → `combatId`), `stamina.full`, `quest.updated`, `level.up` |
| `region:{id}`    | `chat.message`, `project.progress` (agrégé, throttle 10 s), `mist.changed`, `warden.sighted`                                              |
| `global`         | `raid.opened`, `raid.tier` (75/50/25), `raid.won/failed`, `ember.rekindled`, `announce`                                                   |

Le client traite tout événement comme un **signal d'invalidation** : il rafraîchit la ressource REST concernée plutôt que d'appliquer le payload aveuglément (source de vérité unique).

## 5. Push (PWA)

`POST /push/subscribe` `{ subscription }` (endpoint Web Push standard, clés VAPID). Notifications émises par le resolver : action résolue hors-ligne, endurance pleine, paliers de raid, fenêtre de raid ouverte. Préférences par type dans `PUT /push/preferences`.
