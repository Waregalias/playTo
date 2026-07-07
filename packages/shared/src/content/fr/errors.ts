import type { ErrorCode } from '../../schemas/error.js';

/**
 * French, player-facing error messages (API-SPEC §2, DESIGN §6).
 * Cause + remedy, lore voice, tutoiement — never vague, never apologetic.
 */
export const ERROR_MESSAGES_FR: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Ta demande est mal formée — vérifie les champs indiqués.',
  UNAUTHENTICATED: 'Ta session s’est éteinte. Reconnecte-toi au bastion.',
  FORBIDDEN: 'Ce lieu ne t’est pas ouvert.',
  NOT_FOUND: 'Rien de tel dans les registres du bastion.',
  RATE_LIMITED: 'Doucement, Ravivé — laisse ta flammèche reprendre son souffle.',
  INSUFFICIENT_STAMINA: 'Ta flammèche est trop faible — repose-toi.',
  QUEUE_FULL: 'Trois actions déjà prévues : termine ou annule avant d’en empiler une autre.',
  NOT_ADJACENT: 'Trop loin : avance de case en case, la Brume n’offre pas de raccourci.',
  HEX_LOCKED: 'La Brume verrouille encore cette région. Rallume d’abord sa Braise.',
  POI_ALREADY_SEARCHED: 'Tu as déjà fouillé ce lieu aujourd’hui — reviens demain.',
  ASSAULT_COOLDOWN: 'Ton prochain assaut n’est pas prêt. Reprends des forces.',
  RAID_CLOSED: 'La fenêtre du raid est refermée.',
  INSUFFICIENT_FUNDS: 'Ta bourse est trop légère pour cela.',
  INVENTORY_FULL: 'Ton sac déborde — vends, dépose ou abandonne quelque chose.',
  REQUIREMENT_NOT_MET: 'Il te manque un prérequis pour cela.',
  DEATH_PENALTY_ACTIVE: 'Ta flammèche vacille encore — attends qu’elle se raffermisse.',
  COMBAT_ALREADY_ACTIVE: 'Un combat t’attend déjà. Termine-le d’abord.',
  NAME_TAKEN: 'Un Ravivé porte déjà ce nom. Choisis-en un autre.',
  CHARACTER_EXISTS: 'Ta flammèche anime déjà un Ravivé — un seul par compte.',
  NOT_ON_SHRINE: 'Aucun feu ici où se reposer. Rejoins un autel.',
  ACTION_ALREADY_STARTED: 'Cette action est déjà en cours — on n’arrête pas un pas engagé.',
  NOT_ON_POI: 'Rien à fouiller ici — cherche un lieu marqué sur la carte.',
  NO_ACTIVE_COMBAT: 'Aucun Brumeux ne te fait face.',
  INSUFFICIENT_MATERIALS: 'Il te manque des matériaux pour cela.',
  SKILL_ALREADY_LEARNED: 'Tu maîtrises déjà cette compétence.',
  CANNOT_BUY_OWN_LISTING: 'Tu ne peux pas acheter ta propre annonce.',
  LISTING_UNAVAILABLE: 'Cette annonce n’est plus disponible.',
  PROJECT_COMPLETED: 'Ce chantier est déjà achevé.',
  NOTHING_TO_REPAIR: 'Cet équipement est déjà en parfait état.',
};
