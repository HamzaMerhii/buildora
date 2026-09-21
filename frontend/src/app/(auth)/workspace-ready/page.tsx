import { CheckCircle2 } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Primitives';
import { RequireAuth } from '@/components/features/RequireAuth';
export default function Page(){return <RequireAuth redirectTo="/sign-in"><div className="ready-check"><CheckCircle2 size={40}/></div><div className="eyebrow">Step 3 of 3 · Ready</div><h1>Your workspace is ready.</h1><p>Start your first project, define its structure, and bring your team together.</p><ButtonLink href="/app/dashboard">Go to Dashboard →</ButtonLink></RequireAuth>;}
