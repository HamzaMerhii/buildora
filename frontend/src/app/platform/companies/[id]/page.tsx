import { PlatformCompanyDetail } from '@/components/features/Platform';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PlatformCompanyDetail id={id}/>;}
