'use client';
import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { projectCreateSchema, projectEditSchema, projectSchema } from '@/lib/validations/project.schema';
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
import { Field, Textarea, FormSection, FormActions } from './FormPrimitives';

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputId = useId();

  // Edit keeps the existing schema/UI (including currency, dropped from the
  // payload) plus an optional replacement image; create uses the
  // backend-compatible schema without currency.
  const schema = id ? projectEditSchema : projectCreateSchema;

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

  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: initialValues,
    defaultValues: CREATE_DEFAULTS,
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
          onSubmit={form.handleSubmit(async (v) => {
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
                for (const [field, messages] of Object.entries(error.fields)) {
                  if (field in v) form.setError(field as keyof typeof v, { message: messages[0] });
                }
              }
              setBackendError(friendlyMessage(error));
            }
          })}
        >
          <FormSection title="Project Information" description="Core project identity and scope">
            <Field name="name" label="Project Name *" placeholder="e.g. Cedar Residence" />
            <Textarea
              name="description"
              label="Description"
              placeholder="Construction scope, architectural style, and delivery goals…"
            />
          </FormSection>
          <FormSection title="Location" description="Physical construction site">
            <Field
              name="location"
              label="Location / Site Address *"
              placeholder="e.g. Beirut, Lebanon (Plot 4412/Achrafieh)"
            />
          </FormSection>
          <FormSection title="Timeline" description="Planned project delivery window">
            <div className="form-grid">
              <Field name="startDate" label="Start Date *" type="date" />
              <Field name="endDate" label="Expected End Date *" type="date" />
            </div>
          </FormSection>
          {id ? (
            <FormSection title="Budget & Currency">
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
            </FormSection>
          ) : (
            <FormSection title="Budget" description="Total approved project budget in USD">
              <Field
                name="budget"
                label="Total Approved Budget *"
                type="number"
                step="any"
                placeholder="500000"
              />
            </FormSection>
          )}
          <FormSection title="Status" description="Current project operational stage">
            <Field name="status" label="Project Status">
              <option value="PLANNING">Planning — Permits & design</option>
              <option value="IN_PROGRESS">In Progress — Active site works</option>
              <option value="ON_HOLD">On Hold — Paused temporarily</option>
              <option value="COMPLETED">Completed — Handed over</option>
            </Field>
          </FormSection>
          {!id && (
            <FormSection
              title="Project Image"
              description="Optional cover image for the new project. JPEG, PNG or WEBP."
            >
              <NewImagePicker
                inputId={imageInputId}
                inputRef={fileInputRef}
                previewUrl={previewUrl}
                hasSelection={Boolean(selectedImage)}
                imageError={imageError}
                onSelect={handleImageChange}
                onRemove={removeImage}
              />
            </FormSection>
          )}
          {id && (
            <FormSection
              title="Project Image"
              description="Current cover image and optional replacement. JPEG, PNG or WEBP."
            >
              {currentImage && (
                <div className="stack">
                  <img
                    src={currentImage}
                    alt="Current project image"
                    style={{ maxWidth: 320, borderRadius: 8 }}
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
            </FormSection>
          )}
          {backendError && (
            <p className="field-error" role="alert">
              {backendError}
            </p>
          )}
          <FormActions onCancel={cancel} label={id ? 'Save Changes' : 'Create Project'} pending={form.formState.isSubmitting} />
        </form>
      </FormProvider>
    </div>
  );
}
