import { PartyDetail } from '@/components/features/Business';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PartyDetail id={id}/>;}
