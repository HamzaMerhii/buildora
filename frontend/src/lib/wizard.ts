/**
 * Shared multi-step wizard helpers (pure logic, no JSX).
 *
 * Rule: a form with 3+ logical sections becomes a validated wizard;
 * smaller forms stay vertical. Each wizard defines its steps centrally
 * ({ id, title, micro?, description?, fields }) and drives the stepper,
 * per-step trigger() validation, and first-invalid-step lookup from it.
 */

export interface WizardStepDef {
  id: string;
  title: string;
  micro?: string;
  description?: string;
  /** RHF field names validated when leaving this step. */
  fields: string[];
}

/**
 * Map RHF validation errors back to the first step containing an
 * invalid field. Returns -1 when there is nothing invalid.
 */
export function findFirstInvalidStep(
  steps: WizardStepDef[],
  errors: Record<string, unknown>,
): number {
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].fields.some((field) => errors[field] !== undefined)) {
      return i;
    }
  }
  return -1;
}

/** Focus (and reveal) the first of the given fields present in the DOM. */
export function focusFirstField(names: string[]) {
  if (typeof document === 'undefined') return;
  for (const name of names) {
    const el = document.querySelector(`[name="${name}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
      return;
    }
  }
}

/**
 * Enter key on early steps advances the wizard instead of submitting.
 * Textareas keep native Enter behavior; the final step submits normally.
 */
export function handleWizardEnterKey(
  e: React.KeyboardEvent,
  isLast: boolean,
  onNext: () => void,
) {
  if (e.key !== 'Enter') return;
  const target = e.target as HTMLElement;
  if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
  if (!isLast) {
    e.preventDefault();
    onNext();
  }
}
