import { Suspense } from 'react';
import { FloorForm } from '@/components/forms/StructureForms';
export default async function Page({params}:{params:Promise<{buildingId:string}>}){const {buildingId}=await params;return <Suspense fallback={<p className="small" role="status">Loading…</p>}><FloorForm buildingId={buildingId}/></Suspense>;}
