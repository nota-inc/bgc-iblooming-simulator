"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { navigationItems } from "@/lib/navigation";
import type { AppSessionUser } from "@/lib/auth-session";

import { SignOutButton } from "./sign-out-button";

function NavIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "overview":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "database":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case "sliders":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      );
    case "columns":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      );
    default:
      return null;
  }
}

type AppShellProps = {
  children: ReactNode;
  user: AppSessionUser;
};

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>
            <span className="brand-icon">α</span>
            BGC Alpha
          </h1>
          <p>ALPHA Policy Simulator</p>
        </div>

        <div className="workflow-stepper">
          <span className="workflow-stepper-label">Workflow</span>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navigationItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className="nav-link"
                data-active={active}
                href={item.href}
                key={item.href}
              >
                {item.step ? (
                  <span className="nav-step-number">{item.step}</span>
                ) : (
                  <span className="nav-icon">
                    <NavIcon icon={item.icon} />
                  </span>
                )}
                <span className="nav-link-text">
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-panel">
            <p className="user-name">{user.name}</p>
            <p className="user-meta">
              {user.email}
              <br />
              {user.roles.join(", ")}
            </p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
