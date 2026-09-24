import { TaskWorkspaceDetail } from '@/components/features/TasksApi';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <TaskWorkspaceDetail id={id}/>;}
