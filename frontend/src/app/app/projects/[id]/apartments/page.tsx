import { ApartmentsProjectList } from '@/components/features/ApartmentsApi';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ApartmentsProjectList projectId={id}/>;}
