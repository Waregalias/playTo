# SPEC-M3.md — Jalon 3 « Ensemble »

Objectif : le jeu bascule du solo (M2, tout en polling) au **multijoueur temps réel**. Les Ravivés se parlent (chat WebSocket), reconstruisent ensemble le beffroi du Grand Cairn (chantier communautaire = quête **Q5 « Sonner le Glas »**), échangent à l'hôtel des ventes, dépensent enfin leurs points de compétence (arbres des 4 classes) et entretiennent leur équipement (usure à la mort, réparation). **Aucun raid (M4), aucune compagnie / canal `company:` / classement / Marque de gloire / contrat quotidien / craft / expédition de groupe / PNJ marchand dans ce jalon.**

Critère de sortie global (GDD §17) : **Q5 achevée par ≥ 10 joueurs** — dix personnages ayant contribué au beffroi voient la quête passer `completed` à la complétion serveur du chantier.

## Périmètre

### Inclus

- **`shared`** :
  - Catalogue des **60 compétences** (`{ id, class, branch, tier, kind:'active'|'passive', effect }`) — effets sourcés **verbatim de GDD §5**, ids `{class}.{branch}.{tier}` (GLOSSARY). Contenu FR (noms + descriptions) dans `content/fr/skills.ts`.
  - Formules pures testées : `deriveSkillModifiers(learnedSkills)` (agrège les passifs câblables), `repairCost(missingDurability, itemTier)`, `contributionCredit(qty, modifiers)` (multiplicateur Offrande ×1,4).
  - Schémas Zod du contrat M3 : chat (`ChatMessage`, message WS entrant/sortant), projets (`Project`, `ProjectDetail`, corps `contribute`), marché (`Listing`, corps create/buy), compétences (learn / equip `{slot1?,slot2?}`, `skills:[{skillId,equippedSlot?}]` sur `Character`), enveloppe WS `{ channel, type, data, at }`.
- **DB** : migration ajoutant `learnedSkills` (JSONB `string[]`) et `equippedSkills` (JSONB `{slot1?,slot2?}`) sur `characters` ; activation des tables déjà conçues (`projects`, `contributions`, `market_listings`, `chat_messages`) ; contraintes (index chat par canal, `listing_positive`, `contrib_qty`). Seed : projet `r1.belfry` (`goals:{ shadewood:5000, sootOre:3000, ashGlass:500 }`) + quête `r1.main.q5` (`kind:'main'`, requiert `r1.main.q4`).
- **API WS `/ws`** : plugin `@fastify/websocket` + `ConnectionRegistry` en mémoire (Map `characterId → Set<socket>`, index par canal `global` / `region:{id}` / `character:{id}`). Auth à l'upgrade via la session better-auth (`401` sinon). Émission post-commit ; `project.progress` throttlé 10 s (état coalescé).
- **API chat** : `GET /chat/:channel?cursor=` (50 derniers) ; envoi **uniquement via WS** `chat.send` (jamais REST) — Zod, rate-limit **10 msg/min/perso** (dépassement → event `chat.throttled`), persistance + broadcast `chat.message` au canal. Canaux `global` + `region:1`.
- **API projets/contributions** : `GET /projects?regionId=`, `GET /projects/:id` (détail étendu, *ajout M3*), `POST /projects/:id/contribute { resource, qty }` (⚡5, transaction : débit inventaire, insert `contributions`, incrément `progress` clampé au restant, XP + écus au contributeur, broadcast throttlé). Hook de complétion Q5 (voir US4).
- **API marché** : `GET /market/listings?itemId=&cursor=`, `POST /market/listings { itemId, qty, unitPrice }` (retire de l'inventaire, txn), `POST /market/listings/:id/buy { qty }` (txn : taxe 5 % → sink, transfert écus, item→acheteur, achat partiel), `DELETE /market/listings/:id` (vendeur seul, retour des items).
- **API compétences** : `POST /characters/me/skills { skillId }` (coût 1 point + fragments pour paliers 4–5, prérequis palier N−1 de la même branche), `PUT /characters/me/skills/equipped { slot1?, slot2? }` (2 slots de combat, skill apprise + `kind:'active'`). Intégration des effets câblables au combat / à la fouille / au déplacement / à la vision / aux pertes à la mort / à la contribution.
- **API usure/réparation** : perte de durabilité de l'arme + l'armure équipées à la mort (transaction de défaite existante), stats d'équipement réduites à 0 durabilité, `POST /inventory/repair { entryId }` (coût écus proportionnel, sink).
- **Web** : `RealtimeService` (signal-based, socket unique, reconnexion exponentielle, heartbeat ; chaque event = invalidation REST **sauf `chat.message` = append direct**) ; panneau de chat (global/région) ; écran Chantier (barres de progression par ressource, formulaire de contribution, progression publique) ; Place du marché (annonces, filtres, vendre/acheter/annuler) ; arbre de compétences par classe (apprendre/équiper, points affichés) ; durabilité + bouton réparer dans l'inventaire.

### Exclu (ne pas implémenter, même « tant qu'on y est »)

Raid Maugrith et sa création à la complétion de Q5 (M4), Q6, cérémonie de rallumage, ouverture région 2, compagnies + canal `company:`, classements / Marques de gloire, contrats quotidiens, craft (`actions {type:craft}` reste non implémenté), expéditions de groupe, PNJ marchands, push PWA (M5), échange direct entre joueurs.

## User stories & critères d'acceptation

**US1 — Se parler en temps réel.**
Je me connecte, une socket s'ouvre ; j'écris dans le canal global ou région et les autres joueurs présents voient mon message aussitôt.
- ✓ Upgrade `/ws` authentifié par la session ; connexion non authentifiée refusée (`401`).
- ✓ `chat.send` valide Zod (≤ 500 car.), rate-limité 10/min (11ᵉ → `chat.throttled`, pas de persistance).
- ✓ Message persisté puis diffusé `chat.message` à tous les abonnés du canal ; `GET /chat/:channel` renvoie l'historique paginé.
- ✓ Client : `chat.message` appendu directement au fil ; tout autre event traité comme signal d'invalidation.

**US2 — Être notifié sans rafraîchir.**
Quand une de mes actions se résout, mon endurance se remplit, une quête avance ou je monte de niveau, l'UI se met à jour sans polling.
- ✓ Les événements `character:{id}` (`action.resolved`, `stamina.full`, `quest.updated`, `level.up`) déclenchent le refetch de la ressource REST concernée (source de vérité unique).
- ✓ Le worker de résolution (5 s) et les services émettent **après commit**.
- ✓ Perte de connexion → reconnexion automatique ; à la reconnexion, l'app refait un `GET /characters/me` (rattrape l'état manqué).

**US3 — Contribuer au beffroi.**
Au Grand Cairn, je livre du bois d'ombre, du minerai et du verre ; la barre communautaire monte pour tous.
- ✓ `POST /projects/:id/contribute` : `409 INSUFFICIENT_STAMINA` (< 5), `409 INSUFFICIENT_MATERIALS` si l'inventaire ne couvre pas `qty`, `409 PROJECT_COMPLETED` si le chantier est terminé.
- ✓ Transaction : débit inventaire + insert `contributions` + incrément `progress` **clampé au restant** (surplus non débité, non erreur) + XP + écus.
- ✓ Multiplicateur Offrande (`cantor.ember.1`) ×1,4 appliqué à la quantité **créditée** (les matériaux réellement débités restent `qty`).
- ✓ `project.progress` diffusé au canal `region:1`, throttlé 10 s.

**US4 — Achever Q5 ensemble.**
Quand le beffroi atteint 100 %, tous ceux qui ont posé au moins une pierre voient « Sonner le Glas » accomplie et reçoivent la récompense.
- ✓ Complétion idempotente (`UPDATE projects SET completed_at=now() WHERE id=? AND completed_at IS NULL RETURNING`).
- ✓ À la complétion : Q5 passe `completed` pour **tout personnage ayant ≥ 1 contribution**, récompenses de quête distribuées en transaction, `announce` diffusé en `global`.
- ✓ Q5 exige Q4 (`409 REQUIREMENT_NOT_MET` à l'acceptation sinon) ; la création du raid Maugrith est **hors périmètre (M4)**.

**US5 — Vendre et acheter à l'hôtel des ventes.**
Je mets en vente un surplus, un autre joueur l'achète ; l'écart d'écus tient compte de la taxe.
- ✓ Mise en vente : items retirés de l'inventaire en transaction (`409 INSUFFICIENT_MATERIALS`).
- ✓ Achat : `409 INSUFFICIENT_FUNDS`, `409 CANNOT_BUY_OWN_LISTING`, `409 LISTING_UNAVAILABLE` (annonce disparue / quantité insuffisante) ; taxe 5 % prélevée sur le paiement vendeur (sink), item transféré, achat partiel décrémente la pile ; le tout en une transaction.
- ✓ Annulation par le vendeur uniquement (`403` sinon) → items rendus.

**US6 — Dépenser mes points de compétence.**
J'ouvre mon arbre de classe, j'apprends une compétence dont je remplis le prérequis, j'en équipe jusqu'à deux actives pour le combat.
- ✓ `POST /characters/me/skills` : `409 REQUIREMENT_NOT_MET` (points/fragments insuffisants ou palier N−1 manquant), `409 SKILL_ALREADY_LEARNED`. Paliers 4–5 coûtent des fragments de braise (GDD §9.1).
- ✓ `PUT /characters/me/skills/equipped` : refuse une compétence non apprise ou `kind:'passive'` (`409 REQUIREMENT_NOT_MET`) ; ≤ 2 slots ; `null` déséquipe.
- ✓ Les passifs câblables modifient les formules via `deriveSkillModifiers` (testé) ; les actifs équipés sont utilisables en combat (`{action:'skill', skillId}`).

**US7 — Entretenir mon équipement.**
Chaque mort abîme mon arme et mon armure ; à l'atelier je paie pour les remettre en état.
- ✓ À la mort (même transaction que la défaite M2) : `durability -= N` sur l'arme et l'armure équipées (borné à 0).
- ✓ Durabilité 0 → stats d'équipement réduites (via `deriveGearStats`), visible sur l'écran Héros.
- ✓ `POST /inventory/repair` : `409 NOTHING_TO_REPAIR` si pleine, coût = `repairCost(...)` en écus, `409 INSUFFICIENT_FUNDS`, transaction, durabilité restaurée à `maxDurability`.

## Compétences : effets câblés vs inertes en M3

Les 60 effets sont **définis en data** (sourcés GDD §5). Un effet est *câblé* si le système qu'il touche existe en M3, sinon il est *inerte* (présent, non appliqué) et sera réactivé à son jalon. `deriveSkillModifiers` n'agrège que les passifs câblables ; les actifs inertes ne sont pas équipables tant qu'ils ne servent à rien (ou équipables sans effet — voir décision 5).

| Système touché | Statut M3 | Exemples (GDD §5) |
|---|---|---|
| Combat — actif (slot) | **câblé** | Frappe lourde, Fente, Trait de cendre, Tir précis, Semonce… |
| Combat — passif | **câblé** | Garde ferme (+armure %), Mur de fer, Embuscade, Miroir de brume… |
| Fouille (butin) | **câblé** | Lecture des runes (+20 % butin) |
| Déplacement / vision | **câblé** | Pas léger (−10 % timers), Longue-Vue (+1 vision), Cartographe |
| Pertes à la mort | **câblé** | Poche double (−50 % pertes de matériaux) |
| Contribution | **câblé** | Offrande (×1,4) |
| Inventaire | **câblé** | Porteur (+10 emplacements) |
| Groupe / expédition | **inerte** | Provocation, Meneur, Cadence, Chant vivifiant… |
| Raid / Gardien | **inerte** | Œil des Archives, Verbe d'extinction |
| Craft / transmutation | **inerte** | Alchimie, Transmutation |
| Téléport autel / PNJ marchand | **inerte** | Chemins de traverse, Légende de Cendrelune |

La spec d'implémentation (étape 1) fige la table complète des 60 avec `effect` et `wiredInM3:boolean`.

## WebSocket — canaux & événements (rappel API-SPEC §4)

| Canal | Événements serveur→client (M3) |
|---|---|
| `character:{id}` | `action.resolved`, `stamina.full`, `quest.updated`, `level.up` |
| `region:{id}` | `chat.message`, `project.progress` (throttle 10 s) |
| `global` | `chat.message`, `announce` |

Client→serveur : `chat.send` uniquement. `mist.changed` / `warden.sighted` / `raid.*` / `ember.rekindled` : hors périmètre (M4+).

## Codes d'erreur ajoutés (à refléter dans API-SPEC §2)

`INSUFFICIENT_MATERIALS`, `SKILL_ALREADY_LEARNED`, `CANNOT_BUY_OWN_LISTING`, `LISTING_UNAVAILABLE`, `PROJECT_COMPLETED`, `NOTHING_TO_REPAIR`. Réutilisés : `INSUFFICIENT_STAMINA`, `INSUFFICIENT_FUNDS`, `REQUIREMENT_NOT_MET`, `INVENTORY_FULL`, `RATE_LIMITED` (429). Chaque `message` est une chaîne FR de la voix du jeu (`content/fr/errors.ts`).

## Glossaire à compléter (avant tout code — CLAUDE.md §5)

| FR (affichage) | EN (code) |
|---|---|
| Compétence | `skill` |
| Palier | `tier` |
| Durabilité | `durability` |
| Réparation | `repair` |
| Annonce (marché) | `listing` |
| Contribution | `contribution` |
| Canal (chat) | `channel` |

## Ordre d'implémentation (avec vérifications)

```
1. shared : catalogue des 60 compétences + deriveSkillModifiers + repairCost +
   contributionCredit + schémas Zod M3 + contenu FR (skills, erreurs)
   → verify: vitest — prérequis de palier, agrégation passifs, coût réparation
     (0/plein/partiel), crédit contribution ×1,4
2. db : migration (learnedSkills, equippedSkills) + activation projects/
   contributions/market_listings/chat_messages + seed r1.belfry & Q5
   → verify: db:migrate + db:seed idempotents ; projet et Q5 présents
3. api : plugin WS + ConnectionRegistry + auth upgrade + émission post-commit
   → verify: test d'intégration — upgrade authentifié vs 401, broadcast ciblé par canal
4. api : chat (historique + chat.send + rate-limit) + branchement des émissions
   character/region existantes (action.resolved, quest.updated, level.up…)
   → verify: tests — persistance, diffusion, throttle 10/min
5. api : projets/contributions + hook de complétion Q5 + récompenses
   → verify: tests — contribution (clamp, débit, XP/écus), complétion idempotente
     → Q5 done pour ≥1 contribution + announce
6. api : marché (create/buy/cancel + taxe 5 %)
   → verify: tests — achat partiel, taxe, own-listing, funds, listing-unavailable, retour à l'annulation
7. api : compétences (learn/equip) + intégration effets combat/fouille/déplacement/mort
   → verify: tests — prérequis, fragments paliers 4–5, effet passif mesurable,
     actif équipé utilisable en combat
8. api : usure à la mort + réparation
   → verify: tests — durabilité décrémentée à la mort, stats réduites à 0, coût réparation
9. web : RealtimeService + chat + chantier + marché + arbre de compétences + réparation
   → verify: preview — deux sessions voient le même message et la même barre monter ;
     achat/vente ; apprentissage + équipement ; réparation
```

## Décisions proposées (tranchées pour avancer)

1. **Surplus de contribution** : la quantité créditée est **clampée** au restant du goal ; les matériaux au-delà ne sont **pas** débités (pas d'erreur). L'endurance (⚡5) n'est prélevée que si au moins 1 unité est créditée.
2. **Usure** : arme + armure équipées perdent **10 points** de durabilité à chaque mort. À 0, leurs stats d'équipement sont **réduites de 50 %** jusqu'à réparation. `maxDurability` par défaut = 100 (ajustable par palier d'objet au seed).
3. **Slots de compétence active** : **2** (`slot1`/`slot2`, conforme API-SPEC §3). M2 n'en utilisait qu'un ; M3 ouvre le second. Un passif n'occupe pas de slot.
4. **Coût de réparation** : `repairCost = ceil(missingDurability × tarifParPoint × facteurTier)`, tarif à équilibrer en bêta (proposé : 1 ◉/point pour un objet t1, ×1,5 t2). Fonction pure testée.
5. **Actifs inertes** : équipables mais sans effet en M3 ? → **Non** : on n'autorise l'équipement que des actifs dont l'effet est câblé, pour ne pas offrir de slot mort. Les actifs inertes restent apprenables (progression d'arbre) mais non équipables jusqu'à leur jalon.
6. **Détail projet** : `GET /projects/:id` (ajout M3) renvoie `{ ...Project, myContribution, contributorCount }` pour l'UI du chantier ; `GET /projects?regionId=` garde la forme `Project` du contrat.
7. **Reconnexion** : à chaque (re)connexion WS, le client refait `GET /characters/me` et refetch les ressources visibles — pas de rejeu d'événements manqués côté serveur (source de vérité = REST).

## Questions ouvertes (à trancher avant M4)

1. Faut-il un canal `region:0` (bastion) distinct de `global`, ou le bastion partage-t-il `global` ? (proposé : `global` suffit au MVP.)
2. Historique de chat : purge au-delà de N jours / N messages par canal ? (proposé : pas de purge en M3, à surveiller.)
3. Anti-abus marché (prix planchers, annonces max par joueur) — nécessaire dès l'ouverture publique ?
4. Le second slot de compétence doit-il être débloqué par niveau (ex. niv. 6) plutôt que dispo d'emblée ?

## Assets nécessaires (M3)

Aucun nouvel asset de créature. Icônes de ressources (`shadewood`, `sootOre`, `ashGlass`) et de compétences : glyphes/CSS conformes à DESIGN §14.6 (pas de fichiers image requis pour ce jalon). L'écran Chantier peut réutiliser l'illustration de bastion existante.
