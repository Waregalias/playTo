export interface ProjectSeed {
  id: string;
  regionId: number;
  name: string;
  goals: Record<string, number>;
}

/** Community project for Q5 « Sonner le Glas » (GDD §10.2). Resource keys per GLOSSARY. */
export const PROJECT_SEEDS: ProjectSeed[] = [
  {
    id: 'r1.belfry',
    regionId: 1,
    name: 'Beffroi du Grand Cairn',
    goals: { shadewood: 5000, sootOre: 3000, ashGlass: 500 },
  },
];
