import { StageWorkspaceDetail } from '@/components/features/ConstructionApi';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <StageWorkspaceDetail id={id}/>;}
