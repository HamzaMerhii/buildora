'use client';
import { useForm,FormProvider,useFormContext,useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';
import { HardHat, Truck } from 'lucide-react';
import { partyApiSchema } from '@/lib/validations/party.schema';
import { paymentApiSchema } from '@/lib/validations/payment.schema';
import { useAuthStore } from '@/stores/auth.store';
import { canAccess } from '@/lib/auth/permissions';
import {
  createParty,
  getParties,
  getParty,
  mapPartyFormToCreate,
  mapPartyFormToUpdate,
  updateParty,
  type ApiParty,
} from '@/lib/api/party.api';
import { createPayment, mapPaymentFormToCreate } from '@/lib/api/payment.api';
import { getPaymentCategories, type ApiPaymentCategory } from '@/lib/api/payment-category.api';
import { getProjects } from '@/lib/api/project.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { categorySchema } from '@/lib/validations/payment-category.schema';
import { documentApiSchema, documentSchema } from '@/lib/validations/document.schema';
import { DOCUMENT_FILE_ACCEPT, uploadDocument } from '@/lib/api/document.api';
import { leadStatusSchema,leadMessageSchema } from '@/lib/validations/lead.schema';
import {
  LEAD_STATUS_LABEL,
  mapLeadMessageFormToUpdate,
  mapLeadStatusFormToUpdate,
  updateLead,
  type ApiLead,
  type LeadChain,
} from '@/lib/api/lead.api';
import { useWorkspace } from '../features/WorkspaceProvider';
import { PageHeader, EmptyState } from '../ui/Primitives';
import { Field,Textarea,FormActions,NumberedSection } from './FormPrimitives';
const PARTY_TYPE_OPTIONS = [
  { value:'CONTRACTOR', title:'Contractor', description:'Site execution, structural concrete pouring, mechanical trades, and specialty craft works.', badge:'On-Site Execution', Icon:HardHat },
  { value:'SUPPLIER', title:'Supplier', description:'Building materials, ready-mix trucks, rebar shipments, and specialized plant machinery delivery.', badge:'Procurement Logistics', Icon:Truck },
] as const;

function PartyTypeCard({option,checked,focused,onFocus,onBlur}:{option:(typeof PARTY_TYPE_OPTIONS)[number];checked:boolean;focused:boolean;onFocus:()=>void;onBlur:()=>void}){
  const {register}=useFormContext();
  const [hovered,setHovered]=useState(false);
  const {Icon}=option;
  return <label
    onMouseEnter={()=>setHovered(true)}
    onMouseLeave={()=>setHovered(false)}
    style={{display:'flex',flexDirection:'column',gap:10,padding:20,borderRadius:12,border:checked?'1.5px solid var(--amber)':'1px solid var(--line)',background:checked?'#f59e0b14':'#ffffff',cursor:'pointer',transition:'border-color .15s, background .15s, box-shadow .15s',boxShadow:hovered&&!checked?'0 5px 20px #0b1c3010':'none',outline:focused?'2px solid var(--amber)':'none',outlineOffset:3}}
  >
    <span style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
      <Icon size={22} style={{color:'var(--amber-dark)'}} aria-hidden="true"/>
      <span style={{width:18,height:18,borderRadius:'50%',border:checked?'1.5px solid var(--amber)':'1.5px solid #c0c6db',display:'inline-flex',alignItems:'center',justifyContent:'center',background:'#fff',flexShrink:0}}>
        {checked&&<span style={{width:10,height:10,borderRadius:'50%',background:'var(--amber)'}}/>}
      </span>
      <input type="radio" value={option.value} {...register('type')} onFocus={onFocus} onBlur={onBlur} aria-label={option.title} style={{position:'absolute',opacity:0,width:1,height:1}}/>
    </span>
    <span style={{fontSize:15,fontWeight:700,color:'var(--ink)'}}>{option.title}</span>
    <span style={{fontSize:12,color:'var(--muted)',lineHeight:1.6}}>{option.description}</span>
    <span style={{alignSelf:'flex-start',fontSize:10,fontWeight:600,padding:'4px 10px',borderRadius:999,background:'var(--low)',color:'var(--amber-dark)'}}>{option.badge}</span>
  </label>;
}

/** Two-option card selector bound to the same `type` field (CONTRACTOR/SUPPLIER only). */
function PartyTypeCards(){
  const {formState:{errors}}=useFormContext();
  const value=useWatch({name:'type'});
  const groupId=useId();
  const [focused,setFocused]=useState<string|null>(null);
  const error=errors.type?.message;
  return <div className="field">
    <span id={groupId} style={{fontSize:12,fontWeight:600}}>Party Type *</span>
    <div className="form-grid" role="presentation">
      {PARTY_TYPE_OPTIONS.map((option)=><PartyTypeCard key={option.value} option={option} checked={value===option.value} focused={focused===option.value} onFocus={()=>setFocused(option.value)} onBlur={()=>setFocused(null)}/>)}
    </div>
    {error&&<p className="field-error" id={groupId+'-error'} role="alert">{String(error)}</p>}
  </div>;
}

export function PartyForm({id}:{id?:string}){
const companyId=useAuthStore((s)=>s.companyId);
const {notify}=useWorkspace();
const router=useRouter();
const [initialValues,setInitialValues]=useState<z.input<typeof partyApiSchema>|undefined>(undefined);
const [loading,setLoading]=useState(!!id);
const [loadError,setLoadError]=useState<string|null>(null);
const [backendError,setBackendError]=useState<string|null>(null);
const fetchParty=useCallback(async()=>{
if(!id)return;
if(!companyId){setLoading(false);setLoadError('No company context. Please sign in again.');return;}
setLoading(true);setLoadError(null);
try{
const p=await getParty(companyId,id);
setInitialValues({name:p.name,type:p.type,phone:p.phone??'',email:p.email??'',address:p.address??'',notes:p.notes??''});
}catch(err){
if(err instanceof ApiError&&(err.status===404||err.status===422)){setLoadError('Party not found.');}
else if(err instanceof ApiError&&err.status===401){setLoadError('Your session has expired. Please sign in again.');}
else{setLoadError(friendlyMessage(err));}
}finally{setLoading(false);}
},[companyId,id]);
/* eslint-disable react-hooks/set-state-in-effect -- party prefill load on mount */
useEffect(()=>{fetchParty();},[fetchParty]);
/* eslint-enable react-hooks/set-state-in-effect */
const form=useForm<z.input<typeof partyApiSchema>,unknown,z.output<typeof partyApiSchema>>({resolver:zodResolver(partyApiSchema),values:initialValues,defaultValues:{name:'',type:'CONTRACTOR',phone:'',email:'',address:'',notes:''}});
if(id&&loading)return <p className="small" role="status" aria-live="polite">Loading party…</p>;
if(id&&(loadError||!initialValues))return <><p className="field-error" role="alert">{loadError??'Party not found.'}</p><p className="section-space"><button className="button secondary" type="button" onClick={fetchParty}>Retry</button></p></>;
return <div className="form-layout"><PageHeader title={id?'Edit Party':'Add Party'} description="Register an external contractor, supplier, or project partner." back="/app/parties"/><FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(async(v)=>{
if(!companyId){setBackendError('No company context. Please sign in again.');return;}
setBackendError(null);
try{
if(id){
await updateParty(companyId,id,mapPartyFormToUpdate(v));
notify('Party saved successfully.');
router.push('/app/parties/'+id);
}else{
const created=await createParty(companyId,mapPartyFormToCreate(v));
notify('Party saved successfully.');
router.push('/app/parties/'+created.id);
}
}catch(error){
if(error instanceof ApiError&&error.fields){
for(const [field,messages] of Object.entries(error.fields)){
if(field in v)form.setError(field as keyof typeof v,{message:messages[0]});
}
}
setBackendError(friendlyMessage(error));
}
})}><NumberedSection number={1} title="Party Information" micro="GENERAL"><Field name="name" label="Company / Entity Legal Name *"/><PartyTypeCards/><Textarea name="notes" label="Notes & Operational Brief"/></NumberedSection><NumberedSection number={2} title="Contact & Address" micro="CONTACT"><div className="form-grid"><Field name="phone" label="Phone Number" type="tel"/><Field name="email" label="Email Address" type="email"/></div><Textarea name="address" label="Physical or Depot Address"/></NumberedSection>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions onCancel={()=>router.push('/app/parties')} label={id?'Save Changes':'Add Party'} pending={form.formState.isSubmitting}/></form></FormProvider></div>;}
export function PaymentForm(){const companyId=useAuthStore((s)=>s.companyId);const companyRole=useAuthStore((s)=>s.companyRole);const {notify}=useWorkspace();const router=useRouter();const searchParams=useSearchParams();const hintProjectId=searchParams.get('projectId');const canMutate=!companyRole||canAccess(companyRole,'payments');const [projects,setProjects]=useState<Array<{id:string;name:string}>>([]);const [parties,setParties]=useState<ApiParty[]>([]);const [categories,setCategories]=useState<ApiPaymentCategory[]>([]);const [loading,setLoading]=useState(true);const [loadError,setLoadError]=useState<string|null>(null);const [backendError,setBackendError]=useState<string|null>(null);const fetchDirectory=useCallback(async()=>{if(!companyId){setLoading(false);setLoadError('No company context. Please sign in again.');return;}setLoading(true);setLoadError(null);try{const [plist,partiesList,cats]=await Promise.all([getProjects(companyId,{limit:100}),getParties(companyId),getPaymentCategories()]);setProjects(plist.map((p)=>({id:p.id,name:p.name})));setParties(partiesList);setCategories(cats);}catch(err){if(err instanceof ApiError&&err.status===401){setLoadError('Your session has expired. Please sign in again.');}else if(err instanceof ApiError&&err.status===403){setLoadError('You do not have access to payments for this company.');}else{setLoadError(friendlyMessage(err));}}finally{setLoading(false);}},[companyId]);/* eslint-disable react-hooks/set-state-in-effect -- payment options load on mount */useEffect(()=>{fetchDirectory();},[fetchDirectory]);/* eslint-enable react-hooks/set-state-in-effect */const form=useForm<z.input<typeof paymentApiSchema>,unknown,z.output<typeof paymentApiSchema>>({resolver:zodResolver(paymentApiSchema),defaultValues:{projectId:hintProjectId??'',partyId:'',categoryId:'',amount:'',paymentDate:'',reference:'',description:''}});if(!canMutate)return <EmptyState title="Not permitted" description="Your role cannot record payments."/>;if(loading)return <p className="small" role="status" aria-live="polite">Loading payment options…</p>;if(loadError)return <><p className="field-error" role="alert">{loadError}</p><p className="section-space"><button className="button secondary" type="button" onClick={fetchDirectory}>Retry</button></p></>;return <div className="form-layout"><PageHeader title="Record Payment" description="Add an outgoing payment made for a construction project." back="/app/payments"/><FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(async(v)=>{if(!companyId){setBackendError('No company context. Please sign in again.');return;}setBackendError(null);try{const created=await createPayment(companyId,v.projectId,mapPaymentFormToCreate(v));notify(v.reference?.trim()?'Payment recorded successfully. Reference: '+v.reference.trim():'Payment recorded successfully.');router.push('/app/payments/'+created.id+'?projectId='+v.projectId);}catch(error){if(error instanceof ApiError&&error.fields){for(const [field,messages] of Object.entries(error.fields)){if(field==='party_id')form.setError('partyId',{message:messages[0]});else if(field==='category_id')form.setError('categoryId',{message:messages[0]});else if(field==='payment_date')form.setError('paymentDate',{message:messages[0]});else if(field==='amount')form.setError('amount',{message:messages[0]});else if(field in v)form.setError(field as keyof typeof v,{message:messages[0]});}}setBackendError(friendlyMessage(error));}})}><NumberedSection number={1} title="Project" micro="SCOPE"><Field name="projectId" label="Project *"><option value="">Select project</option>{projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</Field></NumberedSection><NumberedSection number={2} title="Beneficiary" micro="PAYEE"><Field name="partyId" label="Party *"><option value="">Select party</option>{parties.map(p=><option value={p.id} key={p.id}>{p.name} — {p.type==='CONTRACTOR'?'Contractor':'Supplier'}</option>)}</Field><p className="small">Both contractors and suppliers can receive payments.</p></NumberedSection><NumberedSection number={3} title="Category" micro="CLASSIFICATION"><Field name="categoryId" label="Payment Category *"><option value="">Select category</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</Field><p className="small">Categories are managed by platform administrators.</p></NumberedSection><NumberedSection number={4} title="Amount" micro="AMOUNT"><Field name="amount" label="Disbursement Amount *" type="number" step="any"/></NumberedSection><NumberedSection number={5} title="Schedule & Reference" micro="SCHEDULE"><div className="form-grid"><Field name="paymentDate" label="Payment Date *" type="date"/><Field name="reference" label="Reference" placeholder="e.g. CR-PAY-015"/></div></NumberedSection><NumberedSection number={6} title="Description" micro="DETAILS"><Textarea name="description" label="Description"/></NumberedSection>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions onCancel={()=>router.push('/app/payments')} label="Record Payment" pending={form.formState.isSubmitting}/></form></FormProvider></div>;}
export function DocumentUploadForm({projectId,onClose,onSaved}:{projectId?:string;onClose:()=>void;onSaved?:()=>void}){
const companyId=useAuthStore((s)=>s.companyId);
const companyRole=useAuthStore((s)=>s.companyRole);
const {notify}=useWorkspace();
const canMutate=!companyRole||canAccess(companyRole,'documents');
const [projects,setProjects]=useState<Array<{id:string;name:string}>>([]);
const [loading,setLoading]=useState(true);
const [loadError,setLoadError]=useState<string|null>(null);
const [backendError,setBackendError]=useState<string|null>(null);
const [selectedFile,setSelectedFile]=useState<File|null>(null);
const fileInputId=useId();
const fetchProjects=useCallback(async()=>{
if(!companyId){setLoading(false);setLoadError('No company context. Please sign in again.');return;}
setLoading(true);setLoadError(null);
try{const list=await getProjects(companyId,{limit:100});setProjects(list.map((p)=>({id:p.id,name:p.name})));}
catch(err){
if(err instanceof ApiError&&err.status===401){setLoadError('Your session has expired. Please sign in again.');}
else{setLoadError(friendlyMessage(err));}
}
finally{setLoading(false);}
},[companyId]);
/* eslint-disable react-hooks/set-state-in-effect -- project options load on mount */
useEffect(()=>{fetchProjects();},[fetchProjects]);
/* eslint-enable react-hooks/set-state-in-effect */
const form=useForm<z.input<typeof documentApiSchema>,unknown,z.output<typeof documentApiSchema>>({resolver:zodResolver(documentApiSchema),defaultValues:{projectId:projectId??'',name:'',category:'',file:undefined}});
if(!canMutate)return <EmptyState title="Not permitted" description="Your role cannot upload documents."/>;
if(loading)return <p className="small" role="status" aria-live="polite">Loading projects…</p>;
if(loadError)return <><p className="field-error" role="alert">{loadError}</p><p className="section-space"><button className="button secondary" type="button" onClick={fetchProjects}>Retry</button></p></>;
const lockedName=projectId?projects.find((p)=>p.id===projectId)?.name:undefined;
return <FormProvider {...form}><form noValidate className="stack" onSubmit={form.handleSubmit(async(v)=>{
const pid=projectId??v.projectId;
if(!companyId){setBackendError('No company context. Please sign in again.');return;}
if(!pid){setBackendError('Choose a project.');return;}
if(!selectedFile){form.setError('file',{message:'Choose a file'});return;}
setBackendError(null);
try{
await uploadDocument(companyId,pid,{name:v.name,category:v.category||undefined,file:selectedFile});
notify('Document uploaded successfully.');
setSelectedFile(null);
onSaved?.();onClose();
}catch(error){
if(error instanceof ApiError&&error.status===400){form.setError('file',{message:error.detail||'Unsupported file. Use PDF, DOC, DOCX, XLS, XLSX, JPEG, PNG or WEBP.'});}
else if(error instanceof ApiError&&(error.status===404||error.status===422)){setBackendError('Project not found.');}
else{setBackendError(friendlyMessage(error));}
}
})}>{!projectId&&<NumberedSection number={1} title="Project" micro="HIERARCHY"><Field name="projectId" label="Project *"><option value="">Select project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Field></NumberedSection>}{projectId&&<p className="form-note">Project · {lockedName??projectId}</p>}<NumberedSection number={projectId?1:2} title="Document Information" micro="DETAILS"><Field name="name" label="Document Name *" placeholder="e.g. Building Permit — Revision 2"/><Field name="category" label="Category" placeholder="e.g. Permit, Plan, Contract"/></NumberedSection><NumberedSection number={projectId?2:3} title="File Upload" micro="FILE"><div className="field"><label htmlFor={fileInputId}>File Attachment *</label><input id={fileInputId} type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={(e)=>{const f=e.target.files?.[0]??null;setSelectedFile(f);form.setValue('file',f??undefined,{shouldValidate:true});}}/>{form.formState.errors.file&&<p className="field-error" role="alert">{String(form.formState.errors.file.message)}</p>}<small>PDF, DOC, DOCX, XLS, XLSX, JPEG, PNG or WEBP · 50MB frontend upload guard (no backend limit)</small></div>{selectedFile&&<p className="small">Selected: {selectedFile.name} ({(selectedFile.size/1024).toFixed(0)} KB)</p>}</NumberedSection>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions onCancel={onClose} label="Upload Document" pending={form.formState.isSubmitting}/></form></FormProvider>;}
export function CategoryForm({id,onClose}:{id?:string;onClose:()=>void}){const {data,save,notify}=useWorkspace();const form=useForm<z.input<typeof categorySchema>,unknown,z.output<typeof categorySchema>>({resolver:zodResolver(categorySchema),values:data.categories.find(c=>c.id===id),defaultValues:data.categories.find(c=>c.id===id)??{name:'',description:''}});return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(v=>{save('categories',{...v,id:id??crypto.randomUUID()});notify('Payment category saved.');onClose();})}><Field name="name" label="Category Name *"/><div className="section-space"><Textarea name="description" label="Description"/></div><FormActions onCancel={onClose} label={id?'Save Changes':'Add Category'}/></form></FormProvider>;}
export function LeadStatusForm({companyId,chain,lead,onClose,onSaved}:{companyId:string;chain:LeadChain;lead:ApiLead;onClose:()=>void;onSaved:()=>void}){const {notify}=useWorkspace();const [backendError,setBackendError]=useState<string|null>(null);const form=useForm<z.input<typeof leadStatusSchema>,unknown,z.output<typeof leadStatusSchema>>({resolver:zodResolver(leadStatusSchema),defaultValues:{status:lead.status}});return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(async(v)=>{setBackendError(null);try{await updateLead(companyId,chain,lead.id,mapLeadStatusFormToUpdate(v));notify('Lead status updated successfully.');onSaved();onClose();}catch(error){setBackendError(friendlyMessage(error));}})}><div className="form-note">{lead.name} · Current status: {LEAD_STATUS_LABEL[lead.status]}</div><Field name="status" label="Select New Status *"><option value="NEW">New — Awaiting initial sales contact</option><option value="CONTACTED">Contacted — Communication established</option><option value="CLOSED">Closed — Enquiry concluded</option></Field>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions onCancel={onClose} label="Save Status" pending={form.formState.isSubmitting}/></form></FormProvider>;}
export function LeadMessageForm({companyId,chain,lead,onClose,onSaved}:{companyId:string;chain:LeadChain;lead:ApiLead;onClose:()=>void;onSaved:()=>void}){const {notify}=useWorkspace();const [backendError,setBackendError]=useState<string|null>(null);const form=useForm<z.input<typeof leadMessageSchema>,unknown,z.output<typeof leadMessageSchema>>({resolver:zodResolver(leadMessageSchema),defaultValues:{message:lead.message??''}});return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(async(v)=>{setBackendError(null);try{await updateLead(companyId,chain,lead.id,mapLeadMessageFormToUpdate(v));notify('Lead message updated successfully.');onSaved();onClose();}catch(error){setBackendError(friendlyMessage(error));}})}><div className="form-note">{lead.name} · Contact message stored on the Lead record</div><Textarea name="message" label="Lead Message"/><p className="small">Blank messages are left unchanged on the server.</p>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions onCancel={onClose} label="Save Message" pending={form.formState.isSubmitting}/></form></FormProvider>;}
export function DocumentForm({onClose}:{onClose?:()=>void}){const {data,save,notify}=useWorkspace();const router=useRouter();const close=onClose??(()=>router.push('/app/documents'));const form=useForm<z.input<typeof documentSchema>,unknown,z.output<typeof documentSchema>>({resolver:zodResolver(documentSchema),defaultValues:{projectId:'cedar-residence',name:'',category:'Plan'}});return <FormProvider {...form}><form noValidate className="stack" onSubmit={form.handleSubmit(v=>{const file=v.file[0];save('documents',{id:crypto.randomUUID(),projectId:v.projectId,name:v.name,category:v.category,format:file.name.split('.').pop()!.toUpperCase(),size:(file.size/1024/1024).toFixed(1)+' MB',date:new Date().toISOString().slice(0,10),url:URL.createObjectURL(file)});notify('Document added to the local project registry.');close();})}><Field name="projectId" label="Project *">{data.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Field><Field name="name" label="Document Name *" placeholder="e.g. Building Permit — Revision 2"/><Field name="category" label="Category *"><option>Agreement</option><option>Plan</option><option>Permit</option><option>Other</option></Field><Field name="file" label="File Attachment *" type="file" accept=".pdf,.docx,.dwg,.xlsx,.png" hint="Supports PDF, DOCX, DWG, XLSX, PNG (Max 50MB)"/><div className="form-note">Files remain in this browser session. No upload service is connected.</div><FormActions onCancel={close} label="Upload Document"/></form></FormProvider>;}
