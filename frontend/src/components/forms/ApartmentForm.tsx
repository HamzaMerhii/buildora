"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
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
  CheckField,
  FormSection,
  FormActions,
} from "./FormPrimitives";

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
        description="Manage structural placement, unit specifications, and public listing visibility."
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
          <FormSection
            title="1. Location in Structure"
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
              </>
            )}
          </FormSection>
          <FormSection title="2. Apartment Information">
            <Field
              name="number"
              label="Apartment Number *"
              placeholder="e.g. 201"
            />
            <Textarea name="description" label="Description" />
          </FormSection>
          <FormSection title="3. Area & Rooms">
            <Field
              name="area"
              label="Gross Area (sqm) *"
              type="number"
              step="any"
            />
            <div className="form-grid">
              <Field name="bedrooms" label="Bedrooms *" type="number" />
              <Field name="bathrooms" label="Bathrooms *" type="number" />
            </div>
          </FormSection>
          <FormSection title="4. Price & Valuation">
            <Field
              name="price"
              label="Base Price (USD) *"
              type="number"
              step="any"
            />
          </FormSection>
          <FormSection title="5. Inventory Status">
            <Field name="status" label="Operational Status">
              <option value="AVAILABLE">Available — Open inventory</option>
              <option value="RESERVED">Reserved — Deposit received</option>
              <option value="SOLD">Sold — Ownership transferred</option>
            </Field>
          </FormSection>
          <FormSection title="6. Public Visibility">
            <CheckField
              name="isPublic"
              label="Public — Show this apartment on the public property catalog"
            />
            <p className="small">
              Private apartments are available only in your internal workspace.
            </p>
          </FormSection>
          {!id ? (
            <FormSection
              title="7. Apartment Images"
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
            </FormSection>
          ) : (
            <>
              <FormSection
                title="7. Apartment Images"
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
              </FormSection>
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
