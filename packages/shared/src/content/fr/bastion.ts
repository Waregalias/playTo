/** Bastion building display names & descriptions (GLOSSARY §Bâtiments du Bastion). */
export type BuildingId =
  | 'building.forge'
  | 'building.archives'
  | 'building.board'
  | 'building.sanctum'
  | 'building.belfry'
  | 'building.market';

export const BUILDINGS_FR: Record<BuildingId, { name: string; description: string }> = {
  'building.board': {
    name: 'Tableau de Mira',
    description: 'Consulte les quêtes et les missions en cours.',
  },
  'building.market': {
    name: 'L’Hôtel des ventes',
    description: 'Échange avec les autres Ravivés.',
  },
  'building.forge': {
    name: 'Forge de Brasfer',
    description: 'Livre tes matériaux au chantier commun.',
  },
  'building.archives': {
    name: 'Archives d’Ennor',
    description: 'Découvre l’histoire d’Aldenfer et les secrets de la Brume.',
  },
  'building.sanctum': {
    name: 'Chantre-Major Isolde',
    description: 'Reçois bénédictions et quêtes sacrées.',
  },
  'building.belfry': {
    name: 'Le beffroi du Grand Cairn',
    description: 'Prépare-toi aux raids et affronte les Gardiens.',
  },
};
