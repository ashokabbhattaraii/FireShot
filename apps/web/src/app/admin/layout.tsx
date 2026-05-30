"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAdminNav } from "@/lib/useAdminNav";
import { ViewportToggle } from "@/components/ViewportToggle";
import { PageLoading } from "@/components/ui";

const NAV_GROUPS = [
  {
    label: "Core",
    items: [
      { key: "overview", href: "/admin", label: "Overview", icon: "📊" },
    ],
  },
  {
    label: "Matches",
    items: [
      { key: "tournaments", href: "/admin/tournaments", label: "Tournaments", icon: "🏆" },
      { key: "results", href: "/admin/results", label: "Results", icon: "📋" },
      { key: "schedule", href: "/admin/schedule", label: "Free Daily", icon: "📅" },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: "payments", href: "/admin/payments", label: "Payments", icon: "💳" },
      { key: "withdrawals", href: "/admin/withdrawals", label: "Withdrawals", icon: "💸" },
      { key: "reports", href: "/admin/reports", label: "Reports", icon: "📈" },
      { key: "risk-profiles", href: "/admin/finance/risk-profiles", label: "Risk Profiles", icon: "🛡️" },
      { key: "referrals", href: "/admin/referrals", label: "Referrals", icon: "🎁" },
    ],
  },
  {
    label: "Users",
    items: [
      { key: "users", href: "/admin/users", label: "Users", icon: "👥" },
      { key: "roles", href: "/admin/roles", label: "Roles & Perms", icon: "🔐" },
      { key: "support", href: "/admin/support", label: "Support", icon: "🎧" },
    ],
  },
  {
    label: "System",
    items: [
      { key: "config", href: "/admin/config", label: "System Config", icon: "⚙️" },
      { key: "flags", href: "/admin/flags", label: "Feature Flags", icon: "🚦" },
      { key: "banners", href: "/admin/banners", label: "Banners", icon: "🖼️" },
      { key: "bot", href: "/admin/bot", label: "Bot Control", icon: "🤖" },
      { key: "logs", href: "/admin/logs", label: "Audit Logs", icon: "📝" },
      { key: "apk-releases", href: "/admin/app-releases", label: "APK Releases", icon: "📱" },
      { key: "apk-test", href: "/admin/apk-test", label: "APK Testing", icon: "🧪" },
    ],
  },
];

// Flat list for permission filtering
const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { nav: allowedNav, isLoading: navLoading } = useAdminNav();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const loading = authLoading || navLoading;

  const allowedKeys = useMemo(() => {
    if (!allowedNav) return null;
    return new Set(allowedNav);
  }, [allowedNav]);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => !allowedKeys || allowedKeys.has(item.key)),
    })).filter((group) => group.items.length > 0);
  }, [allowedKeys]);

  const mobileNavItems = useMemo(() => {
    return visibleGroups.flatMap((group) => group.items);
  }, [visibleGroups]);

  const roleName = String(user?.roleRef?.name ?? user?.role ?? "PLAYER").toUpperCase();
  const workspaceLabel =
    roleName === "SUPPORT" ? "Support Workspace"
    : roleName === "FINANCE" ? "Finance Workspace"
    : roleName === "SUPER_ADMIN" ? "Super Admin"
    : "Admin Workspace";

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!navLoading && allowedNav && allowedNav.length === 0) router.replace("/");
  }, [navLoading, allowedNav, router]);

  useEffect(() => {
    if (pathname !== "/admin" || !visibleGroups.length) return;
    const allItems = visibleGroups.flatMap((g) => g.items);
    let preferredKey = "overview";
    if (roleName === "SUPPORT") preferredKey = "support";
    else if (roleName === "FINANCE") preferredKey = "payments";
    const preferred =
      allItems.find((item) => item.key === preferredKey) ??
      allItems.find((item) => item.key !== "overview") ??
      allItems[0];
    if (preferred?.href && preferred.href !== pathname) router.replace(preferred.href);
  }, [pathname, roleName, router, visibleGroups]);

  if (loading) return <PageLoading label="Checking admin access..." />;
  if (!user) return <p style={{ color: "var(--fs-red)" }}>Admin access required.</p>;

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo / workspace */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
            🔥 FireSlot
          </p>
          <p className="mt-0.5 text-sm font-semibold text-white">{workspaceLabel}</p>
        </div>
        <button
          className="lg:hidden rounded p-1 text-white/50 hover:text-white"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all mb-0.5 ${
                    active
                      ? "border-l-2 border-[#E53935] bg-[rgba(229,57,53,0.12)] text-[#E53935] font-semibold"
                      : "border-l-2 border-transparent text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.07] px-3 py-3 space-y-2">
        <ViewportToggle />
        <Link
          href="/"
          className="block text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          ← Back to App
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ margin: "0 -16px" }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col border-r border-white/[0.07] bg-[var(--fs-surface-1)] sticky top-0 h-screen overflow-hidden">
        <SidebarContent />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-[var(--fs-surface-1)] shadow-2xl z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar with section header and horizontal sub-nav */}
        <div className="lg:hidden sticky top-0 z-40 bg-[var(--fs-surface-1)]/90 backdrop-blur-md border-b border-white/[0.07]">
          {/* Brand/Hamburger row */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 hover:text-white transition-colors bg-white/[0.02]"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-white tracking-wide">FireSlot</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#E53935]/10 text-[#E53935] uppercase tracking-wider">
                  Admin
                </span>
              </div>
            </div>
            <span className="text-xs font-semibold text-white/50">{workspaceLabel}</span>
          </div>

          {/* Horizontal scroll sub-nav */}
          <div className="flex items-center gap-2 overflow-x-auto px-4 pb-2.5 scrollbar-none">
            {mobileNavItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all shrink-0 border ${
                    active
                      ? "border-[#E53935]/30 bg-[#E53935]/15 text-white font-semibold shadow-[0_0_10px_rgba(229,57,53,0.15)]"
                      : "border-transparent bg-white/[0.02] text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="text-sm leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Page content with max-width */}
        <div className="mx-auto max-w-[1100px] px-4 py-6 lg:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
