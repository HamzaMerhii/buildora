import { WorkspaceShell } from '@/components/layout/WorkspaceShell';
import { RequireAuth, RequirePlatformAdmin } from '@/components/features/RequireAuth';
export default function Layout({children}:{children:React.ReactNode}){return <RequireAuth><RequirePlatformAdmin><WorkspaceShell platform>{children}</WorkspaceShell></RequirePlatformAdmin></RequireAuth>;}
