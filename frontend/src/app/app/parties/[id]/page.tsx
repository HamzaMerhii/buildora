import { PartyWorkspaceDetail } from '@/components/features/PartiesApi';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PartyWorkspaceDetail id={id}/>;}
