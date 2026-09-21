import { ProjectNavTabs } from '@/components/features/ProjectNavTabs';
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ProjectNavTabs />
      {children}
    </>
  );
}
