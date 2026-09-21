'use client';
import { useState } from 'react';
import { useForm,FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2 } from 'lucide-react';
import { enquirySchema } from '@/lib/validations/lead.schema';
import { Field,Textarea } from './FormPrimitives';
import { useWorkspace } from '../features/WorkspaceProvider';
import { ButtonLink } from '../ui/Primitives';
export function EnquiryForm({apartmentId}:{apartmentId:string}){const {save}=useWorkspace();const [sent,setSent]=useState(false);const form=useForm<z.input<typeof enquirySchema>,unknown,z.output<typeof enquirySchema>>({resolver:zodResolver(enquirySchema),defaultValues:{name:'',phone:'',email:'',contactMethod:'phone',message:''}});if(sent)return <div className="empty-state"><CheckCircle2 size={45} style={{margin:'0 auto 20px',color:'#247146'}}/><h2>Enquiry Sent Successfully!</h2><p>Your interest has been added to the local leads register. Our team can review your request in this demo workspace.</p><ButtonLink href="/apartments">Browse Apartments</ButtonLink></div>;return <FormProvider {...form}><form className="stack" noValidate onSubmit={form.handleSubmit(v=>{save('leads',{id:crypto.randomUUID(),name:v.name,phone:v.phone,email:v.email,apartmentId,status:'NEW',message:v.message??'',date:new Date().toISOString().slice(0,10),notes:[]});setSent(true);})}><Field name="name" label="Full Name *" placeholder="e.g. Ahmad Khalil"/><Field name="phone" label="Phone Number" type="tel" placeholder="+961 70 123 456" hint="Provide a phone number or email address."/><Field name="email" label="Email Address" type="email" placeholder="ahmad@example.com"/><Field name="contactMethod" label="Preferred Contact Method"><option value="phone">Phone Call</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></Field><Textarea name="message" label="Specific Questions or Requests" placeholder="I would like to schedule a viewing…"/><button className="button" type="submit">Submit Enquiry →</button><p className="small">Your contact information is used to respond to this property enquiry.</p></form></FormProvider>;}
