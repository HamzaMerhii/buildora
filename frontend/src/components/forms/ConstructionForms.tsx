'use client';
import { useCallback, useEffect, useRef, useId, useState } from 'react';
import { useForm,FormProvider,useFormContext } from 'react-hook-form';
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
import { PageHeader, EmptyState, Badge } from '../ui/Primitives';
import { Field,Textarea,FormActions,NumberedSection } from './FormPrimitives';
import { taskApiSchema } from '@/lib/validations/task.schema';
import { taskUpdateSchema } from '@/lib/validations/task-update.schema';
import { progress as progressRule, taskStatus, optionalText } from '@/lib/validations/common';
import {
  createTask,
  getTask,
  mapApiTaskToFormValues,
  mapTaskFormToCreate,
  mapTaskFormToUpdate,
  postTaskUpdate,
  resolveTaskChain,
  updateTask,
  type FrontendTaskStatus,
} from '@/lib/api/task.api';
import { getStage, getStages, type ApiStage } from '@/lib/api/construction-stage.api';
import { getParties, type ApiParty } from '@/lib/api/party.api';
import {
  companyRoleLabel,
  getCompanyMembers,
  type ApiCompanyMember,
} from '@/lib/api/company-member.api';
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
})}><NumberedSection number={1} title="Stage Information" micro="GENERAL">{id
?<div className="form-note">Project · {resolvedProjectName||resolvedProjectId}</div>
:<Field name="projectId" label="Project *">{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Field>}<Field name="name" label="Stage Name *" placeholder="e.g. Structure"/><Textarea name="description" label="Description"/></NumberedSection><NumberedSection number={2} title="Timeline" micro="SCHEDULE"><div className="form-grid"><Field name="startDate" label="Start Date" type="date"/><Field name="endDate" label="Due Date" type="date"/></div></NumberedSection><NumberedSection number={3} title="Status" micro="LIFECYCLE"><Field name="status" label="Construction Stage Status *"><StatusOptions/></Field></NumberedSection>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions onCancel={()=>router.push('/app/construction')} label={id?'Save Changes':'Create Stage'} pending={form.formState.isSubmitting}/></form></FormProvider></div>;}
const TASK_STATUS_OPTIONS=[{value:'NOT_STARTED',title:'Not Started',description:'Work has not begun on site.'},{value:'IN_PROGRESS',title:'In Progress',description:'Actively being executed by the site team.'},{value:'COMPLETED',title:'Completed',description:'Verified and signed off.'}] as const;
function StatusCards(){const {register,watch,formState:{errors}}=useFormContext();const value=watch('status') as string|undefined;const [focused,setFocused]=useState<string|null>(null);const error=errors.status?.message;return <div className="field"><span style={{fontSize:12,fontWeight:600}}>Task Status *</span><div style={{display:'flex',flexDirection:'column',gap:10}}>{TASK_STATUS_OPTIONS.map(o=><label key={o.value} style={{display:'flex',alignItems:'center',gap:12,padding:14,borderRadius:10,border:value===o.value?'1.5px solid var(--amber)':'1px solid var(--line)',background:value===o.value?'#f59e0b14':'#fff',cursor:'pointer',transition:'border-color .15s, background .15s',outline:focused===o.value?'2px solid var(--amber)':'none',outlineOffset:3}}><input type="radio" value={o.value} {...register('status')} onFocus={()=>setFocused(o.value)} onBlur={()=>setFocused(null)} aria-label={o.title} style={{position:'absolute',opacity:0,width:1,height:1}}/><span style={{width:18,height:18,borderRadius:'50%',border:value===o.value?'1.5px solid var(--amber)':'1.5px solid #c0c6db',display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#fff',flexShrink:0}}>{value===o.value&&<span style={{width:10,height:10,borderRadius:'50%',background:'var(--amber)'}}/>}</span><span style={{flex:1,minWidth:0}}><strong style={{display:'block',fontSize:13}}>{o.title}</strong><small style={{color:'var(--muted)'}}>{o.description}</small></span><Badge value={o.value}/></label>)}</div>{error&&<p className="field-error" role="alert">{String(error)}</p>}</div>;}
function ProgressControl(){const {watch,setValue}=useFormContext();const raw=watch('progress') as number|string|undefined;const num=typeof raw==='number'?raw:Number(raw);const safe=Number.isFinite(num)?Math.min(100,Math.max(0,Math.round(num))):0;return <div className="field"><label htmlFor="task-progress-slider" style={{fontSize:12,fontWeight:600}}>Progress Preview</label><input id="task-progress-slider" type="range" min={0} max={100} step={1} value={safe} onChange={e=>setValue('progress',Number(e.target.value),{shouldValidate:true,shouldDirty:true})} style={{width:'100%',accentColor:'var(--amber)'}} aria-valuetext={`${safe} percent`}/><small style={{color:'var(--muted)'}}>{safe}% complete</small></div>;}
function TaskStageHelper({stages}:{stages: ApiStage[]}){const {watch}=useFormContext();const stageId=watch('stageId') as string|undefined;const stage=stages.find(s=>s.id===stageId);const prev=stage?stages.find(s=>s.order===stage.order-1):undefined;return <p className="small" style={{marginTop:8}}>{stage?`This task will be connected to ${stage.name}.`:''}{prev?` Previous phase: ${prev.name}.`:''}</p>;}
function AssignmentPreview({userName,userRole,partyName}:{userName?:string;userRole?:string;partyName?:string}){
const userInitials=(userName??'').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()||'?';
const partyInitials=(partyName??'').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()||'?';
return <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:12}}>
<div style={{display:'flex',alignItems:'center',gap:12,padding:14,border:'1px solid var(--line)',borderRadius:10,background:'var(--surface)'}}><span aria-hidden="true" style={{width:40,height:40,borderRadius:'50%',background:'var(--low)',color:'var(--amber-dark)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,flexShrink:0}}>{userInitials}</span><span style={{flex:1,minWidth:0}}><small style={{color:'var(--muted)'}}>Assigned Team Member</small><strong style={{display:'block',fontSize:14}}>{userName??'Not selected'}</strong><small style={{color:'var(--muted)'}}>{userRole??''}</small></span></div>
<div style={{display:'flex',alignItems:'center',gap:12,padding:14,border:'1px solid var(--line)',borderRadius:10,background:'var(--surface)'}}><span aria-hidden="true" style={{width:40,height:40,borderRadius:'8px',background:'var(--low)',color:'var(--amber-dark)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,flexShrink:0}}>{partyInitials}</span><span style={{flex:1,minWidth:0}}><small style={{color:'var(--muted)'}}>Executed By</small><strong style={{display:'block',fontSize:14}}>{partyName??'Not selected'}</strong>{partyName&&<Badge value="CONTRACTOR"/>}</span></div>
</div>;}
export function TaskForm({id}:{id?:string}){
const companyId=useAuthStore((s)=>s.companyId);
const sessionUser=useAuthStore((s)=>s.user);
const companyRole=useAuthStore((s)=>s.companyRole);
const {notify}=useWorkspace();
const router=useRouter();
const searchParams=useSearchParams();
const hintProjectId=searchParams.get('projectId');
const hintStageId=searchParams.get('stageId');
const [projects,setProjects]=useState<Array<{id:string;name:string}>>([]);
const [stages,setStages]=useState<ApiStage[]>([]);
const [parties,setParties]=useState<ApiParty[]>([]);
const [members,setMembers]=useState<ApiCompanyMember[]>([]);
const [membersLoading,setMembersLoading]=useState(true);
const [membersError,setMembersError]=useState<string|null>(null);
const [initialValues,setInitialValues]=useState<z.input<typeof taskApiSchema>|undefined>(undefined);
const [resolvedChain,setResolvedChain]=useState<{projectId:string;stageId:string;stageName?:string}|null>(null);
const [loading,setLoading]=useState(!!id);
const [loadError,setLoadError]=useState<string|null>(null);
const [backendError,setBackendError]=useState<string|null>(null);
const [createdId,setCreatedId]=useState<string|null>(null);
const fetchOptions=useCallback(async()=>{
if(id||!companyId)return;
try{
const [plist,partiesList]=await Promise.all([getProjects(companyId,{limit:100}),getParties(companyId)]);
setProjects(plist.map((p)=>({id:p.id,name:p.name})));
setParties(partiesList);
}catch{
setProjects([]);setParties([]);
}
},[companyId,id]);
useEffect(()=>{fetchOptions();},[fetchOptions]);
const fetchMembers=useCallback(async()=>{
if(!companyId){setMembers([]);setMembersLoading(false);setMembersError('No company context. Please sign in again.');return;}
setMembersLoading(true);setMembersError(null);
try{setMembers(await getCompanyMembers(companyId));}
catch(err){
setMembers([]);
if(err instanceof ApiError&&err.status===403){setMembersError('Only company owners can list the full team. Your own account remains selectable.');}
else if(err instanceof ApiError&&err.status===401){setMembersError('Your session has expired. Please sign in again.');}
else if(err instanceof ApiError&&(err.status===404||err.status===422)){setMembersError('Company not found.');}
else{setMembersError(friendlyMessage(err));}
}
finally{setMembersLoading(false);}
},[companyId]);
useEffect(()=>{fetchMembers();},[fetchMembers]);
const fetchRecord=useCallback(async()=>{
if(!id)return;
if(!companyId){setLoading(false);setLoadError('No company context. Please sign in again.');return;}
setLoading(true);setLoadError(null);
try{
const resolved=await resolveTaskChain(companyId,id,hintProjectId&&hintStageId?{projectId:hintProjectId,stageId:hintStageId}:undefined);
const [fresh,partiesList,stageInfo]=await Promise.all([
getTask(companyId,resolved.chain.projectId,resolved.chain.stageId,id),
getParties(companyId).catch(()=>[]),
getStage(companyId,resolved.chain.projectId,resolved.chain.stageId).catch(()=>null),
]);
setResolvedChain({projectId:resolved.chain.projectId,stageId:resolved.chain.stageId,stageName:stageInfo?.name});
setParties(partiesList);
setInitialValues(mapApiTaskToFormValues(fresh,resolved.chain.stageId));
}catch(err){
if(err instanceof ApiError&&(err.status===404||err.status===422)){setLoadError('Task not found.');}
else if(err instanceof ApiError&&err.status===401){setLoadError('Your session has expired. Please sign in again.');}
else{setLoadError(friendlyMessage(err));}
}finally{setLoading(false);}
},[companyId,id,hintProjectId,hintStageId]);
useEffect(()=>{fetchRecord();},[fetchRecord]);
const form=useForm<z.input<typeof taskApiSchema>,unknown,z.output<typeof taskApiSchema>>({resolver:zodResolver(taskApiSchema),values:initialValues,defaultValues:{title:'',description:'',projectId:hintProjectId??'',stageId:hintStageId??'',assignedTo:sessionUser?.id??'',partyId:'',startDate:'',endDate:'',progress:0,status:'NOT_STARTED',notes:''}});
const watchedProjectId=form.watch('projectId') as string|undefined;
const watchedAssignedTo=form.watch('assignedTo') as string|undefined;
const watchedPartyId=form.watch('partyId') as string|undefined;
const fetchStagesFor=useCallback(async(pid:string|undefined)=>{
if(id||!companyId||!pid){if(!id)setStages([]);return;}
try{setStages(await getStages(companyId,pid));}catch{setStages([]);}
},[companyId,id]);
useEffect(()=>{fetchStagesFor(watchedProjectId);},[watchedProjectId,fetchStagesFor]);
const contractors=parties.filter((p)=>p.type==='CONTRACTOR');
const previewPartyName=parties.find((p)=>p.id===watchedPartyId)?.name;
const eligibleMembers=members.filter((m)=>m.isActive);
const membersByUserId=new Map(eligibleMembers.map((m)=>[m.userId,m]));
const sessionFallback=!sessionUser?null:{membershipId:'',userId:sessionUser.id,name:sessionUser.name,email:sessionUser.email,role:companyRole??'OTHER',isActive:true} as ApiCompanyMember;
const assigneeOptions=eligibleMembers.length?eligibleMembers:(sessionFallback?[sessionFallback]:[]);
const selectedMember=watchedAssignedTo?membersByUserId.get(watchedAssignedTo)??(sessionFallback&&watchedAssignedTo===sessionFallback.userId?sessionFallback:null):null;
const assignedFallback=initialValues?.assignedTo&&!assigneeOptions.some((m)=>m.userId===initialValues.assignedTo)?initialValues.assignedTo:null;
const partyFallback=!id?null:((initialValues?.partyId&&!parties.some((p)=>p.id===initialValues.partyId))?initialValues.partyId:null);
const selectedUserName=selectedMember?.name;
const selectedUserRole=selectedMember?companyRoleLabel[selectedMember.role]:undefined;
if(id&&loading)return <p className="small" role="status" aria-live="polite">Loading task…</p>;
if(id&&(loadError||!initialValues||!resolvedChain))return <><p className="field-error" role="alert">{loadError??'Task not found.'}</p><p className="section-space"><button className="button secondary" type="button" onClick={fetchRecord}>Retry</button></p></>;
return <div className="form-layout"><PageHeader title={id?'Edit Task':'Create Task'} description="Add a work item to a construction stage." back="/app/construction">{id&&resolvedChain?<span className="small">Stage · {resolvedChain.stageName??resolvedChain.stageId}</span>:null}</PageHeader><FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(async(v)=>{
if(!companyId){setBackendError('No company context. Please sign in again.');return;}
setBackendError(null);
try{
if(id&&resolvedChain){
await updateTask(companyId,resolvedChain.projectId,resolvedChain.stageId,id,mapTaskFormToUpdate(v));
if(v.notes?.trim()){
await postTaskUpdate(companyId,resolvedChain.projectId,resolvedChain.stageId,id,{progress:v.progress,status:v.status,notes:v.notes.trim()});
}
notify('Task saved successfully.');
router.push('/app/tasks/'+id);
}else{
if(!watchedProjectId){setBackendError('Choose a project.');return;}
if(!v.stageId){setBackendError('Choose a construction stage.');return;}
let newId=createdId;
if(!newId){
const created=await createTask(companyId,watchedProjectId,v.stageId,mapTaskFormToCreate(v));
newId=created.id;setCreatedId(newId);
}
if(v.notes?.trim()){
await postTaskUpdate(companyId,watchedProjectId,v.stageId,newId,{progress:v.progress,status:v.status,notes:v.notes.trim()});
}
notify('Task saved successfully.');
router.push('/app/tasks/'+newId);
}
}catch(error){
if(error instanceof ApiError&&error.fields){
for(const [field,messages] of Object.entries(error.fields)){
if(field==='assigned_to')form.setError('assignedTo',{message:messages[0]});
else if(field==='party_id')form.setError('partyId',{message:messages[0]});
else if(field==='start_date')form.setError('startDate',{message:messages[0]});
else if(field==='due_date')form.setError('endDate',{message:messages[0]});
else if(field==='progress_percent')form.setError('progress',{message:messages[0]});
else if(field in v)form.setError(field as keyof typeof v,{message:messages[0]});
}
}
setBackendError(friendlyMessage(error));
}
})}><NumberedSection number={1} title="Task Information" micro="GENERAL"><Field name="title" label="Task Name *" placeholder="e.g. Install Third Floor Reinforcement"/><Textarea name="description" label="Description" placeholder="e.g. Scope inclusions, quality benchmarks, safety notes…"/><p className="small">Clear titles and measurable scope help the site team execute faster.</p></NumberedSection><NumberedSection number={2} title="Construction Stage" micro="STAGE">{id&&resolvedChain
?<><p className="small">Stage · {resolvedChain.stageName??resolvedChain.stageId}</p><p className="small" style={{color:'var(--muted)'}}>Structural placement cannot be changed after creation.</p></>
:<><Field name="projectId" label="Project *"><option value="">Select project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Field><div className="field"><label>Project Scope</label><ProjectScopeNote projectId={watchedProjectId??''} stages={stages}/></div><Field name="stageId" label="Construction Stage *"><option value="">Select stage</option>{stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Field><TaskStageHelper stages={stages}/></>}</NumberedSection><NumberedSection number={3} title="Assignment" micro="ASSIGNMENT"><div className="form-grid"><Field name="assignedTo" label="Assigned Team Member *">{membersLoading?<option value="">Loading team members…</option>:assigneeOptions.length===0?<option value="">No team member available</option>:<><option value="">Select team member</option>{assigneeOptions.map((m)=><option key={m.userId} value={m.userId}>{m.name} — {companyRoleLabel[m.role]}{m.userId===sessionUser?.id?' (you)':''}</option>)}</>}{assignedFallback?<option value={assignedFallback} disabled>Former member · {assignedFallback.slice(0,8)}</option>:null}</Field><Field name="partyId" label="Executing Contractor *"><option value="">Select contractor</option>{contractors.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{partyFallback?<option value={partyFallback} disabled>Former party · {partyFallback.slice(0,8)}</option>:null}</Field></div>{membersError&&<p className="field-error" role="alert">{membersError}</p>}{membersError&&<p><button className="button secondary" type="button" onClick={fetchMembers}>Retry members</button></p>}<AssignmentPreview userName={selectedUserName} userRole={selectedUserRole} partyName={previewPartyName}/></NumberedSection><NumberedSection number={4} title="Timeline" micro="SCHEDULE" description="Set a working window for site execution."><div className="form-grid"><Field name="startDate" label="Start Date *" type="date"/><Field name="endDate" label="Due Date *" type="date"/></div></NumberedSection><NumberedSection number={5} title="Progress & Status" micro="PROGRESS"><div className="form-grid"><div><Field name="progress" label="Progress Percentage (%) *" type="number"/><div className="section-space"><ProgressControl/></div></div><StatusCards/></div></NumberedSection><NumberedSection number={6} title="Notes" micro="NOTES" description="Field instructions for the executing team."><Textarea name="notes" label="Logistical & Quality Notes" placeholder="e.g. Site instructions, inspection notes, logistical constraints…"/><p className="small">Notes are saved as a site log entry alongside this task.</p></NumberedSection>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions onCancel={()=>router.push(id?'/app/tasks/'+id:'/app/construction')} label={id?'Save Changes':'Create Task'} pending={form.formState.isSubmitting}/></form></FormProvider></div>;}
function ProjectScopeNote({projectId,stages}:{projectId:string;stages:ApiStage[]}){const count=stages.length;return <p className="small" style={{marginTop:8}}>{!projectId?'Choose a project to list its stages.':count?`${count} stage${count===1?'':'s'} available in this project.`:'No stages in this project yet.'}</p>;}
function LegacyTaskUpdateForm({taskId,onClose}:{taskId:string;onClose:()=>void}){const {data,update,notify}=useWorkspace();const task=data.tasks.find(t=>t.id===taskId);const form=useForm<z.input<typeof taskUpdateSchema>,unknown,z.output<typeof taskUpdateSchema>>({resolver:zodResolver(taskUpdateSchema),defaultValues:{progress:task?.progress??0,notes:''}});return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(v=>{update({tasks:data.tasks.map(t=>t.id===taskId?{...t,progress:v.progress,status:v.progress===100?'COMPLETED':v.progress>0?'IN_PROGRESS':'NOT_STARTED'}:t),updates:[{id:crypto.randomUUID(),taskId,progress:v.progress,notes:v.notes,date:new Date().toISOString(),photo:v.photo?.[0]?URL.createObjectURL(v.photo[0]):undefined},...data.updates]});notify('Task update saved successfully.');onClose();})}><p className="form-note">{task?.title} · Current progress: {task?.progress}%</p><Field name="progress" label="New Progress Percentage *" type="number"/><div className="section-space"><Textarea name="notes" label="Notes / Site Observation"/></div><div className="section-space"><Field name="photo" label="Photo Upload (Optional)" type="file" accept="image/jpeg,image/png" hint="JPG, PNG up to 10MB"/></div><FormActions onCancel={onClose} label="Save Update"/></form></FormProvider>;}
const taskUpdateApiSchema=z.object({progress:progressRule, status:taskStatus, notes:optionalText});
function RealTaskUpdateForm({companyId,projectId,stageId,taskId,taskTitle,currentProgress,currentStatus,onClose,onSaved}:{companyId:string;projectId:string;stageId:string;taskId:string;taskTitle?:string;currentProgress?:number;currentStatus?:FrontendTaskStatus;onClose:()=>void;onSaved?:()=>void}){
const {notify}=useWorkspace();
const [backendError,setBackendError]=useState<string|null>(null);
const [selectedFile,setSelectedFile]=useState<File|null>(null);
const [previewUrl,setPreviewUrl]=useState<string|null>(null);
const fileInputRef=useRef<HTMLInputElement|null>(null);
const photoInputId=useId();
const form=useForm<z.input<typeof taskUpdateApiSchema>,unknown,z.output<typeof taskUpdateApiSchema>>({resolver:zodResolver(taskUpdateApiSchema),defaultValues:{progress:currentProgress??0,status:currentStatus??'NOT_STARTED',notes:''}});
/* eslint-disable react-hooks/set-state-in-effect -- photo preview lifecycle */
useEffect(()=>{if(!selectedFile){setPreviewUrl(null);return;}const url=URL.createObjectURL(selectedFile);setPreviewUrl(url);return ()=>URL.revokeObjectURL(url);},[selectedFile]);
/* eslint-enable react-hooks/set-state-in-effect */
return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(async(v)=>{
setBackendError(null);
if(selectedFile&&selectedFile.size>10*1024*1024){setBackendError('Photo must be 10MB or smaller.');return;}
try{
await postTaskUpdate(companyId,projectId,stageId,taskId,{progress:v.progress,status:v.status,notes:v.notes||undefined,image:selectedFile??undefined});
notify('Task update saved successfully.');
onSaved?.();onClose();
}catch(error){setBackendError(friendlyMessage(error));}
})}><p className="form-note">{taskTitle??'Task'} · Current progress: {currentProgress??0}%</p><Field name="progress" label="New Progress Percentage *" type="number"/><div className="section-space"><Field name="status" label="Resulting Task Status *"><StatusOptions/></Field></div><div className="section-space"><Textarea name="notes" label="Notes / Site Observation"/></div><div className="section-space"><div className="field"><label htmlFor={photoInputId}>Photo Upload (Optional)</label><input id={photoInputId} ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>setSelectedFile(e.target.files?.[0]??null)}/><small>JPG, PNG or WEBP up to 10MB</small></div>{previewUrl&&<div className="section-space"><img src={previewUrl} alt="Selected site photo preview" style={{maxWidth:320,borderRadius:8}}/><div><button className="button secondary" type="button" onClick={()=>{setSelectedFile(null);if(fileInputRef.current)fileInputRef.current.value='';}}>Remove Photo</button></div></div>}</div>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions onCancel={onClose} label="Save Update" pending={form.formState.isSubmitting}/></form></FormProvider>;}
export function TaskUpdateForm({taskId,onClose,chain,currentStatus,currentProgress,taskTitle,onSaved}:{taskId:string;onClose:()=>void;chain?:{companyId:string;projectId:string;stageId:string};currentStatus?:FrontendTaskStatus;currentProgress?:number;taskTitle?:string;onSaved?:()=>void}){
if(!chain)return <LegacyTaskUpdateForm taskId={taskId} onClose={onClose}/>;
return <RealTaskUpdateForm companyId={chain.companyId} projectId={chain.projectId} stageId={chain.stageId} taskId={taskId} taskTitle={taskTitle} currentProgress={currentProgress} currentStatus={currentStatus} onClose={onClose} onSaved={onSaved}/>;
}
