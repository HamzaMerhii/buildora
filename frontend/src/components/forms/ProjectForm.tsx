'use client';
import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { projectCreateSchema, projectEditSchema, projectSchema } from '@/lib/validations/project.schema';
import { getProjectWizardSteps, findFirstInvalidStep } from '@/lib/validations/project-wizard';
import { useAuthStore } from '@/stores/auth.store';
import {
  createProject,
  getProject,
  mapApiProjectToFormValues,
  mapProjectFormToCreate,
  mapProjectFormToUpdate,
  updateProject,
} from '@/lib/api/project.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { useWorkspace } from '../features/WorkspaceProvider';
import { PageHeader, EmptyState } from '../ui/Primitives';
import { Field, Textarea } from './FormPrimitives';
import { WizardNav, WizardStepPanel, WizardFooter } from './FormWizard';
import { focusFirstField, handleWizardEnterKey } from '@/lib/wizard';

type FormInput = z.input<typeof projectSchema>;

const CREATE_DEFAULTS: FormInput = {
  name: '',
  description: '',
  location: '',
  startDate: '2026-09-19',
  endDate: '2027-12-30',
  budget: '',
  currency: 'USD',
  status: 'PLANNING',
};

/** Shared new-image picker: file input + preview + remove. Used by both create and edit. */
function NewImagePicker({
  inputId,
  inputRef,
  previewUrl,
  hasSelection,
  imageError,
  onSelect,
  onRemove,
}: {
  inputId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  previewUrl: string | null;
  hasSelection: boolean;
  imageError?: string;
  onSelect: (files: FileList | null) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={inputId}>Project Image</label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          onChange={(e) => onSelect(e.target.files)}
          aria-invalid={Boolean(imageError)}
          aria-describedby={imageError ? `${inputId}-error` : undefined}
        />
        <small>JPEG, PNG or WEBP. Only one image is supported.</small>
        {imageError && (
          <p className="field-error" id={`${inputId}-error`} role="alert">
            {String(imageError)}
          </p>
        )}
      </div>
      {previewUrl && hasSelection && (
        <div className="stack">
          <img
            src={previewUrl}
            alt="Selected project image preview"
            style={{ maxWidth: 320, borderRadius: 8 }}
          />
          <div>
            <button className="button secondary" type="button" onClick={onRemove}>
              Remove Image
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Card-based project status selector (radio semantics, same `status` field). */
const PROJECT_STATUS_OPTIONS = [
  { value: 'PLANNING', title: 'Planning', description: 'Recommended for design and permit review', dot: '#4675C0' },
  { value: 'IN_PROGRESS', title: 'In Progress', description: 'Active site mobilization and works', dot: '#f59e0b' },
  { value: 'ON_HOLD', title: 'On Hold', description: 'Awaiting clearances, financing, or restart', dot: '#697A98' },
  { value: 'COMPLETED', title: 'Completed', description: 'Final handover and project completion', dot: '#22c55e' },
] as const;

function ProjectStatusCards() {
  const { register, watch, formState: { errors } } = useFormContext();
  const value = watch('status') as string | undefined;
  const [focused, setFocused] = useState<string | null>(null);
  const error = errors.status?.message;
  return (
    <div className="field">
      <span style={{ fontSize: 10, letterSpacing: '.08em', color: 'var(--muted)', textTransform: 'uppercase' }}>
        Initial Project Status
      </span>
      <div className="status-cards" role="radiogroup" aria-label="Initial project status">
        {PROJECT_STATUS_OPTIONS.map((o) => {
          const selected = value === o.value;
          return (
            <label
              key={o.value}
              style={{
                display: 'flex', flexDirection: 'column', gap: 8, padding: 16, borderRadius: 10,
                border: selected ? '1.5px solid var(--primary)' : '1px solid var(--line)',
                background: selected ? '#4675C014' : '#fff', cursor: 'pointer',
                transition: 'border-color .15s, background .15s',
                outline: focused === o.value ? '2px solid var(--primary)' : 'none', outlineOffset: 3,
                minHeight: 118,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  aria-hidden="true"
                  style={{ width: 12, height: 12, borderRadius: '50%', background: selected ? o.dot : 'var(--mist)' }}
                />
                <span
                  aria-hidden="true"
                  style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: selected ? '1.5px solid var(--primary)' : '1.5px solid var(--mist)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: '#fff', flexShrink: 0,
                  }}
                >
                  {selected && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)' }} />}
                </span>
                <input
                  type="radio"
                  value={o.value}
                  {...register('status')}
                  onFocus={() => setFocused(o.value)}
                  onBlur={() => setFocused(null)}
                  aria-label={o.title}
                  style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
                />
              </span>
              <strong style={{ fontSize: 13 }}>{o.title}</strong>
              <small style={{ color: 'var(--muted)', lineHeight: 1.5 }}>{o.description}</small>
            </label>
          );
        })}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {String(error)}
        </p>
      )}
    </div>
  );
}

export function ProjectForm({ id }: { id?: string }) {
  const { notify } = useWorkspace();
  const router = useRouter();
  const companyId = useAuthStore((s) => s.companyId);
  const [initialValues, setInitialValues] = useState<FormInput | undefined>(undefined);
  // Remote image URL kept separate from the File input: it is display-only.
  // PATCH accepts a JSON image URL string but offers no file upload, so the
  // edit form never puts this URL into a File control.
  const [currentImage, setCurrentImage] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputId = useId();

  // Edit keeps the existing schema/UI (including currency, dropped from the
  // payload) plus an optional replacement image; create uses the
  // backend-compatible schema without currency.
  const schema = id ? projectEditSchema : projectCreateSchema;
  const steps = getProjectWizardSteps(Boolean(id));
  const isLast = step === steps.length - 1;

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    if (!companyId) {
      setLoading(false);
      setLoadError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const project = await getProject(companyId, id);
      setInitialValues(mapApiProjectToFormValues(project));
      setCurrentImage(project.image);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setLoadError('Project not found.');
      } else if (err instanceof ApiError && err.status === 401) {
        setLoadError('Your session has expired. Please sign in again.');
      } else {
        setLoadError(friendlyMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, id]);

  /* eslint-disable react-hooks/set-state-in-effect -- initial project load from the API on mount */
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // One form instance for the whole wizard. shouldUnregister: false keeps
  // hidden steps' values in the final submission.
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: initialValues,
    defaultValues: CREATE_DEFAULTS,
    shouldUnregister: false,
  });

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- object URL lifecycle for the selected image preview */
  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const imageError = (form.formState.errors as { image?: { message?: string } }).image?.message;
  const isSubmitting = form.formState.isSubmitting;

  const handleImageChange = (files: FileList | null) => {
    form.setValue('image' as never, (files ?? undefined) as never, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setSelectedImage(files?.[0] ?? null);
  };

  const removeImage = () => {
    form.setValue('image' as never, undefined as never, { shouldValidate: true, shouldDirty: true });
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** Validate only the current step's fields; advance exactly one step. */
  const handleNext = async () => {
    const triggerStep = form.trigger as (names: string[]) => Promise<boolean>;
    const valid = await triggerStep(steps[step].fields);
    if (!valid) {
      const invalid = steps[step].fields.filter((name) => form.getFieldState(name as never).invalid);
      focusFirstField(invalid.length ? invalid : steps[step].fields);
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const submitValid = async (v: z.output<typeof schema>) => {
    if (!companyId) {
      setBackendError('No company context. Please sign in again.');
      return;
    }
    setBackendError(null);
    try {
      if (id) {
        // `currency` is UI-only (no backend column). A newly
        // selected image is uploaded via multipart PATCH; with no
        // new file the `image` part is omitted and the existing
        // image is preserved.
        await updateProject(companyId, id, mapProjectFormToUpdate(v));
        notify('Project changes saved.');
        router.push('/app/projects/' + id);
      } else {
        // Backend create returns {message} only (no project ID),
        // so the safe flow is back to the refreshed list.
        await createProject(companyId, mapProjectFormToCreate(v));
        notify('Project created successfully.');
        router.push('/app/projects');
      }
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        const names = Object.keys(error.fields);
        for (const [field, messages] of Object.entries(error.fields)) {
          if (field in v) form.setError(field as keyof typeof v, { message: messages[0] });
        }
        // Jump to the first step holding a backend-rejected field.
        const idx = findFirstInvalidStep(
          Object.fromEntries(names.map((name) => [name, true])),
          Boolean(id),
        );
        if (idx >= 0) setStep(idx);
      }
      setBackendError(friendlyMessage(error));
    }
  };

  const submitInvalid = (errors: Record<string, unknown>) => {
    const idx = findFirstInvalidStep(errors, Boolean(id));
    if (idx >= 0) {
      setStep(idx);
      window.setTimeout(() => {
        const stepFields = getProjectWizardSteps(Boolean(id))[idx].fields;
        focusFirstField(stepFields.filter((name) => errors[name] !== undefined));
      }, 60);
    }
  };

  if (id && loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading project…
      </p>
    );
  }
  if (id && (loadError || !initialValues)) {
    return (
      <>
        <EmptyState title={loadError ?? 'Project not found'} />
        <p className="section-space">
          <button className="button secondary" type="button" onClick={fetchDetail}>
            Retry
          </button>
        </p>
      </>
    );
  }

  const cancel = () => router.push(id ? '/app/projects/' + id : '/app/projects');

  const renderStepFields = () => {
    switch (steps[step].id) {
      case 'details':
        return (
          <>
            <Field name="name" label="Project Name *" placeholder="e.g. Cedar Residence" />
            <Textarea
              name="description"
              label="Description"
              placeholder="Construction scope, architectural style, and delivery goals…"
            />
          </>
        );
      case 'location':
        return (
          <Field
            name="location"
            label="Location / Site Address *"
            placeholder="e.g. Beirut, Lebanon (Plot 4412/Achrafieh)"
          />
        );
      case 'timeline':
        return (
          <div className="form-grid">
            <Field name="startDate" label="Start Date *" type="date" />
            <Field name="endDate" label="Expected End Date *" type="date" />
          </div>
        );
      case 'budget':
        return id ? (
          <div className="form-grid">
            <Field
              name="budget"
              label="Total Approved Budget *"
              type="number"
              step="any"
              placeholder="500000"
            />
            <Field name="currency" label="Currency *">
              <option value="USD">USD ($) — US Dollar</option>
              <option value="LBP">LBP — Lebanese Pound</option>
              <option value="EUR">EUR (€) — Euro</option>
              <option value="GBP">GBP (£)</option>
              <option value="AED">AED</option>
              <option value="SAR">SAR</option>
            </Field>
          </div>
        ) : (
          <Field
            name="budget"
            label="Total Approved Budget *"
            type="number"
            step="any"
            placeholder="500000"
          />
        );
      case 'status':
        return <ProjectStatusCards />;
      case 'image':
        return (
          <>
            {id && currentImage && (
              <div className="stack">
                <img
                  src={currentImage}
                  alt="Current project image"
                  style={{ maxWidth: 320, borderRadius: 8 }}
                  loading="lazy"
                />
                <small>Current image — saving without a new file keeps it.</small>
              </div>
            )}
            <NewImagePicker
              inputId={imageInputId}
              inputRef={fileInputRef}
              previewUrl={previewUrl}
              hasSelection={Boolean(selectedImage)}
              imageError={imageError}
              onSelect={handleImageChange}
              onRemove={removeImage}
            />
          </>
        );
      default:
        return null;
    }
  };

  const current = steps[step];

  return (
    <div className="form-layout">
      <PageHeader
        title={id ? 'Edit Project' : 'Create Project'}
        description={
          id
            ? 'Update the project baseline, timeline, and budget.'
            : 'Define a new construction project and its operational baseline.'
        }
        back="/app/projects"
      />
      <FormProvider {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(submitValid, submitInvalid)}
          onKeyDown={(e) => handleWizardEnterKey(e, isLast, () => void handleNext())}
        >
          <WizardNav steps={steps} step={step} onGoBack={(i) => setStep(i)} />
          <WizardStepPanel key={step} step={current}>
            {renderStepFields()}
          </WizardStepPanel>
          {backendError && (
            <p className="field-error" role="alert">
              {backendError}
            </p>
          )}
          <WizardFooter
            step={step}
            totalSteps={steps.length}
            submitLabel={id ? 'Save Changes' : 'Create Project'}
            submitPending={isSubmitting}
            onBack={handleBack}
            onCancel={cancel}
            onNext={() => void handleNext()}
          />
        </form>
      </FormProvider>
    </div>
  );
}
