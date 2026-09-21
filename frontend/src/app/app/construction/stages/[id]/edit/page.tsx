import { StageForm } from '@/components/forms/ConstructionForms';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <StageForm id={id}/>;}
