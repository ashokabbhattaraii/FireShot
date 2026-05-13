"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAdminNav } from "@/lib/useAdminNav";
import { ViewportToggle } from "@/components/ViewportToggle";
import { PageLoading } from "@/components/ui";

const ALL_NAV = [
  { key: "overview", href: "/admin", label: "Overview", icon: "📊" },
  { key: "tournaments", href: "/admin/tournaments", label: "Tournaments", icon: "🏆" },
  { key: "payments", href: "/admin/payments", label: "Payments", icon: "💳" },
  { key: "results", href: "/admin/results", label: "Results", icon: "📋" },
  { key: "withdrawals", href: "/admin/withdrawals", label: "Withdrawals", icon: "💸" },
  { key: "reports", href: "/admin/reports", label: "Reports", icon: "📊" },
  { key: "risk-profiles", href: "/admin/finance/risk-profiles", label: "Risk Profiles", icon: "🛡️" },
  { key: "users", href: "/admin/users", label: "Users", icon: "👥" },
  { key: "banners", href: "/admin/banners", label: "Banners", icon: "🖼️" },
  { key: "flags", href: "/admin/flags", label: "Feature Flags", icon: "🚦" },
  { key: "config", href: "/admin/config", label: "System Config", icon: "⚙️" },
  { key: "schedule", href: "/admin/schedule", label: "Free Daily", icon: "📅" },
  { key: "roles", href: "/admin/roles", label: "Roles & Perms", icon: "🔐" },
  { key: "logs", href: "/admin/logs", label: "Audit Logs", icon: "📝" },
  { key: "bot", href: "/admin/bot", label: "Bot Control", icon: "🤖" },
  { key: "support", href: "/admin/support", label: "Support & Disputes", icon: "🎧" },
  { key: "referrals", href: "/admin/referrals", label: "Referrals", icon: "🎁" },
  { key: "apk-releases", href: "/admin/app-releases", label: "APK Releases", icon: "📱" },
  { key: "apk-test", href: "/admin/apk-test", label: "APK Testing", icon: "🧪" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const { nav: allowedNav, isLoading: navLoading } = useAdminNav();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const loading = authLoading || navLoading;

  const visibleNav = useMemo(() => {
    if (!allowedNav) return ALL_NAV;
    const navByKey = new Map(ALL_NAV.map((item) => [item.key, item]));
    return allowedNav
      .map((key) => navByKey.get(key))
      .filter((item): item is (typeof ALL_NAV)[number] => Boolean(item));
  }, [allowedNav]);

  const roleName = String(user?.roleRef?.name ?? user?.role ?? "PLAYER").toUpperCase();
  const workspaceLabel =
    roleName === "SUPPORT"
      ? "Support Workspace"
      : roleName === "FINANCE"
        ? "Finance Workspace"
        : roleName === "SUPER_ADMIN"
          ? "Super Admin Workspace"
          : "Admin Workspace";

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!navLoading && allowedNav && allowedNav.length === 0) {
      router.replace("/");
    }
  }, [navLoading, allowedNav, router]);

  useEffect(() => {
    if (pathname !== "/admin" || !visibleNav.length) return;

    let preferredKey = "overview";
    if (roleName === "SUPPORT") preferredKey = "support";
    else if (roleName === "FINANCE") preferredKey = "payments";

    const preferred =
      visibleNav.find((item) => item.key === preferredKey) ??
      visibleNav.find((item) => item.key !== "overview") ??
      visibleNav[0];

    if (preferred?.href && preferred.href !== pathname) {
      router.replace(preferred.href);
    }
  }, [pathname, roleName, router, visibleNav]);

  if (loading) return <PageLoading label="Checking admin access..." />;
  if (!user) return <p style={{ color: "var(--fs-red)" }}>Admin access required.</p>;

  const SidebarContent = () => (
    <>
      <div style={{ padding: "16px 12px", borderBottom: "1px solid var(--fs-border)" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "var(--fs-text-3)", textTransform: "uppercase" }}>
          Control Center
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fs-text-1)", marginTop: 4 }}>
          🔥 {workspaceLabel}
        </p>
      </div>

      <nav style={{ padding: "8px 6px", flex: 1, overflowY: "auto" }}>
        {visibleNav.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 8,
                marginBottom: 2,
                textDecoration: "none",
                background: active ? "rgba(229,57,53,0.12)" : "transparent",
                borderLeft: active ? "3px solid #E53935" : "3px solid transparent",
                color: active ? "#E53935" : "rgba(255,255,255,0.65)",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                transition: "all .15s",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "12px", borderTop: "1px solid var(--fs-border)" }}>
        <ViewportToggle />
        <Link
          href="/"
          style={{ display: "block", marginTop: 8, fontSize: 12, color: "var(--fs-text-3)", textDecoration: "none" }}
        >
          ← Back to App
        </Link>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", margin: "0 -16px" }}>
      {/* Desktop sidebar */}
      <aside
        style={{
          width: 230,
          flexShrink: 0,
          background: "var(--fs-surface-1)",
          borderRight: "1px solid var(--fs-border)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 56,
          height: "calc(100vh - 56px)",
          overflowY: "auto",
        }}
        className="hidden lg:flex"
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden" style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: 250,
              background: "var(--fs-surface-1)",
              display: "flex",
              flexDirection: "column",
              zIndex: 61,
            }}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, padding: 16 }}>
        {/* Mobile top bar */}
        <div
          className="lg:hidden"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: "1px solid var(--fs-border)",
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            style={{ fontSize: 22, background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4, minWidth: 44, minHeight: 44 }}
          >
            ☰
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--fs-text-1)" }}>{workspaceLabel}</span>
        </div>

        {children}
      </main>
    </div>
  );
}
