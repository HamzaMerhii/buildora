import { ProjectStructureApi } from '@/components/features/ProjectsApi';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ProjectStructureApi id={id}/>;}
