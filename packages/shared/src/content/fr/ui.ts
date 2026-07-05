/** Game shell & M1 screen strings (DESIGN §6 — tutoiement, lore voice). */
export const UI_FR = {
  nav: {
    map: 'Carte',
    bastion: 'Bastion',
    hero: 'Héros',
    raid: 'Raid',
  },
  status: {
    hp: 'PV',
    stamina: 'Endurance',
    ashCrowns: 'écus',
    emberFragments: 'fragments',
    gloryMarks: 'gloire',
    level: 'niv.',
  },
  queue: {
    empty: 'Aucune action en cours — la flammèche attend.',
    move: 'Déplacement',
    rest: 'Repos à l’autel',
    queued: 'en file',
  },
  map: {
    mistLevelLabel: 'Brume niveau',
    pickHexTitle: 'Choisis un hexagone',
    pickHexHint: 'Touche une case adjacente pour voir le coût du déplacement.',
    fogTitle: 'Brume opaque',
    fogHint: 'Personne n’a encore cartographié cette zone. Approche-toi pour la révéler.',
    hereSuffix: 'Tu es ici.',
    tooFar: 'Trop loin : avance de case en case (ou empile jusqu’à 3 actions).',
    mistTax: 'La Brume alourdit le pas.',
    staminaCost: 'endurance',
    moveAction: 'Se mettre en route',
    restAction: 'Se reposer (30 min · +75 ⚡)',
    queuedFromHint: 'Coût depuis la fin de ta file d’actions.',
    cancelAction: 'Annuler',
    terrains: {
      plain: 'Plaine',
      forest: 'Forêt',
      hill: 'Colline',
      marsh: 'Marais',
      ruins: 'Ruines',
      ash_road: 'Route de cendre',
      ford: 'Gué',
      shrine: 'Autel',
    } as Record<string, string>,
  },
  creation: {
    eyebrow: 'La Salle des Cendres',
    title: 'Éveille ton Ravivé',
    intro:
      'La dernière Braise a refusé de te laisser partir. Choisis le nom qu’on gravera sur ta lanterne, et la voie que ta flammèche suivra.',
    nameLabel: 'Nom du Ravivé',
    namePlaceholder: '3 à 24 caractères',
    classLabel: 'Choisis ta voie',
    submit: 'Rejoindre le bastion',
    classes: {
      blade: {
        name: 'La Lame',
        tagline: 'Encaisse et protège. Les remparts marchent avec elle.',
      },
      arcanist: {
        name: 'L’Arcaniste',
        tagline: 'La cendrelumière obéit à qui sait lire les Archives.',
      },
      scout: {
        name: 'L’Éclaireur',
        tagline: 'Les Routes de Cendre n’ont pas de secret pour lui.',
      },
      cantor: {
        name: 'Le Chantre',
        tagline: 'Sa voix ravive les Braises — et ceux qui marchent avec lui.',
      },
    } as Record<string, { name: string; tagline: string }>,
  },
  placeholders: {
    bastion: 'Le Bastion de Cendrelune ouvrira ses portes bientôt.',
    hero: 'Ta légende s’écrira ici.',
    raid: 'Les Gardiens dorment encore. Reviens quand le Glas sonnera.',
  },
  errors: {
    loadFailed: 'Le bastion est injoignable — réessaie dans un instant.',
  },
} as const;
