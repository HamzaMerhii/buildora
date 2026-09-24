'use client';
import { useState } from 'react';
import { useForm,FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { companySchema,companySetupSchema,memberSchema } from '@/lib/validations/company.schema';
import { profileSchema,passwordSchema } from '@/lib/validations/profile.schema';
import { useWorkspace } from '../features/WorkspaceProvider';
import { Field,CheckField,FormSection,FormActions } from './FormPrimitives';
import { createCompany } from '@/lib/api/company.api';
import { ApiError, friendlyMessage } from '@/lib/api/client';
import { label } from '@/lib/utils/format';

function SetupCompanyForm(){
  const {notify}=useWorkspace();
  const router=useRouter();
  const [backendError,setBackendError]=useState<string|null>(null);
  const form=useForm<z.infer<typeof companySetupSchema>>({resolver:zodResolver(companySetupSchema),defaultValues:{name:'',email:'',phone:'',address:''}});
  const pending=form.formState.isSubmitting;
  return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(async v=>{
    setBackendError(null);
    try{
      await createCompany({name:v.name,email:v.email,phone:v.phone,address:v.address});
      notify('Company workspace created.');
      router.push('/workspace-ready');
    }catch(error){
      if(error instanceof ApiError && error.fields){
        for(const [field,messages] of Object.entries(error.fields)){
          if(field==='name'||field==='email'||field==='phone'||field==='address'){
            form.setError(field,{message:messages[0]});
          }
        }
      }
      setBackendError(friendlyMessage(error));
    }
  })}><FormSection title="Company Information" description="Workspace identity and contact details. Only the legal name is required."><Field name="name" label="Company Legal Name *" placeholder="e.g. Cedar Construction"/><div className="form-grid"><Field name="email" label="Corporate Email" type="email" placeholder="info@company.com"/><Field name="phone" label="Phone Number" type="tel" placeholder="+961 1 555 220"/></div><Field name="address" label="Main Physical Address" placeholder="Beirut, Lebanon"/></FormSection>{backendError&&<p className="field-error" role="alert">{backendError}</p>}<FormActions pending={pending} onCancel={()=>router.push('/register')} label="Create Workspace"/></form></FormProvider>;
}

function SettingsCompanyForm(){
  const {data,save,notify}=useWorkspace();
  const router=useRouter();
  const company=data.companies[0];
  const form=useForm<z.infer<typeof companySchema>>({resolver:zodResolver(companySchema),values:company,defaultValues:company});
  return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(v=>{save('companies',{...company,...v});notify('Company information saved.');})}><FormSection title="Company Information" description="Workspace identity and contact details"><Field name="name" label="Company Legal Name *"/><Field name="category" label="Primary Category *"/><div className="form-grid"><Field name="email" label="Corporate Inquiries Email *" type="email"/><Field name="phone" label="Phone Number *" type="tel"/></div><Field name="address" label="Main Physical Address *"/></FormSection><div className="form-note">Demo settings are stored locally. Company onboarding uses the real backend API.</div><FormActions onCancel={()=>router.push('/app/dashboard')} label="Save Changes"/></form></FormProvider>;
}

export function CompanyForm({setup=false}:{setup?:boolean}){return setup?<SetupCompanyForm/>:<SettingsCompanyForm/>;}
export function MemberForm({id,onClose}:{id?:string;onClose:()=>void}){const {data,save,notify}=useWorkspace();const record=data.members.find(m=>m.id===id);const form=useForm<z.infer<typeof memberSchema>>({resolver:zodResolver(memberSchema),values:record,defaultValues:record??{name:'',email:'',role:'OTHER',active:true}});return <FormProvider {...form}><form className="stack" noValidate onSubmit={form.handleSubmit(v=>{save('members',{...v,id:id??crypto.randomUUID(),platformRole:record?.platformRole??'USER'});notify('Team member saved.');onClose();})}><Field name="name" label="Full Name *"/><Field name="email" label="Email Address *" type="email"/><Field name="role" label="Company Role *">{['OWNER','PROJECT_MANAGER','SITE_ENGINEER','SALES','FINANCE','OTHER'].map(r=><option key={r} value={r}>{label(r)}</option>)}</Field><CheckField name="active" label="Active team member"/><FormActions onCancel={onClose} label={id?'Save Changes':'Add Team Member'}/></form></FormProvider>;}
export function ProfileForm(){const {data,update,notify}=useWorkspace();const form=useForm<z.input<typeof profileSchema>,unknown,z.output<typeof profileSchema>>({resolver:zodResolver(profileSchema),values:data.profile,defaultValues:data.profile});return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(v=>{update({profile:v});notify('Personal information updated.');})}><FormSection title="Personal Information"><Field name="name" label="Full Name *"/><Field name="email" label="Email Address *" type="email"/><Field name="phone" label="Phone Number" type="tel"/></FormSection><FormActions onCancel={()=>form.reset(data.profile)} label="Update Profile"/></form></FormProvider>;}
export function PasswordForm(){const {notify}=useWorkspace();const form=useForm<z.infer<typeof passwordSchema>>({resolver:zodResolver(passwordSchema),defaultValues:{currentPassword:'',password:'',confirmPassword:''}});return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit(()=>{notify('Password form validated. This demo does not store credentials.');form.reset();})}><FormSection title="Password & Security"><Field name="currentPassword" label="Current Password" type="password" autoComplete="current-password"/><Field name="password" label="New Password" type="password" autoComplete="new-password"/><Field name="confirmPassword" label="Confirm New Password" type="password" autoComplete="new-password"/></FormSection><FormActions onCancel={()=>form.reset()} label="Change Password"/></form></FormProvider>;}
