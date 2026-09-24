"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, FormProvider, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import {
  apartmentApiSchema,
  apartmentEditSchema,
  apartmentImagesSchema,
} from "@/lib/validations/apartment.schema";
import { useAuthStore } from "@/stores/auth.store";
import {
  addApartmentImages,
  createApartment,
  deleteApartmentImage,
  mapApartmentFormToCreate,
  mapApartmentFormToUpdate,
  mapApiApartmentToFormValues,
  resolveApartmentChain,
  updateApartment,
} from "@/lib/api/apartment.api";
import { getProjects } from "@/lib/api/project.api";
import { getBuildings, type ApiBuilding } from "@/lib/api/building.api";
import { getFloors, type ApiFloor } from "@/lib/api/floor.api";
import { ApiError, friendlyMessage } from "@/lib/api/client";
import { useWorkspace } from "../features/WorkspaceProvider";
import { PageHeader, EmptyState, DetailList } from "../ui/Primitives";
import { ConfirmDialog } from "../ui/Dialog";
import {
  Field,
  Textarea,
  FormActions,
  NumberedSection,
} from "./FormPrimitives";

/** Card-based inventory status selector (radio semantics, same `status` field). */
const APARTMENT_STATUS_OPTIONS = [
  { value: 'AVAILABLE', title: 'Available', description: 'Available for assignment or sale.', dot: '#22c55e' },
  { value: 'RESERVED', title: 'Reserved', description: 'Currently reserved.', dot: '#f59e0b' },
  { value: 'SOLD', title: 'Sold', description: 'Marked as sold.', dot: '#64748b' },
] as const;

function ApartmentStatusCards() {
  const { register, watch, formState: { errors } } = useFormContext();
  const value = watch('status') as string | undefined;
  const [focused, setFocused] = useState<string | null>(null);
  const error = errors.status?.message;
  return (
    <div className="field">
      <div className="status-cards status-cards-3" role="radiogroup" aria-label="Inventory status">
        {APARTMENT_STATUS_OPTIONS.map((o) => {
          const selected = value === o.value;
          return (
            <label
              key={o.value}
              style={{
                display: 'flex', flexDirection: 'column', gap: 8, padding: 16, borderRadius: 10,
                border: selected ? '1.5px solid var(--amber)' : '1px solid var(--line)',
                background: selected ? '#f59e0b14' : '#fff', cursor: 'pointer',
                transition: 'border-color .15s, background .15s',
                outline: focused === o.value ? '2px solid var(--amber)' : 'none', outlineOffset: 3,
                minHeight: 118,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  aria-hidden="true"
                  style={{ width: 12, height: 12, borderRadius: '50%', background: selected ? o.dot : '#c0c6db' }}
                />
                <span
                  aria-hidden="true"
                  style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: selected ? '1.5px solid var(--amber)' : '1.5px solid #c0c6db',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: '#fff', flexShrink: 0,
                  }}
                >
                  {selected && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber)' }} />}
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

/** Horizontal Public/Private switch bound to the real `isPublic` field. */
function VisibilitySwitch() {
  const { watch, setValue } = useFormContext();
  const value = Boolean(watch('isPublic'));
  return (
    <div className="visibility-panel">
      <span style={{ flex: 1 }}>
        <strong style={{ display: 'block', fontSize: 13 }}>Website Visitor Display</strong>
        <small style={{ color: 'var(--muted)' }}>
          {value
            ? 'Public — this apartment is shown on the public property catalog.'
            : 'Private — this apartment stays inside your internal workspace.'}
        </small>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label="Public visibility"
        className={'switch' + (value ? ' on' : '')}
        onClick={() => setValue('isPublic', !value, { shouldDirty: true, shouldValidate: true })}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
}

interface EditChain {
  projectId: string;
  buildingId: string;
  floorId: string;
  projectName?: string;
  buildingName?: string;
  floorName?: string;
}

/** Shared multi-image picker: file input + previews + per-file remove. */
function NewImagesPicker({
  inputId,
  inputRef,
  previewUrls,
  hasSelection,
  imageError,
  onSelect,
  onRemove,
}: {
  inputId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  previewUrls: string[];
  hasSelection: boolean;
  imageError?: string;
  onSelect: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={inputId}>Apartment Images</label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          multiple
          onChange={(e) => onSelect(e.target.files)}
          aria-invalid={Boolean(imageError)}
          aria-describedby={imageError ? `${inputId}-error` : undefined}
        />
        <small>JPEG, PNG or WEBP. You may select multiple files.</small>
        {imageError && (
          <p className="field-error" id={`${inputId}-error`} role="alert">
            {String(imageError)}
          </p>
        )}
      </div>
      {hasSelection && previewUrls.length > 0 && (
        <div className="three-grid">
          {previewUrls.map((url, i) => (
            <div key={url + i} className="stack">
              <img
                src={url}
                alt={`Selected apartment image ${i + 1} preview`}
                style={{ borderRadius: 8 }}
              />
              <div>
                <button className="button secondary" type="button" onClick={() => onRemove(i)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function ApartmentForm({ id }: { id?: string }) {
  const { notify } = useWorkspace();
  const router = useRouter();
  const companyId = useAuthStore((s) => s.companyId);
  const [chain, setChain] = useState<(EditChain & { images: Array<{ id: string; url: string }> }) | null>(null);
  const [chainLoading, setChainLoading] = useState(!!id);
  const [chainError, setChainError] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<
    z.input<typeof apartmentApiSchema> | z.input<typeof apartmentEditSchema> | undefined
  >(undefined);
  const [backendError, setBackendError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [buildings, setBuildings] = useState<ApiBuilding[]>([]);
  const [floors, setFloors] = useState<ApiFloor[]>([]);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<Array<{ id: string; url: string }>>([]);
  const [newImagesError, setNewImagesError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imagesInputId = "apartment-images";

  // Create uses the image-capable schema; edit validates newly selected
  // files against the shared image rule explicitly (PATCH itself has no
  // image field). Neither schema has currency (no backend column).
  const schema = id ? apartmentEditSchema : apartmentApiSchema;

  const resolveChain = useCallback(async () => {
    if (!id) return;
    if (!companyId) {
      setChainLoading(false);
      setChainError('No company context. Please sign in again.');
      return;
    }
    setChainLoading(true);
    setChainError(null);
    try {
      const resolved = await resolveApartmentChain(companyId, id);
      setChain({
        projectId: resolved.projectId,
        buildingId: resolved.buildingId,
        floorId: resolved.floorId,
        projectName: resolved.projectName,
        buildingName: resolved.buildingName,
        floorName: resolved.floorName,
        images: resolved.images,
      });
      setExistingImages(resolved.images);
      setInitialValues(mapApiApartmentToFormValues(resolved, resolved));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setChainError('Apartment not found.');
      } else if (err instanceof ApiError && err.status === 401) {
        setChainError('Your session has expired. Please sign in again.');
      } else {
        setChainError(friendlyMessage(err));
      }
    } finally {
      setChainLoading(false);
    }
  }, [companyId, id]);

  /* eslint-disable react-hooks/set-state-in-effect -- edit chain + prefill load on mount */
  useEffect(() => {
    resolveChain();
  }, [resolveChain]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: initialValues,
    defaultValues: {
      projectId: '',
      buildingId: '',
      floorId: '',
      number: '',
      description: '',
      area: '',
      bedrooms: 1,
      bathrooms: 1,
      price: '',
      status: 'AVAILABLE',
      isPublic: false,
    },
  });

  const projectId = useWatch({ control: form.control, name: 'projectId' });
  const buildingId = useWatch({ control: form.control, name: 'buildingId' });

  // Real project options for create mode.
  useEffect(() => {
    if (id || !companyId) return;
    let cancelled = false;
    getProjects(companyId, { limit: 100 })
      .then((list) => {
        if (!cancelled) setProjects(list.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, companyId]);

  // Real building options for the selected project.
  /* eslint-disable react-hooks/set-state-in-effect -- cascade options load on parent change */
  useEffect(() => {
    if (id || !companyId || !projectId) {
      setBuildings([]);
      return;
    }
    let cancelled = false;
    getBuildings(companyId, projectId)
      .then((list) => {
        if (!cancelled) setBuildings(list);
      })
      .catch(() => {
        if (!cancelled) setBuildings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, companyId, projectId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Real floor options for the selected building.
  /* eslint-disable react-hooks/set-state-in-effect -- cascade options load on parent change */
  useEffect(() => {
    if (id || !companyId || !projectId || !buildingId) {
      setFloors([]);
      return;
    }
    let cancelled = false;
    getFloors(companyId, projectId, buildingId)
      .then((list) => {
        if (!cancelled) setFloors(list);
      })
      .catch(() => {
        if (!cancelled) setFloors([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, companyId, projectId, buildingId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reset dependent selects when a parent changes (create mode).
  useEffect(() => {
    if (id) return;
    form.setValue('buildingId', '');
    form.setValue('floorId', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  useEffect(() => {
    if (id) return;
    form.setValue('floorId', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  // Image previews (create mode only).
  /* eslint-disable react-hooks/set-state-in-effect -- object URL lifecycle for selected previews */
  useEffect(() => {
    if (!selectedFiles.length) {
      setPreviewUrls([]);
      return;
    }
    const urls = selectedFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [selectedFiles]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const imageError = (form.formState.errors as { images?: { message?: string } }).images?.message;

  const validateNewFiles = (files: FileList | null): string | null => {
    if (!files?.length) return null;
    const result = apartmentImagesSchema.safeParse(files);
    if (result.success) return null;
    return result.error.issues[0]?.message ?? 'Use JPEG, PNG or WEBP images';
  };

  const handleImagesChange = (files: FileList | null) => {
    const next = files ? Array.from(files) : [];
    if (!id) {
      form.setValue('images' as never, (files ?? undefined) as never, {
        shouldValidate: true,
        shouldDirty: true,
      });
    } else {
      setNewImagesError(validateNewFiles(files));
    }
    setSelectedFiles(next);
  };

  const removeImage = (index: number) => {
    const next = selectedFiles.filter((_, i) => i !== index);
    if (!id) {
      const transfer = new DataTransfer();
      next.forEach((f) => transfer.items.add(f));
      form.setValue('images' as never, (transfer.files.length ? transfer.files : undefined) as never, {
        shouldValidate: true,
        shouldDirty: true,
      });
    } else {
      const transfer = new DataTransfer();
      next.forEach((f) => transfer.items.add(f));
      setNewImagesError(
        next.length
          ? validateNewFiles(transfer.files.length ? transfer.files : null)
          : null,
      );
    }
    setSelectedFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmDeleteImage = async () => {
    if (!companyId || !chain || !id || !pendingDeleteId) return;
    setDeletingImage(true);
    try {
      await deleteApartmentImage(
        companyId,
        chain.projectId,
        chain.buildingId,
        chain.floorId,
        id,
        pendingDeleteId,
      );
      setExistingImages((prev) => prev.filter((img) => img.id !== pendingDeleteId));
      setPendingDeleteId(null);
      notify('Apartment image deleted.');
    } catch (error) {
      setBackendError(friendlyMessage(error));
      setPendingDeleteId(null);
    } finally {
      setDeletingImage(false);
    }
  };

  if (id && chainLoading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading apartment…
      </p>
    );
  }
  if (id && (chainError || !chain || !initialValues)) {
    return (
      <>
        <EmptyState title={chainError ?? 'Apartment not found'} />
        <p className="section-space">
          <button className="button secondary" type="button" onClick={resolveChain}>
            Retry
          </button>
        </p>
      </>
    );
  }

  return (
    <div className="form-layout">
      <PageHeader
        title={id ? "Edit Apartment" : "Create Apartment"}
        description={
          id
            ? "Update unit specifications, visibility, and photos."
            : "Add a new apartment to the project structure with unit specifications."
        }
        back="/app/apartments"
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
              if (id && chain) {
                await updateApartment(
                  companyId,
                  chain.projectId,
                  chain.buildingId,
                  chain.floorId,
                  id,
                  mapApartmentFormToUpdate(v),
                );
                if (selectedFiles.length) {
                  const filesError = validateNewFiles(
                    (() => {
                      const transfer = new DataTransfer();
                      selectedFiles.forEach((f) => transfer.items.add(f));
                      return transfer.files;
                    })(),
                  );
                  if (filesError) {
                    setNewImagesError(filesError);
                    setBackendError(filesError);
                    return;
                  }
                  await addApartmentImages(
                    companyId,
                    chain.projectId,
                    chain.buildingId,
                    chain.floorId,
                    id,
                    selectedFiles,
                  );
                }
                notify('Apartment saved successfully.');
                router.push('/app/apartments/' + id);
              } else {
                const target = {
                  projectId: v.projectId,
                  buildingId: v.buildingId,
                  floorId: v.floorId,
                };
                if (!target.projectId || !target.buildingId || !target.floorId) {
                  setBackendError('Choose a project, building and floor.');
                  return;
                }
                const created = await createApartment(
                  companyId,
                  target.projectId,
                  target.buildingId,
                  target.floorId,
                  mapApartmentFormToCreate(v),
                );
                notify('Apartment saved successfully.');
                router.push('/app/apartments/' + created.id);
              }
            } catch (error) {
              if (error instanceof ApiError && error.fields) {
                for (const [field, messages] of Object.entries(error.fields)) {
                  if (field === 'unit_number') form.setError('number', { message: messages[0] });
                  else if (field === 'area_sqm') form.setError('area', { message: messages[0] });
                  else if (field === 'is_public') form.setError('isPublic', { message: messages[0] });
                  else if (field in v) form.setError(field as keyof typeof v, { message: messages[0] });
                }
              }
              if (error instanceof ApiError && error.status === 409) {
                form.setError('number', { message: error.detail });
              }
              setBackendError(friendlyMessage(error));
            }
          })}
        >
          <NumberedSection number="1"
            title="Location in Structure"
            micro="HIERARCHY"
            description="Asset placement within the project hierarchy"
          >
            {id && chain ? (
              <>
                <DetailList
                  items={[
                    ['Project', chain.projectName ?? chain.projectId],
                    ['Building', chain.buildingName ?? chain.buildingId],
                    ['Floor', chain.floorName ?? chain.floorId],
                  ]}
                />
                <p className="small">Structural placement cannot be changed after creation.</p>
              </>
            ) : (
              <>
                <Field name="projectId" label="Project *">
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Field>
                <div className="form-grid">
                  <Field name="buildingId" label="Building *">
                    <option value="">Select building</option>
                    {buildings.map((b) => (
                      <option value={b.id} key={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Field>
                  <Field name="floorId" label="Floor *">
                    <option value="">Select floor</option>
                    {floors.map((f) => (
                      <option value={f.id} key={f.id}>
                        {f.name ?? `Floor ${f.number}`}
                      </option>
                    ))}
                  </Field>
                </div>
                <p className="small section-space">
                  Apartments must belong to a valid project, building, and floor hierarchy.
                </p>
              </>
            )}
          </NumberedSection>
          <NumberedSection number="2" title="Apartment Information" micro="CORE IDENTIFIERS">
            <Field
              name="number"
              label="Apartment Number *"
              placeholder="e.g. 201"
              hint="Unique unit identifier within the selected floor."
            />
            <div className="section-space">
              <Textarea
                name="description"
                label="Description"
                placeholder="e.g. Bright corner unit with balcony access…"
              />
            </div>
          </NumberedSection>
          <NumberedSection number="3" title="Area & Rooms" micro="METRICS">
            <div className="apt-metrics">
              <Field
                name="area"
                label="Area (sqm) *"
                type="number"
                step="any"
              />
              <Field name="bedrooms" label="Bedrooms *" type="number" />
              <Field name="bathrooms" label="Bathrooms *" type="number" />
            </div>
          </NumberedSection>
          <NumberedSection number="4" title="Price & Valuation" micro="FINANCIALS">
            <Field
              name="price"
              label="Base Price *"
              type="number"
              step="any"
            />
          </NumberedSection>
          <NumberedSection number="5" title="Inventory Status" micro="LIFECYCLE PHASE">
            <ApartmentStatusCards />
          </NumberedSection>
          <NumberedSection number="6" title="Public Visibility" micro="VISIBILITY CONTROL">
            <VisibilitySwitch />
            <p className="small section-space">
              Private apartments are available only in your internal workspace.
            </p>
          </NumberedSection>
          {!id ? (
            <NumberedSection number="7"
              title="Apartment Images"
              micro="MEDIA"
              description="Optional photos for the new apartment. JPEG, PNG or WEBP; you may select several."
            >
              <NewImagesPicker
                inputId={imagesInputId}
                inputRef={fileInputRef}
                previewUrls={previewUrls}
                hasSelection={selectedFiles.length > 0}
                imageError={imageError}
                onSelect={handleImagesChange}
                onRemove={removeImage}
              />
            </NumberedSection>
          ) : (
            <>
              <NumberedSection number="7"
                title="Apartment Images"
                micro="MEDIA"
                description="Current photos and new uploads. JPEG, PNG or WEBP; you may select several."
              >
                {existingImages.length > 0 ? (
                  <div className="three-grid">
                    {existingImages.map((img) => (
                      <div key={img.id} className="stack">
                        <img src={img.url} alt="Current apartment photo" style={{ borderRadius: 8 }} />
                        <div>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => setPendingDeleteId(img.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="small">No images yet. Add some below.</p>
                )}
                <div className="section-space">
                  <NewImagesPicker
                    inputId={imagesInputId}
                    inputRef={fileInputRef}
                    previewUrls={previewUrls}
                    hasSelection={selectedFiles.length > 0}
                    imageError={newImagesError ?? undefined}
                    onSelect={handleImagesChange}
                    onRemove={removeImage}
                  />
                </div>
              </NumberedSection>
              <ConfirmDialog
                open={pendingDeleteId !== null}
                onClose={() => setPendingDeleteId(null)}
                onConfirm={confirmDeleteImage}
                title="Delete apartment image?"
                description="This removes the photo from the apartment. This cannot be undone."
              />
              {deletingImage && (
                <p className="small" role="status" aria-live="polite">
                  Deleting image…
                </p>
              )}
            </>
          )}
          {backendError && (
            <p className="field-error" role="alert">
              {backendError}
            </p>
          )}
          <FormActions
            onCancel={() => router.push('/app/apartments')}
            label={id ? 'Save Changes' : 'Create Apartment'}
            pending={form.formState.isSubmitting}
          />
        </form>
      </FormProvider>
    </div>
  );
}
