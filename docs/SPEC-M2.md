# SPEC-M2.md — Jalon 2 « Se battre »

Objectif : un joueur affronte les Brumeux des Landes en combat par tours asynchrone, fouille les points d'intérêt, gère son inventaire et son équipement, meurt et se réveille au bastion — et déroule la chaîne principale Q1→Q4 en solo. **Aucun contenu communautaire (chat, chantiers, raids), aucun marché, pas d'arbres de compétences complets dans ce jalon.**

Critère de sortie global (GDD §17) : Q1→Q4 jouables en solo, de la Salle des Cendres au Chevalier Vide.

## Périmètre

### Inclus

- `shared` : formules de combat pures (GDD §13) avec RNG injecté, schémas Zod combat/inventaire/quêtes, contenu FR (Brumeux, objets, quêtes, dialogues).
- DB : tables `combats`, `items`, `inventory`, `quests`, `character_quests` (DATA-MODEL) + migrations + seeds (objets de départ, quêtes r1.main.q1→q4 + specs des 5 Brumeux région 1).
- Combat par tours persisté : Attaque / Compétence (1 slot, voir décisions) / Objet / Fuite. Riposte du Brumeux dans la même réponse. On peut fermer l'app en plein combat.
- Rencontres : tirées serveur à la résolution d'un `move`/`search` hors région 0, probabilité par terrain. Un combat actif bloque toute nouvelle action (`COMBAT_ALREADY_ACTIVE`).
- Fouille (`search`) : ⚡10, 5 min, 1 fouille/POI/jour/joueur (`POI_ALREADY_SEARCHED`), butin par table de loot + XP.
- Inventaire : capacité 30 + FOR, équipement (1 arme + 1 armure), consommables utilisables hors combat et en combat, matériaux empilables.
- XP & niveaux : XP de combat/fouille/quête, courbe GDD §6, +2 points d'attributs par niveau (répartition via `POST /characters/me/attributes`), +1 point de compétence aux niveaux pairs (stocké, dépensé en M3).
- Mort/respawn : PV 0 → réveil Salle des Cendres, `deathPenaltyUntil` = +2 h réelles (stats effectives −20 %), perte de matériaux transportés (voir décisions).
- Quêtes : moteur à étapes (JSONB validé), hooks `reach`/`search`/`kill`/`combat`/`choice`, chaîne Q1→Q4 avec l'embranchement de Petra (Q3) et le mini-boss Chevalier Vide (Q4).
- Web : overlay combat (DESIGN §3, maquette), écran Héros complet (stats, attributs à répartir, équipement, inventaire), journal de quêtes dans l'écran Bastion (tableau de Mira), toasts de butin/level-up.

### Exclu (ne pas implémenter, même « tant qu'on y est »)

Chat/WS (toujours polling), chantiers, raids, hôtel des ventes, contrats quotidiens, arbres de compétences complets (achat/équipement de compétences = M3), craft, réparations/usure, quêtes annexes, expéditions de groupe, PNJ marchands.

## User stories & critères d'acceptation

**US1 — Croiser un Brumeux.**
Quand mon déplacement ou ma fouille se résout hors du bastion, je peux tomber sur un Brumeux ; le combat m'attend à ma prochaine connexion.

- ✓ La rencontre est tirée côté serveur à la résolution (probabilité par terrain, jamais sur route de cendre ni au bastion), journalisée dans `result`.
- ✓ `GET /combat/current` retourne le combat actif ; toute intention d'action pendant un combat actif → `409 COMBAT_ALREADY_ACTIVE`.
- ✓ Un seul combat actif par personnage (index partiel unique).

**US2 — Me battre par tours.**
Je choisis Attaque, Compétence, Objet ou Fuite ; le serveur résout mon tour et la riposte, et me renvoie l'état complet avec le log.

- ✓ Formules GDD §13 testées unitairement dans `shared` (bornes d'aléa, mitigation armure, critique, esquive).
- ✓ Tout l'aléa est tiré serveur ; chaque tirage est visible dans le log du combat.
- ✓ Le combat survit à une fermeture de l'app (état 100 % persisté, aucune contrainte de temps par tour).
- ✓ Victoire → XP + écus + butin (inventaire plein → butin perdu, message dédié) ; fuite réussie → aucun gain ; fuite ratée → riposte gratuite.

**US3 — Mourir n'est pas la fin.**
À 0 PV je me réveille à la Salle des Cendres avec la moitié de mes PV, un malus de 20 % sur mes stats pendant 2 h et une partie de mes matériaux en moins.

- ✓ Respawn + `deathPenaltyUntil` + perte de matériaux appliqués dans la même transaction que la défaite.
- ✓ Le malus s'applique aux formules de combat et est visible sur l'écran Héros (compte à rebours).
- ✓ La file d'actions est vidée à la mort (sans remboursement).

**US4 — Fouiller les lieux.**
Sur un hex à POI, je lance une fouille (⚡10 · 5 min) et je récolte butin et XP à la résolution.

- ✓ `POST /actions {search}` : `409 NOT_ON_POI` hors POI, `409 POI_ALREADY_SEARCHED` si déjà fouillé aujourd'hui (minuit UTC), coûts exacts.
- ✓ Butin tiré serveur sur la table de loot du POI, inséré en transaction, visible dans `result`.

**US5 — Porter, équiper, utiliser.**
Je vois mon inventaire (capacité 30 + FOR), j'équipe une arme/armure, j'utilise une potion en combat ou hors combat.

- ✓ `POST /inventory/:entryId/equip` déséquipe l'ancien objet du même type ; les stats d'équipement alimentent les formules.
- ✓ Ramassage au-delà de la capacité → `409 INVENTORY_FULL`.
- ✓ Potion en combat = l'action du tour ; hors combat = instantané.

**US6 — Suivre la chaîne des Landes (Q1→Q4).**
J'accepte les quêtes au tableau de Mira, je vois l'étape courante, la progression avance automatiquement (atteindre un hex, fouiller, vaincre), je tranche l'embranchement de Petra, et je défais le Chevalier Vide pour gagner l'arme de rang 2 de ma classe.

- ✓ Chaque quête exige la précédente (`409 REQUIREMENT_NOT_MET` sinon).
- ✓ Q3 : le choix A/B est persisté et exclusif ; Q4 : le Chevalier Vide n'apparaît qu'à l'étape idoine, sur le Marais des Soupirs.
- ✓ Récompenses en transaction ; l'arme t2 correspond à la classe.

**US7 — Monter en niveau.**
L'XP s'accumule, je passe niveau (cap 25), je répartis mes +2 points d'attributs depuis l'écran Héros.

- ✓ `POST /characters/me/attributes` refuse une somme > points disponibles (`400`).
- ✓ PV max recalculés à la hausse de VIT ; level-up visible (toast + écran Héros).

## Ordre d'implémentation (avec vérifications)

```
1. shared : formules de combat (RNG injecté) + schémas Zod M2 + contenu FR
   → verify: vitest — dégâts min/max, armure 0/50/∞, critique, esquive,
     fuite bornée, malus de mort −20 %
2. db : tables M2 + migrations + seeds (items, quêtes, foes en contenu partagé)
   → verify: db:migrate + db:seed idempotents ; 4 armes t1 + 4 t2 présentes
3. api : module combat (create/current/turn) + rencontres à la résolution
   → verify: tests d'intégration RNG contrôlé — victoire, défaite+respawn,
     fuite, COMBAT_ALREADY_ACTIVE, riposte
4. api : search + loot + inventaire (equip/use/capacité)
   → verify: tests US4/US5 dont les deux 409
5. api : XP/level-up + attributs + moteur de quêtes + seed Q1→Q4
   → verify: test bout-en-bout Q1→Q4 simulé (reach → search → kill → boss)
6. web : overlay combat + rencontres au retour de résolution
   → verify: combat complet au doigt sur 360px, fermeture/réouverture en plein tour
7. web : écran Héros (stats, attributs, équipement, inventaire) + malus visible
8. web : journal de quêtes (Bastion) + toasts butin/level-up
   → verify: Q1→Q4 joué à la main dans le preview
```

## Décisions proposées (à valider, tranchées pour avancer)

1. **Compétence de départ** : chaque classe reçoit d'office la compétence tier-1 de sa branche offensive, équipée en slot 1 (Lame : Frappe lourde ×1,3 recharge 2 t · Arcaniste : Trait de cendre · Éclaireur : Tir précis · Chantre : Semonce). L'acquisition/équipement libre attend M3 — le combat garde ainsi 4 vraies options dès M2 (conforme à la maquette).
2. **Perte à la mort** : 25 % de chaque pile de matériaux (arrondi bas), équipement et monnaies intacts. (La compétence Éclaireur « Poche double −50 % » de M3 s'appliquera dessus.)
3. **Probabilités de rencontre** (par résolution de move, région ≥ 1) : forêt 35 % · ruines 40 % · marais 30 % · colline 20 % · gué 20 % · plaine 15 % · autel et route 0 %. Fouille : +10 points partout. À équilibrer en bêta.
4. **Stats des Brumeux** : non chiffrées au GDD → définies dans `shared/content` (loup de suie niv. 2 → chevalier vide niv. 5, mouton d'ombre réservé au raid M4). Le Berger spectral sert les vagues de Q3-A.
5. **« Réputation + » de Q3-B** : traduite en +40 ◉ et un dialogue de Petra différent (la réputation n'existe pas encore comme système).
6. **Reset des fouilles** : minuit UTC (simple, prévisible) — pas de fenêtre glissante 24 h.
7. **Armes/armures sans usure** en M2 (les réparations arrivent avec l'économie M3).

## Questions ouvertes (à trancher avant M3)

1. Les rencontres doivent-elles monter avec le niveau de Brume de l'hex (×1,25/niveau ?) — cohérent avec le lore, mais à mesurer.
2. Le Chevalier Vide doit-il être re-combattable après Q4 (farm de l'arme t2 exclu) ?
3. Potions en combat : un « sac de combat » limité (2-3 slots) ou tout l'inventaire accessible ?

## Assets nécessaires (M2)

À déposer dans `apps/web/public/assets/foes/` (carré ~512px, style « illustration semi-peinte sombre ») :

1. **Loup de suie** (`soot-wolf.png`)
2. **Berger spectral** (`spectral-shepherd.png`)
3. **Chevalier Vide** (`hollow-knight.png`) — mini-boss Q4, le plus important
4. **Faucheur de bruyère** (`heather-reaper.png`)

(Le Mouton d'ombre attendra le raid M4.) Les icônes d'objets restent en glyphes/CSS pour M2, conformément au GDD §14.6. En attendant les fichiers, l'overlay combat utilise la silhouette CSS de la maquette.
