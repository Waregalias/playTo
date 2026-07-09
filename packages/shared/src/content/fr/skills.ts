/**
 * French skill names & one-line descriptions (GDD §5, DESIGN §6 voice, tutoiement).
 * Keyed by skill id `{class}.{branch}.{tier}` — one entry per skill in SKILLS.
 */
export const SKILL_CONTENT_FR: Record<string, { name: string; description: string }> = {
  // ── La Lame — Rempart ──
  'blade.bulwark.1': { name: 'Garde ferme', description: 'Ton armure gagne 10 %. Tiens bon.' },
  'blade.bulwark.2': {
    name: 'Provocation',
    description: 'En groupe, tu attires 70 % des coups ennemis sur toi.',
  },
  'blade.bulwark.3': {
    name: 'Mur de fer',
    description: 'Tu bloques la première attaque de chaque combat.',
  },
  'blade.bulwark.4': {
    name: 'Représailles',
    description: 'Tu renvoies 20 % des dégâts que tu bloques.',
  },
  'blade.bulwark.5': {
    name: 'Dernier bastion',
    description: 'Une fois par combat, tu survis à un coup fatal (1 fois par jour).',
  },
  // ── La Lame — Fer ──
  'blade.steel.1': {
    name: 'Frappe lourde',
    description: 'Un coup à 130 % des dégâts. Recharge : 2 tours.',
  },
  'blade.steel.2': { name: 'Fente', description: 'Ta lame ignore 25 % de l’armure adverse.' },
  'blade.steel.3': {
    name: 'Tourbillon',
    description: 'Tu frappes tous les ennemis à 70 % des dégâts.',
  },
  'blade.steel.4': {
    name: 'Brise-garde',
    description: 'Tu réduis l’armure ennemie de 30 % pendant 3 tours.',
  },
  'blade.steel.5': {
    name: 'Exécution',
    description: '+100 % de dégâts contre un ennemi sous 25 % de ses PV.',
  },
  // ── La Lame — Vétéran ──
  'blade.veteran.1': {
    name: 'Endurci',
    description: 'Tes combats coûtent 20 % d’endurance en moins.',
  },
  'blade.veteran.2': {
    name: 'Porteur',
    description: 'Ton sac gagne 10 emplacements. Charge à toi de bien répartir.',
  },
  'blade.veteran.3': {
    name: 'Instinct',
    description: 'Tu flaires les embuscades : plus de malus de surprise.',
  },
  'blade.veteran.4': {
    name: 'Meneur',
    description: 'Ton expédition gagne +5 % à toutes ses stats.',
  },
  'blade.veteran.5': {
    name: 'Légende de Cendrelune',
    description: 'Les marchands t’accordent 10 % de remise.',
  },

  // ── L'Arcaniste — Cendrelumière ──
  'arcanist.ashlight.1': {
    name: 'Trait de cendre',
    description: 'Un trait ardent à 130 % des dégâts. Recharge : 2 tours.',
  },
  'arcanist.ashlight.2': {
    name: 'Brasier',
    description: 'Tu embrases l’ennemi pour 150 % des dégâts.',
  },
  'arcanist.ashlight.3': {
    name: 'Nova ardente',
    description: 'Une déflagration à 180 % des dégâts.',
  },
  'arcanist.ashlight.4': {
    name: 'Marque incandescente',
    description: 'La cible marquée subit +25 % de dégâts.',
  },
  'arcanist.ashlight.5': {
    name: 'Colonne de flamme',
    description: 'Dégâts massifs. Une seule fois par combat.',
  },
  // ── L'Arcaniste — Voile ──
  'arcanist.veil.1': {
    name: 'Voile aveuglant',
    description: 'La précision de l’ennemi chute de 20 %.',
  },
  'arcanist.veil.2': { name: 'Entrave de suie', description: 'L’ennemi perd son prochain tour.' },
  'arcanist.veil.3': {
    name: 'Miroir de brume',
    description: 'Ton esquive grimpe de 30 % pendant 2 tours.',
  },
  'arcanist.veil.4': { name: 'Dissipation', description: 'Tu effaces les bienfaits de l’ennemi.' },
  'arcanist.veil.5': {
    name: 'Prison de verre',
    description: 'Tu figes un ennemi 2 tours. Une fois par combat.',
  },
  // ── L'Arcaniste — Savant ──
  'arcanist.scholar.1': {
    name: 'Lecture des runes',
    description: 'Tes fouilles rapportent 20 % de butin en plus.',
  },
  'arcanist.scholar.2': {
    name: 'Cartographe',
    description: 'Tu révèles un hexagone adjacent de plus.',
  },
  'arcanist.scholar.3': {
    name: 'Alchimie',
    description: 'Tu sais distiller des potions à la forge.',
  },
  'arcanist.scholar.4': {
    name: 'Transmutation',
    description: '10 matériaux communs deviennent 1 rare (une fois toutes les 6 h).',
  },
  'arcanist.scholar.5': {
    name: 'Œil des Archives',
    description: 'Tu perces les faiblesses des Gardiens.',
  },

  // ── L'Éclaireur — Traque ──
  'scout.hunt.1': {
    name: 'Tir précis',
    description: 'Un tir à 130 % des dégâts. Recharge : 2 tours.',
  },
  'scout.hunt.2': {
    name: 'Flèche barbelée',
    description: 'La plaie saigne pendant 3 tours.',
  },
  'scout.hunt.3': { name: 'Double tir', description: 'Deux flèches, 160 % des dégâts.' },
  'scout.hunt.4': { name: 'Tir d’ancrage', description: 'Tu cloues l’ennemi sur place.' },
  'scout.hunt.5': {
    name: 'Flèche de la lanterne',
    description: 'Un tir puissant qui révèle aussi l’invisible.',
  },
  // ── L'Éclaireur — Voyage ──
  'scout.travel.1': {
    name: 'Pas léger',
    description: 'Tes timers de déplacement baissent de 10 %.',
  },
  'scout.travel.2': { name: 'Longue-Vue', description: 'Ta vision porte un hexagone plus loin.' },
  'scout.travel.3': {
    name: 'Pisteur',
    description: 'Tu repères les lieux non fouillés à 2 hexagones.',
  },
  'scout.travel.4': {
    name: 'Passe-marais',
    description: 'Les terrains difficiles ne te ralentissent plus.',
  },
  'scout.travel.5': {
    name: 'Chemins de traverse',
    description: 'Rejoins tout autel visité (une fois toutes les 12 h).',
  },
  // ── L'Éclaireur — Ombre ──
  'scout.shadow.1': {
    name: 'Poche double',
    description: 'Tu ne perds plus que la moitié de tes matériaux en mourant.',
  },
  'scout.shadow.2': { name: 'Embuscade', description: '+40 % de dégâts au premier tour.' },
  'scout.shadow.3': { name: 'Évasion', description: 'Tu fuis un combat sans la moindre pénalité.' },
  'scout.shadow.4': {
    name: 'Détrousseur',
    description: 'Les Brumeux te laissent 15 % d’écus en plus.',
  },
  'scout.shadow.5': {
    name: 'Fantôme de brume',
    description: 'Traverse un hex de Brume de niveau 3 sans surcoût (une fois toutes les 6 h).',
  },

  // ── Le Chantre — Hymne ──
  'cantor.hymn.1': { name: 'Chant vivifiant', description: 'Tu soignes 15 % des PV du groupe.' },
  'cantor.hymn.2': { name: 'Cadence', description: 'Le groupe gagne +10 % d’adresse.' },
  'cantor.hymn.3': {
    name: 'Répons',
    description: 'Tu ranimes un allié à 30 % de ses PV. Une fois par combat.',
  },
  'cantor.hymn.4': { name: 'Hymne de fer', description: 'L’armure du groupe grimpe de 20 %.' },
  'cantor.hymn.5': {
    name: 'Chœur des Premiers',
    description: 'Tous les cooldowns du groupe reculent d’un tour.',
  },
  // ── Le Chantre — Braise ──
  'cantor.ember.1': {
    name: 'Offrande',
    description: 'Tes contributions aux chantiers comptent pour 1,4×.',
  },
  'cantor.ember.2': {
    name: 'Veilleur',
    description: 'Tu te reposes deux fois plus vite aux autels.',
  },
  'cantor.ember.3': {
    name: 'Écho de la Flamme',
    description: 'Chaque jour, une Braise t’accorde +10 % à une stat pendant 4 h.',
  },
  'cantor.ember.4': {
    name: 'Pèlerin',
    description: 'Tu vois la progression des chantiers et raids où que tu sois.',
  },
  'cantor.ember.5': {
    name: 'Rallumeur',
    description: 'Au rallumage d’une Braise, tu gagnes un titre et 5 Fragments.',
  },
  // ── Le Chantre — Verbe ──
  'cantor.verse.1': { name: 'Semonce', description: 'L’ennemi perd 10 % de sa Force.' },
  'cantor.verse.2': {
    name: 'Litanie',
    description: 'Des dégâts de Volonté qui rongent l’ennemi sur 3 tours.',
  },
  'cantor.verse.3': {
    name: 'Injonction',
    description: 'L’ennemi frappe son propre camp. Une fois par combat.',
  },
  'cantor.verse.4': { name: 'Sceau de cendre', description: 'L’ennemi ne peut plus fuir.' },
  'cantor.verse.5': {
    name: 'Verbe d’extinction',
    description: 'Dégâts doublés contre les Gardiens. Une fois par raid.',
  },
};
