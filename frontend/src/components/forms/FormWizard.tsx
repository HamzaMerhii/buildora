'use client';
import { Progress } from '../ui/Primitives';
import type { WizardStepDef } from '@/lib/wizard';

/**
 * Shared wizard chrome, matching the Project wizard reference.
 * - WizardNav: "Step X of N" + clickable completed steps + progress bar.
 *   Future steps are never clickable (no validation bypass).
 * - WizardStepPanel: section shell without duplicated step numbering.
 * - WizardFooter: Back / Cancel / Next-or-Submit layout.
 *
 * Per-step validation pattern (keeps full type safety out of the way
 * since step configs hold plain string field names):
 *   const triggerStep = form.trigger as (names: string[]) => Promise<boolean>;
 *   const valid = await triggerStep(step.fields);
 */

export function WizardNav({
  steps,
  step,
  onGoBack,
}: {
  steps: WizardStepDef[];
  step: number;
  onGoBack: (index: number) => void;
}) {
  const progress = Math.round(((step + 1) / steps.length) * 100);
  return (
    <nav aria-label="Form steps" className="section-space">
      <p className="small" aria-live="polite">
        Step {step + 1} of {steps.length}
      </p>
      <ol className="wizard-steps">
        {steps.map((s, i) => (
          <li
            key={s.id}
            aria-current={i === step ? 'step' : undefined}
            className={i < step ? 'done' : i === step ? 'current' : ''}
          >
            {i < step ? (
              <button
                type="button"
                className="wizard-step-num"
                onClick={() => onGoBack(i)}
                aria-label={`Go back to step ${i + 1}: ${s.title}`}
              >
                <span aria-hidden="true">✓</span>
              </button>
            ) : (
              <span className="wizard-step-num" aria-hidden="true">
                {i + 1}
              </span>
            )}
            <span>{s.title}</span>
          </li>
        ))}
      </ol>
      <Progress value={progress} />
    </nav>
  );
}

export function WizardStepPanel({ step, children }: { step: WizardStepDef; children: React.ReactNode }) {
  return (
    <section className="form-section wizard-step" aria-label={step.title}>
      <div className="apt-sec-head">
        <div style={{ flex: 1 }}>
          <h2>{step.title}</h2>
          {step.description && <p>{step.description}</p>}
        </div>
        {step.micro && <span className="apt-micro">{step.micro}</span>}
      </div>
      <div className="form-section-content">{children}</div>
    </section>
  );
}

export function WizardFooter({
  step,
  totalSteps,
  submitLabel,
  submitPending,
  onBack,
  onCancel,
  onNext,
}: {
  step: number;
  totalSteps: number;
  submitLabel: string;
  submitPending: boolean;
  onBack: () => void;
  onCancel?: () => void;
  onNext: () => void;
}) {
  const isLast = step === totalSteps - 1;
  return (
    <div className="form-actions wizard-footer">
      <div className="wizard-footer-left">
        {step > 0 && (
          <button type="button" className="button secondary" onClick={onBack} disabled={submitPending}>
            Back
          </button>
        )}
        {onCancel && (
          <button type="button" className="button secondary" onClick={onCancel} disabled={submitPending}>
            Cancel
          </button>
        )}
      </div>
      {isLast ? (
        <button type="submit" className="button" disabled={submitPending}>
          {submitPending ? 'Saving…' : submitLabel}
        </button>
      ) : (
        <button type="button" className="button" onClick={onNext}>
          Next
        </button>
      )}
    </div>
  );
}
