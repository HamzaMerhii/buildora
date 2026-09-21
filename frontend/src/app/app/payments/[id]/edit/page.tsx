import { PaymentForm } from '@/components/forms/BusinessForms';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PaymentForm id={id}/>;}
