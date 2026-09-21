import { WorkspaceShell } from '@/components/layout/WorkspaceShell';
import { RequireAuth, RequireModuleAccess, RequireSession } from '@/components/features/RequireAuth';
export default function Layout({children}:{children:React.ReactNode}){return <RequireAuth><RequireSession><RequireModuleAccess><WorkspaceShell>{children}</WorkspaceShell></RequireModuleAccess></RequireSession></RequireAuth>;}
