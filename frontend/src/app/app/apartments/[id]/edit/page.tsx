import { ApartmentForm } from '@/components/forms/ApartmentForm';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ApartmentForm id={id}/>;}
