import { ApartmentDetail } from '@/components/features/Apartments';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <div className="public-container"><ApartmentDetail id={id} publicView/></div>;}
