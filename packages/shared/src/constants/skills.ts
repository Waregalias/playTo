import type { CharacterClass } from './classes.js';

/** The 12 branch codes (GLOSSARY §Branches de compétences). */
export type SkillBranch =
  | 'bulwark'
  | 'steel'
  | 'veteran'
  | 'ashlight'
  | 'veil'
  | 'scholar'
  | 'hunt'
  | 'travel'
  | 'shadow'
  | 'hymn'
  | 'ember'
  | 'verse';

export type SkillTier = 1 | 2 | 3 | 4 | 5;

/**
 * Flat aggregate of the passive skill effects wired in M3 (SPEC-M3 compatibility table).
 * Numeric fields add across learned skills; `contributionMult` multiplies (base 1); booleans OR.
 */
export interface SkillModifiers {
  armorPct: number; // +% armour (Garde ferme)
  dodgePct: number; // +% dodge
  searchLootPct: number; // +% search loot (Lecture des runes)
  moveTimerPct: number; // −% move timer, stored positive (Pas léger)
  visionBonus: number; // +hex vision radius (Longue-Vue, Cartographe)
  inventoryBonus: number; // +inventory slots (Porteur)
  deathMaterialLossPct: number; // −% material loss on death, positive (Poche double)
  contributionMult: number; // ×contribution credit (Offrande) — default 1
  firstTurnDmgPct: number; // +% damage on turn 1 (Embuscade)
  foeAshCrownsPct: number; // +% ash crowns from foes (Détrousseur)
  blockFirstAttack: boolean; // Mur de fer
  fleeNoPenalty: boolean; // Évasion
}

/** Combat parameters of an active skill (consumed by the combat service). */
export interface ActiveSkillParams {
  multiplier?: number; // damage vs class attack score
  cooldown: number; // turns
  damageKind?: 'physical' | 'arcane';
  ignoreArmorPct?: number; // Fente
  bleedTurns?: number; // Flèche barbelée, Litanie
}

export interface SkillDef {
  id: string;
  class: CharacterClass;
  branch: SkillBranch;
  tier: SkillTier;
  kind: 'active' | 'passive';
  /** Effect applied this milestone (SPEC-M3). Inert skills are learnable but not equippable. */
  wiredInM3: boolean;
  /** emberFragments cost — 0 for tiers 1–3, >0 for 4–5 (GDD §9.1). */
  fragmentCost: number;
  /** Passive contribution to SkillModifiers (absent on active skills). */
  modifiers?: Partial<SkillModifiers>;
  /** Combat params (present iff kind === 'active'). */
  active?: ActiveSkillParams;
}

export const EMPTY_MODIFIERS: SkillModifiers = {
  armorPct: 0,
  dodgePct: 0,
  searchLootPct: 0,
  moveTimerPct: 0,
  visionBonus: 0,
  inventoryBonus: 0,
  deathMaterialLossPct: 0,
  contributionMult: 1,
  firstTurnDmgPct: 0,
  foeAshCrownsPct: 0,
  blockFirstAttack: false,
  fleeNoPenalty: false,
};

const fragmentCostFor = (tier: SkillTier): number => (tier === 4 ? 1 : tier === 5 ? 2 : 0);

const passive = (
  cls: CharacterClass,
  branch: SkillBranch,
  tier: SkillTier,
  wiredInM3: boolean,
  modifiers?: Partial<SkillModifiers>,
): SkillDef => ({
  id: `${cls}.${branch}.${tier}`,
  class: cls,
  branch,
  tier,
  kind: 'passive',
  wiredInM3,
  fragmentCost: fragmentCostFor(tier),
  ...(modifiers ? { modifiers } : {}),
});

const active = (
  cls: CharacterClass,
  branch: SkillBranch,
  tier: SkillTier,
  wiredInM3: boolean,
  params: ActiveSkillParams,
): SkillDef => ({
  id: `${cls}.${branch}.${tier}`,
  class: cls,
  branch,
  tier,
  kind: 'active',
  wiredInM3,
  fragmentCost: fragmentCostFor(tier),
  active: params,
});

/**
 * The 60 skills of Season 1 (GDD §5.1–5.4). Effects are wired this milestone only when the
 * system they touch already exists (combat / search / movement / vision / inventory / death /
 * contribution); group, raid, craft, teleport and merchant effects are defined but inert.
 */
export const SKILLS: readonly SkillDef[] = [
  // ── La Lame (§5.1) ──
  // Rempart (bulwark) — defence, passive
  passive('blade', 'bulwark', 1, true, { armorPct: 10 }), // Garde ferme
  passive('blade', 'bulwark', 2, false), // Provocation (group)
  passive('blade', 'bulwark', 3, true, { blockFirstAttack: true }), // Mur de fer
  passive('blade', 'bulwark', 4, false), // Représailles (reflect — not modelled)
  passive('blade', 'bulwark', 5, false), // Dernier bastion (fatal-save — not modelled)
  // Fer (steel) — offence, active
  active('blade', 'steel', 1, true, { multiplier: 1.3, cooldown: 2, damageKind: 'physical' }), // Frappe lourde
  active('blade', 'steel', 2, true, {
    multiplier: 1,
    cooldown: 1,
    damageKind: 'physical',
    ignoreArmorPct: 25,
  }), // Fente
  active('blade', 'steel', 3, false, { multiplier: 0.7, cooldown: 2, damageKind: 'physical' }), // Tourbillon (AoE)
  active('blade', 'steel', 4, false, { multiplier: 1, cooldown: 2, damageKind: 'physical' }), // Brise-garde (debuff)
  active('blade', 'steel', 5, false, { multiplier: 2, cooldown: 3, damageKind: 'physical' }), // Exécution (conditional)
  // Vétéran (veteran) — utility, passive
  passive('blade', 'veteran', 1, false), // Endurci (stamina cost — no field yet)
  passive('blade', 'veteran', 2, true, { inventoryBonus: 10 }), // Porteur
  passive('blade', 'veteran', 3, false), // Instinct (surprise — not modelled)
  passive('blade', 'veteran', 4, false), // Meneur (expedition)
  passive('blade', 'veteran', 5, false), // Légende de Cendrelune (merchant)

  // ── L'Arcaniste (§5.2) ──
  // Cendrelumière (ashlight) — damage, active
  active('arcanist', 'ashlight', 1, true, { multiplier: 1.3, cooldown: 2, damageKind: 'arcane' }), // Trait de cendre
  active('arcanist', 'ashlight', 2, true, { multiplier: 1.5, cooldown: 2, damageKind: 'arcane' }), // Brasier
  active('arcanist', 'ashlight', 3, true, { multiplier: 1.8, cooldown: 3, damageKind: 'arcane' }), // Nova ardente
  active('arcanist', 'ashlight', 4, false, { multiplier: 1, cooldown: 2, damageKind: 'arcane' }), // Marque incandescente (debuff)
  active('arcanist', 'ashlight', 5, true, { multiplier: 2.5, cooldown: 4, damageKind: 'arcane' }), // Colonne de flamme
  // Voile (veil) — control, active
  active('arcanist', 'veil', 1, false, { multiplier: 0, cooldown: 2, damageKind: 'arcane' }), // Voile aveuglant
  active('arcanist', 'veil', 2, false, { multiplier: 0, cooldown: 2, damageKind: 'arcane' }), // Entrave de suie
  active('arcanist', 'veil', 3, false, { multiplier: 0, cooldown: 2, damageKind: 'arcane' }), // Miroir de brume
  active('arcanist', 'veil', 4, false, { multiplier: 0, cooldown: 2, damageKind: 'arcane' }), // Dissipation
  active('arcanist', 'veil', 5, false, { multiplier: 0, cooldown: 3, damageKind: 'arcane' }), // Prison de verre
  // Savant (scholar) — utility, passive
  passive('arcanist', 'scholar', 1, true, { searchLootPct: 20 }), // Lecture des runes
  passive('arcanist', 'scholar', 2, true, { visionBonus: 1 }), // Cartographe
  passive('arcanist', 'scholar', 3, false), // Alchimie (craft)
  passive('arcanist', 'scholar', 4, false), // Transmutation (craft)
  passive('arcanist', 'scholar', 5, false), // Œil des Archives (raid)

  // ── L'Éclaireur (§5.3) ──
  // Traque (hunt) — damage, active
  active('scout', 'hunt', 1, true, { multiplier: 1.3, cooldown: 2, damageKind: 'physical' }), // Tir précis
  active('scout', 'hunt', 2, true, {
    multiplier: 1,
    cooldown: 2,
    damageKind: 'physical',
    bleedTurns: 3,
  }), // Flèche barbelée
  active('scout', 'hunt', 3, true, { multiplier: 1.6, cooldown: 2, damageKind: 'physical' }), // Double tir
  active('scout', 'hunt', 4, false, { multiplier: 1, cooldown: 2, damageKind: 'physical' }), // Tir d'ancrage (immobilise)
  active('scout', 'hunt', 5, true, { multiplier: 1.8, cooldown: 3, damageKind: 'physical' }), // Flèche de la lanterne
  // Voyage (travel) — exploration, passive
  passive('scout', 'travel', 1, true, { moveTimerPct: 10 }), // Pas léger
  passive('scout', 'travel', 2, true, { visionBonus: 1 }), // Longue-Vue
  passive('scout', 'travel', 3, false), // Pisteur (POI reveal — not modelled)
  passive('scout', 'travel', 4, false), // Passe-marais (terrain malus — not modelled)
  passive('scout', 'travel', 5, false), // Chemins de traverse (teleport)
  // Ombre (shadow) — utility, passive
  passive('scout', 'shadow', 1, true, { deathMaterialLossPct: 50 }), // Poche double
  passive('scout', 'shadow', 2, true, { firstTurnDmgPct: 40 }), // Embuscade
  passive('scout', 'shadow', 3, true, { fleeNoPenalty: true }), // Évasion
  passive('scout', 'shadow', 4, true, { foeAshCrownsPct: 15 }), // Détrousseur
  passive('scout', 'shadow', 5, false), // Fantôme de brume (mist crossing)

  // ── Le Chantre (§5.4) ──
  // Hymne (hymn) — support, active (group — inert in M3)
  active('cantor', 'hymn', 1, false, { multiplier: 0, cooldown: 2 }), // Chant vivifiant
  active('cantor', 'hymn', 2, false, { multiplier: 0, cooldown: 2 }), // Cadence
  active('cantor', 'hymn', 3, false, { multiplier: 0, cooldown: 2 }), // Répons
  active('cantor', 'hymn', 4, false, { multiplier: 0, cooldown: 2 }), // Hymne de fer
  active('cantor', 'hymn', 5, false, { multiplier: 0, cooldown: 3 }), // Chœur des Premiers
  // Braise (ember) — community, passive
  passive('cantor', 'ember', 1, true, { contributionMult: 1.4 }), // Offrande
  passive('cantor', 'ember', 2, false), // Veilleur (rest speed — not modelled)
  passive('cantor', 'ember', 3, false), // Écho de la Flamme (blessing)
  passive('cantor', 'ember', 4, false), // Pèlerin (remote progress)
  passive('cantor', 'ember', 5, false), // Rallumeur (rekindle title)
  // Verbe (verse) — control, active
  active('cantor', 'verse', 1, false, { multiplier: 0, cooldown: 1, damageKind: 'arcane' }), // Semonce
  active('cantor', 'verse', 2, true, {
    multiplier: 1.3,
    cooldown: 2,
    damageKind: 'arcane',
    bleedTurns: 3,
  }), // Litanie (M2 cantor starter)
  active('cantor', 'verse', 3, false, { multiplier: 0, cooldown: 3, damageKind: 'arcane' }), // Injonction
  active('cantor', 'verse', 4, false, { multiplier: 0, cooldown: 3, damageKind: 'arcane' }), // Sceau de cendre
  active('cantor', 'verse', 5, false, { multiplier: 2, cooldown: 4, damageKind: 'arcane' }), // Verbe d'extinction (raid)
];

export const SKILLS_BY_ID: Record<string, SkillDef> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s]),
);

export function getSkill(id: string): SkillDef | undefined {
  return SKILLS_BY_ID[id];
}
