export type BuildoraStat = {
  id: string;
  value: string;
  label: string;
  description?: string;
};

/** Placeholder trust indicators. Replace values with verified Buildora numbers. */
export const buildoraStats: BuildoraStat[] = [
  {
    id: 'projects',
    value: '25+',
    label: 'Projects Delivered',
    description: 'Residential and commercial spaces completed.',
  },
  {
    id: 'partners',
    value: '12+',
    label: 'Construction Partners',
    description: 'Trusted contractors and engineering firms.',
  },
  {
    id: 'experience',
    value: '10+',
    label: 'Years Experience',
    description: 'Combined hands-on delivery expertise.',
  },
  {
    id: 'satisfaction',
    value: '98%',
    label: 'Client Satisfaction',
    description: 'Clients who would build with us again.',
  },
];
