import Link from 'next/link';
import { EmptyState } from '@/components/ui/Primitives';
// Payment edit is intentionally unsupported (no backend PATCH endpoint).
// This route stays reserved and explains instead of faking a mutation.
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return (<><EmptyState title="Payment editing is not supported" description="Payments are read-only once recorded."/><p className="section-space"><Link className="back-link" href={'/app/payments/' + id}>Back to payment</Link></p></>);}
