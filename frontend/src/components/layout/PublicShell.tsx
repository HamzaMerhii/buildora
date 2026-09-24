"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
export function PublicShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href:string) => href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link className="public-brand" href="/">
          <img src="/images/f049f3d28ba1.webp" alt="" />
          <span>
            Buildora<small>ENGINEERED FOR GENERATIONS</small>
          </span>
        </Link>
        <button
          className="icon-button mobile-menu"
          aria-label="Toggle navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? "open" : ""}>
          {[
            ["/", "Home"],
            ["/projects", "Projects"],
            ["/apartments", "Apartments"],
          ].map(([href, name]) => (
            <Link
              key={href}
              href={href}
              className={isActive(href) ? "active" : ""}
              aria-current={isActive(href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {name}
            </Link>
          ))}
          <Link className="button secondary" href="/sign-in">
            Workspace Login <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer className="public-footer">
        <div>
          <Link className="public-brand" href="/">
            Buildora
          </Link>
          <p>
            Precision engineering. Lasting spaces.
            <br />
            Beirut, Lebanon
          </p>
        </div>
        <div>
          <strong>Explore</strong>
          <Link href="/projects">Our projects</Link>
          <Link href="/apartments">Available apartments</Link>
        </div>
        <div>
          <strong>Connect</strong>
          <a href="mailto:info@buildora.com">
            info@buildora.com
          </a>
          <a href="tel:+9611555220">+961 1 555 220</a>
          <Link href="/sign-in">Workspace sign in</Link>
        </div>
        <small>© 2026 Buildora. All rights reserved.</small>
      </footer>
    </div>
  );
}
