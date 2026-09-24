import { PaymentWorkspaceDetail } from '@/components/features/PaymentsApi';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PaymentWorkspaceDetail id={id}/>;}
