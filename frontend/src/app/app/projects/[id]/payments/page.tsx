import { ProjectPaymentsSection } from '@/components/features/PaymentsApi';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ProjectPaymentsSection projectId={id}/>;}
