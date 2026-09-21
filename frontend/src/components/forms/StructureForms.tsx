'use client';
import { useCallback, useEffect, useState } from 'react';
import { useForm,FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { buildingSchema } from '@/lib/validations/building.schema';
import { floorApiSchema } from '@/lib/validations/floor.schema';
import { landRecordSchema, landSchema } from '@/lib/validations/project.schema';
import { useAuthStore } from '@/stores/auth.store';
import {
  LAND_RECORD_FIELD_MAP,
  getLandRecord,
  mapApiLandRecordToFormValues,
  mapLandRecordFormToUpdate,
  updateLandRecord,
} from '@/lib/api/land-record.api';
import {
  createBuilding,
  getBuilding,
  mapApiBuildingToFormValues,
  mapBuildingFormToCreate,
  mapBuildingFormToUpdate,
  updateBuilding,
} from '@/lib/api/building.api';
import {
  createFloor,
  getFloor,
  mapApiFloorToFormValues,
  mapFloorFormToCreate,
  mapFloorFormToUpdate,
  updateFloor,
} from '@/lib/api/floor.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { useWorkspace } from '../features/WorkspaceProvider';
import { PageHeader } from '../ui/Primitives';
import { Field,Textarea,FormSection,FormActions } from './FormPrimitives';
export function BuildingForm({projectId,id}:{projectId:string;id?:string}){
  const companyId = useAuthStore((s) => s.companyId);
  const {data,notify}=useWorkspace();
  const router=useRouter();
  const [initialValues, setInitialValues] = useState<z.input<typeof buildingSchema> | undefined>(undefined);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState<string|null>(null);
  const [backendError, setBackendError] = useState<string|null>(null);
  const back='/app/projects/'+projectId+'/structure';

  const fetchBuilding = useCallback(async () => {
    if (!id) return;
    if (!companyId) {
      setLoading(false);
      setLoadError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      setInitialValues(mapApiBuildingToFormValues(await getBuilding(companyId, projectId, id), projectId));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setLoadError('Building not found.');
      } else if (err instanceof ApiError && err.status === 401) {
        setLoadError('Your session has expired. Please sign in again.');
      } else {
        setLoadError(friendlyMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId, id]);

  /* eslint-disable react-hooks/set-state-in-effect -- building prefill load on mount */
  useEffect(() => {
    fetchBuilding();
  }, [fetchBuilding]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const form=useForm<z.input<typeof buildingSchema>,unknown,z.output<typeof buildingSchema>>({resolver:zodResolver(buildingSchema),values:initialValues,defaultValues:{name:'',description:'',projectId}});

  if (id && loading) {
    return <p className="small" role="status" aria-live="polite">Loading building…</p>;
  }
  if (id && (loadError || !initialValues)) {
    return <><p className="field-error" role="alert">{loadError ?? 'Building not found.'}</p><p className="section-space"><button className="button secondary" type="button" onClick={fetchBuilding}>Retry</button></p></>;
  }

  return <div className="form-layout"><PageHeader title={id?'Edit Building':'Add Building'} description={'Add a structural enclosure to '+(data.projects.find(p=>p.id===projectId)?.name??'the project')} back={back}/><FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(async (v)=>{
    if (!companyId) {
      setBackendError('No company context. Please sign in again.');
      return;
    }
    setBackendError(null);
    try {
      if (id) {
        await updateBuilding(companyId, projectId, id, mapBuildingFormToUpdate(v));
      } else {
        await createBuilding(companyId, projectId, mapBuildingFormToCreate(v));
      }
      notify('Building saved.');
      router.push(back);
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          if (field === 'name' || field === 'description') form.setError(field, { message: messages[0] });
        }
      }
      setBackendError(friendlyMessage(error));
    }
  })}><FormSection title="Building Information"><Field name="name" label="Building Name *" placeholder="e.g. Building A or East Wing Block"/><Textarea name="description" label="Description (Optional)" placeholder="Main residential block facing the eastern entrance."/></FormSection>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions onCancel={()=>router.push(back)} label={id?'Save Changes':'Add Building'} pending={form.formState.isSubmitting}/></form></FormProvider></div>;
}
export function FloorForm({buildingId,id}:{buildingId:string;id?:string}){
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get('projectId');
  const companyId = useAuthStore((s) => s.companyId);
  const {data,notify}=useWorkspace();
  const router=useRouter();
  // Parent building context: real API when the hierarchy passes projectId,
  // otherwise the legacy mock lookup. Floor CRUD itself stays mock.
  const [realParent, setRealParent] = useState<{name:string;projectId:string}|null>(null);
  const [parentLoading, setParentLoading] = useState(!!queryProjectId);
  const [parentError, setParentError] = useState<string|null>(null);
  const [initialValues, setInitialValues] = useState<z.input<typeof floorApiSchema> | undefined>(undefined);
  const [recordLoading, setRecordLoading] = useState(!!id);
  const [recordError, setRecordError] = useState<string|null>(null);
  const [backendError, setBackendError] = useState<string|null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- parent building context load on mount */
  useEffect(() => {
    if (!queryProjectId) return;
    if (!companyId) {
      setParentError('No company context. Please sign in again.');
      setParentLoading(false);
      return;
    }
    let cancelled = false;
    setParentLoading(true);
    setParentError(null);
    getBuilding(companyId, queryProjectId, buildingId).then(
      (b) => { if (!cancelled) { setRealParent({name: b.name, projectId: b.projectId}); setParentLoading(false); } },
      (err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
          setParentError('Building not found.');
        } else if (err instanceof ApiError && err.status === 401) {
          setParentError('Your session has expired. Please sign in again.');
        } else {
          setParentError(friendlyMessage(err));
        }
        setParentLoading(false);
      },
    );
    return () => { cancelled = true; };
  }, [queryProjectId, companyId, buildingId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const mockParent = queryProjectId ? undefined : data.buildings.find(b=>b.id===buildingId);
  const parentName = realParent?.name ?? mockParent?.name;
  const parentProjectId = realParent?.projectId ?? mockParent?.projectId ?? queryProjectId;
  const back = parentProjectId ? '/app/projects/'+parentProjectId+'/structure' : '/app/projects';

  const fetchRecord = useCallback(async () => {
    if (!id) return;
    if (!companyId || !parentProjectId) {
      setRecordLoading(false);
      if (!parentProjectId) setRecordError('Building context is not available.');
      return;
    }
    setRecordLoading(true);
    setRecordError(null);
    try {
      setInitialValues(mapApiFloorToFormValues(await getFloor(companyId, parentProjectId, buildingId, id), buildingId));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
        setRecordError('Floor not found.');
      } else if (err instanceof ApiError && err.status === 401) {
        setRecordError('Your session has expired. Please sign in again.');
      } else {
        setRecordError(friendlyMessage(err));
      }
    } finally {
      setRecordLoading(false);
    }
  }, [companyId, parentProjectId, buildingId, id]);

  /* eslint-disable react-hooks/set-state-in-effect -- floor prefill load once parent context resolves */
  useEffect(() => {
    if (queryProjectId && (parentLoading || !parentProjectId)) return;
    fetchRecord();
  }, [fetchRecord, queryProjectId, parentLoading, parentProjectId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const form=useForm<z.input<typeof floorApiSchema>,unknown,z.output<typeof floorApiSchema>>({resolver:zodResolver(floorApiSchema),values:initialValues,defaultValues:{name:'',number:'',description:'',buildingId}});

  if ((queryProjectId && parentLoading) || (id && recordLoading)) {
    return <p className="small" role="status" aria-live="polite">Loading…</p>;
  }
  if (parentError || !parentProjectId || (id && (recordError || !initialValues))) {
    return <><p className="field-error" role="alert">{parentError ?? recordError ?? 'Floor not found.'}</p><p className="section-space"><Link href="/app/projects">Back to Projects</Link></p></>;
  }

  return <div className="form-layout"><PageHeader title={id?'Edit Floor':'Add Floor'} description={'Define a floor within '+(parentName??'this building')} back={back}/><div className="form-note">Parent Structural Enclosure · {parentName??'Unknown building'}</div><FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(async (v)=>{
    if (!companyId || !parentProjectId) {
      setBackendError('Building context is not available.');
      return;
    }
    setBackendError(null);
    try {
      if (id) {
        await updateFloor(companyId, parentProjectId, buildingId, id, mapFloorFormToUpdate(v));
      } else {
        await createFloor(companyId, parentProjectId, buildingId, mapFloorFormToCreate(v));
      }
      notify('Floor successfully saved.');
      router.push(back);
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          if (field === 'name' || field === 'description') form.setError(field, { message: messages[0] });
          if (field === 'floor_number') form.setError('number', { message: messages[0] });
        }
      }
      if (error instanceof ApiError && error.status === 409) {
        form.setError('number', { message: error.detail });
      }
      setBackendError(friendlyMessage(error));
    }
  })}><FormSection title="Floor Specification"><div className="form-grid"><Field name="name" label="Floor Name" placeholder="e.g. Floor 3"/><Field name="number" label="Floor Number *" type="number" step="1" placeholder="3"/></div><Textarea name="description" label="Optional Description / Notes"/></FormSection>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions onCancel={()=>router.push(back)} label={id?'Save Changes':'Add Floor'} pending={form.formState.isSubmitting}/></form></FormProvider></div>;
}
function LegacyLandForm({onClose}:{onClose:()=>void}){const {data,update,notify}=useWorkspace();const form=useForm<z.input<typeof landSchema>,unknown,z.output<typeof landSchema>>({resolver:zodResolver(landSchema),values:data.land,defaultValues:data.land});return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(v=>{update({land:v});notify('Land information updated.');onClose();})}><div className="form-grid"><Field name="area" label="Land Area (sqm)" type="number"/><Field name="parcel" label="Parcel Number"/><Field name="maxHeight" label="Max Height (m)" type="number"/><Field name="ratio" label="Building Ratio (%)" type="number"/></div><div className="section-space"><Textarea name="constraints" label="Zoning & Regulatory Constraints"/></div><div className="section-space"><Textarea name="notes" label="Operational Notes"/></div><FormActions onCancel={onClose}/></form></FormProvider>;}

/** Real Land Record form (GET prefill + PATCH save). Mounted fresh on each dialog open. */
function LandRecordForm({projectId,onClose,onSaved}:{projectId:string;onClose:()=>void;onSaved?:()=>void}){
  const companyId = useAuthStore((s) => s.companyId);
  const { notify } = useWorkspace();
  const [initialValues, setInitialValues] = useState<z.input<typeof landRecordSchema> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  const fetchRecord = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setLoadError('No company context. Please sign in again.');
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      setInitialValues(mapApiLandRecordToFormValues(await getLandRecord(companyId, projectId)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setLoadError('Land record is not available for this project.');
      } else if (err instanceof ApiError && err.status === 401) {
        setLoadError('Your session has expired. Please sign in again.');
      } else {
        setLoadError(friendlyMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId]);

  /* eslint-disable react-hooks/set-state-in-effect -- land record prefill load on dialog open */
  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const form = useForm<z.input<typeof landRecordSchema>, unknown, z.output<typeof landRecordSchema>>({
    resolver: zodResolver(landRecordSchema),
    values: initialValues,
    defaultValues: { area: '', parcel: '', maxHeight: '', ratio: '', constraints: '', notes: '' },
  });

  if (loading) {
    return (
      <p className="small" role="status" aria-live="polite">
        Loading land record…
      </p>
    );
  }
  if (loadError || !initialValues) {
    return (
      <div className="stack" role="alert">
        <p className="field-error">{loadError ?? 'Land record is not available.'}</p>
        <div>
          <button className="button secondary" type="button" onClick={fetchRecord}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
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
            await updateLandRecord(companyId, projectId, mapLandRecordFormToUpdate(v));
            notify('Land information updated.');
            onSaved?.();
            onClose();
          } catch (error) {
            if (error instanceof ApiError && error.fields) {
              for (const [field, messages] of Object.entries(error.fields)) {
                const formField = LAND_RECORD_FIELD_MAP[field];
                if (formField) form.setError(formField, { message: messages[0] });
              }
            }
            setBackendError(friendlyMessage(error));
          }
        })}
      >
        <div className="form-grid">
          <Field name="area" label="Land Area (sqm)" type="number" step="any" />
          <Field name="parcel" label="Parcel Number" />
          <Field name="maxHeight" label="Max Height (m)" type="number" step="any" />
          <Field name="ratio" label="Building Ratio (%)" type="number" step="any" />
        </div>
        <div className="section-space">
          <Textarea name="constraints" label="Zoning & Regulatory Constraints" />
        </div>
        <div className="section-space">
          <Textarea name="notes" label="Operational Notes" />
        </div>
        {backendError && (
          <p className="field-error" role="alert">
            {backendError}
          </p>
        )}
        <FormActions onCancel={onClose} pending={form.formState.isSubmitting} />
      </form>
    </FormProvider>
  );
}

export function LandForm({projectId,onClose,onSaved}:{projectId?:string;onClose:()=>void;onSaved?:()=>void}){
  if (!projectId) return <LegacyLandForm onClose={onClose} />;
  return <LandRecordForm projectId={projectId} onClose={onClose} onSaved={onSaved} />;
}
