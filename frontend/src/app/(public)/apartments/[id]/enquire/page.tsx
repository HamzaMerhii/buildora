import { PublicEnquiry } from '@/components/features/PublicPages';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PublicEnquiry id={id}/>;}
