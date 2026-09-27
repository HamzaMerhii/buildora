import '@/styles/public.css';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="buildora-public">{children}</div>;
}