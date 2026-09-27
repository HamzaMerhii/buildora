"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  HardHat,
  DoorOpen,
  Users,
  Wallet,
  Contact,
  FileText,
  Sparkles,
  Settings,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { companyRoleLabel } from "@/lib/api/company-member.api";
import { PLATFORM_ROLE_LABEL } from "@/lib/api/platform.api";
import { canAccess, NAV_MODULES } from "@/lib/auth/permissions";
import { getPostLoginRoute } from "@/lib/auth/redirect";
import { label } from "@/lib/utils/format";
const navigation = [
  {
    name: "Dashboard",
    href: "/app/dashboard",
    icon: LayoutDashboard,
    group: "",
  },
  {
    name: "Projects",
    href: "/app/projects",
    icon: Building2,
    group: "Projects",
  },
  { name: "Construction", href: "/app/construction", icon: HardHat, group: "" },
  { name: "Apartments", href: "/app/apartments", icon: DoorOpen, group: "" },
  { name: "Parties", href: "/app/parties", icon: Users, group: "Business" },
  { name: "Payments", href: "/app/payments", icon: Wallet, group: "" },
  { name: "Leads", href: "/app/leads", icon: Contact, group: "" },
  {
    name: "Documents",
    href: "/app/documents",
    icon: FileText,
    group: "Workspace",
  },
  {
    name: "AI Assistant",
    href: "/app/ai-assistant",
    icon: Sparkles,
    group: "",
  },
];
export function WorkspaceShell({
  children,
  platform = false,
}: {
  children: ReactNode;
  platform?: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const platformRole = useAuthStore((s) => s.platformRole);
  const companyRole = useAuthStore((s) => s.companyRole);
  const sessionUser = useAuthStore((s) => s.user);
  const sessionStatus = useAuthStore((s) => s.sessionStatus);
  const displayName = sessionUser?.name ?? null;
  const roleLabel = platform
    ? (platformRole ? PLATFORM_ROLE_LABEL[platformRole] : null)
    : (companyRole ? companyRoleLabel[companyRole] : null);
  const initials = displayName
    ? displayName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    : '?';
  // Dashboard entry points at the role's canonical landing page, which is
  // always allowed for that role. Other entries are filtered by permission;
  // while the session is unresolved (role null) everything stays visible and
  // the route guards remain the enforcement point.
  const dashboardHref = platform ? "/platform" : getPostLoginRoute(platformRole, companyRole);
  const canAccessSettings = platform || !companyRole || canAccess(companyRole, 'settings');
  const handleLogout = () => {
    logout();
    router.push('/sign-in');
  };
  const [open, setOpen] = useState(false);
  const activePath = path.startsWith('/app/tasks') ? '/app/construction' : path.startsWith('/app/buildings') ? '/app/projects' : path;
  const isActive = (href:string) => href === '/platform' ? path === href : activePath === href || activePath.startsWith(href + '/');
  const links = platform
    ? [
        {
          name: "Dashboard",
          href: "/platform",
          icon: LayoutDashboard,
          group: "",
        },
        {
          name: "Companies",
          href: "/platform/companies",
          icon: Building2,
          group: "Platform",
        },
        { name: "Users", href: "/platform/users", icon: Users, group: "" },
      ]
    : [
        {
          name: "Dashboard",
          href: dashboardHref,
          icon: LayoutDashboard,
          group: "",
        },
        ...navigation
          .slice(1)
          .filter(
            (item) =>
              !companyRole || canAccess(companyRole, NAV_MODULES[item.href]),
          ),
      ];
  return (
    <div className="workspace-shell">
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={"sidebar " + (open ? "is-open" : "")}>
        <Link
          href={platform ? "/platform" : "/app/dashboard"}
          className="brand"
        >
          <img src="/images/f049f3d28ba1.webp" alt="" />
          <span>
            Buildora
            <small>
              {platform ? "PLATFORM ADMINISTRATION" : "ENTERPRISE PMS"}
            </small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {links.map(({ name, href, icon: Icon, group }) => (
            <div key={href}>
              {group && group !== "Workspace" && <div className="nav-group">{group}</div>}
              <Link
                href={href}
                className={
                  isActive(href)
                    ? "active"
                    : ""
                }
                aria-current={isActive(href) ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon size={19} />
                <span>{name}</span>
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {canAccessSettings && (
          <Link href="/app/settings" className={isActive('/app/settings') ? 'active' : ''} aria-current={isActive('/app/settings') ? 'page' : undefined} onClick={()=>setOpen(false)}>
            <Settings size={18} />
            <span>Settings</span>
          </Link>
          )}
          <Link href="/sign-in" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Sign out</span>
          </Link>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>{platform ? "Platform" : "Workspace"}</span>
            <ChevronRight size={14} />
            <strong>{label(path.split("/")[2] || "Dashboard")}</strong>
          </div>
          <div className="header-actions">
            <Link
              className="icon-button"
              href="/app/ai-assistant"
              aria-label="Open AI assistant"
            >
              <Sparkles size={18} />
            </Link>
            <Link className="profile-link" href="/app/settings/profile">
              <span className="profile-text" title={displayName ?? 'User'}>
                {displayName ?? (sessionStatus === 'loading' ? '…' : 'User')}
                {roleLabel && <small>{roleLabel}</small>}
              </span>
              <span className="profile-avatar" aria-hidden="true">
                {initials}
              </span>
            </Link>
          </div>
        </header>
        <main className="workspace-content" id="main-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <ShieldCheck size={14} /> Buildora
          <span>Hamza Merhi</span>
        </footer>
      </div>
      {open && (
        <button
          className="mobile-close icon-button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
      )}
    </div>
  );
}
