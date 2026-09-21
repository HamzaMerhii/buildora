import { CompanyForm } from '@/components/forms/AccountForms';
import { RequireAuth } from '@/components/features/RequireAuth';
export default function Page(){return <RequireAuth redirectTo="/sign-in"><div className="eyebrow">Step 2 of 3 · Company Setup</div><h1>Set up your company</h1><p>Give your workspace an identity.</p><CompanyForm setup/></RequireAuth>;}
