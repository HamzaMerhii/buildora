import { BuildingForm } from '@/components/forms/StructureForms';
export default async function Page({params}:{params:Promise<{id:string;buildingId:string}>}){const {id,buildingId}=await params;return <BuildingForm projectId={id} id={buildingId}/>;}
