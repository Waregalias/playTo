# GLOSSARY.md — Domaine FR ↔ code EN

Le code (identifiants, tables, routes, enums, fichiers) est **entièrement en anglais**. Le français n'existe que dans la couche contenu (i18n, textes de quêtes, dialogues). Ce glossaire est la table de correspondance officielle — toute nouvelle notion doit y être ajoutée avant d'entrer dans le code.

## Concepts fondamentaux

| Français (affichage) | Anglais (code) | Notes |
|---|---|---|
| La Flamme Primordiale | Primordial Flame | lore uniquement |
| La Brume | Mist | `mistLevel`, `mist_delta` |
| Braise | Ember | `emberLit`, région/objectif |
| Brumeux (créatures) | Mistborn | type d'ennemi `mistborn` |
| Ravivé (joueur) | Rekindled | lore ; en code : `character` |
| Flammèche | Spark | lore de l'endurance |
| Endurance | Stamina | `stamina`, coût `staminaCost` |
| Gardien de Brume | Mist Warden | `warden`, `wardenId` |
| Bastion de Cendrelune | Cinderlune Bastion | région 0, slug `cinderlune` |
| Chantier communautaire | Community project | table `projects` |
| Cérémonie de rallumage | Rekindling ceremony | événement `rekindling` |
| Expédition (groupe) | Expedition | |
| Compagnie (guilde) | Company | table `companies` |
| Hôtel des ventes | Auction house | routes `market/*` |
| Autel | Shrine | terrain `shrine`, repos |
| Point d'intérêt | POI | `poiType` |
| Fouille | Search | action `search` |
| Brouillard de guerre | Fog of war | table `discoveries` |
| File d'actions | Action queue | table `action_queue` |
| Contrat quotidien | Daily contract | `daily_contracts` |
| Contribution (chantier) | Contribution | table `contributions` |
| Annonce (marché) | Listing | table `market_listings` |
| Canal (chat) | Channel | `chat_messages.channel` |
| Compétence | Skill | ids `{class}.{branch}.{tier}` |
| Palier (de compétence) | Tier | |
| Durabilité | Durability | `durability` / `maxDurability` |
| Réparation | Repair | route `inventory/repair` |

## Monnaies & ressources

| Français | Anglais (code) | Glyphe UI |
|---|---|---|
| Écus de cendre | `ashCrowns` | ◉ |
| Fragments de braise | `emberFragments` | ✦ |
| Marques de gloire | `gloryMarks` | ⚑ |
| Bois d'ombre | `shadewood` | |
| Minerai de suie | `sootOre` | |
| Herbes de lande | `moorHerbs` | |
| Cuir de Brumeux | `mistbornHide` | |
| Verre de cendre | `ashGlass` | |
| Essence de brume | `mistEssence` | rare |

## Classes & attributs

| Français | Anglais (code) |
|---|---|
| La Lame | `blade` |
| L'Arcaniste | `arcanist` |
| L'Éclaireur | `scout` |
| Le Chantre | `cantor` |
| Force (FOR) | `str` |
| Adresse (ADR) | `dex` |
| Volonté (VOL) | `wil` |
| Vitalité (VIT) | `vit` |
| Ferveur (FER) | `fer` (fervor) |

## Branches de compétences

| Classe | FR | EN (code) |
|---|---|---|
| blade | Rempart / Fer / Vétéran | `bulwark` / `steel` / `veteran` |
| arcanist | Cendrelumière / Voile / Savant | `ashlight` / `veil` / `scholar` |
| scout | Traque / Voyage / Ombre | `hunt` / `travel` / `shadow` |
| cantor | Hymne / Braise / Verbe | `hymn` / `ember` / `verse` |

Identifiants de compétence : `{class}.{branch}.{tier}` → `blade.bulwark.3`.

## Terrains

| FR | EN (enum `terrain`) |
|---|---|
| Plaine | `plain` |
| Forêt | `forest` |
| Colline | `hill` |
| Marais | `marsh` |
| Ruines | `ruins` |
| Route de cendre | `ash_road` |
| Gué | `ford` |
| Autel | `shrine` |

## Régions & Gardiens (Saison 1)

| ID | FR | Slug code | Gardien |
|---|---|---|---|
| 0 | Bastion de Cendrelune | `cinderlune` | — |
| 1 | Les Landes de Vellebrune | `vellebrune-moors` | Maugrith (`maugrith`) |
| 2 | La Sylve d'Ombrecœur | `shadeheart-wood` | Sylvara (`sylvara`) |
| 3 | Les Carrières de Halvenn | `halvenn-quarries` | Karn Volge (`karn-volge`) |

Les noms propres (Maugrith, Cendrelune, Vellebrune…) ne se traduisent pas ; seuls les noms communs le sont.

## PNJ (région 0)

| FR | ID code |
|---|---|
| Intendante Mira | `npc.mira` |
| Aldo Brasfer | `npc.brasfer` |
| Archiviste Ennor | `npc.ennor` |
| Chantre-Major Isolde | `npc.isolde` |
| Fenk | `npc.fenk` |
| Maîtresse Ossa | `npc.ossa` |

## Rangs de renommée

Cendreux `ashen` → Porteur d'étincelle `sparkbearer` → Veilleur `watcher` → Flamme-née `flameborn` → Rallumeur `rekindler`.
