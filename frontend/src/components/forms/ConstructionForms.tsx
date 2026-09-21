'use client';
import { useCallback, useEffect, useState } from 'react';
import { useForm,FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { stageApiSchema } from '@/lib/validations/construction-stage.schema';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess } from '@/lib/auth/permissions';
import {
  createStage,
  mapApiStageToFormValues,
  mapStageFormToCreate,
  mapStageFormToUpdate,
  resolveStageProject,
  updateStage,
} from '@/lib/api/construction-stage.api';
import { getProjects } from '@/lib/api/project.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { useWorkspace } from '../features/WorkspaceProvider';
import { PageHeader, EmptyState } from '../ui/Primitives';
import { Field,Textarea,FormSection,FormActions } from './FormPrimitives';
import { taskSchema } from '@/lib/validations/task.schema';
import { taskUpdateSchema } from '@/lib/validations/task-update.schema';
function StatusOptions(){return <><option value="NOT_STARTED">Not Started</option><option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option></>;}
export function StageForm({id}:{id?:string}){
const companyId=useAuthStore((s)=>s.companyId);
const companyRole=useAuthStore((s)=>s.companyRole);
const {notify}=useWorkspace();
const router=useRouter();
const searchParams=useSearchParams();
const hintProjectId=searchParams.get('projectId');
// Stage mutations require OWNER/PROJECT_MANAGER backend-side; the frontend
// map has no stage-mutate key, so the PM-level 'projects-mutate' key is the
// documented proxy for these gates.
const canMutate=!companyRole||canAccess(companyRole,'projects-mutate');
const [projects,setProjects]=useState<Array<{id:string;name:string}>>([]);
const [initialValues,setInitialValues]=useState<z.input<typeof stageApiSchema>|undefined>(undefined);
const [resolvedProjectId,setResolvedProjectId]=useState<string|null>(null);
const [resolvedProjectName,setResolvedProjectName]=useState('');
const [loading,setLoading]=useState(!!id);
const [loadError,setLoadError]=useState<string|null>(null);
const [backendError,setBackendError]=useState<string|null>(null);
const fetchProjects=useCallback(async()=>{if(id||!companyId)return;try{const list=await getProjects(companyId,{limit:100});setProjects(list.map((p)=>({id:p.id,name:p.name})));}catch{setProjects([]);}},[companyId,id]);
/* eslint-disable react-hooks/set-state-in-effect -- project options load on mount */
useEffect(()=>{fetchProjects();},[fetchProjects]);
/* eslint-enable react-hooks/set-state-in-effect */
const fetchRecord=useCallback(async()=>{
if(!id)return;
if(!companyId){setLoading(false);setLoadError('No company context. Please sign in again.');return;}
setLoading(true);setLoadError(null);
try{
const resolved=await resolveStageProject(companyId,id,hintProjectId?{id:hintProjectId}:undefined);
setResolvedProjectId(resolved.projectId);setResolvedProjectName(resolved.projectName??'');
setInitialValues(mapApiStageToFormValues(resolved.stage,resolved.projectId));
}catch(err){
if(err instanceof ApiError&&(err.status===404||err.status===422)){setLoadError('Stage not found.');}
else if(err instanceof ApiError&&err.status===401){setLoadError('Your session has expired. Please sign in again.');}
else{setLoadError(friendlyMessage(err));}
}finally{setLoading(false);}
},[companyId,id,hintProjectId]);
/* eslint-disable react-hooks/set-state-in-effect -- stage prefill load on mount */
useEffect(()=>{fetchRecord();},[fetchRecord]);
/* eslint-enable react-hooks/set-state-in-effect */
const form=useForm<z.input<typeof stageApiSchema>,unknown,z.output<typeof stageApiSchema>>({resolver:zodResolver(stageApiSchema),values:initialValues,defaultValues:{projectId:'',name:'',description:'',startDate:'',endDate:'',status:'NOT_STARTED'}});
if(!canMutate)return <EmptyState title="Not permitted" description="Your role cannot manage construction stages."/>;
if(id&&loading)return <p className="small" role="status" aria-live="polite">Loading stage…</p>;
if(id&&(loadError||!initialValues||!resolvedProjectId))return <><EmptyState title={loadError??'Stage not found'}/><p className="section-space"><button className="button secondary" type="button" onClick={fetchRecord}>Retry</button></p></>;
return <div className="form-layout"><PageHeader title={id?'Edit Construction Stage':'Create Construction Stage'} description="Define an operational phase and its execution timeline." back="/app/construction"/><FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(async(v)=>{
if(!companyId){setBackendError('No company context. Please sign in again.');return;}
setBackendError(null);
try{
if(id){
if(!resolvedProjectId){setBackendError('Project context is missing.');return;}
await updateStage(companyId,resolvedProjectId,id,mapStageFormToUpdate(v));
notify('Construction stage saved.');
router.push('/app/construction/stages/'+id+'?projectId='+resolvedProjectId);
}else{
if(!v.projectId){setBackendError('Choose a project.');return;}
const created=await createStage(companyId,v.projectId,mapStageFormToCreate(v));
notify('Construction stage saved.');
router.push('/app/construction/stages/'+created.id+'?projectId='+v.projectId);
}
}catch(error){
if(error instanceof ApiError&&error.fields){
for(const [field,messages] of Object.entries(error.fields)){
if(field==='start_date')form.setError('startDate',{message:messages[0]});
else if(field==='due_date')form.setError('endDate',{message:messages[0]});
else if(field in v)form.setError(field as keyof typeof v,{message:messages[0]});
}
}
setBackendError(friendlyMessage(error));
}
})}><FormSection title="Stage Information">{id
?<div className="form-note">Project · {resolvedProjectName||resolvedProjectId}</div>
:<Field name="projectId" label="Project *">{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Field>}<Field name="name" label="Stage Name *" placeholder="e.g. Structure"/><Textarea name="description" label="Description"/></FormSection><FormSection title="Timeline"><div className="form-grid"><Field name="startDate" label="Start Date" type="date"/><Field name="endDate" label="Due Date" type="date"/></div></FormSection><FormSection title="Status"><Field name="status" label="Construction Stage Status *"><StatusOptions/></Field></FormSection>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions onCancel={()=>router.push('/app/construction')} label={id?'Save Changes':'Create Stage'} pending={form.formState.isSubmitting}/></form></FormProvider></div>;}
export function TaskForm({id}:{id?:string}){const {data,save,notify}=useWorkspace();const router=useRouter();const record=data.tasks.find(t=>t.id===id);const form=useForm<z.input<typeof taskSchema>,unknown,z.output<typeof taskSchema>>({resolver:zodResolver(taskSchema),values:record,defaultValues:record??{title:'',description:'',stageId:'stage-3',assignee:'Omar Saleh',startDate:'2026-09-19',endDate:'2026-09-30',progress:0,status:'NOT_STARTED',notes:''}});return <div className="form-layout"><PageHeader title={id?'Edit Task':'Create Task'} description="Add a work item to a construction stage." back="/app/construction"/><FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(v=>{const key=id??crypto.randomUUID();save('tasks',{...v,id:key});notify('Task saved successfully.');router.push('/app/tasks/'+key);})}><FormSection title="1. Task Information"><Field name="title" label="Title *" placeholder="e.g. Install Third Floor Reinforcement"/><Textarea name="description" label="Description"/></FormSection><FormSection title="2. Construction Stage"><Field name="stageId" label="Construction Stage *">{data.stages.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</Field></FormSection><FormSection title="3. Assignment"><Field name="assignee" label="Assigned Team Member *"><option>Omar Saleh</option><option>Maya Haddad</option></Field></FormSection><FormSection title="4. Timeline"><div className="form-grid"><Field name="startDate" label="Start Date *" type="date"/><Field name="endDate" label="Due Date *" type="date"/></div></FormSection><FormSection title="5. Progress & Status"><div className="form-grid"><Field name="progress" label="Progress Percentage (%) *" type="number"/><Field name="status" label="Task Status *"><StatusOptions/></Field></div></FormSection><FormSection title="6. Notes"><Textarea name="notes" label="Logistical & Quality Notes"/></FormSection><FormActions onCancel={()=>router.push('/app/construction')} label={id?'Save Changes':'Create Task'}/></form></FormProvider></div>;}
export function TaskUpdateForm({taskId,onClose}:{taskId:string;onClose:()=>void}){const {data,update,notify}=useWorkspace();const task=data.tasks.find(t=>t.id===taskId);const form=useForm<z.input<typeof taskUpdateSchema>,unknown,z.output<typeof taskUpdateSchema>>({resolver:zodResolver(taskUpdateSchema),defaultValues:{progress:task?.progress??0,notes:''}});return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(v=>{update({tasks:data.tasks.map(t=>t.id===taskId?{...t,progress:v.progress,status:v.progress===100?'COMPLETED':v.progress>0?'IN_PROGRESS':'NOT_STARTED'}:t),updates:[{id:crypto.randomUUID(),taskId,progress:v.progress,notes:v.notes,date:new Date().toISOString(),photo:v.photo?.[0]?URL.createObjectURL(v.photo[0]):undefined},...data.updates]});notify('Task update saved successfully.');onClose();})}><p className="form-note">{task?.title} · Current progress: {task?.progress}%</p><Field name="progress" label="New Progress Percentage *" type="number"/><div className="section-space"><Textarea name="notes" label="Notes / Site Observation"/></div><div className="section-space"><Field name="photo" label="Photo Upload (Optional)" type="file" accept="image/jpeg,image/png" hint="JPG, PNG up to 10MB"/></div><FormActions onCancel={onClose} label="Save Update"/></form></FormProvider>;}
