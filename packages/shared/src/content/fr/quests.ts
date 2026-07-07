/** Main-quest chain content, region 1 (GDD §10.2). Keyed by quest id / step id. */
export interface QuestContentFr {
  name: string;
  hook: string;
  steps: Record<string, string>;
  choices?: Record<string, string>;
  done: string;
}

export const QUESTS_FR: Record<string, QuestContentFr> = {
  'r1.main.q1': {
    name: 'Le premier pas dans la grisaille',
    hook: 'Mira te tend une lanterne. « Trois cases, Ravivé. L’autel du Vieux Gué. Montre-moi que ta flammèche tient debout. »',
    steps: {
      s1: 'Atteins l’autel du Vieux Gué, à trois cases du bastion.',
    },
    done: 'L’autel tiédit à ton approche. Le Vieux Gué se souvient de toi.',
  },
  'r1.main.q2': {
    name: 'Le hameau qui n’existe plus',
    hook: 'Vellebrune-la-Basse n’apparaît plus sur aucune carte. Ses ruines, si. Fouille-les — et méfie-toi de ce qui y rôde encore.',
    steps: {
      s1: 'Fouille les ruines de Vellebrune-la-Basse.',
      s2: 'Abats le Loup de suie qui garde le hameau.',
    },
    done: 'Dans les décombres, un journal de berger. Ses pages se réécrivent sous tes yeux.',
  },
  'r1.main.q3': {
    name: 'Les moutons comptent leurs bergers',
    hook: 'On parle d’un troupeau parfaitement normal au milieu de la Brume, et d’une bergère qui refuse de partir. Va voir les cairns des bergers.',
    steps: {
      s1: 'Rejoins Petra la Bergère, aux cairns des bergers.',
      s2: 'Petra garde son troupeau au cœur de la grisaille. Que fais-tu ?',
      s3a: 'Protège le troupeau : repousse trois Bergers spectraux.',
      s3b: 'Tu as suivi Petra de nuit. Les moutons sont des souvenirs qu’elle refuse de lâcher.',
    },
    choices: {
      protect: 'Protéger le troupeau (voie de la compassion)',
      truth: 'Percer le secret (voie de la vérité)',
      disperse: 'Disperser les souvenirs — elle doit avancer',
      silence: 'Te taire — certains mensonges tiennent chaud',
    },
    done: 'Les cairns se taisent. Petra, elle, continue de compter.',
  },
  'r1.main.q4': {
    name: 'La cloche engloutie',
    hook: 'La cloche du village dort au fond du Marais des Soupirs. Quelque chose en armure la veille. Ramène-la — ou du moins, reviens.',
    steps: {
      s1: 'Gagne le Marais des Soupirs.',
      s2: 'Affronte le Chevalier Vide et reprends la cloche engloutie.',
    },
    done: 'La cloche est lourde de vase et de noms oubliés. Brasfer saura la faire sonner à nouveau.',
  },
  'r1.main.q5': {
    name: 'Sonner le Glas',
    hook: 'La cloche est revenue, mais le beffroi du Grand Cairn n’est plus que ruines. Reconstruisons-le tous ensemble — bois d’ombre, minerai, verre de cendre. Quand la cloche sonnera, Maugrith ne pourra plus se cacher.',
    steps: {
      s1: 'Livre des matériaux au chantier du beffroi du Grand Cairn.',
    },
    done: 'Le beffroi se dresse à nouveau. La première volée déchire la Brume — et quelque chose, au loin, se réveille.',
  },
};
