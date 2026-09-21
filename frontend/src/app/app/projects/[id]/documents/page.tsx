import { DocumentsList } from '@/components/features/LeadsDocuments';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <DocumentsList projectId={id}/>;}
