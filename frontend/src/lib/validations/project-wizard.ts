/**
 * Project form wizard configuration (pure logic, no JSX so it stays
 * importable from node validation scripts).
 *
 * Mirrors the six ProjectForm sections 1:1 — each section is one step.
 * Step 4 differs between create (budget only) and edit (budget +
 * currency) because currency exists only in the edit schema.
 */

import {
  findFirstInvalidStep as findFirstInvalidStepGeneric,
  type WizardStepDef,
} from '@/lib/wizard';

export type ProjectWizardStep = WizardStepDef;

const BASE_STEPS: Omit<ProjectWizardStep, 'fields'>[] = [
  {
    id: 'details',
    title: 'Project Information',
    micro: 'GENERAL',
    description: 'Core project identity and scope',
  },
  {
    id: 'location',
    title: 'Location',
    micro: 'SITE',
    description: 'Physical construction site',
  },
  {
    id: 'timeline',
    title: 'Timeline',
    micro: 'SCHEDULE',
    description: 'Planned project delivery window',
  },
  {
    id: 'budget',
    title: 'Budget',
    micro: 'FINANCIALS',
    description: 'Total approved project budget in USD',
  },
  {
    id: 'status',
    title: 'Status',
    micro: 'LIFECYCLE',
    description: 'Set the workflow gate for resource planning and subcontractor dispatch.',
  },
  {
    id: 'image',
    title: 'Project Image',
    micro: 'MEDIA',
    description: 'Optional cover image for the project. JPEG, PNG or WEBP.',
  },
];

export function getProjectWizardSteps(isEdit: boolean): ProjectWizardStep[] {
  return BASE_STEPS.map((step) => {
    switch (step.id) {
      case 'details':
        return { ...step, fields: ['name', 'description'] };
      case 'location':
        return { ...step, fields: ['location'] };
      case 'timeline':
        return { ...step, fields: ['startDate', 'endDate'] };
      case 'budget':
        return isEdit
          ? {
              ...step,
              title: 'Budget & Currency',
              description: undefined,
              fields: ['budget', 'currency'],
            }
          : { ...step, fields: ['budget'] };
      case 'status':
        return { ...step, fields: ['status'] };
      case 'image':
        return { ...step, fields: ['image'] };
      default:
        return { ...step, fields: [] };
    }
  });
}

/**
 * Map RHF validation errors back to the first step containing an
 * invalid field. Returns -1 when there is nothing invalid.
 */
export function findFirstInvalidStep(
  errors: Record<string, unknown>,
  isEdit: boolean,
): number {
  return findFirstInvalidStepGeneric(getProjectWizardSteps(isEdit), errors);
}
