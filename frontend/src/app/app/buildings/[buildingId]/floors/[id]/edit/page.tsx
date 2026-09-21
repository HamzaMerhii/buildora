import { Suspense } from 'react';
import { FloorForm } from '@/components/forms/StructureForms';
export default async function Page({params}:{params:Promise<{buildingId:string;id:string}>}){const {buildingId,id}=await params;return <Suspense fallback={<p className="small" role="status">Loading…</p>}><FloorForm id={id} buildingId={buildingId}/></Suspense>;}
