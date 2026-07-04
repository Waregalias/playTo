# Les Braises d'Aldenfer — Document de Game Design

*Jeu web multijoueur d'exploration et de quêtes en heroic-fantasy, à rythme semi-réel (timers), jouable sur navigateur desktop et mobile. Cible : 50–200 joueurs par serveur.*

---

## 1. Vision & piliers de design

**Pitch.** Le royaume d'Aldenfer a sombré dans la Brume depuis l'extinction de la Flamme Primordiale. Les joueurs incarnent des Ravivés, envoyés depuis le dernier bastion pour rallumer les Braises qui repoussent la Brume et libèrent les régions une à une. La progression du monde est **communautaire** : personne ne rallume une Braise seul.

**Piliers.**

1. **Le monde avance grâce à tous.** Les régions se débloquent par effort collectif (ressources livrées, dégâts cumulés sur les Gardiens). Un joueur qui se connecte 10 minutes par jour contribue réellement.
2. **Le temps est la ressource maîtresse.** Chaque action a un coût en endurance et un délai réel. Pas de grind frénétique : on planifie, on lance, on revient.
3. **Jouable au pouce.** Toute interaction tient sur un écran de téléphone, en moins de 30 secondes par décision.
4. **La Brume raconte.** Le lore n'est pas un mur de texte : il se découvre en fouillant, via les PNJ et les événements de région.

**Ce que le jeu n'est pas** : pas de combat temps réel, pas de PvP sauvage (compétition indirecte via classements), pas de pay-to-win.

---

## 2. Lore

### 2.1 La Flamme Primordiale

Il y a mille ans, les Premiers Chantres arrachèrent une étincelle au cœur du volcan Karn-Doril et l'installèrent au sommet de la Grande Lanterne, au centre du royaume d'Aldenfer. Cette Flamme Primordiale ne réchauffait pas seulement : elle *affirmait* le monde. Sous sa lumière, les frontières entre le réel et l'Ailleurs restaient scellées.

Autour d'elle, on bâtit sept cités reliées par les Routes de Cendre, pavées de pierre volcanique qui conservait un peu de la chaleur de la Flamme. Des Braises — fragments de la Flamme enchâssés dans des autels de bronze — furent disséminées dans chaque région comme relais de sa lumière.

### 2.2 L'Extinction

Il y a trente ans, la Flamme s'est éteinte en une nuit. Personne ne sait pourquoi — c'est le mystère central du jeu, révélé par arcs saisonniers. Trois théories circulent parmi les PNJ :

- **La théorie du Vol** (défendue par l'Archiviste Ennor) : quelqu'un, ou quelque chose, a *pris* la Flamme. Elle existe encore, ailleurs.
- **La théorie de la Dette** (défendue par la Chantre-Major Isolde) : la Flamme était un emprunt fait au volcan. Le contrat des Premiers Chantres est arrivé à échéance.
- **La théorie du Sommeil** (murmurée par les fous et le marchand Fenk) : la Flamme ne s'est pas éteinte. Elle s'est *retournée*. La Brume est son rêve.

### 2.3 La Brume

Sans la Flamme, l'Ailleurs suinte dans le monde sous forme d'une brume grise et froide. La Brume n'est pas un simple brouillard :

- Elle **dissout la mémoire des lieux** : les routes changent, les villages engloutis n'apparaissent plus sur aucune carte.
- Elle **engendre les Brumeux** : créatures mi-souvenir mi-cauchemar, échos déformés de ce que la région a été (bergers spectraux, loups de suie, chevaliers vides).
- Elle **obéit aux Gardiens** : dans chaque région, la Brume s'est condensée autour d'une entité dominante, le Gardien de Brume, qui verrouille la Braise locale.

### 2.4 Les Ravivés (les joueurs)

Les Ravivés sont des morts récents que la dernière Braise du bastion a refusé de laisser partir. Ils se réveillent dans la Salle des Cendres avec une flammèche logée dans la poitrine — c'est elle qui les anime, et c'est pour cela qu'ils peuvent marcher dans la Brume sans se dissoudre.

Conséquences ludiques :

- **La mort n'est pas définitive** : un Ravivé vaincu se réveille au bastion, mais sa flammèche vacille (malus temporaire de 20 % sur les stats pendant 2 h réelles) et il perd une partie des ressources transportées.
- **La flammèche est la jauge d'endurance** : agir dans la Brume la consomme ; le repos près d'un feu la ravive.

### 2.5 Le Bastion de Cendrelune

Dernière cité vivante, construite autour de l'ultime Braise majeure. C'est le hub social : place du marché, forge, archives, salle du Chantre, tableau des expéditions. Tout joueur y commence et y revient à chaque mort.

### 2.6 Arcs narratifs saisonniers

- **Saison 1 — Les Landes s'éveillent** : libération des trois premières régions, découverte des premiers indices sur l'Extinction (des traces de pas *dans* la Grande Lanterne, orientées vers l'intérieur).
- **Saison 2 — La Dette du Volcan** : ouverture vers Karn-Doril, confrontation avec les héritiers des Premiers Chantres.
- **Saison 3 — Ce qui rêve sous la Brume** : révélation finale, choix communautaire de fin de saison qui modifie l'état du serveur (rallumer la Flamme ou la remplacer).

---

## 3. Le monde & la carte

### 3.1 Structure

La carte est **hexagonale**, découpée en régions de 40 à 80 hexagones. Chaque hexagone possède un terrain, éventuellement un point d'intérêt (POI), et un niveau de Brume (0 = clair, 3 = opaque).

**Terrains** (8) : plaine, forêt, colline, marais, ruines, route de cendre, rivière/gué, autel.

| Terrain | Coût endurance | Timer déplacement | Particularité |
|---|---|---|---|
| Route de cendre | 3 | 1 min | Aucune rencontre |
| Plaine | 5 | 2 min | — |
| Forêt | 8 | 5 min | +bois, rencontres fréquentes |
| Colline | 10 | 8 min | +minerai, vision +1 hex |
| Marais | 12 | 10 min | +herbes rares, risque d'enlisement (timer ×2, 10 %) |
| Ruines | 8 | 6 min | POI fréquents, Brumeux fréquents |
| Gué | 6 | 4 min | Passage obligé (goulots stratégiques) |
| Autel | 5 | 2 min | Point de repos, sauvegarde de position |

Le **niveau de Brume** de l'hexagone multiplie les coûts : ×1 (niveau 0), ×1,25 (1), ×1,5 (2), ×2 (3). Rallumer la Braise régionale fait chuter toute la région d'un niveau.

### 3.2 Les régions (Saison 1)

**Région 0 — Bastion de Cendrelune** (hub, 7 hexagones, sans Brume)
Place du marché, Forge de Brasfer, Archives, Grande Salle du Chantre, Salle des Cendres (spawn), Porte de l'Ouest, Jardin des Lanternes.

**Région 1 — Les Landes de Vellebrune** (45 hex, niveau recommandé 1–8)
Landes balayées de bruyères grises, hameaux de bergers engloutis. Thème : la mémoire qui s'efface. Gardien : **Maugrith, le Berger de Brume**. Braise : l'Autel du Grand Cairn.

**Région 2 — La Sylve d'Ombrecœur** (60 hex, niveau 8–16)
Forêt ancienne dont les arbres ont commencé à *marcher*. Thème : la nature qui se défend contre les deux camps. Gardien : **Sylvara, la Racine-Creuse**. Braise : la Souche-Lanterne.

**Région 3 — Les Carrières de Halvenn** (55 hex, niveau 14–22)
Mines et carrières où les tailleurs de pierre ont continué à travailler après leur mort. Thème : le labeur sans but. Gardien : **Karn Volge, le Contremaître de Suie**. Braise : la Forge Noyée.

**Régions 4–6** (Saison 2) : le Lac des Regrets, les Hauts-Cols de Ferregarde, les Pentes de Karn-Doril.

### 3.3 Brouillard de guerre

Chaque joueur ne voit que les hexagones qu'il a visités ou qui sont adjacents à sa position (vision +1 sur colline, +1 avec la compétence Éclaireur « Longue-Vue »). Une **carte communautaire** aux Archives agrège les découvertes de tous les joueurs qui choisissent de « verser leurs relevés » (petit gain d'écus), à la manière des relevés d'Hordes.

---
## 4. Classes de héros

Quatre classes, complémentaires en expédition de groupe. Chaque personnage a 5 attributs : **Force (FOR), Adresse (ADR), Volonté (VOL), Vitalité (VIT), Ferveur (FER)** — la Ferveur régit l'efficacité près des Braises et la résistance à la Brume.

### 4.1 La Lame (tank / mêlée)

Anciens soldats de la garde d'Aldenfer. Encaisse et protège.

- Stats de départ : FOR 8, ADR 5, VOL 4, VIT 9, FER 4
- Arme : épée + bouclier / espadon
- Rôle en groupe : réduit les dégâts subis par l'expédition de 15 %.

### 4.2 L'Arcaniste (dégâts / contrôle)

Étudiants des Archives qui manipulent la cendrelumière, résidu magique de la Flamme.

- Stats : FOR 3, ADR 5, VOL 9, VIT 5, FER 8
- Arme : bâton-lanterne
- Rôle en groupe : +20 % de dégâts de l'expédition contre les Brumeux.

### 4.3 L'Éclaireur (exploration / vitesse)

Contrebandiers et messagers des Routes de Cendre.

- Stats : FOR 5, ADR 9, VOL 5, VIT 6, FER 5
- Arme : arc / dagues
- Rôle en groupe : −20 % sur les timers de déplacement de l'expédition, vision +1.

### 4.4 Le Chantre (soutien / communautaire)

Héritiers des Premiers Chantres, ils « chantent » aux Braises.

- Stats : FOR 4, ADR 4, VOL 7, VIT 6, FER 9
- Arme : masse-encensoir
- Rôle en groupe : régénération d'endurance +50 % au repos, ses contributions aux chantiers communautaires comptent ×1,25.

---

## 5. Arbres de compétences

Chaque classe possède **3 branches de 5 compétences** (15 par classe). On débloque un point de compétence par niveau pair + certains points via quêtes. Les rangs 4–5 d'une branche exigent des **Fragments de braise** (monnaie rare) en plus des points.

### 5.1 La Lame

**Branche Rempart (défense)**
1. Garde ferme — +10 % armure.
2. Provocation — en groupe, attire 70 % des attaques ennemies.
3. Mur de fer — bloque la première attaque de chaque combat.
4. Représailles — renvoie 20 % des dégâts bloqués.
5. Dernier bastion — survit à un coup fatal 1 fois par combat (1/24 h).

**Branche Fer (offense)**
1. Frappe lourde — attaque à 130 % des dégâts, cooldown 2 tours.
2. Fente — ignore 25 % de l'armure.
3. Tourbillon — frappe tous les ennemis à 70 %.
4. Brise-garde — réduit l'armure ennemie de 30 % (3 tours).
5. Exécution — +100 % de dégâts sous 25 % de PV ennemis.

**Branche Vétéran (utilitaire)**
1. Endurci — coût d'endurance des combats −20 %.
2. Porteur — +10 emplacements d'inventaire.
3. Instinct — détecte les embuscades (annule les malus de surprise).
4. Meneur — l'expédition gagne +5 % à toutes les stats.
5. Légende de Cendrelune — les PNJ marchands offrent −10 %.

### 5.2 L'Arcaniste

**Branche Cendrelumière (dégâts)** : Trait de cendre → Brasier → Nova ardente → Marque incandescente (cible +25 % dégâts subis) → Colonne de flamme (dégâts massifs, 1/combat).

**Branche Voile (contrôle)** : Voile aveuglant (précision ennemie −20 %) → Entrave de suie (l'ennemi passe 1 tour) → Miroir de brume (esquive +30 %, 2 tours) → Dissipation (retire les buffs ennemis) → Prison de verre (gèle un ennemi 2 tours, 1/combat).

**Branche Savant (utilitaire)** : Lecture des runes (fouilles +20 % de butin) → Cartographe (révèle 1 hex adjacent supplémentaire) → Alchimie (craft de potions) → Transmutation (convertit 10 matériaux communs en 1 rare, 1/6 h) → Œil des Archives (révèle les faiblesses des boss au raid).

### 5.3 L'Éclaireur

**Branche Traque (dégâts)** : Tir précis → Flèche barbelée (saignement 3 tours) → Double tir → Tir d'ancrage (immobilise) → Flèche de la lanterne (dégâts + révèle les invisibles).

**Branche Voyage (exploration)** : Pas léger (timers −10 %) → Longue-Vue (vision +1) → Pisteur (voit les POI non fouillés à 2 hex) → Passe-marais (annule les malus de terrain) → Chemins de traverse (téléportation vers tout autel visité, 1/12 h).

**Branche Ombre (utilitaire)** : Poche double (les pertes à la mort −50 %) → Embuscade (+40 % dégâts au 1er tour) → Évasion (fuite de combat sans pénalité) → Détrousseur (+15 % écus sur les Brumeux) → Fantôme de brume (traverse 1 hex de Brume niveau 3 sans surcoût, 1/6 h).

### 5.4 Le Chantre

**Branche Hymne (soutien)** : Chant vivifiant (soigne 15 % PV du groupe) → Cadence (le groupe gagne +10 % ADR) → Répons (ressuscite un allié à 30 % PV, 1/combat) → Hymne de fer (armure de groupe +20 %) → Chœur des Premiers (tous les cooldowns du groupe −1 tour).

**Branche Braise (communautaire)** : Offrande (contributions ×1,4) → Veilleur (repos aux autels 2× plus rapide) → Écho de la Flamme (les Braises régionales lui accordent 1 bénédiction/jour : +10 % à une stat 4 h) → Pèlerin (voit la progression exacte des chantiers et raids depuis n'importe où) → Rallumeur (lors du rallumage d'une Braise, gagne un titre + 5 Fragments).

**Branche Verbe (contrôle)** : Semonce (l'ennemi perd 10 % FOR) → Litanie (dégâts de VOL sur 3 tours) → Injonction (l'ennemi attaque son propre camp, 1/combat) → Sceau de cendre (l'ennemi ne peut plus fuir) → Verbe d'extinction (dégâts massifs ×2 contre les Gardiens, 1/raid).

---

## 6. Progression

- **XP** : combats, fouilles, quêtes, contributions communautaires. Courbe : `XP(niv) = 100 × niv^1.6`.
- **Niveau max Saison 1 : 25.**
- Chaque niveau : +2 points d'attributs à répartir ; chaque niveau pair : +1 point de compétence.
- **Rangs de renommée** (parallèles au niveau, gagnés en Marques de gloire) : Cendreux → Porteur d'étincelle → Veilleur → Flamme-née → Rallumeur. Débloquent des cosmétiques et le droit de vote sur les décisions de région (quel chantier prioriser).

---

## 7. Méthodologie de jeu (boucles)

### 7.1 Boucle courte (2–5 min, plusieurs fois par jour)

1. Ouvrir l'app (PWA) → notification « expédition arrivée » ou « endurance pleine ».
2. Résoudre : fouille, combat en 3–5 décisions, ou dépôt de ressources.
3. Relancer une action à timer (déplacement, repos, craft).

### 7.2 Boucle moyenne (session de 15–30 min, 1×/jour)

Planifier un itinéraire de plusieurs hexagones, enchaîner fouilles et combats jusqu'à épuisement de l'endurance, revenir à un autel, vendre/craft au bastion, contribuer au chantier régional.

### 7.3 Boucle longue (hebdomadaire, communautaire)

- **Chantiers de région** : livrer des ressources pour reconstruire pont, avant-poste, relais de lanterne (chacun débloque un service : raccourci, marchand avancé, réduction de Brume locale).
- **Raid de Gardien** (fenêtre de 48 h, déclenché quand le chantier « Sonner le Glas » est achevé) : chaque joueur lance des assauts individuels ; les dégâts se cumulent sur une barre de vie serveur. Paliers de riposte du boss à 75/50/25 % (événements de région : Brume +1 partout pendant 2 h, etc.).
- **Rallumage de la Braise** : cérémonie de 24 h après la chute du Gardien ; la région passe Brume −1, la suivante s'ouvre.

### 7.4 Endurance

- Jauge de 100. Régénération : 1 point / 6 min (pleine en 10 h) ; ×1,5 au repos à un autel ; ×2 au bastion.
- Impossible de descendre sous 0 : le jeu impose la planification, pas la privation de sommeil.

### 7.5 File d'actions

Un joueur peut **empiler jusqu'à 3 actions** (ex. : déplacement → fouille → déplacement). Style Ogame : on programme, le serveur exécute aux timestamps. Les compétences et objets « instantanés » restent utilisables à tout moment.

---

## 8. Coût des actions (référence)

| Action | Endurance | Timer | Notes |
|---|---|---|---|
| Déplacement | 3–12 (terrain) | 1–10 min (terrain × Brume) | file d'actions |
| Fouille de POI | 10 | 5 min | 1 fouille/POI/jour/joueur |
| Combat contre Brumeux | 15 | résolution immédiate (tours) | fuite possible |
| Repos à l'autel | — | 30 min | +75 endurance |
| Craft simple | 5 | 10 min | forge du bastion : 5 min |
| Craft avancé | 10 | 60 min | forge uniquement |
| Contribution chantier | 5 | instantané | + matériaux livrés sur place |
| Assaut de raid | 25 | 1/4 h max | pendant la fenêtre de 48 h |
| Expédition groupée (2–4 j.) | 20 | somme des déplacements −20 % | butin partagé, bonus de classes |
| Téléport vers le bastion | 0 | 60 min | objet « Pierre de Cendrelune », 1/24 h |

---

## 9. Économie & monnaies

### 9.1 Trois monnaies

| Monnaie | Obtention | Usage | Esprit |
|---|---|---|---|
| **Écus de cendre** | Brumeux, ventes, fouilles, relevés de carte | Équipement commun, consommables, réparations | flux quotidien |
| **Fragments de braise** | Boss, quêtes majeures, paliers communautaires | Compétences rang 4–5, équipement rare, reliques | progression longue |
| **Marques de gloire** | Classements hebdo (exploration, contributions, raids) | Cosmétiques, titres, droit de vote régional | prestige, jamais de puissance |

### 9.2 Matériaux (non-monnaie)

Bois d'ombre, minerai de suie, herbes de lande, cuir de Brumeux, verre de cendre, essence de brume (rare). Servent au craft et aux chantiers. **Poids d'inventaire limité** (30 + FOR emplacements) → choix de transport, rôle du Porteur.

### 9.3 Robinets & éviers (anti-inflation)

- Éviers principaux : réparations d'équipement (usure à chaque mort), consommables de raid, taxes de marché (5 % sur l'hôtel des ventes entre joueurs).
- L'hôtel des ventes du bastion est le seul lieu d'échange entre joueurs (pas d'échange direct → limite le RMT et les mules).

---
## 10. Quêtes

### 10.1 Types

1. **Quête principale** (par région) : chaîne narrative à embranchements, mène au raid du Gardien.
2. **Quêtes annexes** : histoires locales, débloquées en fouillant des POI ou en parlant aux PNJ de région.
3. **Quêtes communautaires** (chantiers) : objectifs de livraison/dégâts à l'échelle du serveur, barre de progression publique.
4. **Contrats quotidiens** : 3 tâches courtes tirées au sort (tuer X Brumeux, fouiller Y, livrer Z) → écus + un peu d'XP.

### 10.2 Arbre de quête principale — Région 1, « Les Landes de Vellebrune »

```
Q1 « Le premier pas dans la grisaille »
   Sortir du bastion, atteindre l'autel du Vieux Gué (3 hex).
   → apprend : déplacement, endurance, repos.
        │
Q2 « Le hameau qui n'existe plus »
   Fouiller les ruines de Vellebrune-la-Basse. Découverte : un
   journal de berger, dont les pages se réécrivent.
   → apprend : fouille, combat (1 Loup de suie).
        │
Q3 « Les moutons comptent leurs bergers »  ── EMBRANCHEMENT
   Rencontre de Petra la Bergère (PNJ), qui garde un troupeau
   de moutons... parfaitement normaux, au milieu de la Brume.
   ├─ A « Protéger le troupeau » (voie de la compassion)
   │    Défendre 3 vagues de Brumeux. Petra devient marchande
   │    de vivres à prix réduit pour le joueur.
   └─ B « Percer le secret » (voie de la vérité)
        Suivre Petra de nuit : les moutons sont des souvenirs
        qu'elle refuse de lâcher. Choix cruel : les disperser
        (+1 point de compétence) ou se taire (réputation +).
        │
Q4 « La cloche engloutie »
   Retrouver la cloche du village dans le Marais des Soupirs,
   affronter le Chevalier Vide (mini-boss solo, niv. 5).
   → récompense : arme de classe rang 2.
        │
Q5 « Sonner le Glas » ── QUÊTE COMMUNAUTAIRE
   Chantier : reconstruire le beffroi du Grand Cairn
   (serveur : 5 000 bois d'ombre, 3 000 minerai, 500 verre).
   Le son de la cloche force Maugrith à se manifester.
        │
Q6 « Le Berger de Brume » ── RAID 48 h
   Gardien Maugrith. Victoire → cérémonie de rallumage,
   ouverture de la Sylve d'Ombrecœur, 5 Fragments/participant.
```

### 10.3 Quêtes annexes de la région 1

- **« Les lettres mortes »** : livrer 4 lettres d'un facteur brumeux à des tombes précises → révèle un pan du lore de l'Extinction.
- **« Le braconnier de nulle part »** : traquer un Brumeux unique qui se déplace réellement sur la carte serveur (1 spawn/jour, premier arrivé).
- **« Cendres et bruyères »** : herboristerie pour Mira, introduit le craft de potions.
- **« Ce que le cairn a vu »** : puzzle de pierres runiques (mini-jeu de logique), récompense : compétence gratuite.

---

## 11. Boss & Gardiens de Brume

### Mécanique de raid commune

- Fenêtre de **48 h**, PV serveur = `40 000 × (nb joueurs actifs 7 j) × coef. région`.
- Assaut individuel : combat par tours contre une « projection » du Gardien (3–5 tours), les dégâts infligés sont soustraits des PV serveur. Coût : 25 endurance, max 1 assaut/4 h.
- **Paliers de riposte** à 75/50/25 % : événement de région pendant 2 h (Brume +1, spawn d'élites, autels éteints). Communication via bandeau global + WebSocket.
- Échec (48 h écoulées) : le Gardien régénère 30 %, nouveau chantier « Sonner le Glas » à −50 % de coût. On peut retenter.

### Les trois Gardiens de la Saison 1

**Maugrith, le Berger de Brume** (région 1) — Géant voûté au manteau de laine grise, suivi d'un troupeau d'ombres. Gimmick : à chaque assaut, 1 « mouton d'ombre » accompagne la projection ; le tuer d'abord réduit les dégâts de Maugrith de 40 %. Faiblesse (révélée par Œil des Archives) : la cloche — les joueurs ayant fini Q4 infligent +15 %.

**Sylvara, la Racine-Creuse** (région 2) — Arbre-mère éventré dont le cœur abrite une braise volée. Gimmick : elle *soigne* si on l'attaque au feu (résiste à la cendrelumière brute) ; il faut alterner types de dégâts, ce qui pousse aux expéditions multi-classes. Phase 25 % : elle déracine et change d'hexagone chaque 6 h (les joueurs doivent la re-localiser).

**Karn Volge, le Contremaître de Suie** (région 3) — Colosse de pierre et de chaînes, entouré d'ouvriers spectraux. Gimmick : une jauge de « Cadence » monte à chaque assaut raté du serveur ; à 10, il frappe le chantier régional (détruit des ressources livrées). Récompense : plans de forge avancée.

---

## 12. PNJ

### Bastion de Cendrelune

| PNJ | Rôle | Personnalité / accroche |
|---|---|---|
| **Intendante Mira** | Tableau de quêtes, contrats quotidiens | Ancienne quartier-maître, tient le bastion à la liste et au sifflet. « On ne meurt qu'une fois par jour, c'est le règlement. » |
| **Aldo Brasfer** | Forgeron : craft, réparations, améliorations | Bourru, sourd d'une oreille depuis l'Extinction. Paye en écus toute « ferraille de Brume ». |
| **Archiviste Ennor** | Compétences, lore, carte communautaire | Défend la théorie du Vol. Achète les relevés d'exploration. |
| **Chantre-Major Isolde** | Guildes (compagnies), cérémonies de rallumage | Solennelle, doute en secret de la théorie de la Dette qu'elle enseigne. |
| **Fenk** | Marchand ambulant, stock rotatif (24 h) | Colporte la théorie du Sommeil. Vend parfois des objets uniques... d'origine douteuse. |
| **Maîtresse Ossa** | Hôtel des ventes | Ne parle qu'en pourcentages. |

### Région 1 (exemples)

- **Petra la Bergère** : cœur de l'embranchement Q3, marchande de vivres si épargnée.
- **Le Facteur** : Brumeux pacifique, donne « Les lettres mortes ».
- **Vieux Cormac** : ermite du Marais des Soupirs, indices sur le Chevalier Vide.

---

## 13. Combat (résolution)

Combat **par tours, asynchrone, résolu côté serveur**. Le joueur choisit parmi 4 options par tour : Attaque, Compétence (2 slots équipés), Objet, Fuite.

Formules (base, à équilibrer en bêta) :

```
Dégâts physiques = (FOR × 2 + arme) × (1 − armure/(armure + 50)) × aléa(0.9–1.1)
Dégâts arcaniques = (VOL × 2 + focus) × (1 − résist/(résist + 50)) × aléa(0.9–1.1)
Initiative = ADR + d10        Esquive = ADR × 0.8 %        Critique = ADR × 0.5 %, ×1.5
PV = 30 + VIT × 8             Fuite = 50 % + (ADR joueur − ADR ennemi) × 3 %
Résistance à la Brume = FER × 1 % (réduit les malus de Brume 2+)
```

Un combat dure 3 à 6 tours. Sur mobile : 4 gros boutons, log de combat au-dessus, aucune contrainte de temps par tour (l'état est persisté ; on peut fermer l'app en plein combat).

---

## 14. Assets nécessaires

### 14.1 Interface (UI kit)

- Cadres/panneaux « bronze et cendre » (9-slice), boutons (3 états), jauges (PV, endurance, boss, chantier), bandeau d'événement serveur, tooltips, modales.
- Icônes système : ~30 (monnaies ×3, endurance, timer, sac, carte, épée, fuite, etc.).

### 14.2 Monde

- **Tuiles hexagonales** : 8 terrains × 4 niveaux de Brume = 32 variantes (ou 8 tuiles + 3 calques de brume superposables — recommandé).
- Marqueurs : POI (6 types), autel, braise (animée : 3 frames de pulsation), joueur, groupe, Gardien itinérant.
- Fond de carte parcheminé + vignettage de brume.

### 14.3 Personnages & créatures

- Portraits de classes : 4 classes × 2 présentations = 8 illustrations (buste).
- Portraits PNJ : 9 (6 bastion + 3 région 1).
- Brumeux région 1 : 5 (Loup de suie, Berger spectral, Chevalier Vide, Mouton d'ombre, Faucheur de bruyère) — illustration fixe + 2 frames optionnelles.
- Gardiens : 3 illustrations majeures (écran de raid).

### 14.4 Objets & compétences

- Icônes d'objets : ~60 (armes ×16, armures ×12, consommables ×12, matériaux ×12, quête ×8).
- Icônes de compétences : 60 (15 × 4 classes).

### 14.5 Audio (optionnel MVP)

- 2 ambiances (bastion, landes), 8 SFX (clic, combat ×3, fouille, level-up, cloche de raid, rallumage).

### 14.6 Sourcing

Style conseillé : illustration semi-peinte sombre, format carré pour toutes les icônes. Options : packs itch.io/Kenney/CraftPix pour tuiles et icônes + génération IA retouchée pour portraits et Gardiens (cohérence via prompt de style unique). Tout l'UI peut être fait en CSS/SVG (voir maquette) → le MVP est jouable avec ~40 assets seulement (tuiles, marqueurs, 8 portraits, icônes système).

---

## 15. Modèles de données (Drizzle ORM / PostgreSQL)

Schéma cœur du MVP. Conventions : timestamps en `timestamptz`, timers = colonne `ends_at` (le serveur ne « tick » pas les joueurs : tout est calculé à la lecture ou par un worker léger qui résout les actions échues).

```ts
import { pgTable, uuid, varchar, integer, bigint, boolean,
  timestamp, jsonb, text, pgEnum, primaryKey, index } from "drizzle-orm/pg-core";

// ——— Enums
export const classEnum = pgEnum("class", ["lame", "arcaniste", "eclaireur", "chantre"]);
export const terrainEnum = pgEnum("terrain",
  ["plaine", "foret", "colline", "marais", "ruines", "route", "gue", "autel"]);
export const actionEnum = pgEnum("action_type",
  ["move", "search", "rest", "craft", "raid_assault", "expedition_leg"]);
export const questStateEnum = pgEnum("quest_state", ["available", "active", "done", "failed"]);
export const rarityEnum = pgEnum("rarity", ["commun", "rare", "braise", "relique"]);

// ——— Comptes (Better-auth gère users/sessions ; on référence son user.id)

export const characters = pgTable("characters", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),      // ← better-auth
  name: varchar("name", { length: 24 }).notNull().unique(),
  class: classEnum("class").notNull(),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  // attributs
  for: integer("for").notNull(), adr: integer("adr").notNull(),
  vol: integer("vol").notNull(), vit: integer("vit").notNull(),
  fer: integer("fer").notNull(),
  attributePoints: integer("attribute_points").notNull().default(0),
  skillPoints: integer("skill_points").notNull().default(0),
  // vitals — l'endurance est stockée en (valeur, date) et recalculée à la lecture
  hp: integer("hp").notNull(),
  stamina: integer("stamina").notNull().default(100),
  staminaUpdatedAt: timestamp("stamina_updated_at", { withTimezone: true }).notNull().defaultNow(),
  deathPenaltyUntil: timestamp("death_penalty_until", { withTimezone: true }),
  // position
  hexId: uuid("hex_id").notNull().references(() => hexes.id),
  // monnaies
  ecus: integer("ecus").notNull().default(0),
  fragments: integer("fragments").notNull().default(0),
  marques: integer("marques").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const regions = pgTable("regions", {
  id: integer("id").primaryKey(),                   // 0 = bastion
  name: varchar("name", { length: 64 }).notNull(),
  unlocked: boolean("unlocked").notNull().default(false),
  mistLevel: integer("mist_level").notNull().default(3),
  braiseLit: boolean("braise_lit").notNull().default(false),
});

export const hexes = pgTable("hexes", {
  id: uuid("id").defaultRandom().primaryKey(),
  regionId: integer("region_id").notNull().references(() => regions.id),
  q: integer("q").notNull(), r: integer("r").notNull(),   // coordonnées axiales
  terrain: terrainEnum("terrain").notNull(),
  mistDelta: integer("mist_delta").notNull().default(0),  // écart local vs région
  poiType: varchar("poi_type", { length: 24 }),           // null = pas de POI
  poiData: jsonb("poi_data"),
}, (t) => [index("hex_coord_idx").on(t.regionId, t.q, t.r)]);

// hexagones découverts par personnage (brouillard de guerre)
export const discoveries = pgTable("discoveries", {
  characterId: uuid("character_id").notNull().references(() => characters.id),
  hexId: uuid("hex_id").notNull().references(() => hexes.id),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  sharedToArchive: boolean("shared").notNull().default(false),
}, (t) => [primaryKey({ columns: [t.characterId, t.hexId] })]);

// file d'actions (max 3 par perso, contrainte applicative)
export const actionQueue = pgTable("action_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id").notNull().references(() => characters.id),
  type: actionEnum("type").notNull(),
  payload: jsonb("payload").notNull(),              // { targetHexId, ... }
  position: integer("position").notNull(),          // 0..2
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  resolved: boolean("resolved").notNull().default(false),
}, (t) => [index("aq_due_idx").on(t.resolved, t.endsAt)]);

// ——— Compétences & objets
export const skills = pgTable("skills", {
  id: varchar("id", { length: 40 }).primaryKey(),   // "lame.rempart.3"
  class: classEnum("class").notNull(),
  branch: varchar("branch", { length: 20 }).notNull(),
  tier: integer("tier").notNull(),                  // 1..5
  name: varchar("name", { length: 48 }).notNull(),
  effect: jsonb("effect").notNull(),
  fragmentCost: integer("fragment_cost").notNull().default(0),
});

export const characterSkills = pgTable("character_skills", {
  characterId: uuid("character_id").notNull().references(() => characters.id),
  skillId: varchar("skill_id", { length: 40 }).notNull().references(() => skills.id),
  equippedSlot: integer("equipped_slot"),           // null | 1 | 2
}, (t) => [primaryKey({ columns: [t.characterId, t.skillId] })]);

export const items = pgTable("items", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  kind: varchar("kind", { length: 20 }).notNull(),  // arme|armure|conso|materiau|quete
  rarity: rarityEnum("rarity").notNull().default("commun"),
  stats: jsonb("stats"),
  stackable: boolean("stackable").notNull().default(false),
});

export const inventory = pgTable("inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id").notNull().references(() => characters.id),
  itemId: varchar("item_id", { length: 40 }).notNull().references(() => items.id),
  qty: integer("qty").notNull().default(1),
  equipped: boolean("equipped").notNull().default(false),
  durability: integer("durability"),
}, (t) => [index("inv_char_idx").on(t.characterId)]);

// ——— Quêtes
export const quests = pgTable("quests", {
  id: varchar("id", { length: 40 }).primaryKey(),   // "r1.main.q3"
  regionId: integer("region_id").notNull().references(() => regions.id),
  kind: varchar("kind", { length: 16 }).notNull(),  // main|side|daily
  name: varchar("name", { length: 80 }).notNull(),
  steps: jsonb("steps").notNull(),                  // graphe d'étapes + embranchements
  rewards: jsonb("rewards").notNull(),
  requires: jsonb("requires"),                      // prérequis (quête, niveau)
});

export const characterQuests = pgTable("character_quests", {
  characterId: uuid("character_id").notNull().references(() => characters.id),
  questId: varchar("quest_id", { length: 40 }).notNull().references(() => quests.id),
  state: questStateEnum("state").notNull().default("active"),
  stepId: varchar("step_id", { length: 24 }).notNull(),
  progress: jsonb("progress"),                      // compteurs, choix d'embranchement
}, (t) => [primaryKey({ columns: [t.characterId, t.questId] })]);

// ——— Communautaire : chantiers & raids
export const projects = pgTable("projects", {
  id: varchar("id", { length: 40 }).primaryKey(),   // "r1.beffroi"
  regionId: integer("region_id").notNull().references(() => regions.id),
  name: varchar("name", { length: 80 }).notNull(),
  goals: jsonb("goals").notNull(),                  // { bois: 5000, minerai: 3000 }
  progress: jsonb("progress").notNull().default({}),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const contributions = pgTable("contributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: varchar("project_id", { length: 40 }).notNull().references(() => projects.id),
  characterId: uuid("character_id").notNull().references(() => characters.id),
  resource: varchar("resource", { length: 24 }).notNull(),
  qty: integer("qty").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("contrib_proj_idx").on(t.projectId)]);

export const raids = pgTable("raids", {
  id: uuid("id").defaultRandom().primaryKey(),
  regionId: integer("region_id").notNull().references(() => regions.id),
  bossId: varchar("boss_id", { length: 40 }).notNull(),
  hpMax: bigint("hp_max", { mode: "number" }).notNull(),
  hpCurrent: bigint("hp_current", { mode: "number" }).notNull(),
  opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
  closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 12 }).notNull().default("open"), // open|won|failed
});

export const raidAssaults = pgTable("raid_assaults", {
  id: uuid("id").defaultRandom().primaryKey(),
  raidId: uuid("raid_id").notNull().references(() => raids.id),
  characterId: uuid("character_id").notNull().references(() => characters.id),
  damage: integer("damage").notNull(),
  log: jsonb("log").notNull(),                      // replay du combat
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("assault_raid_idx").on(t.raidId, t.characterId)]);

// ——— Social
export const companies = pgTable("companies", {    // guildes
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 32 }).notNull().unique(),
  leaderId: uuid("leader_id").notNull().references(() => characters.id),
  charter: text("charter"),
});

export const companyMembers = pgTable("company_members", {
  companyId: uuid("company_id").notNull().references(() => companies.id),
  characterId: uuid("character_id").notNull().references(() => characters.id).unique(),
  role: varchar("role", { length: 12 }).notNull().default("membre"),
}, (t) => [primaryKey({ columns: [t.companyId, t.characterId] })]);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  channel: varchar("channel", { length: 24 }).notNull(), // global|region:1|company:uuid
  characterId: uuid("character_id").notNull().references(() => characters.id),
  body: varchar("body", { length: 500 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("chat_chan_idx").on(t.channel, t.createdAt)]);
```

**Principes clés du modèle :**

- **Aucun tick par joueur.** L'endurance est `(valeur, date)` → recalcul à la lecture. Les actions ont un `ends_at` ; un worker (BullMQ ou simple `setInterval` + requête sur `aq_due_idx`) résout celles qui sont échues, et toute lecture de l'état d'un perso résout d'abord ses actions dues (résolution paresseuse = robuste même si le worker tombe).
- **Le serveur fait autorité sur tout** : le client n'envoie que des intentions (`POST /actions { type, target }`), le serveur valide coûts, adjacence, prérequis.
- **JSONB pour le contenu, colonnes pour le requêtable** : effets de compétences, étapes de quêtes et logs de combat en JSONB versionné ; tout ce qui sert au matchmaking/classement en colonnes indexées.

---

## 16. Architecture & temps réel (brief)

```
Client PWA (React + SVG hexmap)
   │  HTTPS  → Fastify (REST : intentions, lectures)
   │  WSS    → Fastify websocket (événements)
   ▼
PostgreSQL (Drizzle) ── worker de résolution (actions échues, fenêtres de raid)
```

- **WebSocket, 4 canaux** : `global` (bandeaux serveur, paliers de boss), `region:{id}` (chat + événements), `company:{id}`, `character:{id}` (résolutions personnelles → notification push via service worker).
- **PWA** : manifest + service worker → installation sur mobile, notifications push (« Expédition arrivée », « Le Gardien riposte ! »), cache des assets. C'est le vecteur mobile ; pas d'app store nécessaire au MVP.
- **Anti-triche de base** : rate-limit par route, validation Zod de toutes les intentions, résolution 100 % serveur, logs d'assauts rejouables.

---

## 17. Roadmap MVP

| Jalon | Contenu | Critère de sortie |
|---|---|---|
| **M1 — Marcher** (3–4 sem.) | Auth, création de perso, carte région 0+1, déplacement à timers, endurance, brouillard de guerre | 5 testeurs traversent les Landes sur mobile |
| **M2 — Se battre** (3 sem.) | Combat par tours, Brumeux, fouilles, inventaire, mort/respawn | Q1→Q4 jouables en solo |
| **M3 — Ensemble** (3 sem.) | Chat WS, chantier communautaire, contributions, hôtel des ventes | Q5 achevée par ≥10 joueurs |
| **M4 — Le Gardien** (2–3 sem.) | Raid 48 h, paliers, cérémonie de rallumage, ouverture région 2 | Premier Maugrith tombe |
| **M5 — Rétention** | Contrats quotidiens, compagnies, classements/Marques, PWA push | rétention J7 mesurable |

---

*Fin du document. Version 1.0 — base de travail à équilibrer en bêta.*
